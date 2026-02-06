/**
 * Metadata Extractor
 * Extracts tags from URL, filename, and image colors (free, instant)
 */

// Common words to filter out from URL/filename extraction
const STOP_WORDS = new Set([
    'www', 'com', 'org', 'net', 'io', 'co', 'http', 'https',
    'html', 'htm', 'php', 'asp', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'were',
    'image', 'images', 'img', 'photo', 'photos', 'pic', 'pics', 'picture',
    'upload', 'uploads', 'media', 'assets', 'static', 'files', 'file',
    'index', 'default', 'main', 'page', 'content', 'data',
    'thumb', 'thumbnail', 'thumbnails', 'preview', 'small', 'large', 'medium',
    'new', 'old', 'copy', 'final', 'v1', 'v2', 'v3', 'temp', 'tmp',
    // Commerce / Generic
    'category', 'categories', 'collection', 'collections', 'product', 'products', 'item', 'items',
    'shop', 'store', 'cart', 'basket', 'checkout', 'sale', 'offer',
    'home', 'about', 'contact', 'search', 'login', 'signup',
    'menu', 'nav', 'navigation', 'result', 'results', 'filter', 'filters', 'sort', 'view', 'all',
    // German Common Words
    'und', 'für', 'von', 'mit', 'bei', 'dem', 'den', 'das', 'die', 'der',
    'ein', 'eine', 'einen', 'im', 'in', 'aus', 'auf', 'ist', 'sind',
    'startseite', 'kategorie', 'kategorien', 'produkt', 'produkte',
    'warenkorb', 'kasse', 'anmelden', 'registrieren', 'suche',
    'zuhause', 'seite', 'bild', 'bilder', 'datei', 'alle', 'alles', 'menü', 'navigation'
]);

// Minimum word length for extraction
const MIN_WORD_LENGTH = 3;

/**
 * Extract domain tag from URL
 * @param {string} url - Source URL
 * @returns {string|null} Domain name or null
 */
export function extractDomainTag(url) {
    if (!url) return null;

    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;

        // Remove common prefixes
        let domain = hostname.replace(/^www\./, '');

        // Get the main domain (e.g., "pinterest" from "pinterest.com")
        const parts = domain.split('.');
        if (parts.length >= 2) {
            domain = parts[parts.length - 2]; // Second to last part
        }

        // Filter out very short or generic domains
        if (domain.length < 3 || STOP_WORDS.has(domain)) {
            return null;
        }

        return domain.toLowerCase();

    } catch (e) {
        return null;
    }
}

/**
 * Extract keywords from URL path
 * @param {string} url - Source URL
 * @returns {string[]} Array of keywords
 */
export function extractUrlKeywords(url) {
    if (!url) return [];

    try {
        const urlObj = new URL(url);
        const path = urlObj.pathname + urlObj.search;

        // Split by common delimiters
        const words = path
            .split(/[-_\/\?\&\=\+\.]+/)
            .map(w => w.toLowerCase().trim())
            .filter(w =>
                w.length >= MIN_WORD_LENGTH &&
                !STOP_WORDS.has(w) &&
                !/^\d+$/.test(w) && // Filter pure numbers
                /^[a-z]+$/.test(w) // Only letters
            );

        // Deduplicate and limit
        return [...new Set(words)].slice(0, 5);

    } catch (e) {
        return [];
    }
}

/**
 * Extract keywords from filename/title
 * @param {string} filename - Image filename or title
 * @returns {string[]} Array of keywords
 */
export function extractFilenameKeywords(filename) {
    if (!filename) return [];

    // Remove file extension
    const name = filename.replace(/\.[^.]+$/, '');

    // Split by common delimiters (including camelCase)
    const words = name
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Split camelCase
        .split(/[-_\s\.]+/)
        .map(w => w.toLowerCase().trim())
        .filter(w =>
            w.length >= MIN_WORD_LENGTH &&
            !STOP_WORDS.has(w) &&
            !/^\d+$/.test(w)
        );

    return [...new Set(words)].slice(0, 5);
}

/**
 * Extract dominant colors from image (simplified version)
 * Uses canvas sampling - works synchronously
 * @param {HTMLImageElement|string} image - Image element or base64 string
 * @returns {Promise<string[]>} Array of color names
 */
export async function extractDominantColors(imageSource) {
    return new Promise((resolve) => {
        try {
            const img = new Image();
            img.crossOrigin = 'anonymous';

            img.onload = () => {
                try {
                    // Create small canvas for sampling
                    const canvas = document.createElement('canvas');
                    const size = 50; // Sample at 50x50 for speed
                    canvas.width = size;
                    canvas.height = size;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, size, size);

                    const imageData = ctx.getImageData(0, 0, size, size).data;

                    // Simple color binning
                    const colorCounts = {};

                    for (let i = 0; i < imageData.length; i += 16) { // Sample every 4th pixel
                        const r = imageData[i];
                        const g = imageData[i + 1];
                        const b = imageData[i + 2];

                        const colorName = rgbToColorName(r, g, b);
                        if (colorName) {
                            colorCounts[colorName] = (colorCounts[colorName] || 0) + 1;
                        }
                    }

                    // Sort by count and take top 3
                    const sortedColors = Object.entries(colorCounts)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([name]) => name);

                    resolve(sortedColors);

                } catch (e) {
                    console.warn('Color extraction failed:', e);
                    resolve([]);
                }
            };

            img.onerror = () => resolve([]);

            // Handle both URL and base64
            if (typeof imageSource === 'string') {
                img.src = imageSource;
            } else {
                resolve([]);
            }

        } catch (e) {
            resolve([]);
        }
    });
}

/**
 * Convert RGB to simple color name
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string|null} Color name
 */
function rgbToColorName(r, g, b) {
    // Calculate HSL for better color naming
    const max = Math.max(r, g, b) / 255;
    const min = Math.min(r, g, b) / 255;
    const l = (max + min) / 2;

    // Very dark or very light
    if (l < 0.15) return 'black';
    if (l > 0.85) return 'white';

    // Grayscale
    if (max - min < 0.1) return 'gray';

    // Get hue
    let h;
    const d = max - min;
    const rn = r / 255, gn = g / 255, bn = b / 255;

    if (max === rn) {
        h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    } else if (max === gn) {
        h = ((bn - rn) / d + 2) / 6;
    } else {
        h = ((rn - gn) / d + 4) / 6;
    }

    h *= 360;

    // Map hue to color name
    if (h < 15 || h >= 345) return 'red';
    if (h < 45) return 'orange';
    if (h < 75) return 'yellow';
    if (h < 150) return 'green';
    if (h < 195) return 'cyan';
    if (h < 255) return 'blue';
    if (h < 285) return 'purple';
    if (h < 345) return 'pink';

    return null;
}

/**
 * Extract all metadata tags from an item
 * @param {Object} item - Item with sourceUrl, title, content
 * @returns {Promise<string[]>} Combined array of all extracted tags
 */
export async function extractAllMetadataTags(item) {
    const tags = [];

    // Domain tag
    const domainTag = extractDomainTag(item.sourceUrl);
    if (domainTag) {
        tags.push(domainTag);
    }

    // URL keywords
    const urlKeywords = extractUrlKeywords(item.sourceUrl);
    tags.push(...urlKeywords);

    // Filename keywords
    const filenameKeywords = extractFilenameKeywords(item.title);
    tags.push(...filenameKeywords);

    // Color extraction (if image content is available)
    if (item.content && item.type === 'image') {
        const colors = await extractDominantColors(item.content);
        tags.push(...colors);
    }

    // Deduplicate and return
    return [...new Set(tags)];
}
