import { imageToBase64 } from '../utils/imageProxy';

const DEFAULT_MODEL = import.meta.env.VITE_GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_ALIASES = {
    'nano banana pro': 'gemini-3-pro-image-preview',
    'nano-banana-pro': 'gemini-3-pro-image-preview',
    nano_banana_pro: 'gemini-3-pro-image-preview',
    'nano banana': 'gemini-2.5-flash-image',
    'nano-banana': 'gemini-2.5-flash-image',
    nano_banana: 'gemini-2.5-flash-image',
};
const FALLBACK_MODELS = ['gemini-2.5-flash-image'];

function getApiKey() {
    const envKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (envKey) return envKey;

    try {
        const settings = JSON.parse(localStorage.getItem('autoTaggingSettings') || '{}');
        if (settings.geminiApiKey) {
            return settings.geminiApiKey;
        }
    } catch {
        // Ignore parsing issues and fall back to env var.
    }

    return '';
}

function dataUrlToInlineData(dataUrl) {
    const match = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
    if (!match) return null;

    return {
        mime_type: match[1],
        data: match[2],
    };
}

function collectInlineImageParts(responseJson) {
    const candidates = Array.isArray(responseJson?.candidates) ? responseJson.candidates : [];
    const imageParts = [];

    candidates.forEach((candidate) => {
        const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : [];
        parts.forEach((part) => {
            const inlineData = part?.inlineData || part?.inline_data;
            if (inlineData?.data && inlineData?.mimeType) {
                imageParts.push({
                    data: inlineData.data,
                    mimeType: inlineData.mimeType,
                });
            } else if (inlineData?.data && inlineData?.mime_type) {
                imageParts.push({
                    data: inlineData.data,
                    mimeType: inlineData.mime_type,
                });
            }
        });
    });

    return imageParts;
}

function normalizeModelName(model) {
    if (!model || typeof model !== 'string') return DEFAULT_MODEL;
    const normalized = model.trim().toLowerCase();
    return MODEL_ALIASES[normalized] || model.trim();
}

async function callGeminiModel({ model, body, apiKey }) {
    const response = await fetch(`${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (response.ok) {
        return { ok: true, data: await response.json(), status: response.status };
    }

    let message = `Gemini image generation failed (${response.status}) for ${model}.`;
    try {
        const errorPayload = await response.json();
        if (errorPayload?.error?.message) {
            message = errorPayload.error.message;
        }
    } catch {
        // Keep fallback message.
    }

    return { ok: false, status: response.status, message, model };
}

export async function generateImagesWithGemini({
    prompt,
    negativePrompt = '',
    referenceImageUrls = [],
    count = 1,
    model = DEFAULT_MODEL,
}) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('Gemini API key is not configured.');
    }

    const clampedCount = Math.max(1, Math.min(4, Number(count) || 1));
    const promptText = negativePrompt
        ? `${prompt}\n\nAvoid: ${negativePrompt}`
        : prompt;

    const referenceParts = [];
    const referenceUrls = referenceImageUrls.slice(0, 3);

    for (const url of referenceUrls) {
        try {
            const dataUrl = await imageToBase64(url);
            const inlineData = dataUrlToInlineData(dataUrl);
            if (inlineData) {
                referenceParts.push({ inline_data: inlineData });
            }
        } catch {
            // Skip invalid/unreachable references and continue generation.
        }
    }

    const body = {
        contents: [{
            parts: [
                { text: promptText },
                ...referenceParts,
            ],
        }],
        generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            candidateCount: clampedCount,
        },
    };

    const requestedModel = normalizeModelName(model);
    const modelCandidates = [requestedModel, ...FALLBACK_MODELS].filter(
        (candidate, index, list) => candidate && list.indexOf(candidate) === index
    );
    const attempts = [];

    for (const candidateModel of modelCandidates) {
        const result = await callGeminiModel({ model: candidateModel, body, apiKey });
        if (result.ok) {
            const data = result.data;
            const imageParts = collectInlineImageParts(data);

            const images = imageParts.map((part, index) => ({
                id: `gemini_${Date.now()}_${index}`,
                mimeType: part.mimeType,
                dataUrl: `data:${part.mimeType};base64,${part.data}`,
            }));

            const text = data?.candidates?.[0]?.content?.parts?.find((part) => part?.text)?.text || '';

            return {
                images,
                text,
                raw: data,
                model: candidateModel,
            };
        }

        attempts.push({ model: candidateModel, status: result.status, message: result.message });

        const isRetryableModelError = result.status === 404
            || /not found|not supported|unsupported|not available|deprecated/i.test(result.message || '');
        if (!isRetryableModelError) {
            throw new Error(`[${candidateModel}] ${result.message}`);
        }
    }

    const attemptSummary = attempts.map((a) => `${a.model} (${a.status})`).join(', ');
    throw new Error(`No compatible Gemini image model available. Tried: ${attemptSummary}`);
}
