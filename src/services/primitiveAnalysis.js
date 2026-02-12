import { imageToBase64 } from '../utils/imageProxy';
import {
    getPrimitiveAnalysisForImage,
    getPrimitiveResult,
    savePrimitiveResultsBatch,
    updateItem,
} from '../lib/storage';
import { getPrimitiveSchemas } from './analysisSchemaRegistry';
import { pushPipelineDebugEvent } from './pipelineDebug';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const STAGE_A_MODEL = import.meta.env.VITE_GEMINI_STAGE_A_MODEL || 'gemini-2.5-pro';
const STAGE_A_BASE_DELAY_MS = 25000;
const STAGE_A_MAX_PROMPT_CHARS = 30000;
const STAGE_A_MAX_RETRIES = 3;
const STAGE_A_MAX_BACKOFF_MS = 90000;
const STAGE_A_RATE_LIMIT_COOLDOWN_MS = 120000;
const STAGE_A_RATE_LIMIT_GLOBAL_PAUSE_MS = 15 * 60 * 1000;
const STAGE_A_RATE_LIMIT_ITEM_RETRY_MS = 10 * 60 * 1000;
const STAGE_A_MAX_OUTPUT_TOKENS = 2200;
// Stage A processes all queued images sequentially (not locked to a single image id).
const STAGE_A_SINGLE_IMAGE_MODE = false;
// Run compact multi-primitive batches in one request when possible.
const STAGE_A_SINGLE_PRIMITIVE_PER_REQUEST = false;
// Stage A target: all primitive blocks per image.
const STAGE_A_MAX_PRIMITIVES_PER_IMAGE = 9;
// TPM-safe chunking: request a few primitives per call, not all 9 at once.
const STAGE_A_MAX_PRIMITIVES_PER_CALL = 3;
// Preferred path: run Stage A via backend queue.
const STAGE_A_USE_REMOTE_QUEUE = true;
const STAGE_A_REMOTE_BASE_URL = '/api/stagea';
const STAGE_A_REMOTE_POLL_INTERVAL_MS = 3000;

const primitiveQueue = [];
const queuedIds = new Set();
let isProcessingQueue = false;
let lastGeminiCallAt = 0;
let rateLimitBackoffMs = 0;
let rateLimitedUntil = 0;
let consecutiveRateLimitHits = 0;
let singleImageModeItemId = null;
let remoteQueueAvailable = STAGE_A_USE_REMOTE_QUEUE;
let remotePollTimer = null;
let remotePollInFlight = false;
const remoteTrackedItemIds = new Set();
const remoteSyncedResultIds = new Set();
let remoteQueueStatus = {
    pending: 0,
    isProcessing: false,
    nextAllowedAt: 0,
    rateLimitedUntil: 0,
    rateLimitBackoffMs: 0,
};

function safeUpdateItemAnalysisState(itemId, updates = {}) {
    if (!itemId) return;
    try {
        updateItem(itemId, updates);
    } catch {
        // Item may be deleted while queue runs.
    }
}

function getApiKey() {
    const envKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (envKey) return envKey;

    try {
        const settings = JSON.parse(localStorage.getItem('autoTaggingSettings') || '{}');
        if (settings.geminiApiKey) return settings.geminiApiKey;
    } catch {
        // Ignore parse failures and fallback to env.
    }
    return '';
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForGeminiSlot() {
    const elapsed = Date.now() - lastGeminiCallAt;
    const rateLimitWait = Math.max(0, rateLimitedUntil - Date.now());
    const waitMs = Math.max(0, STAGE_A_BASE_DELAY_MS - elapsed) + rateLimitBackoffMs + rateLimitWait;
    if (waitMs > 0) await sleep(waitMs);
}

function onGeminiCallSuccess() {
    lastGeminiCallAt = Date.now();
    consecutiveRateLimitHits = 0;
    if (rateLimitBackoffMs > 0) {
        rateLimitBackoffMs = Math.max(0, Math.floor(rateLimitBackoffMs * 0.6) - 500);
    }
}

function parseRetryAfterMs(headerValue) {
    if (!headerValue) return 0;
    const asNumber = Number(headerValue);
    if (Number.isFinite(asNumber) && asNumber > 0) {
        return Math.round(asNumber * 1000);
    }
    const asDate = new Date(headerValue).getTime();
    if (Number.isFinite(asDate)) {
        return Math.max(0, asDate - Date.now());
    }
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

function onGeminiCallRateLimited(retryDelayMs = 0) {
    lastGeminiCallAt = Date.now();
    consecutiveRateLimitHits += 1;
    rateLimitBackoffMs = Math.min(
        STAGE_A_MAX_BACKOFF_MS,
        rateLimitBackoffMs > 0 ? Math.ceil(rateLimitBackoffMs * 1.8) : 12000
    );
    const adaptivePauseMs = consecutiveRateLimitHits >= 3
        ? STAGE_A_RATE_LIMIT_GLOBAL_PAUSE_MS
        : STAGE_A_RATE_LIMIT_COOLDOWN_MS;
    rateLimitedUntil = Math.max(
        rateLimitedUntil,
        Date.now() + Math.max(adaptivePauseMs, retryDelayMs)
    );
}

function stripCodeFences(text) {
    const raw = String(text || '').trim();
    if (!raw.startsWith('```')) return raw;
    return raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
}

async function computeSha256Hex(text) {
    const payload = new TextEncoder().encode(String(text || ''));
    const digest = await crypto.subtle.digest('SHA-256', payload);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function getConfidenceScore(blockData) {
    const value = blockData?.confidence?.overall;
    return typeof value === 'number' ? value : 0;
}

function getTargetPrimitiveLimit() {
    const totalSchemas = getPrimitiveSchemas().length;
    return Math.max(1, Math.min(totalSchemas, STAGE_A_MAX_PRIMITIVES_PER_IMAGE));
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

function getCriticalRules(schema, limit = 3) {
    const rules = Array.isArray(schema?.gemini_instructions?.rules)
        ? schema.gemini_instructions.rules
        : [];
    return rules
        .map((rule) => String(rule || '').trim())
        .filter(Boolean)
        .slice(0, limit);
}

async function normalizeImageToBase64(item) {
    if (!item?.content) return null;

    let dataUrl = item.content;
    if (!String(dataUrl).startsWith('data:')) {
        dataUrl = await imageToBase64(String(dataUrl));
    }

    const match = String(dataUrl).match(/^data:(image\/[\w+.-]+);base64,(.+)$/);
    if (!match) return null;

    return {
        mimeType: match[1],
        base64Data: match[2],
        dataUrl,
    };
}

function getMissingOrOutdatedSchemas(imageHash, schemas) {
    return schemas.filter((schema) => {
        const existing = getPrimitiveResult(imageHash, schema.schema_block);
        return !(existing && existing.version === schema.version && existing.status !== 'failed');
    });
}

function buildPromptForSchemas(schemas) {
    const blockKeys = schemas.map((schema) => schema.schema_block);

    const blockInstructions = schemas.map((schema, index) => {
        const rules = getCriticalRules(schema, 3);
        const ruleLines = rules.length
            ? rules.map((rule) => `- ${rule}`).join('\n')
            : '- Keep output factual and concise.';
        const compactShape = buildCompactSchemaShape(schema.output_schema || {});

        return [
            `BLOCK ${index + 1}: ${schema.schema_block} (v${schema.version || '1.0.0'})`,
            `Task: ${schema?.gemini_instructions?.task || 'Extract this block with high precision.'}`,
            'Critical rules:',
            ruleLines,
            `Expected JSON shape for "${schema.schema_block}":`,
            JSON.stringify(compactShape, null, 2),
        ].join('\n');
    }).join('\n\n');

    return [
        'You are analyzing one visual image for a design intelligence platform.',
        `Extract the requested analysis blocks and return one JSON object with exactly these top-level keys: ${blockKeys.join(', ')}.`,
        'Do not return markdown. Return valid JSON only.',
        'Use concise output values: short phrases, no repeated explanations.',
        'If uncertain, lower confidence.overall and explain caveats in confidence.notes.',
        'Each requested block must include confidence.overall and confidence.notes.',
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
    if (STAGE_A_SINGLE_PRIMITIVE_PER_REQUEST) {
        return schemas.map((schema) => [schema]);
    }

    const maxPerCall = Math.max(1, Math.min(9, STAGE_A_MAX_PRIMITIVES_PER_CALL));
    const chunks = [];
    for (let index = 0; index < schemas.length; index += maxPerCall) {
        chunks.push(schemas.slice(index, index + maxPerCall));
    }

    const finalBatches = [];
    chunks.forEach((batch) => {
        const prompt = buildPromptForSchemas(batch);
        if (prompt.length <= STAGE_A_MAX_PROMPT_CHARS || batch.length <= 1) {
            finalBatches.push(batch);
            return;
        }

        const pivot = Math.ceil(batch.length / 2);
        finalBatches.push(batch.slice(0, pivot), batch.slice(pivot));
    });

    return finalBatches;
}

async function callGeminiForBatch(apiKey, prompt, mimeType, base64Data) {
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
            // Keep fallback message.
        }
        const retryFromMessageMs = parseRetryDelayFromMessage(message);
        onGeminiCallRateLimited(Math.max(retryAfterMs, retryFromMessageMs));
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
            // Keep generic message.
        }
        onGeminiCallSuccess();
        const error = new Error(message);
        error.code = response.status;
        throw error;
    }

    onGeminiCallSuccess();

    const data = await response.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!responseText) {
        throw new Error('Gemini returned an empty response.');
    }
    const parsed = JSON.parse(stripCodeFences(responseText));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Gemini response was not a JSON object.');
    }
    return parsed;
}

async function extractBatchWithRetry(apiKey, schemas, mimeType, base64Data) {
    const prompt = buildPromptForSchemas(schemas);
    let lastError = null;
    let lastErrorCode = null;

    for (let attempt = 0; attempt <= STAGE_A_MAX_RETRIES; attempt += 1) {
        try {
            const parsed = await callGeminiForBatch(apiKey, prompt, mimeType, base64Data);
            return { ok: true, parsed };
        } catch (error) {
            lastError = error;
            lastErrorCode = error?.code ?? null;
            if (error?.code === 429 && schemas.length > 1) {
                return {
                    ok: false,
                    error: lastError?.message || 'Gemini rate limited (429)',
                    code: 429,
                };
            }
            if (attempt < STAGE_A_MAX_RETRIES) {
                const retryWait = error?.code === 429
                    ? Math.max(
                        Math.min(STAGE_A_MAX_BACKOFF_MS, rateLimitBackoffMs || (12000 * (attempt + 1))),
                        Math.max(0, rateLimitedUntil - Date.now())
                    )
                    : (2500 * (attempt + 1));
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

async function runPrimitiveAnalysisForItem(item) {
    const targetTotal = getTargetPrimitiveLimit();
    const apiKey = getApiKey();
    if (item?.type !== 'image') return;

    pushPipelineDebugEvent('stageA:item_start', 'Stage A started for image.', {
        itemId: item.id,
        targetPrimitives: targetTotal,
    });

    if (!apiKey) {
        pushPipelineDebugEvent('stageA:item_failed', 'Stage A failed: missing API key.', {
            itemId: item?.id,
        });
        safeUpdateItemAnalysisState(item?.id, {
            analysisStatus: 'failed',
            analysisProgress: {
                completed: 0,
                total: targetTotal,
                failed: targetTotal,
            },
            analysisUpdatedAt: Date.now(),
        });
        return;
    }

    const normalized = await normalizeImageToBase64(item);
    if (!normalized?.base64Data) {
        pushPipelineDebugEvent('stageA:item_failed', 'Stage A failed: image normalization failed.', {
            itemId: item?.id,
        });
        safeUpdateItemAnalysisState(item?.id, {
            analysisStatus: 'failed',
            analysisProgress: {
                completed: 0,
                total: targetTotal,
                failed: targetTotal,
            },
            analysisUpdatedAt: Date.now(),
        });
        return;
    }

    const imageHash = await computeSha256Hex(normalized.base64Data);
    if (!imageHash) {
        pushPipelineDebugEvent('stageA:item_failed', 'Stage A failed: could not compute image hash.', {
            itemId: item?.id,
        });
        safeUpdateItemAnalysisState(item?.id, {
            analysisStatus: 'failed',
            analysisProgress: {
                completed: 0,
                total: targetTotal,
                failed: targetTotal,
            },
            analysisUpdatedAt: Date.now(),
        });
        return;
    }

    // Persist hash on item for downstream cache joins.
    safeUpdateItemAnalysisState(item.id, { imageHash });

    const allSchemas = getPrimitiveSchemas();
    const targetSchemas = allSchemas.slice(0, targetTotal);
    const pendingSchemas = getMissingOrOutdatedSchemas(imageHash, targetSchemas);
    if (pendingSchemas.length === 0) {
        pushPipelineDebugEvent('stageA:item_skipped', 'Stage A skipped: all target primitives already cached.', {
            itemId: item.id,
            imageHash,
            targetPrimitives: targetTotal,
        });
        safeUpdateItemAnalysisState(item.id, {
            analysisStatus: 'done',
            analysisProgress: {
                completed: targetTotal,
                total: targetTotal,
                failed: 0,
            },
            analysisUpdatedAt: Date.now(),
        });
        return;
    }

    safeUpdateItemAnalysisState(item.id, {
        analysisStatus: 'processing',
        analysisProgress: {
            completed: Math.max(0, targetTotal - pendingSchemas.length),
            total: targetTotal,
            failed: 0,
        },
        analysisUpdatedAt: Date.now(),
    });

    const schemaBatches = splitSchemasForBudget(pendingSchemas);
    const batchQueue = [...schemaBatches];
    const collectedResults = [];
    let hitRateLimit = false;

    pushPipelineDebugEvent('stageA:batch_plan', 'Stage A batching plan prepared.', {
        itemId: item.id,
        imageHash,
        batchSizes: schemaBatches.map((batch) => batch.length),
        pendingPrimitives: pendingSchemas.map((schema) => schema.schema_block),
    });

    while (batchQueue.length > 0) {
        const schemaBatch = batchQueue.shift();
        if (!schemaBatch?.length) continue;

        pushPipelineDebugEvent('stageA:batch_start', 'Stage A batch request started.', {
            itemId: item.id,
            imageHash,
            primitives: schemaBatch.map((schema) => schema.schema_block),
        });

        const result = await extractBatchWithRetry(
            apiKey,
            schemaBatch,
            normalized.mimeType,
            normalized.base64Data
        );

        if (result.ok) {
            pushPipelineDebugEvent('stageA:batch_success', 'Stage A batch completed.', {
                itemId: item.id,
                imageHash,
                primitives: schemaBatch.map((schema) => schema.schema_block),
            });
            const analyzedAt = new Date().toISOString();
            schemaBatch.forEach((schema) => {
                const payload = result.parsed?.[schema.schema_block];
                if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
                    collectedResults.push({
                        primitiveName: schema.schema_block,
                        version: schema.version || '1.0.0',
                        data: payload,
                        confidence: getConfidenceScore(payload),
                        analyzedAt,
                        status: 'ready',
                        notes: null,
                    });
                } else {
                    collectedResults.push({
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
        } else {
            if (result.code === 429) {
                hitRateLimit = true;
            }
            const shouldSplitBatch = schemaBatch.length > 1
                && (result.code === 429 || result.code == null || result.code >= 500);

            if (shouldSplitBatch) {
                pushPipelineDebugEvent('stageA:batch_split', 'Stage A split a failed batch into smaller chunks.', {
                    itemId: item.id,
                    imageHash,
                    failedCode: result.code || null,
                    failedPrimitives: schemaBatch.map((schema) => schema.schema_block),
                });
                const pivot = Math.ceil(schemaBatch.length / 2);
                const firstHalf = schemaBatch.slice(0, pivot);
                const secondHalf = schemaBatch.slice(pivot);
                if (secondHalf.length) batchQueue.unshift(secondHalf);
                if (firstHalf.length) batchQueue.unshift(firstHalf);
                continue;
            }

            pushPipelineDebugEvent('stageA:batch_failed', 'Stage A batch failed after retries.', {
                itemId: item.id,
                imageHash,
                failedCode: result.code || null,
                error: result.error || 'unknown_stage_a_batch_error',
                primitives: schemaBatch.map((schema) => schema.schema_block),
            });
            const analyzedAt = new Date().toISOString();
            schemaBatch.forEach((schema) => {
                collectedResults.push({
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
        }
    }

    if (collectedResults.length > 0) {
        const savedRecord = savePrimitiveResultsBatch(item.id, imageHash, collectedResults);
        const persistedRecord = savedRecord || getPrimitiveAnalysisForImage(imageHash);
        const persistedPrimitives = persistedRecord?.primitives || {};

        let completed = targetSchemas.filter((schema) => (
            persistedPrimitives[schema.schema_block]?.version === schema.version
            && persistedPrimitives[schema.schema_block]?.status === 'ready'
        )).length;
        let failed = targetSchemas.filter((schema) => (
            persistedPrimitives[schema.schema_block]?.version === schema.version
            && persistedPrimitives[schema.schema_block]?.status === 'failed'
        )).length;

        if (!persistedRecord) {
            const completedFromBatch = collectedResults.filter((entry) => entry.status === 'ready').length;
            const failedFromBatch = collectedResults.filter((entry) => entry.status === 'failed').length;
            completed = Math.min(targetTotal, completedFromBatch + Math.max(0, targetTotal - pendingSchemas.length));
            failed = Math.min(targetTotal, failedFromBatch);
        }

        const status = completed >= targetTotal && failed === 0
            ? 'done'
            : (failed > 0 && completed === 0 ? 'failed' : 'in_progress');
        const isRateLimitedFailure = hitRateLimit && completed === 0;
        const effectiveStatus = isRateLimitedFailure ? 'rate_limited' : status;
        const retryAt = isRateLimitedFailure
            ? Date.now() + Math.max(STAGE_A_RATE_LIMIT_ITEM_RETRY_MS, rateLimitBackoffMs, Math.max(0, rateLimitedUntil - Date.now()))
            : null;

        safeUpdateItemAnalysisState(item.id, {
            analysisStatus: effectiveStatus,
            analysisProgress: {
                completed,
                total: targetTotal,
                failed,
            },
            analysisRetryAt: retryAt,
            analysisUpdatedAt: Date.now(),
        });
        pushPipelineDebugEvent('stageA:item_complete', 'Stage A finished image processing.', {
            itemId: item.id,
            imageHash,
            completed,
            failed,
            total: targetTotal,
            status: effectiveStatus,
            retryAt,
        });
    } else {
        const isRateLimitedFailure = hitRateLimit;
        const retryAt = isRateLimitedFailure
            ? Date.now() + Math.max(STAGE_A_RATE_LIMIT_ITEM_RETRY_MS, rateLimitBackoffMs, Math.max(0, rateLimitedUntil - Date.now()))
            : null;
        safeUpdateItemAnalysisState(item.id, {
            analysisStatus: isRateLimitedFailure ? 'rate_limited' : 'failed',
            analysisProgress: {
                completed: 0,
                total: targetTotal,
                failed: targetTotal,
            },
            analysisRetryAt: retryAt,
            analysisUpdatedAt: Date.now(),
        });
        pushPipelineDebugEvent('stageA:item_failed', 'Stage A finished with no collected results.', {
            itemId: item.id,
            imageHash,
            total: targetTotal,
            status: isRateLimitedFailure ? 'rate_limited' : 'failed',
            retryAt,
        });
    }
}

function mapRemoteAnalysisStatus(status) {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'queued') return 'queued';
    if (normalized === 'processing') return 'processing';
    if (normalized === 'rate_limited') return 'rate_limited';
    if (normalized === 'failed') return 'failed';
    if (normalized === 'done') return 'done';
    if (normalized === 'in_progress') return 'in_progress';
    return 'in_progress';
}

function isRemoteTerminalStatus(status) {
    return status === 'done' || status === 'failed';
}

async function fetchRemoteStageAStatus() {
    const response = await fetch(`${STAGE_A_REMOTE_BASE_URL}/status`);
    if (!response.ok) {
        let message = `Stage A remote status error (${response.status})`;
        try {
            const payload = await response.json();
            message = payload?.error || message;
        } catch {
            // keep fallback message
        }
        throw new Error(message);
    }
    const payload = await response.json();
    return payload && typeof payload === 'object' ? payload : {};
}

async function fetchRemoteStageAResult(itemId) {
    const response = await fetch(`${STAGE_A_REMOTE_BASE_URL}/result?itemId=${encodeURIComponent(itemId)}`);
    if (!response.ok) {
        let message = `Stage A remote result error (${response.status})`;
        try {
            const payload = await response.json();
            message = payload?.error || message;
        } catch {
            // keep fallback
        }
        throw new Error(message);
    }
    const payload = await response.json();
    return payload && typeof payload === 'object' ? payload : null;
}

async function syncRemoteResultForItem(itemId) {
    if (!itemId || remoteSyncedResultIds.has(itemId)) return;
    try {
        const result = await fetchRemoteStageAResult(itemId);
        if (!result) return;
        const status = mapRemoteAnalysisStatus(result.status);
        const progress = result.analysisProgress || {};
        const completed = Number(progress.completed || 0);
        const total = Number(progress.total || 0);
        const failed = Number(progress.failed || 0);
        const results = Array.isArray(result.results) ? result.results : [];
        if (result.imageHash && results.length > 0) {
            savePrimitiveResultsBatch(itemId, result.imageHash, results);
        }

        const updates = {
            analysisStatus: status,
            analysisProgress: { completed, total, failed },
            analysisRetryAt: result.retryAt || null,
            analysisUpdatedAt: result.updatedAt || Date.now(),
        };
        if (result.imageHash) {
            updates.imageHash = result.imageHash;
        }
        safeUpdateItemAnalysisState(itemId, updates);

        remoteSyncedResultIds.add(itemId);
        if (isRemoteTerminalStatus(status)) {
            remoteTrackedItemIds.delete(itemId);
            queuedIds.delete(itemId);
        }
    } catch (error) {
        pushPipelineDebugEvent('stageA:remote_result_failed', 'Remote Stage A result sync failed.', {
            itemId,
            error: error?.message || 'remote_result_sync_failed',
        });
    }
}

function updateLocalStateFromRemoteSummary(summary) {
    if (!summary?.itemId) return;
    const status = mapRemoteAnalysisStatus(summary.status);
    const progress = summary.analysisProgress || {};
    const completed = Number(progress.completed || 0);
    const total = Number(progress.total || 0);
    const failed = Number(progress.failed || 0);
    const updates = {
        analysisStatus: status,
        analysisProgress: { completed, total, failed },
        analysisRetryAt: summary.retryAt || null,
        analysisUpdatedAt: summary.updatedAt || Date.now(),
    };
    if (summary.imageHash) {
        updates.imageHash = summary.imageHash;
    }
    safeUpdateItemAnalysisState(summary.itemId, updates);

    if (summary.hasResult) {
        void syncRemoteResultForItem(summary.itemId);
    }

    if (isRemoteTerminalStatus(status) && !summary.hasResult) {
        remoteTrackedItemIds.delete(summary.itemId);
        queuedIds.delete(summary.itemId);
    }
}

function maybeStopRemotePolling() {
    if (!remotePollTimer) return;
    const shouldStop = remoteTrackedItemIds.size === 0
        && !remoteQueueStatus.isProcessing
        && Number(remoteQueueStatus.pending || 0) === 0;
    if (shouldStop) {
        clearInterval(remotePollTimer);
        remotePollTimer = null;
    }
}

async function pollRemoteStageAQueue() {
    if (!remoteQueueAvailable || remotePollInFlight) return;
    remotePollInFlight = true;
    try {
        const payload = await fetchRemoteStageAStatus();
        const queue = payload?.queue || {};
        remoteQueueStatus = {
            pending: Number(queue.pending || 0),
            isProcessing: Boolean(queue.isProcessing),
            nextAllowedAt: Number(queue.nextAllowedAt || 0),
            rateLimitedUntil: Number(queue.rateLimitedUntil || 0),
            rateLimitBackoffMs: Number(queue.rateLimitBackoffMs || 0),
        };

        const items = Array.isArray(payload?.items) ? payload.items : [];
        items.forEach((summary) => {
            if (summary?.itemId) {
                remoteTrackedItemIds.add(summary.itemId);
                updateLocalStateFromRemoteSummary(summary);
            }
        });

        maybeStopRemotePolling();
    } catch (error) {
        pushPipelineDebugEvent('stageA:remote_status_failed', 'Remote Stage A status poll failed.', {
            error: error?.message || 'remote_status_poll_failed',
        });
    } finally {
        remotePollInFlight = false;
    }
}

function startRemoteStageAPolling() {
    if (remotePollTimer || !remoteQueueAvailable) return;
    remotePollTimer = setInterval(() => {
        void pollRemoteStageAQueue();
    }, STAGE_A_REMOTE_POLL_INTERVAL_MS);
    void pollRemoteStageAQueue();
}

async function enqueueRemoteStageA(item) {
    const response = await fetch(`${STAGE_A_REMOTE_BASE_URL}/enqueue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            items: [{
                id: item.id,
                type: item.type,
                content: item.content,
                sourceUrl: item.sourceUrl || null,
            }],
        }),
    });

    if (!response.ok) {
        let message = `Stage A remote enqueue error (${response.status})`;
        try {
            const payload = await response.json();
            message = payload?.error || message;
        } catch {
            // keep fallback message
        }
        throw new Error(message);
    }

    const payload = await response.json();
    return payload && typeof payload === 'object' ? payload : {};
}

async function processPrimitiveQueue() {
    if (primitiveQueue.length === 0) {
        isProcessingQueue = false;
        if (STAGE_A_SINGLE_IMAGE_MODE) {
            singleImageModeItemId = null;
        }
        return;
    }

    isProcessingQueue = true;
    const task = primitiveQueue.shift();
    const { itemId, item } = task;

    try {
        await runPrimitiveAnalysisForItem(item);
    } catch (error) {
        console.warn('Stage A primitive analysis failed:', error);
    } finally {
        if (itemId) queuedIds.delete(itemId);
    }

    setTimeout(processPrimitiveQueue, 250);
}

/**
 * Queue Stage A primitives extraction.
 * Returns false if item is not queueable or already queued.
 */
export function queueStageAPrimitiveAnalysis(item) {
    if (!item?.id || item?.type !== 'image') return false;
    const blockedUntil = Number(item?.analysisRetryAt || 0);
    if (item?.analysisStatus === 'rate_limited' && blockedUntil > Date.now()) {
        return false;
    }

    if (remoteQueueAvailable) {
        if (queuedIds.has(item.id)) return false;
        queuedIds.add(item.id);
        remoteTrackedItemIds.add(item.id);
        safeUpdateItemAnalysisState(item.id, {
            analysisStatus: 'queued',
            analysisUpdatedAt: Date.now(),
        });
        pushPipelineDebugEvent('stageA:queued', 'Image queued for remote Stage A.', {
            itemId: item.id,
        });

        void enqueueRemoteStageA(item)
            .then(() => {
                startRemoteStageAPolling();
            })
            .catch((error) => {
                remoteQueueAvailable = false;
                remoteTrackedItemIds.delete(item.id);
                queuedIds.delete(item.id);
                pushPipelineDebugEvent('stageA:remote_enqueue_failed', 'Remote Stage A enqueue failed. Falling back to local queue.', {
                    itemId: item.id,
                    error: error?.message || 'remote_enqueue_failed',
                });
                // Fallback path: queue locally if remote endpoint is unavailable.
                queueStageAPrimitiveAnalysis(item);
            });

        return true;
    }

    if (STAGE_A_SINGLE_IMAGE_MODE) {
        if (!singleImageModeItemId) {
            singleImageModeItemId = item.id;
        }
        if (item.id !== singleImageModeItemId) {
            return false;
        }
    }

    if (queuedIds.has(item.id)) return false;

    queuedIds.add(item.id);
    safeUpdateItemAnalysisState(item.id, {
        analysisStatus: 'queued',
        analysisUpdatedAt: Date.now(),
    });

    pushPipelineDebugEvent('stageA:queued', 'Image queued for Stage A.', {
        itemId: item.id,
        queueDepth: primitiveQueue.length + 1,
    });

    primitiveQueue.push({
        itemId: item.id,
        item: { ...item },
        queuedAt: Date.now(),
    });

    if (!isProcessingQueue) {
        processPrimitiveQueue();
    }

    return true;
}

export function getStageAQueueStatus() {
    if (remoteQueueAvailable) {
        return {
            pending: Number(remoteQueueStatus.pending || 0),
            isProcessing: Boolean(remoteQueueStatus.isProcessing),
            nextAllowedAt: Number(remoteQueueStatus.nextAllowedAt || 0),
            rateLimitedUntil: Number(remoteQueueStatus.rateLimitedUntil || 0),
            rateLimitBackoffMs: Number(remoteQueueStatus.rateLimitBackoffMs || 0),
        };
    }

    return {
        pending: primitiveQueue.length,
        isProcessing: isProcessingQueue,
        nextAllowedAt: Math.max(lastGeminiCallAt + STAGE_A_BASE_DELAY_MS + rateLimitBackoffMs, rateLimitedUntil),
        rateLimitedUntil,
        rateLimitBackoffMs,
    };
}

/**
 * Queue a backfill batch for images that still need Stage A analysis.
 */
export function queueStageABackfill(items = [], options = {}) {
    const { maxToQueue = 10 } = options;
    if (!Array.isArray(items) || items.length === 0) {
        return { queued: 0, remaining: 0, totalCandidates: 0 };
    }

    const candidates = items.filter((item) => item?.type === 'image' && item?.id);
    const limit = Math.max(1, Math.min(50, Number(maxToQueue) || 10));
    let queued = 0;

    for (const item of candidates.slice(0, limit)) {
        if (queueStageAPrimitiveAnalysis(item)) {
            queued += 1;
        }
    }

    return {
        queued,
        remaining: Math.max(0, candidates.length - queued),
        totalCandidates: candidates.length,
    };
}
