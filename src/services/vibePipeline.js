import { getLensRegistry, getLensSchemaById, getPrimitiveSchemas } from './analysisSchemaRegistry';
import { resolveIntentToLenses } from './lensRouting';
import {
    getPrimitiveAnalysisStore,
    getLensResult,
    saveLensResult,
} from '../lib/storage';
import { pushPipelineDebugEvent } from './pipelineDebug';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const VIBE_CHAT_MODEL = import.meta.env.VITE_GEMINI_VIBE_CHAT_MODEL || 'gemini-2.0-flash';
const STAGE_B_MODEL = import.meta.env.VITE_GEMINI_STAGE_B_MODEL || 'gemini-2.5-pro';
const VIBE_RUNS_KEY = 'dreamlab_vibe_runs';

const STAGE_B_BASE_DELAY_MS = 22000;
const STAGE_B_MAX_RETRIES = 2;
const STAGE_B_MAX_BACKOFF_MS = 120000;
const STAGE_B_RATE_LIMIT_COOLDOWN_MS = 90000;
const MAX_STORED_VIBE_RUNS = 40;

const stageBQueue = [];
let isProcessingStageBQueue = false;
let lastStageBCallAt = 0;
let stageBRateLimitBackoffMs = 0;
let stageBRateLimitedUntil = 0;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey() {
    const envKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (envKey) return envKey;

    try {
        const settings = JSON.parse(localStorage.getItem('autoTaggingSettings') || '{}');
        if (settings.geminiApiKey) return settings.geminiApiKey;
    } catch {
        // Ignore parse failures.
    }

    return '';
}

function stripCodeFences(text) {
    const raw = String(text || '').trim();
    if (!raw.startsWith('```')) return raw;
    return raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}

function readVibeRuns() {
    try {
        const raw = localStorage.getItem(VIBE_RUNS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeVibeRuns(runs) {
    try {
        localStorage.setItem(VIBE_RUNS_KEY, JSON.stringify(runs));
        window.dispatchEvent(new Event('storage-update'));
    } catch {
        // Keep vibe run state best-effort.
    }
}

function upsertVibeRun(runPatch) {
    const runs = readVibeRuns();
    const index = runs.findIndex((run) => run.id === runPatch.id);
    if (index >= 0) {
        runs[index] = {
            ...runs[index],
            ...runPatch,
            updatedAt: Date.now(),
        };
    } else {
        runs.unshift({
            ...runPatch,
            updatedAt: Date.now(),
        });
    }
    writeVibeRuns(runs.slice(0, MAX_STORED_VIBE_RUNS));
}

export function getVibeRuns(workspaceId = null, projectId = null) {
    const runs = readVibeRuns();
    return runs.filter((run) => {
        if (workspaceId && run.workspaceId !== workspaceId) return false;
        if (projectId && run.projectId !== projectId) return false;
        return true;
    });
}

export function getLatestVibeRun(workspaceId = null, projectId = null) {
    const runs = getVibeRuns(workspaceId, projectId);
    return runs.length > 0 ? runs[0] : null;
}

export function getStageBQueueStatus() {
    return {
        pending: stageBQueue.length,
        isProcessing: isProcessingStageBQueue,
        nextAllowedAt: Math.max(
            lastStageBCallAt + STAGE_B_BASE_DELAY_MS + stageBRateLimitBackoffMs,
            stageBRateLimitedUntil
        ),
    };
}

async function waitForStageBSlot() {
    const elapsed = Date.now() - lastStageBCallAt;
    const rateLimitWait = Math.max(0, stageBRateLimitedUntil - Date.now());
    const waitMs = Math.max(0, STAGE_B_BASE_DELAY_MS - elapsed) + stageBRateLimitBackoffMs + rateLimitWait;
    if (waitMs > 0) await sleep(waitMs);
}

function onStageBCallSuccess() {
    lastStageBCallAt = Date.now();
    if (stageBRateLimitBackoffMs > 0) {
        stageBRateLimitBackoffMs = Math.max(0, Math.floor(stageBRateLimitBackoffMs * 0.6) - 600);
    }
}

function onStageBCallRateLimited() {
    lastStageBCallAt = Date.now();
    stageBRateLimitBackoffMs = Math.min(
        STAGE_B_MAX_BACKOFF_MS,
        stageBRateLimitBackoffMs > 0 ? Math.ceil(stageBRateLimitBackoffMs * 1.8) : 15000
    );
    stageBRateLimitedUntil = Math.max(
        stageBRateLimitedUntil,
        Date.now() + STAGE_B_RATE_LIMIT_COOLDOWN_MS
    );
}

async function callGeminiJson({ model, apiKey, prompt, maxOutputTokens = 4096 }) {
    await waitForStageBSlot();
    const response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens,
                responseMimeType: 'application/json',
            },
        }),
    });

    if (response.status === 429) {
        let message = 'Gemini rate limited (429)';
        try {
            const payload = await response.json();
            message = payload?.error?.message || message;
        } catch {
            // Keep fallback message.
        }
        onStageBCallRateLimited();
        const error = new Error(message);
        error.code = 429;
        throw error;
    }

    if (!response.ok) {
        let message = `Gemini API error (${response.status})`;
        try {
            const payload = await response.json();
            message = payload?.error?.message || message;
        } catch {
            // Keep fallback message.
        }
        onStageBCallSuccess();
        const error = new Error(message);
        error.code = response.status;
        throw error;
    }

    onStageBCallSuccess();
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) {
        const error = new Error('Gemini returned empty response.');
        error.code = 'EMPTY';
        throw error;
    }

    const parsed = JSON.parse(stripCodeFences(text));
    return { parsed, raw: data };
}

async function callGeminiJsonWithRetry({ model, apiKey, prompt, maxOutputTokens = 4096 }) {
    let lastError = null;
    for (let attempt = 0; attempt <= STAGE_B_MAX_RETRIES; attempt += 1) {
        try {
            return await callGeminiJson({ model, apiKey, prompt, maxOutputTokens });
        } catch (error) {
            lastError = error;
            if (attempt < STAGE_B_MAX_RETRIES) {
                const retryWait = error?.code === 429
                    ? Math.max(
                        Math.min(STAGE_B_MAX_BACKOFF_MS, stageBRateLimitBackoffMs || (15000 * (attempt + 1))),
                        Math.max(0, stageBRateLimitedUntil - Date.now())
                    )
                    : (3000 * (attempt + 1));
                await sleep(retryWait);
            }
        }
    }
    throw lastError || new Error('Unknown Stage B Gemini error.');
}

function getRegistryEntries() {
    const wrapper = getLensRegistry() || {};
    const registry = wrapper || {};
    const sections = [
        { lensType: 'domain', bucket: registry.domain_lenses },
        { lensType: 'style', bucket: registry.style_lenses },
        { lensType: 'structural', bucket: registry.structural_lenses },
    ];

    return sections.flatMap(({ lensType, bucket }) => (
        (bucket?.lenses || []).map((entry) => ({
            ...entry,
            lensType,
            summary: entry.summary || '',
            trigger_keywords: Array.isArray(entry.trigger_keywords) ? entry.trigger_keywords : [],
        }))
    ));
}

function toLensConfig(entry) {
    if (!entry?.id) return null;
    return {
        id: entry.id,
        lensType: entry.lensType || null,
        costTier: entry.cost_tier || 'medium',
        summary: entry.summary || '',
        file: entry.file,
        schema: getLensSchemaById(entry.id),
        requiresTargetContext: Boolean(entry.requires_target_context),
        minimumImages: entry.minimum_images || 1,
        operatesOn: entry.operates_on || 'single_image',
        dependencies: Array.isArray(entry.depends_on) ? entry.depends_on : [],
    };
}

function tokenize(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length > 1);
}

function normalizeVector(vector) {
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + (value * value), 0));
    if (!norm) return vector;
    return vector.map((value) => value / norm);
}

function hashToken(token) {
    let hash = 0;
    for (let i = 0; i < token.length; i += 1) {
        hash = ((hash << 5) - hash) + token.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function textToVector(text, dims = 48) {
    const vector = Array(dims).fill(0);
    tokenize(text).forEach((token) => {
        const index = hashToken(token) % dims;
        vector[index] += 1;
    });
    return normalizeVector(vector);
}

function cosineSimilarity(a = [], b = []) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
    let dot = 0;
    for (let i = 0; i < a.length; i += 1) {
        dot += a[i] * b[i];
    }
    return Math.max(-1, Math.min(1, dot));
}

function flattenPrimitiveText(record) {
    const primitives = record?.primitives || {};
    return Object.values(primitives)
        .map((entry) => JSON.stringify(entry?.data || {}))
        .join(' ');
}

function getPrimitiveConfidence(record) {
    const primitives = record?.primitives || {};
    const values = Object.values(primitives)
        .map((entry) => Number(entry?.confidence || 0))
        .filter((value) => Number.isFinite(value));
    if (values.length === 0) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getPrimitiveCompleteness(record) {
    const primitives = record?.primitives || {};
    const total = getPrimitiveSchemas().length;
    if (total === 0) return 0;
    const ready = Object.values(primitives).filter((entry) => entry?.status === 'ready').length;
    return ready / total;
}

function scoreRelevance(focusStatement, primitiveText) {
    const focusTokens = new Set(tokenize(focusStatement));
    if (focusTokens.size === 0) return 0.5;

    const primitiveTokens = new Set(tokenize(primitiveText));
    let overlap = 0;
    focusTokens.forEach((token) => {
        if (primitiveTokens.has(token)) overlap += 1;
    });

    return Math.min(1, overlap / Math.max(4, focusTokens.size));
}

export function selectAnchorImages(items = [], options = {}) {
    const {
        focusStatement = '',
        maxAnchors = 5,
        minConfidence = 0.5,
        duplicateSimilarityThreshold = 0.92,
        mmrLambda = 0.7,
    } = options;

    const primitiveStore = getPrimitiveAnalysisStore();
    const candidates = (Array.isArray(items) ? items : [])
        .filter((item) => item?.type === 'image' && item?.imageHash)
        .map((item) => {
            const record = primitiveStore[item.imageHash];
            if (!record) return null;

            const primitiveText = flattenPrimitiveText(record);
            const vector = textToVector(primitiveText);
            const confidence = getPrimitiveConfidence(record);
            const completeness = getPrimitiveCompleteness(record);
            const relevance = scoreRelevance(focusStatement, primitiveText);
            const quality = (0.6 * confidence) + (0.4 * completeness);
            const baseScore = (0.55 * relevance) + (0.45 * quality);

            return {
                item,
                record,
                vector,
                confidence,
                completeness,
                relevance,
                quality,
                baseScore,
            };
        })
        .filter(Boolean);

    if (candidates.length === 0) return [];

    const filtered = candidates.filter((candidate) => candidate.confidence >= minConfidence);
    const working = filtered.length > 0 ? filtered : candidates;

    const deduped = [];
    working.forEach((candidate) => {
        const isDuplicate = deduped.some((existing) => (
            existing.item.imageHash === candidate.item.imageHash
            || cosineSimilarity(existing.vector, candidate.vector) >= duplicateSimilarityThreshold
        ));
        if (!isDuplicate) deduped.push(candidate);
    });

    const limit = Math.max(1, Math.min(8, Number(maxAnchors) || 5));
    const selected = [];
    const remaining = [...deduped];

    while (selected.length < limit && remaining.length > 0) {
        let bestIndex = 0;
        let bestScore = -Infinity;

        remaining.forEach((candidate, index) => {
            const maxSimilarityToSelected = selected.length === 0
                ? 0
                : Math.max(...selected.map((sel) => cosineSimilarity(sel.vector, candidate.vector)));
            const novelty = 1 - maxSimilarityToSelected;
            const mmrScore = (mmrLambda * candidate.baseScore) + ((1 - mmrLambda) * novelty);
            if (mmrScore > bestScore) {
                bestScore = mmrScore;
                bestIndex = index;
            }
        });

        const [picked] = remaining.splice(bestIndex, 1);
        selected.push({
            ...picked,
            mmrScore: bestScore,
        });
    }

    return selected.map((entry) => ({
        itemId: entry.item.id,
        imageHash: entry.item.imageHash,
        sourceUrl: entry.item.sourceUrl || null,
        previewUrl: entry.item.content || null,
        title: entry.item.title || null,
        relevance: Number(entry.relevance.toFixed(3)),
        quality: Number(entry.quality.toFixed(3)),
        score: Number(entry.mmrScore.toFixed(3)),
        confidence: Number(entry.confidence.toFixed(3)),
    }));
}

async function hashText(text) {
    const payload = new TextEncoder().encode(String(text || ''));
    const digest = await crypto.subtle.digest('SHA-256', payload);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function buildCompactSchemaShape(node) {
    if (Array.isArray(node)) {
        if (node.length === 0) return [];
        return [buildCompactSchemaShape(node[0])];
    }
    if (node && typeof node === 'object') {
        return Object.entries(node).reduce((acc, [key, value]) => {
            acc[key] = buildCompactSchemaShape(value);
            return acc;
        }, {});
    }
    if (typeof node === 'string') {
        const normalized = node.trim().toLowerCase();
        if (normalized.startsWith('number') || normalized.startsWith('integer')) return 'number';
        if (normalized.startsWith('boolean')) return 'boolean';
        if (normalized.startsWith('array')) return 'array';
        if (normalized.startsWith('object')) return 'object';
    }
    return 'string';
}

async function resolveLensesWithChat(focusStatement, maxLenses = 4) {
    const entries = getRegistryEntries();
    const apiKey = getApiKey();
    const fallback = resolveIntentToLenses(focusStatement).slice(0, maxLenses);

    if (!apiKey || entries.length === 0 || !String(focusStatement || '').trim()) {
        return {
            assistantReply: fallback.length
                ? `Selected lenses: ${fallback.map((lens) => lens.id).join(', ')}.`
                : 'No lens match found. Defaulting to aesthetic fingerprint.',
            lenses: fallback,
            source: 'keyword_fallback',
        };
    }

    const prompt = [
        'You are a lens router for a design analysis system.',
        'Given the user focus statement and available lenses, choose the most relevant lenses.',
        `Return valid JSON with keys: assistant_reply (string), selected_lens_ids (string array).`,
        `Do not include markdown.`,
        '',
        `Focus statement: "${String(focusStatement || '').trim()}"`,
        '',
        'Available lenses:',
        JSON.stringify(entries, null, 2),
        '',
        `Constraints:`,
        `- Select 1 to ${Math.max(1, Number(maxLenses) || 4)} lens IDs.`,
        '- Prefer precision over quantity.',
        '- Include aesthetic_fingerprint if focus is broad or vibe-oriented.',
    ].join('\n');

    try {
        const { parsed } = await callGeminiJsonWithRetry({
            model: VIBE_CHAT_MODEL,
            apiKey,
            prompt,
            maxOutputTokens: 900,
        });

        const selectedIds = Array.isArray(parsed?.selected_lens_ids)
            ? parsed.selected_lens_ids.map((id) => String(id || '').trim()).filter(Boolean)
            : [];

        const knownIds = new Set(entries.map((entry) => entry.id));
        const validatedIds = selectedIds.filter((id) => knownIds.has(id)).slice(0, maxLenses);
        const resolved = validatedIds.length > 0
            ? validatedIds
                .map((id) => entries.find((entry) => entry.id === id))
                .map((entry) => toLensConfig(entry))
                .filter(Boolean)
            : fallback;

        return {
            assistantReply: String(parsed?.assistant_reply || '').trim()
                || `Selected lenses: ${resolved.map((lens) => lens.id).join(', ')}.`,
            lenses: resolved,
            source: validatedIds.length > 0 ? 'chat_router' : 'keyword_fallback',
        };
    } catch (error) {
        pushPipelineDebugEvent('stageB:lens_router_fallback', 'Lens chat router failed; fallback to keyword routing.', {
            error: error?.message || 'unknown_router_error',
        });
        return {
            assistantReply: fallback.length
                ? `Selected lenses: ${fallback.map((lens) => lens.id).join(', ')}.`
                : 'No lens match found. Defaulting to aesthetic fingerprint.',
            lenses: fallback,
            source: 'keyword_fallback',
        };
    }
}

function pickPrimitiveBlocksForLens(record, lensConfig) {
    const primitives = record?.primitives || {};
    const requested = Array.isArray(lensConfig?.schema?.reads_from_primitives)
        ? lensConfig.schema.reads_from_primitives
        : Object.keys(primitives);

    return requested.reduce((acc, key) => {
        const entry = primitives[key];
        if (!entry || entry.status !== 'ready') return acc;
        acc[key] = {
            version: entry.version,
            confidence: entry.confidence,
            data: entry.data,
        };
        return acc;
    }, {});
}

function buildLensPrompt({ lensConfig, focusStatement, anchors, primitiveStore }) {
    const compactOutputSchema = buildCompactSchemaShape(lensConfig?.schema?.output_schema || {});
    const rules = Array.isArray(lensConfig?.schema?.gemini_instructions?.rules)
        ? lensConfig.schema.gemini_instructions.rules.slice(0, 6)
        : [];

    const anchorPayload = anchors.map((anchor) => {
        const record = primitiveStore[anchor.imageHash] || null;
        return {
            item_id: anchor.itemId,
            image_hash: anchor.imageHash,
            source_url: anchor.sourceUrl,
            anchor_score: anchor.score,
            primitives: pickPrimitiveBlocksForLens(record, lensConfig),
        };
    });

    return [
        `You are running Stage B lens analysis for lens "${lensConfig?.id}".`,
        `Focus statement: "${focusStatement}"`,
        `Lens role: ${lensConfig?.schema?.gemini_instructions?.role || 'Interpret primitives for this lens.'}`,
        `Lens task: ${lensConfig?.schema?.gemini_instructions?.task || 'Generate lens interpretation.'}`,
        '',
        'Critical rules:',
        ...(rules.length > 0 ? rules.map((rule) => `- ${rule}`) : ['- Use primitive data as source of truth.']),
        '',
        'Anchor inputs (selected images with primitive data):',
        JSON.stringify(anchorPayload, null, 2),
        '',
        'Return valid JSON only. Match this compact output shape:',
        JSON.stringify(compactOutputSchema, null, 2),
    ].join('\n');
}

async function runSingleLensAnalysis({ run, lensConfig, anchors, apiKey, primitiveStore }) {
    const focusHash = await hashText(run.focusStatement || '');
    const anchorHash = await hashText(anchors.map((anchor) => anchor.imageHash).join('|'));
    const lensVersion = lensConfig?.schema?.version || '1.0.0';
    const cacheKey = `stageb:${run.workspaceId || 'workspace'}:${run.projectId || 'project'}:${lensConfig.id}:${lensVersion}:${focusHash}:${anchorHash}`;
    const cached = getLensResult(cacheKey);
    if (cached) {
        pushPipelineDebugEvent('stageB:lens_cached', 'Stage B lens output served from cache.', {
            runId: run.id,
            lensId: lensConfig.id,
            cacheKey,
        });
        return {
            status: 'cached',
            cacheKey,
            output: cached,
            model: cached?.model || null,
        };
    }

    const prompt = buildLensPrompt({
        lensConfig,
        focusStatement: run.focusStatement,
        anchors,
        primitiveStore,
    });

    const { parsed, raw } = await callGeminiJsonWithRetry({
        model: STAGE_B_MODEL,
        apiKey,
        prompt,
        maxOutputTokens: 3200,
    });

    const payload = {
        lens: lensConfig.id,
        lensVersion,
        model: STAGE_B_MODEL,
        focusStatement: run.focusStatement,
        anchors,
        output: parsed,
        raw,
        analyzedAt: new Date().toISOString(),
    };

    saveLensResult(cacheKey, payload);
    return {
        status: 'ready',
        cacheKey,
        output: payload,
        model: STAGE_B_MODEL,
    };
}

async function processStageBQueue() {
    if (stageBQueue.length === 0) {
        isProcessingStageBQueue = false;
        return;
    }

    isProcessingStageBQueue = true;
    const task = stageBQueue.shift();
    if (!task) {
        setTimeout(processStageBQueue, 200);
        return;
    }

    const { runId, selectedLenses: queuedLensConfigs } = task;
    const runs = readVibeRuns();
    const current = runs.find((run) => run.id === runId);
    if (!current) {
        setTimeout(processStageBQueue, 200);
        return;
    }

    const apiKey = getApiKey();
    if (!apiKey) {
        upsertVibeRun({
            ...current,
            status: 'failed',
            error: 'Gemini API key is not configured.',
            finishedAt: Date.now(),
        });
        pushPipelineDebugEvent('stageB:run_failed', 'Vibe run failed: missing API key.', { runId });
        setTimeout(processStageBQueue, 200);
        return;
    }

    upsertVibeRun({
        ...current,
        status: 'processing',
        startedAt: current.startedAt || Date.now(),
    });

    pushPipelineDebugEvent('stageB:run_started', 'Vibe run processing started.', {
        runId,
        lensCount: current?.selectedLensIds?.length || 0,
        anchorCount: current?.anchors?.length || 0,
    });

    const primitiveStore = getPrimitiveAnalysisStore();
    const fallbackLenses = resolveIntentToLenses(current.focusStatement || '')
        .filter((lens) => current.selectedLensIds.includes(lens.id));
    const lenses = Array.isArray(queuedLensConfigs) && queuedLensConfigs.length > 0
        ? queuedLensConfigs
        : fallbackLenses;

    const outputs = Array.isArray(current.outputs) ? [...current.outputs] : [];
    let failedCount = 0;

    for (const lensConfig of lenses) {
        try {
            pushPipelineDebugEvent('stageB:lens_started', 'Stage B lens execution started.', {
                runId,
                lensId: lensConfig.id,
            });

            const result = await runSingleLensAnalysis({
                run: current,
                lensConfig,
                anchors: current.anchors || [],
                apiKey,
                primitiveStore,
            });

            outputs.push({
                lensId: lensConfig.id,
                status: result.status,
                cacheKey: result.cacheKey,
                model: result.model || null,
                updatedAt: Date.now(),
            });

            pushPipelineDebugEvent('stageB:lens_done', 'Stage B lens execution completed.', {
                runId,
                lensId: lensConfig.id,
                status: result.status,
            });
        } catch (error) {
            failedCount += 1;
            outputs.push({
                lensId: lensConfig.id,
                status: 'failed',
                error: error?.message || 'unknown_stage_b_error',
                updatedAt: Date.now(),
            });
            pushPipelineDebugEvent('stageB:lens_failed', 'Stage B lens execution failed.', {
                runId,
                lensId: lensConfig.id,
                error: error?.message || 'unknown_stage_b_error',
            });
        }
    }

    const finalStatus = failedCount === 0
        ? 'done'
        : (failedCount < lenses.length ? 'partial' : 'failed');

    upsertVibeRun({
        ...current,
        status: finalStatus,
        outputs,
        finishedAt: Date.now(),
        error: finalStatus === 'failed' ? 'All lens runs failed.' : null,
    });

    pushPipelineDebugEvent('stageB:run_finished', 'Vibe run finished.', {
        runId,
        status: finalStatus,
        totalLenses: lenses.length,
        failedLenses: failedCount,
    });

    setTimeout(processStageBQueue, 300);
}

export async function prepareVibePlan({
    focusStatement = '',
    items = [],
    maxLenses = 4,
    maxAnchors = 5,
}) {
    const trimmedFocus = String(focusStatement || '').trim();
    const routing = await resolveLensesWithChat(trimmedFocus, maxLenses);
    const anchors = selectAnchorImages(items, {
        focusStatement: trimmedFocus,
        maxAnchors,
    });
    const eligibleLenses = routing.lenses.filter((lens) => (
        anchors.length >= Math.max(1, Number(lens?.minimumImages) || 1)
    ));
    const finalLenses = eligibleLenses.length > 0 ? eligibleLenses : routing.lenses;

    return {
        focusStatement: trimmedFocus,
        assistantReply: routing.assistantReply,
        selectedLenses: finalLenses.slice(0, maxLenses),
        anchors,
        routerSource: routing.source,
    };
}

export function queueVibeAnalysisRun({
    workspaceId,
    projectId = null,
    focusStatement,
    selectedLenses = [],
    anchors = [],
}) {
    const normalizedLenses = (Array.isArray(selectedLenses) ? selectedLenses : []).map((lens) => ({
        id: lens.id,
        lensType: lens.lensType,
        costTier: lens.costTier,
        summary: lens.summary,
        file: lens.file,
        schema: lens.schema || null,
        requiresTargetContext: Boolean(lens.requiresTargetContext),
        minimumImages: lens.minimumImages || 1,
        operatesOn: lens.operatesOn || 'single_image',
        dependencies: Array.isArray(lens.dependencies) ? lens.dependencies : [],
    }));

    const run = {
        id: `vibe_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        workspaceId: workspaceId || null,
        projectId: projectId || null,
        focusStatement: String(focusStatement || '').trim(),
        selectedLensIds: normalizedLenses.map((lens) => lens.id),
        anchors,
        outputs: [],
        status: 'queued',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };

    upsertVibeRun(run);
    stageBQueue.push({ runId: run.id, selectedLenses: normalizedLenses });

    pushPipelineDebugEvent('stageB:queued', 'Vibe run queued for Stage B.', {
        runId: run.id,
        lensCount: run.selectedLensIds.length,
        anchorCount: anchors.length,
        queueDepth: stageBQueue.length,
    });

    if (!isProcessingStageBQueue) {
        processStageBQueue();
    }

    return run;
}
