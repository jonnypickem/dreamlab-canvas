/**
 * Gemini Vision API Service
 * Handles AI image analysis for objective and context-aware tagging
 */

const GEMINI_MODEL = import.meta.env.VITE_GEMINI_VISION_MODEL || 'gemini-2.5-pro';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Objective analysis prompt - comprehensive visual analysis
const OBJECTIVE_PROMPT = `You are a professional visual analyst. Analyze this image comprehensively and provide 15-20 descriptive tags.

REQUIRED TAG CATEGORIES:

1. **OBJECTS** (Specific): "iphone 16 pro", "leather chair", "ceramic vase" (Avoid generic "product")
2. **COLORS** (Specific): "matte-black", "electric-blue", "warm-beige", "neon-green", "translucent"
3. **VIBE/MOOD**: "minimalist", "retro", "industrial", "luxurious", "playful", "moody"
4. **ART DIRECTION**: "studio lighting", "macro shot", "grainy", "soft focus", "high contrast", "editorial"

STRICTLY IGNORE:
- NO: "collection", "shop", "store", "product", "category", "home", "sale", "new arrival", "best seller", "all", "alle"
- NO: generic words like "image", "photo", "pic", "visual", "view"

Be specific and descriptive. Use compound tags with hyphens.

Return ONLY comma-separated lowercase tags. No explanations, no numbering, no categories labels.

Example output: midnight-blue, lavender-purple, slate-grey, white-background, brushed-aluminum, matte-glass, glossy-finish, dual-camera-system, side-profile, product-photography, minimalist, studio-lighting, premium-tech, clean-aesthetic, purple-tint`;

/**
 * Get API key from settings or environment
 */
function getApiKey() {
    const envKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (envKey) return envKey;

    // Fall back to localStorage settings
    try {
        const settings = JSON.parse(localStorage.getItem('autoTaggingSettings') || '{}');
        if (settings.geminiApiKey) {
            return settings.geminiApiKey;
        }
    } catch (e) {
        console.warn('Failed to read settings:', e);
    }

    return '';
}

/**
 * Analyze image for objective, factual tags
 * @param {string} imageBase64 - Base64 encoded image (with or without data: prefix)
 * @returns {Promise<string[]>} Array of objective tags
 */
export async function analyzeImageObjective(imageBase64) {
    const apiKey = getApiKey();

    if (!apiKey) {
        console.warn('No Gemini API key configured');
        return [];
    }

    try {
        // Remove data:image prefix if present
        const base64Data = imageBase64.includes(',')
            ? imageBase64.split(',')[1]
            : imageBase64;

        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: OBJECTIVE_PROMPT },
                        {
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: base64Data
                            }
                        }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Gemini API error:', error);
            return [];
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log('🔍 Vision AI raw response:', text);

        // Parse comma-separated tags
        const tags = text
            .split(',')
            .map(t => t.trim().toLowerCase())
            .filter(t => t.length > 0 && t.length < 50); // Filter out empty or overly long responses

        console.log(`🔍 Vision AI parsed ${tags.length} tags:`, tags);

        return tags;

    } catch (error) {
        console.error('Objective AI analysis failed:', error);
        return [];
    }
}

/**
 * Build context-aware prompt using project information
 * @param {Object} project - Project object with description, style, category, aiPrompt
 * @returns {string} Constructed prompt
 */
export function buildContextPrompt(project) {
    let prompt = `Analyze this image for the "${project.name}" project.\n\n`;

    if (project.description) {
        prompt += `Project Context:\n${project.description}\n\n`;
    }

    if (project.style?.length > 0) {
        prompt += `Visual Style: ${project.style.join(', ')}\n`;
    }

    if (project.category && project.category !== 'general') {
        prompt += `Category: ${project.category}\n`;
    }

    if (project.aiPrompt) {
        prompt += `Special Instructions: ${project.aiPrompt}\n\n`;
    }

    prompt += `Provide 5-8 context-aware tags that:\n`;
    prompt += `1. Relate this image to the project goals and description\n`;
    prompt += `2. Highlight features or elements mentioned in the context\n`;
    prompt += `3. Connect to the project's brand positioning or aesthetic\n`;
    prompt += `4. Help find similar project-relevant images\n`;
    prompt += `5. Be specific to THIS project, not just descriptive\n\n`;
    prompt += `Be specific but concise. Use terms relevant to the project.\n`;
    prompt += `Return ONLY comma-separated tags, no explanation.\n\n`;
    prompt += `Example: titanium-finish, triple-camera, premium-aesthetic, tech-innovation, launch-ready`;

    return prompt;
}

/**
 * Analyze image with project context for semantic tags
 * @param {string} imageBase64 - Base64 encoded image
 * @param {Object} project - Project object with context fields
 * @returns {Promise<string[]>} Array of context-aware tags
 */
export async function analyzeImageWithContext(imageBase64, project) {
    // Skip if no project context available
    if (!project || !project.description) {
        return [];
    }

    const apiKey = getApiKey();

    if (!apiKey) {
        console.warn('No Gemini API key configured');
        return [];
    }

    try {
        const prompt = buildContextPrompt(project);

        // Remove data:image prefix if present
        const base64Data = imageBase64.includes(',')
            ? imageBase64.split(',')[1]
            : imageBase64;

        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: base64Data
                            }
                        }
                    ]
                }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Gemini API error:', error);
            return [];
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        const tags = text
            .split(',')
            .map(t => t.trim().toLowerCase())
            .filter(t => t.length > 0 && t.length < 50);

        return tags;

    } catch (error) {
        console.error('Context AI analysis failed:', error);
        return [];
    }
}

/**
 * Test if API key is valid
 * @param {string} apiKey - API key to test
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function testApiKey(apiKey) {
    if (!apiKey) {
        return { valid: false, error: 'No API key provided' };
    }

    try {
        const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: 'Respond with just the word "OK"' }]
                }]
            })
        });

        if (!response.ok) {
            const error = await response.json();
            return {
                valid: false,
                error: error.error?.message || 'Invalid API key'
            };
        }

        return { valid: true };

    } catch (error) {
        return { valid: false, error: error.message };
    }
}

/**
 * Estimate cost for AI operations
 * @param {number} imageCount - Number of images to analyze
 * @returns {{cost: number, formatted: string}}
 */
export function estimateCost(imageCount) {
    const costPerImage = 0.0015; // ~$0.0015 per image with Gemini Flash
    const cost = imageCount * costPerImage;
    return {
        cost,
        formatted: `$${cost.toFixed(4)}`
    };
}
