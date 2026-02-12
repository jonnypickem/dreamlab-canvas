import { createHash } from 'crypto';
import fsSync from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRIMITIVE_SCHEMA_DIR = path.resolve(__dirname, '../analysis_parameters/primitive_schemas');
const ROOT_ENV_FILE = path.resolve(__dirname, '../.env');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const STAGE_A_MODEL = process.env.VITE_GEMINI_STAGE_A_MODEL || process.env.GEMINI_STAGE_A_MODEL || 'gemini-2.5-pro';
const STAGE_A_BASE_DELAY_MS = Number(process.env.STAGE_A_BASE_DELAY_MS || 30000);
const STAGE_A_MAX_PROMPT_CHARS = Number(process.env.STAGE_A_MAX_PROMPT_CHARS || 26000);
const STAGE_A_MAX_RETRIES = Number(process.env.STAGE_A_MAX_RETRIES || 2);
const STAGE_A_MAX_BACKOFF_MS = Number(process.env.STAGE_A_MAX_BACKOFF_MS || 180000);
const STAGE_A_RATE_LIMIT_COOLDOWN_MS = Number(process.env.STAGE_A_RATE_LIMIT_COOLDOWN_MS || 180000);
const STAGE_A_RATE_LIMIT_GLOBAL_PAUSE_MS = Number(process.env.STAGE_A_RATE_LIMIT_GLOBAL_PAUSE_MS || (20 * 60 * 1000));
const STAGE_A_RATE_LIMIT_ITEM_RETRY_MS = Number(process.env.STAGE_A_RATE_LIMIT_ITEM_RETRY_MS || (12 * 60 * 1000));
const STAGE_A_MAX_OUTPUT_TOKENS = Number(process.env.STAGE_A_MAX_OUTPUT_TOKENS || 1800);
const STAGE_A_MAX_PRIMITIVES_PER_IMAGE = Number(process.env.STAGE_A_MAX_PRIMITIVES_PER_IMAGE || 9);
const STAGE_A_MAX_PRIMITIVES_PER_CALL = Number(process.env.STAGE_A_MAX_PRIMITIVES_PER_CALL || 2);
const MAX_TASK_RETENTION_MS = 4 * 60 * 60 * 1000;

const queue = [];
const queuedIds = new Set();
const tasks = new Map();

let isProcessing = false;
let lastGeminiCallAt = 0;
let rateLimitBackoffMs = 0;
let rateLimitedUntil = 0;
let consecutiveRateLimitHits = 0;
let retryTimer = null;
let schemaCache = null;
let envFileCache = null;

function parseEnvFile() {
    if (envFileCache) return envFileCache;
    const parsed = {};
    try {
        const raw = fsSync.readFileSync(ROOT_ENV_FILE, 'utf8');
        raw.split('\n').forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const separatorIndex = trimmed.indexOf('=');
            if (separatorIndex <= 0) return;
            const key = trimmed.slice(0, separatorIndex).trim();
            let value = trimmed.slice(separatorIndex + 1).trim();
            if (
                (value.startsWith('"') && value.endsWith('"'))
                || (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }
            parsed[key] = value;
        });
    } catch {
        // No local .env available.
    }
    envFileCache = parsed;
    return envFileCache;
}

function getApiKey() {
    const envFile = parseEnvFile();
    return (
        process.env.VITE_GEMINI_API_KEY
        || process.env.GEMINI_API_KEY
        || envFile.VITE_GEMINI_API_KEY
        || envFile.GEMINI_API_KEY
        || ''
    );
}

function now() {
    return Date.now();
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripCodeFences(text) {
    const raw = String(text || '').trim();
    if (!raw.startsWith('```')) return raw;
    return raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}

function parseRetryAfterMs(headerValue) {
    if (!headerValue) return 0;
    const asNumber = Number(headerValue);
    if (Number.isFinite(asNumber) && asNumber > 0) return Math.round(asNumber * 1000);
    const asDate = new Date(headerValue).getTime();
    if (Number.isFinite(asDate)) return Math.max(0, asDate - now());
    return 0;
}

function parseRetryDelayFromMessage(message) {
    const text = String(message || '').toLowerCase();
    const match = text.match(/(?:retry|wait|after)\D+(\d+(?:\.\d+)?)\s*(s|sec|second|seconds|m|min|minute|minutes)\b/);
    if (!match) return 0;
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0) return 0;
    const unit = match[2];
    if (unit.startsWith('m')) return Math.round(value * 60 * 1000);
    return Math.round(value * 1000);
}

function onGeminiCallSuccess() {
    lastGeminiCallAt = now();
    consecutiveRateLimitHits = 0;
    if (rateLimitBackoffMs > 0) {
        rateLimitBackoffMs = Math.max(0, Math.floor(rateLimitBackoffMs * 0.7) - 1000);
    }
}

function onGeminiRateLimited(retryDelayMs = 0) {
    lastGeminiCallAt = now();
    consecutiveRateLimitHits += 1;
    rateLimitBackoffMs = Math.min(
        STAGE_A_MAX_BACKOFF_MS,
        rateLimitBackoffMs > 0 ? Math.ceil(rateLimitBackoffMs * 1.8) : 18000
    );
    const adaptivePauseMs = consecutiveRateLimitHits >= 3
        ? STAGE_A_RATE_LIMIT_GLOBAL_PAUSE_MS
        : STAGE_A_RATE_LIMIT_COOLDOWN_MS;
    rateLimitedUntil = Math.max(
        rateLimitedUntil,
        now() + Math.max(adaptivePauseMs, retryDelayMs)
    );
}

async function waitForGeminiSlot() {
    const elapsed = now() - lastGeminiCallAt;
    const rateLimitWait = Math.max(0, rateLimitedUntil - now());
    const waitMs = Math.max(0, STAGE_A_BASE_DELAY_MS - elapsed) + rateLimitBackoffMs + rateLimitWait;
    if (waitMs > 0) await sleep(waitMs);
}

function toSha256Hex(input) {
    return createHash('sha256').update(String(input || '')).digest('hex');
}

async function loadPrimitiveSchemas() {
    if (schemaCache) return schemaCache;
    const files = await fs.readdir(PRIMITIVE_SCHEMA_DIR);
    const schemaFiles = files
        .filter((file) => file.endsWith('.json'))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    const schemas = [];
    for (const file of schemaFiles) {
        const fullPath = path.join(PRIMITIVE_SCHEMA_DIR, file);
        const raw = await fs.readFile(fullPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed?.schema_block) {
            schemas.push(parsed);
        }
    }
    schemaCache = schemas;
    return schemaCache;
}

function inferLeafTypeHint(value) {
    if (typeof value !== 'string') {
        if (typeof value === 'number') return 'number';
        if (typeof value === 'boolean') return 'boolean';
        return 'string';
    }
    const normalized = value.trim().toLowerCase();
    if (!normalized) return 'string';
    if (normalized.startsWith('number') || normalized.startsWith('integer')) return 'number';
    if (normalized.startsWith('boolean')) return 'boolean';
    if (normalized.startsWith('array')) return 'array';
    if (normalized.startsWith('object')) return 'object';
    return 'string';
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
    return inferLeafTypeHint(node);
}

function getCriticalRules(schema, limit = 2) {
    const rules = Array.isArray(schema?.gemini_instructions?.rules)
        ? schema.gemini_instructions.rules
        : [];
    return rules
        .map((rule) => String(rule || '').trim())
        .filter(Boolean)
        .slice(0, limit);
}

function buildPromptForSchemas(schemas) {
    const blockKeys = schemas.map((schema) => schema.schema_block);
    const blockInstructions = schemas.map((schema, index) => {
        const rules = getCriticalRules(schema, 2);
        const compactShape = buildCompactSchemaShape(schema.output_schema || {});
        return [
            `BLOCK ${index + 1}: ${schema.schema_block} (v${schema.version || '1.0.0'})`,
            `Task: ${schema?.gemini_instructions?.task || 'Extract this visual block with high precision.'}`,
            'Rules:',
            ...(rules.length ? rules.map((rule) => `- ${rule}`) : ['- Keep output factual and concise.']),
            `JSON shape for "${schema.schema_block}":`,
            JSON.stringify(compactShape, null, 2),
        ].join('\n');
    }).join('\n\n');

    return [
        'Analyze one image for a design intelligence system.',
        `Return one JSON object with exactly these keys: ${blockKeys.join(', ')}.`,
        'Do not return markdown. Return valid JSON only.',
        'Each block must include confidence.overall and confidence.notes.',
        '',
        blockInstructions,
        '',
        'Return format:',
        JSON.stringify(
            blockKeys.reduce((acc, key) => {
                acc[key] = {};
                return acc;
            }, {}),
            null,
            2
        ),
    ].join('\n');
}

function splitSchemasForBudget(schemas) {
    const maxPerCall = Math.max(1, Math.min(9, STAGE_A_MAX_PRIMITIVES_PER_CALL));
    const groups = [];
    for (let index = 0; index < schemas.length; index += maxPerCall) {
        groups.push(schemas.slice(index, index + maxPerCall));
    }

    const finalGroups = [];
    groups.forEach((group) => {
        const prompt = buildPromptForSchemas(group);
        if (prompt.length <= STAGE_A_MAX_PROMPT_CHARS || group.length <= 1) {
            finalGroups.push(group);
            return;
        }
        const pivot = Math.ceil(group.length / 2);
        finalGroups.push(group.slice(0, pivot), group.slice(pivot));
    });

    return finalGroups;
}

function getConfidenceScore(blockData) {
    const value = blockData?.confidence?.overall;
    return typeof value === 'number' ? value : 0;
}

async function normalizeImageToBase64(content) {
    const raw = String(content || '');
    if (!raw) return null;

    const dataUrlMatch = raw.match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
    if (dataUrlMatch) {
        return {
            mimeType: dataUrlMatch[1],
            base64Data: dataUrlMatch[2],
            source: 'data_url',
        };
    }

    if (raw.startsWith('blob:')) {
        throw new Error('Blob URLs cannot be analyzed by server queue. Use data URLs or http(s) URLs.');
    }

    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
        throw new Error('Unsupported image content format for Stage A.');
    }

    const response = await fetch(raw, {
        headers: {
            'User-Agent': 'Dreamlab-Canvas/1.0',
            Accept: 'image/*,*/*',
        },
    });
    if (!response.ok) {
        throw new Error(`Image fetch failed (${response.status})`);
    }
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const mimeType = contentType.split(';')[0].trim() || 'image/jpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    return {
        mimeType,
        base64Data: buffer.toString('base64'),
        source: 'url',
    };
}

async function callGeminiForBatch({ apiKey, prompt, mimeType, base64Data }) {
    await waitForGeminiSlot();
    const response = await fetch(`${GEMINI_BASE_URL}/${STAGE_A_MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data,
                        },
                    },
                ],
            }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: STAGE_A_MAX_OUTPUT_TOKENS,
            },
        }),
    });

    if (response.status === 429) {
        let message = 'Gemini rate limited (429)';
        const retryAfterMs = parseRetryAfterMs(response.headers?.get?.('retry-after'));
        try {
            const payload = await response.json();
            message = payload?.error?.message || message;
        } catch {
            // keep fallback
        }
        const retryFromMessageMs = parseRetryDelayFromMessage(message);
        onGeminiRateLimited(Math.max(retryAfterMs, retryFromMessageMs));
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
            // keep fallback
        }
        onGeminiCallSuccess();
        const error = new Error(message);
        error.code = response.status;
        throw error;
    }

    onGeminiCallSuccess();

    const payload = await response.json();
    const responseText = payload?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!responseText) {
        const error = new Error('Gemini returned empty response.');
        error.code = 'EMPTY';
        throw error;
    }
    const parsed = JSON.parse(stripCodeFences(responseText));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        const error = new Error('Gemini response was not a JSON object.');
        error.code = 'BAD_SHAPE';
        throw error;
    }
    return parsed;
}

async function extractBatchWithRetry({ apiKey, schemas, mimeType, base64Data }) {
    const prompt = buildPromptForSchemas(schemas);
    let lastError = null;
    let lastErrorCode = null;
    for (let attempt = 0; attempt <= STAGE_A_MAX_RETRIES; attempt += 1) {
        try {
            const parsed = await callGeminiForBatch({ apiKey, prompt, mimeType, base64Data });
            return { ok: true, parsed };
        } catch (error) {
            lastError = error;
            lastErrorCode = error?.code ?? null;
            if (error?.code === 429) {
                return {
                    ok: false,
                    error: error?.message || 'Gemini rate limited (429)',
                    code: 429,
                };
            }
            if (attempt < STAGE_A_MAX_RETRIES) {
                const retryWait = 2500 * (attempt + 1);
                await sleep(retryWait);
            }
        }
    }

    return {
        ok: false,
        error: lastError?.message || 'Unknown Stage A batch error.',
        code: lastErrorCode,
    };
}

function taskSummary(task) {
    return {
        itemId: task.itemId,
        status: task.status,
        analysisProgress: task.analysisProgress,
        retryAt: task.retryAt || null,
        updatedAt: task.updatedAt,
        imageHash: task.imageHash || null,
        error: task.error || null,
        hasResult: Array.isArray(task.results) && task.results.length > 0,
    };
}

function ensureTask(item) {
    const existing = tasks.get(item.id);
    if (existing) {
        if (isRemoteRetryBlocked(existing)) {
            return existing;
        }
        existing.content = item.content;
        existing.type = item.type;
        existing.sourceUrl = item.sourceUrl || null;
        existing.updatedAt = now();
        return existing;
    }

    const task = {
        itemId: item.id,
        type: item.type || 'image',
        content: item.content,
        sourceUrl: item.sourceUrl || null,
        status: 'queued',
        createdAt: now(),
        updatedAt: now(),
        retryAt: null,
        imageHash: null,
        error: null,
        analysisProgress: {
            completed: 0,
            total: STAGE_A_MAX_PRIMITIVES_PER_IMAGE,
            failed: 0,
        },
        results: [],
    };
    tasks.set(task.itemId, task);
    return task;
}

function isRemoteRetryBlocked(task) {
    return task.status === 'rate_limited'
        && Number(task.retryAt || 0) > now();
}

function enqueueTaskId(itemId, front = false) {
    if (!itemId || queuedIds.has(itemId)) return;
    queuedIds.add(itemId);
    if (front) queue.unshift(itemId);
    else queue.push(itemId);
}

function markTaskRateLimited(task, retryMs, errorMessage) {
    task.status = 'rate_limited';
    task.error = errorMessage || 'Stage A rate limited.';
    task.retryAt = now() + Math.max(STAGE_A_RATE_LIMIT_ITEM_RETRY_MS, retryMs || 0, Math.max(0, rateLimitedUntil - now()));
    task.updatedAt = now();
    scheduleRetryWake();
}

async function processTask(task) {
    const apiKey = getApiKey();
    if (!apiKey) {
        task.status = 'failed';
        task.error = 'Gemini API key is not configured for Stage A worker.';
        task.updatedAt = now();
        return;
    }

    task.status = 'processing';
    task.error = null;
    task.retryAt = null;
    task.updatedAt = now();

    let normalized = null;
    try {
        normalized = await normalizeImageToBase64(task.content);
    } catch (error) {
        task.status = 'failed';
        task.error = error?.message || 'Image normalization failed.';
        task.updatedAt = now();
        return;
    }

    if (!normalized?.base64Data) {
        task.status = 'failed';
        task.error = 'Could not normalize image.';
        task.updatedAt = now();
        return;
    }

    task.imageHash = toSha256Hex(normalized.base64Data);

    const schemas = await loadPrimitiveSchemas();
    const targetSchemas = schemas.slice(0, Math.max(1, Math.min(STAGE_A_MAX_PRIMITIVES_PER_IMAGE, schemas.length)));
    task.analysisProgress.total = targetSchemas.length;

    const resultMap = new Map(
        (Array.isArray(task.results) ? task.results : []).map((entry) => [entry.primitiveName, entry])
    );
    const pendingSchemas = targetSchemas.filter((schema) => {
        const existing = resultMap.get(schema.schema_block);
        return !(existing && existing.version === schema.version && existing.status === 'ready');
    });

    if (pendingSchemas.length === 0) {
        task.status = 'done';
        task.analysisProgress.completed = targetSchemas.length;
        task.analysisProgress.failed = 0;
        task.updatedAt = now();
        return;
    }

    const batches = splitSchemasForBudget(pendingSchemas);
    let hitRateLimit = false;
    for (const batch of batches) {
        const result = await extractBatchWithRetry({
            apiKey,
            schemas: batch,
            mimeType: normalized.mimeType,
            base64Data: normalized.base64Data,
        });

        if (!result.ok) {
            if (result.code === 429) {
                hitRateLimit = true;
                break;
            }
            const analyzedAt = new Date().toISOString();
            batch.forEach((schema) => {
                resultMap.set(schema.schema_block, {
                    primitiveName: schema.schema_block,
                    version: schema.version || '1.0.0',
                    data: null,
                    confidence: 0,
                    analyzedAt,
                    status: 'failed',
                    notes: 'Stage A batch failed after retry.',
                    error: result.error || 'stage_a_batch_failed',
                });
            });
            continue;
        }

        const analyzedAt = new Date().toISOString();
        batch.forEach((schema) => {
            const payload = result.parsed?.[schema.schema_block];
            if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
                resultMap.set(schema.schema_block, {
                    primitiveName: schema.schema_block,
                    version: schema.version || '1.0.0',
                    data: payload,
                    confidence: getConfidenceScore(payload),
                    analyzedAt,
                    status: 'ready',
                    notes: null,
                    error: null,
                });
            } else {
                resultMap.set(schema.schema_block, {
                    primitiveName: schema.schema_block,
                    version: schema.version || '1.0.0',
                    data: null,
                    confidence: 0,
                    analyzedAt,
                    status: 'failed',
                    notes: 'Schema block missing from Gemini response.',
                    error: 'missing_block_output',
                });
            }
        });
    }

    const results = Array.from(resultMap.values());
    const completed = results.filter((entry) => entry.status === 'ready').length;
    const failed = results.filter((entry) => entry.status === 'failed').length;
    task.results = results;
    task.analysisProgress = {
        completed,
        total: targetSchemas.length,
        failed,
    };
    task.updatedAt = now();

    if (hitRateLimit && completed === 0) {
        markTaskRateLimited(
            task,
            Math.max(STAGE_A_RATE_LIMIT_ITEM_RETRY_MS, rateLimitBackoffMs, Math.max(0, rateLimitedUntil - now())),
            'Gemini rate limited during Stage A.'
        );
        return;
    }

    if (completed >= targetSchemas.length && failed === 0) {
        task.status = 'done';
        return;
    }

    if (completed > 0 && completed + failed >= targetSchemas.length) {
        task.status = 'done';
        return;
    }

    if (failed > 0 && completed === 0) {
        task.status = 'failed';
        task.error = 'All primitives failed for this run.';
        return;
    }

    task.status = 'in_progress';
}

function pruneOldTasks() {
    const cutoff = now() - MAX_TASK_RETENTION_MS;
    for (const [itemId, task] of tasks.entries()) {
        if (task.updatedAt < cutoff && (task.status === 'done' || task.status === 'failed')) {
            tasks.delete(itemId);
            queuedIds.delete(itemId);
        }
    }
}

async function processQueue() {
    if (isProcessing) return;
    isProcessing = true;
    while (queue.length > 0) {
        const itemId = queue.shift();
        queuedIds.delete(itemId);
        const task = tasks.get(itemId);
        if (!task) continue;

        if (isRemoteRetryBlocked(task)) {
            scheduleRetryWake();
            continue;
        }

        try {
            await processTask(task);
        } catch (error) {
            const message = error?.message || 'Unhandled Stage A worker error.';
            if (error?.code === 429) {
                const retryFromMessageMs = parseRetryDelayFromMessage(message);
                onGeminiRateLimited(retryFromMessageMs);
                markTaskRateLimited(task, retryFromMessageMs, message);
            } else {
                task.status = 'failed';
                task.error = message;
                task.updatedAt = now();
            }
        }

        pruneOldTasks();
        await sleep(250);
    }
    isProcessing = false;
}

function scheduleRetryWake() {
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }

    const nowTs = now();
    let minRetryAt = null;
    for (const task of tasks.values()) {
        if (task.status === 'rate_limited' && Number(task.retryAt || 0) > nowTs) {
            minRetryAt = minRetryAt == null ? Number(task.retryAt) : Math.min(minRetryAt, Number(task.retryAt));
        }
    }
    if (minRetryAt == null) return;

    const waitMs = Math.max(250, minRetryAt - nowTs);
    retryTimer = setTimeout(() => {
        const dueNow = now();
        for (const task of tasks.values()) {
            if (task.status === 'rate_limited' && Number(task.retryAt || 0) <= dueNow) {
                task.status = 'queued';
                task.error = null;
                task.retryAt = null;
                task.updatedAt = dueNow;
                enqueueTaskId(task.itemId);
            }
        }
        processQueue();
        scheduleRetryWake();
    }, waitMs);
}

export async function enqueueStageAAnalysis(items = []) {
    const inputItems = Array.isArray(items) ? items : [];
    const queued = [];
    const skipped = [];

    inputItems.forEach((rawItem) => {
        const item = rawItem && typeof rawItem === 'object' ? rawItem : null;
        if (!item?.id) {
            skipped.push({ itemId: null, reason: 'missing_id' });
            return;
        }
        if (item.type && item.type !== 'image') {
            skipped.push({ itemId: item.id, reason: 'not_image' });
            return;
        }
        if (!item.content) {
            skipped.push({ itemId: item.id, reason: 'missing_content' });
            return;
        }

        const task = ensureTask({
            id: String(item.id),
            type: 'image',
            content: String(item.content),
            sourceUrl: item.sourceUrl || null,
        });

        if (isRemoteRetryBlocked(task)) {
            skipped.push({ itemId: task.itemId, reason: 'rate_limited_wait', retryAt: task.retryAt });
            return;
        }

        task.status = 'queued';
        task.updatedAt = now();
        enqueueTaskId(task.itemId);
        queued.push(task.itemId);
    });

    processQueue();
    scheduleRetryWake();

    return {
        queued,
        skipped,
        queue: getStageAQueueSnapshot().queue,
    };
}

export function getStageAQueueSnapshot() {
    const statusItems = Array.from(tasks.values())
        .filter((task) => (
            task.status === 'queued'
            || task.status === 'processing'
            || task.status === 'rate_limited'
            || task.status === 'in_progress'
            || (task.status === 'done' && task.updatedAt > now() - (30 * 60 * 1000))
        ))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((task) => taskSummary(task));

    return {
        queue: {
            pending: queue.length,
            isProcessing,
            nextAllowedAt: Math.max(lastGeminiCallAt + STAGE_A_BASE_DELAY_MS + rateLimitBackoffMs, rateLimitedUntil),
            rateLimitedUntil,
            rateLimitBackoffMs,
            model: STAGE_A_MODEL,
        },
        items: statusItems,
    };
}

export function getStageAResult(itemId) {
    if (!itemId) return null;
    const task = tasks.get(String(itemId));
    if (!task) return null;
    return {
        itemId: task.itemId,
        status: task.status,
        analysisProgress: task.analysisProgress,
        retryAt: task.retryAt || null,
        updatedAt: task.updatedAt,
        imageHash: task.imageHash || null,
        error: task.error || null,
        results: Array.isArray(task.results) ? task.results : [],
    };
}
