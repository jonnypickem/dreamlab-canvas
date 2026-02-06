/**
 * Gemini Text Service - Smart tier metadata interpretation
 * Uses text-only LLM to understand URL/filename context (~$0.0002/request)
 */

const GEMINI_TEXT_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * Get API key from environment
 */
function getApiKey() {
    return import.meta.env.VITE_GEMINI_API_KEY;
}

/**
 * Smart metadata interpretation using text LLM
 * Takes URL and filename, returns intelligent tags
 * 
 * @param {string} sourceUrl - Full URL or "clipboard"/"figma"
 * @param {string} filename - Filename if available
 * @returns {Promise<string[]>} Array of smart tags
 */
export async function interpretMetadata(sourceUrl, filename = '') {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.warn('No Gemini API key, skipping Smart interpretation');
        return [];
    }

    // Build context string
    let context = '';
    if (sourceUrl && sourceUrl !== 'clipboard' && sourceUrl !== 'figma') {
        context += `URL: ${sourceUrl}\n`;
    }
    if (filename) {
        context += `Filename: ${filename}\n`;
    }

    if (!context) {
        return []; // Nothing to interpret
    }

    const prompt = `Extract highly specific visual tags from this image context. 
Focus strictly on:
1. **Objects** (e.g., "iphone 16 pro", "leather chair")
2. **Colors** (e.g., "matte-black", "neon-green" - be specific)
3. **Vibes** (e.g., "minimalist", "retro", "industrial")
4. **Art Direction** (e.g., "studio lighting", "macro shot", "grainy")

Strictly IGNORE generic e-commerce terms:
- NO: "collection", "shop", "product", "category", "home", "sale", "new arrival", "add to cart", "all", "alle"
- NO: generic words like "image", "photo", "pic"

Context:
${context}

Return ONLY meaningful, lowercase, comma-separated tags. Max 10 tags.`;

    try {
        const response = await fetch(`${GEMINI_TEXT_URL}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 100
                }
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // Parse comma-separated tags
        const tags = text
            .split(',')
            .map(t => t.trim().toLowerCase())
            .filter(t => t.length > 0 && t.length < 30)
            .slice(0, 8);

        return tags;

    } catch (error) {
        console.error('Smart interpretation failed:', error);
        return [];
    }
}

/**
 * Estimate cost for Smart tier
 * ~100 tokens in, ~20 tokens out = ~$0.0002
 */
export function estimateSmartCost(imageCount) {
    return imageCount * 0.0002;
}
