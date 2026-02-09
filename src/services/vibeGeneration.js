// =============================================================================
// DreamLab — Vibe Generation Pipeline
// =============================================================================
//
// Converts ProjectVibe → GenerationVibe → platform-specific prompt.
//
// KEY INSIGHT: The same vibe produces DIFFERENT prompts depending on intent.
//
//   "Retro, fun, pastel bottles" collection could generate:
//     → Product design prompt  (emphasizes shape, materials, detail)
//     → Logo prompt            (emphasizes colors, style, mood)
//     → Photography prompt     (emphasizes lighting, composition, atmosphere)
//     → Brand style prompt     (balanced across all fields)
//
// Usage:
//   import { generatePrompt } from './vibeGeneration';
//
//   const result = generatePrompt(projectVibe, {
//     intent: 'product_design',
//     subject: 'a sleek drinking bottle with grip texture',
//     platform: 'midjourney',
//   });
//
//   result.positive  → "product shot of a sleek drinking bottle..."
//   result.negative  → "watermark, blurry, low quality..."
//
// =============================================================================

import { getProjectVibe } from '../lib/storage';


// -----------------------------------------------------------------------------
// Intent Definitions
// -----------------------------------------------------------------------------
// Each intent defines which vibe fields matter most and how to weight them.

const INTENT_PROFILES = {

    product_design: {
        label: 'Product Design',
        description: 'Generate product concepts, packaging, industrial design',
        fieldWeights: {
            subject: 1.0,       // What the product looks like is everything
            style: 0.9,         // Medium and rendering matter a lot
            color: 0.9,         // Color palette is critical for products
            texture: 0.9,       // Materials, surface quality
            mood: 0.7,          // Emotional tone of the product
            lighting: 0.8,      // How it's lit affects perception
            composition: 0.5,   // Less critical — usually centered product shot
            technical: 0.6,     // Camera/lens for realism
        },
        defaultMedium: 'product shot',
        defaultComposition: 'medium shot',
        defaultNegative: ['watermark', 'blurry', 'low quality', 'distorted proportions', 'unrealistic materials'],
    },

    logo_identity: {
        label: 'Logo & Identity',
        description: 'Generate logos, marks, visual identity elements',
        fieldWeights: {
            style: 1.0,         // Visual style is everything for logos
            color: 1.0,         // Color palette defines the brand
            mood: 0.9,          // Emotional tone shapes the identity
            subject: 0.7,       // The mark itself
            texture: 0.4,       // Less relevant for logos
            lighting: 0.2,      // Mostly irrelevant
            composition: 0.3,   // Simple compositions
            technical: 0.1,     // Not applicable
        },
        defaultMedium: 'vector art',
        defaultComposition: 'centered',
        defaultNegative: ['photorealistic', 'complex background', 'blurry', 'too many details', 'watermark', '3D render'],
    },

    photography_direction: {
        label: 'Photography Direction',
        description: 'Define how photos should be shot — lighting, mood, composition',
        fieldWeights: {
            lighting: 1.0,      // Lighting IS photography direction
            composition: 1.0,   // Framing, angle, shot type
            mood: 0.9,          // The feel of the shoot
            color: 0.9,         // Color grading, palette
            subject: 0.6,       // What's in the shot
            style: 0.7,         // Photography style
            texture: 0.5,       // Film grain, bokeh, etc
            technical: 0.9,     // Camera, lens, settings matter
        },
        defaultMedium: 'photograph',
        defaultComposition: null,  // Use whatever the vibe says
        defaultNegative: ['watermark', 'oversaturated', 'artificial looking', 'low quality', 'overexposed', 'underexposed'],
    },

    brand_style: {
        label: 'Brand Style',
        description: 'Overall brand visual direction — mood boards, style guides',
        fieldWeights: {
            mood: 1.0,          // Brand is about feeling
            color: 1.0,         // Brand colors
            style: 0.9,         // Visual language
            lighting: 0.7,      // Contributes to brand feel
            texture: 0.6,       // Surface quality and detail
            composition: 0.5,   // General framing preferences
            subject: 0.5,       // Context-dependent
            technical: 0.3,     // Less important for brand direction
        },
        defaultMedium: null,  // Use whatever the vibe says
        defaultComposition: null,
        defaultNegative: ['watermark', 'blurry', 'low quality', 'generic', 'stock photo feel'],
    },

    illustration: {
        label: 'Illustration',
        description: 'Generate illustrations, concept art, digital art',
        fieldWeights: {
            style: 1.0,         // Art style is primary
            mood: 0.9,          // Emotional tone
            color: 0.9,         // Palette
            subject: 0.8,       // What to illustrate
            composition: 0.7,   // Framing
            texture: 0.7,       // Detail level, texture effects
            lighting: 0.6,      // Lighting in illustration
            technical: 0.2,     // Render engine maybe
        },
        defaultMedium: 'illustration',
        defaultComposition: null,
        defaultNegative: ['photorealistic', 'watermark', 'blurry', 'low quality', 'bad anatomy'],
    },

    social_media: {
        label: 'Social Media',
        description: 'Content for Instagram, TikTok, social campaigns',
        fieldWeights: {
            mood: 1.0,          // Vibe is everything on social
            color: 1.0,         // Eye-catching palette
            style: 0.8,         // Visual style
            subject: 0.8,       // What's featured
            composition: 0.7,   // Framing for mobile
            lighting: 0.7,      // Attractive lighting
            texture: 0.5,       // Detail
            technical: 0.4,     // Less important
        },
        defaultMedium: null,
        defaultComposition: null,
        defaultNegative: ['watermark', 'blurry', 'low quality', 'boring', 'generic'],
    },
};


// -----------------------------------------------------------------------------
// Main Entry Point
// -----------------------------------------------------------------------------

/**
 * Generate a prompt from a ProjectVibe.
 *
 * @param {Object} projectVibe - The aggregated ProjectVibe from localStorage
 * @param {Object} options
 * @param {string} options.intent - One of the INTENT_PROFILES keys
 * @param {string} options.subject - What to generate (required — the vibe doesn't dictate WHAT, only HOW)
 * @param {string} options.platform - Target platform: 'universal' | 'midjourney' | 'dalle' | 'flux' | 'stable_diffusion'
 * @param {Object} options.overrides - Manual overrides for any GenerationVibe field
 * @returns {{ positive: string, negative: string, generationVibe: Object }}
 */
export function generatePrompt(projectVibe, options = {}) {
    const {
        intent = 'brand_style',
        subject = '',
        platform = 'universal',
        overrides = {},
    } = options;

    const profile = INTENT_PROFILES[intent] || INTENT_PROFILES.brand_style;

    // Step 1: Convert ProjectVibe → GenerationVibe
    const generationVibe = toGenerationVibe(projectVibe, profile, subject, overrides);

    // Step 2: Convert GenerationVibe → prompt string
    const prompt = vibeToPrompt(generationVibe, platform, profile);

    return {
        ...prompt,
        generationVibe,
        intent,
        platform,
    };
}

/**
 * Generate a prompt directly from a projectId.
 * Convenience wrapper that loads the vibe from storage.
 */
export function generatePromptForProject(projectId, options = {}) {
    const projectVibe = getProjectVibe(projectId);
    if (!projectVibe) {
        console.warn('⚡ No vibe found for project:', projectId);
        return null;
    }
    return generatePrompt(projectVibe, options);
}

/**
 * Get available intents with their descriptions.
 */
export function getAvailableIntents() {
    return Object.entries(INTENT_PROFILES).map(([key, profile]) => ({
        key,
        label: profile.label,
        description: profile.description,
    }));
}


// -----------------------------------------------------------------------------
// ProjectVibe → GenerationVibe Conversion
// -----------------------------------------------------------------------------

function toGenerationVibe(projectVibe, profile, subject, overrides) {
    // Helper: extract value from VibeField, respecting weight threshold
    const v = (vibeField, weight = 1) => {
        if (!vibeField) return undefined;
        // Skip fields with very low weight for this intent
        if (weight < 0.3) return undefined;
        // Skip fields with weak consensus unless weight is very high
        if (vibeField.consensus === 'weak' && weight < 0.8) return undefined;
        return vibeField.value;
    };

    const w = profile.fieldWeights;

    const vibe = {
        meta: {
            name: `Generated from ${projectVibe.projectId}`,
            intent: profile.label,
            target_platform: 'universal',
        },

        subject: {
            primary: subject || 'design concept',
            // Subject patterns from vibe inform but don't override user's subject
        },

        style: {
            medium: profile.defaultMedium || v(projectVibe.style?.medium, w.style) || 'photograph',
            rendering_style: v(projectVibe.style?.rendering, w.style),
            art_movement: v(projectVibe.style?.artMovement, w.style),
        },

        vibe: {
            mood: v(projectVibe.mood?.primary, w.mood),
            energy: v(projectVibe.mood?.energy, w.mood),
            atmosphere: v(projectVibe.mood?.atmosphere, w.mood),
            aesthetic: v(projectVibe.mood?.aesthetic, w.mood),
            emotional_keywords: v(projectVibe.mood?.keywords, w.mood),
        },

        composition: {
            shot_type: profile.defaultComposition || v(projectVibe.composition?.dominantShotType, w.composition),
            camera_angle: v(projectVibe.composition?.dominantAngle, w.composition),
        },

        lighting: {
            type: v(projectVibe.lighting?.dominantType, w.lighting),
            quality: v(projectVibe.lighting?.quality, w.lighting),
            color_temperature: v(projectVibe.lighting?.colorTemperature, w.lighting),
            mood_lighting: v(projectVibe.lighting?.moodLighting, w.lighting),
        },

        color: {
            palette: v(projectVibe.color?.palette, w.color),
            dominant_colors: v(projectVibe.color?.dominantColors, w.color),
            accent_colors: v(projectVibe.color?.accentColors, w.color),
            color_grade: v(projectVibe.color?.colorGrade, w.color),
        },

        texture_detail: {
            detail_level: v(projectVibe.texture?.detailLevel, w.texture),
            surface_quality: v(projectVibe.texture?.surfaceQuality, w.texture),
            texture_effects: v(projectVibe.texture?.commonEffects, w.texture),
        },

        constraints: {
            must_exclude: [...(profile.defaultNegative || [])],
        },
    };

    // Apply user overrides (deep merge)
    return deepMerge(vibe, overrides);
}


// -----------------------------------------------------------------------------
// GenerationVibe → Prompt String
// -----------------------------------------------------------------------------

function vibeToPrompt(vibe, platform, profile) {
    // Route to platform-specific formatter
    switch (platform) {
        case 'midjourney':
            return toMidjourneyPrompt(vibe, profile);
        case 'dalle':
            return toDallePrompt(vibe, profile);
        case 'flux':
        case 'stable_diffusion':
            return toKeywordPrompt(vibe, profile);
        default:
            return toUniversalPrompt(vibe, profile);
    }
}


// --- Universal (works everywhere) ---

function toUniversalPrompt(vibe, profile) {
    const w = profile.fieldWeights;
    const parts = [];

    // Subject always first (highest priority in all AI models)
    if (vibe.style?.medium) parts.push(vibe.style.medium);
    parts.push(`of ${vibe.subject.primary}`);

    // Style block
    if (w.style >= 0.7) {
        if (vibe.style?.rendering_style) parts.push(vibe.style.rendering_style);
        if (vibe.style?.art_movement) parts.push(`${vibe.style.art_movement} style`);
    }

    // Mood/Vibe block
    if (w.mood >= 0.7) {
        if (vibe.vibe?.mood) parts.push(`${vibe.vibe.mood} mood`);
        if (vibe.vibe?.energy) parts.push(`${vibe.vibe.energy} energy`);
        if (vibe.vibe?.atmosphere) parts.push(`${vibe.vibe.atmosphere} atmosphere`);
        if (vibe.vibe?.aesthetic) parts.push(`${vibe.vibe.aesthetic} aesthetic`);
    }

    // Composition block
    if (w.composition >= 0.5) {
        if (vibe.composition?.shot_type) parts.push(vibe.composition.shot_type);
        if (vibe.composition?.camera_angle) parts.push(`${vibe.composition.camera_angle} angle`);
    }

    // Lighting block
    if (w.lighting >= 0.5) {
        if (vibe.lighting?.type) parts.push(`${vibe.lighting.type} lighting`);
        if (vibe.lighting?.quality) parts.push(`${vibe.lighting.quality} light`);
        if (vibe.lighting?.mood_lighting) parts.push(vibe.lighting.mood_lighting);
        if (vibe.lighting?.color_temperature) parts.push(`${vibe.lighting.color_temperature} color temperature`);
    }

    // Color block
    if (w.color >= 0.5) {
        if (vibe.color?.palette) parts.push(`${vibe.color.palette} color palette`);
        if (vibe.color?.dominant_colors?.length) {
            parts.push(`colors: ${vibe.color.dominant_colors.slice(0, 4).join(', ')}`);
        }
        if (vibe.color?.color_grade) parts.push(vibe.color.color_grade);
    }

    // Texture block
    if (w.texture >= 0.5) {
        if (vibe.texture_detail?.detail_level) parts.push(vibe.texture_detail.detail_level);
        if (vibe.texture_detail?.surface_quality) parts.push(`${vibe.texture_detail.surface_quality} surfaces`);
    }

    // Emotional keywords (sprinkle at the end for flavor)
    if (vibe.vibe?.emotional_keywords?.length && w.mood >= 0.7) {
        parts.push(vibe.vibe.emotional_keywords.slice(0, 3).join(', '));
    }

    // Technical
    if (w.technical >= 0.5) {
        if (vibe.technical?.camera_model) parts.push(vibe.technical.camera_model);
        if (vibe.technical?.lens) parts.push(vibe.technical.lens);
        if (vibe.technical?.resolution_quality) parts.push(vibe.technical.resolution_quality);
    }

    const positive = parts.filter(Boolean).join(', ');
    const negative = (vibe.constraints?.must_exclude || []).join(', ');

    return { positive, negative };
}


// --- Midjourney (concise, keyword-heavy, max ~60 words) ---

function toMidjourneyPrompt(vibe, profile) {
    const universal = toUniversalPrompt(vibe, profile);

    // Midjourney works best with shorter prompts
    // Trim to essential parts
    const words = universal.positive.split(/[\s,]+/).filter(Boolean);
    const trimmed = words.slice(0, 60).join(' ');

    let prompt = trimmed;

    // Add Midjourney-specific parameters
    const params = [];
    if (vibe.composition?.aspect_ratio) {
        const ar = vibe.composition.aspect_ratio.replace(':', ':');
        params.push(`--ar ${ar}`);
    }

    // Style raw for more photographic results
    if (vibe.style?.medium === 'photograph' || vibe.style?.medium === 'product shot') {
        params.push('--style raw');
    }

    if (params.length) {
        prompt += ' ' + params.join(' ');
    }

    return {
        positive: prompt,
        negative: universal.negative ? `--no ${universal.negative}` : '',
    };
}


// --- DALL-E (natural language, conversational) ---

function toDallePrompt(vibe, profile) {
    const parts = [];

    // DALL-E prefers natural sentences
    const medium = vibe.style?.medium || 'image';
    parts.push(`Create a ${medium} of ${vibe.subject.primary}.`);

    // Mood and atmosphere as a sentence
    const moodParts = [];
    if (vibe.vibe?.mood) moodParts.push(vibe.vibe.mood);
    if (vibe.vibe?.atmosphere) moodParts.push(vibe.vibe.atmosphere);
    if (moodParts.length) {
        parts.push(`The overall feeling should be ${moodParts.join(' and ')}.`);
    }

    // Lighting
    if (vibe.lighting?.type || vibe.lighting?.mood_lighting) {
        const light = vibe.lighting.mood_lighting || vibe.lighting.type;
        parts.push(`Use ${light} lighting${vibe.lighting.color_temperature ? ` with ${vibe.lighting.color_temperature} tones` : ''}.`);
    }

    // Color
    if (vibe.color?.dominant_colors?.length) {
        parts.push(`The color palette should feature ${vibe.color.dominant_colors.slice(0, 4).join(', ')}.`);
    } else if (vibe.color?.palette) {
        parts.push(`Use a ${vibe.color.palette} color palette.`);
    }

    // Composition
    if (vibe.composition?.shot_type) {
        parts.push(`Frame it as a ${vibe.composition.shot_type}.`);
    }

    // Style
    if (vibe.style?.rendering_style) {
        parts.push(`The style should be ${vibe.style.rendering_style}.`);
    }

    // What to avoid
    if (vibe.constraints?.must_exclude?.length) {
        parts.push(`Avoid: ${vibe.constraints.must_exclude.join(', ')}.`);
    }

    return {
        positive: parts.join(' '),
        negative: '', // DALL-E doesn't use separate negative prompts
    };
}


// --- Keyword style (Flux, Stable Diffusion) ---

function toKeywordPrompt(vibe, profile) {
    const universal = toUniversalPrompt(vibe, profile);

    // These models handle longer keyword lists well
    return {
        positive: universal.positive,
        negative: universal.negative,
    };
}


// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

function deepMerge(target, source) {
    if (!source) return target;
    const result = { ...target };

    for (const key of Object.keys(source)) {
        if (source[key] === undefined) continue;

        if (
            source[key] &&
            typeof source[key] === 'object' &&
            !Array.isArray(source[key]) &&
            target[key] &&
            typeof target[key] === 'object'
        ) {
            result[key] = deepMerge(target[key], source[key]);
        } else {
            result[key] = source[key];
        }
    }

    return result;
}


// -----------------------------------------------------------------------------
// Quick Test Helper
// -----------------------------------------------------------------------------
// Run in DevTools: generatePromptForProject('your-project-id', { intent: 'product_design', subject: 'a retro drinking bottle' })

// Make available globally for testing
if (typeof window !== 'undefined') {
    window.__dreamlab = window.__dreamlab || {};
    window.__dreamlab.generatePrompt = generatePrompt;
    window.__dreamlab.generatePromptForProject = generatePromptForProject;
    window.__dreamlab.getAvailableIntents = getAvailableIntents;
    window.__dreamlab.INTENT_PROFILES = INTENT_PROFILES;
}
