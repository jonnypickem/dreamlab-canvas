// =============================================
// FILE: vibeEngine.js
// =============================================

import { getProject, getExtractions, saveExtraction, saveProjectVibe } from '../lib/storage';
import { buildExtractionPrompt, buildQuickExtractionPrompt, buildGeminiRequestBody, parseExtractionResponse } from './extractionPrompt';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// --- Aggregation debounce ---
// We don't re-aggregate on every single image. We wait for a pause.
const aggregationTimers = {}; // projectId → timeout handle
const AGGREGATION_DEBOUNCE_MS = 5000;

const vibeQueue = [];
let isProcessingVibe = false;

/**
 * Public wrapper to queue vibe extraction.
 */
export function extractVibeFromImage(item, projectId, level = 'standard') {
    if (!projectId || item.type !== 'image') return;

    console.log(`⚡ Vibe: Queueing ${item.id} (${level})`);
    vibeQueue.push({ item, projectId, level });

    if (!isProcessingVibe) {
        processVibeQueue();
    }
}

/**
 * Process the queue sequentially with a delay to respect rate limits.
 */
async function processVibeQueue() {
    if (vibeQueue.length === 0) {
        isProcessingVibe = false;
        return;
    }

    isProcessingVibe = true;
    const { item, projectId, level } = vibeQueue.shift();

    try {
        await runVibeExtraction(item, projectId, level);
    } catch (error) {
        console.error('⚡ Vibe: Queue processing error:', error);
    }

    // Wait 5 seconds before next request (Gemini Free Tier: 15 RPM = ~4s per request)
    setTimeout(processVibeQueue, 5000);
}

/**
 * Internal logic for a single extraction request.
 */
async function runVibeExtraction(item, projectId, level) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
        console.warn('⚡ Vibe: extraction skipped — no Gemini API key');
        return null;
    }

    // Build project context from project settings
    const project = getProject(projectId);
    if (!project) return null;

    const projectContext = {
        name: project.name,
        category: project.category || 'general',
        description: project.description || undefined,
        styleKeywords: project.style || [],
        defaultTags: project.tags || [],
        customInstructions: project.aiPrompt || undefined,
    };

    // Choose prompt depth
    const prompt = level === 'quick'
        ? buildQuickExtractionPrompt(projectContext)
        : buildExtractionPrompt(projectContext);

    // Get image as base64
    let imageBase64 = item.content;
    let mimeType = 'image/jpeg';

    if (imageBase64.startsWith('data:')) {
        // Already base64 data URL — strip prefix
        const match = imageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
            mimeType = match[1];
            imageBase64 = match[2];
        }
    } else if (imageBase64.startsWith('http')) {
        // It's a URL — need to fetch and convert to base64
        try {
            const { imageToBase64 } = await import('../utils/imageProxy');
            const dataUrl = await imageToBase64(imageBase64);
            const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
            if (match) {
                mimeType = match[1];
                imageBase64 = match[2];
            } else {
                console.warn('⚡ Vibe: could not parse base64 from URL conversion');
                return null;
            }
        } catch (e) {
            console.warn('⚡ Vibe: failed to fetch image from URL:', e);
            return null;
        }
    } else {
        console.warn('⚡ Vibe: unrecognized image content format');
        return null;
    }

    try {
        console.log(`⚡ Vibe: Calling Gemini for ${item.id} (${level})...`);

        const body = buildGeminiRequestBody(imageBase64, mimeType, prompt);
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const err = await response.json();
            console.error('⚡ Vibe: API error:', err.error?.message);
            // If we hit rate limit again, notify
            if (response.status === 429) {
                console.warn('⚡ Vibe: Rate limit hit (429), slowing down...');
            }
            return null;
        }

        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) return null;

        // Parse into typed extraction
        const extraction = parseExtractionResponse(responseText, item.id, 'gemini-2.0-flash', level);
        if (!extraction) return null;

        // Store it
        saveExtraction(projectId, extraction);
        console.log(`⚡ Vibe: Extracted for ${item.id} — relevance: ${extraction.relevance}, mood: ${extraction.mood.primary}`);

        // Trigger debounced aggregation
        scheduleAggregation(projectId);

        return extraction;

    } catch (error) {
        console.error('⚡ Vibe: extraction failed:', error);
        return null;
    }
}


/**
 * Schedule vibe re-aggregation after a pause in image additions.
 * If the designer is rapidly adding images, we wait until they stop.
 */
function scheduleAggregation(projectId) {
    if (aggregationTimers[projectId]) {
        clearTimeout(aggregationTimers[projectId]);
    }
    aggregationTimers[projectId] = setTimeout(() => {
        aggregateProjectVibe(projectId);
        delete aggregationTimers[projectId];
    }, AGGREGATION_DEBOUNCE_MS);
}


/**
 * Aggregate all extractions for a project into a ProjectVibe.
 * This runs automatically — the designer never calls it.
 */
export function aggregateProjectVibe(projectId) {
    const extractions = getExtractions(projectId);

    if (extractions.length < 3) {
        console.log(`⚡ Vibe: only ${extractions.length} extractions — need 3+ to generate vibe`);
        return null;
    }

    console.log(`⚡ Aggregating vibe from ${extractions.length} extractions...`);

    // Filter to relevant images (relevance > 0.3)
    const relevant = extractions.filter(e => e.relevance > 0.3);
    if (relevant.length < 2) {
        console.log('⚡ Vibe: not enough relevant images');
        return null;
    }

    const vibe = {
        id: `vibe_${projectId}`,
        projectId,
        updatedAt: Date.now(),
        imageCount: extractions.length,
        extractionCount: relevant.length,
        maturity: getMaturity(relevant.length),

        style: {
            medium: findConsensus(relevant, e => e.style.medium),
            rendering: findConsensus(relevant, e => e.style.rendering),
        },
        mood: {
            primary: findConsensus(relevant, e => e.mood.primary),
            energy: findConsensus(relevant, e => e.mood.energy),
            atmosphere: findConsensus(relevant, e => e.mood?.atmosphere),
            keywords: collectAll(relevant, e => e.mood?.keywords || []),
        },
        composition: {
            dominantShotType: findConsensus(relevant, e => e.composition.shotType),
            dominantAngle: findConsensus(relevant, e => e.composition.cameraAngle),
        },
        lighting: {
            dominantType: findConsensus(relevant, e => e.lighting.type),
            quality: findConsensus(relevant, e => e.lighting.quality),
            colorTemperature: findConsensus(relevant, e => e.lighting.colorTemperature),
        },
        color: {
            palette: findConsensus(relevant, e => e.color.palette),
            dominantColors: collectAll(relevant, e => e.color.dominantColors || []),
        },
        texture: {
            detailLevel: findConsensus(relevant, e => e.texture.detailLevel),
        },
        subjectPatterns: {
            commonSubjects: collectAll(relevant, e => [e.subject.primary]),
            hasPeopleRatio: relevant.filter(e => e.subject.hasPeople).length / relevant.length,
            hasTextRatio: relevant.filter(e => e.subject.hasText).length / relevant.length,
        },
    };

    saveProjectVibe(projectId, vibe);
    console.log(`⚡ Vibe generated: "${vibe.mood.primary.value}" mood, "${vibe.color.palette.value}" palette, maturity: ${vibe.maturity}`);

    return vibe;
}


// --- Aggregation Helpers ---

function getMaturity(count) {
    if (count >= 15) return 'strong';
    if (count >= 8) return 'stable';
    if (count >= 5) return 'emerging';
    return 'nascent';
}

/**
 * Find the most common value across extractions for a given field.
 * Returns a VibeField with confidence and consensus level.
 */
function findConsensus(extractions, accessor) {
    const values = extractions.map(accessor).filter(Boolean);
    if (values.length === 0) {
        return { value: 'unknown', confidence: 0, source: 'extracted', fromImages: [], consensus: 'weak' };
    }

    // Count occurrences
    const counts = {};
    const imageMap = {}; // value → [itemIds]
    values.forEach((val, i) => {
        counts[val] = (counts[val] || 0) + 1;
        if (!imageMap[val]) imageMap[val] = [];
        imageMap[val].push(extractions[i].itemId);
    });

    // Find winner
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const [winner, count] = sorted[0];
    const ratio = count / extractions.length;

    return {
        value: winner,
        confidence: ratio,
        source: 'extracted',
        fromImages: imageMap[winner] || [],
        consensus: ratio >= 0.7 ? 'strong' : ratio >= 0.4 ? 'moderate' : 'weak',
    };
}

/**
 * Collect all values from an array field, ranked by frequency.
 * Good for colors, keywords, subjects.
 */
function collectAll(extractions, accessor) {
    const all = extractions.flatMap(accessor).filter(Boolean);
    const counts = {};
    all.forEach(val => {
        const normalized = val.toLowerCase().trim();
        counts[normalized] = (counts[normalized] || 0) + 1;
    });

    // Sort by frequency, take top values
    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8) // top 8
        .map(([val]) => val);

    const ratio = sorted.length > 0 ? counts[sorted[0]] / extractions.length : 0;

    return {
        value: sorted,
        confidence: ratio,
        source: 'extracted',
        fromImages: extractions.map(e => e.itemId),
        consensus: ratio >= 0.7 ? 'strong' : ratio >= 0.4 ? 'moderate' : 'weak',
    };
}