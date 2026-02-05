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

    const prompt = `Extract search tags from this image source. Be smart about it:
- Recognize product names (iPhone-16-pro → "iPhone 16 Pro", "iPhone")
- Identify brands (apple.com → "Apple")  
- Extract meaningful keywords, skip noise (utm_source, random IDs)
- Include style hints if present (hero, banner, minimal)
- Max 8 tags, lowercase, no duplicates

${context}

Return ONLY comma-separated tags. Example: apple, iphone 16 pro, titanium, blue, hero image`;

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
