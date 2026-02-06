
// Simple test script for metadataExtractor.js logic
// Run with: node test-tagging.js

const STOP_WORDS = new Set([
    'www', 'com', 'org', 'net', 'io', 'co', 'http', 'https',
    'html', 'htm', 'php', 'asp', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
    'the', 'and', 'for', 'with', 'from', 'this', 'that', 'are', 'was', 'were',
    'image', 'images', 'img', 'photo', 'photos', 'pic', 'pics', 'picture',
    'upload', 'uploads', 'media', 'assets', 'static', 'files', 'file',
    'index', 'default', 'main', 'page', 'content', 'data',
    'thumb', 'thumbnail', 'thumbnails', 'preview', 'small', 'large', 'medium',
    'new', 'old', 'copy', 'final', 'v1', 'v2', 'v3', 'temp', 'tmp'
]);

const MIN_WORD_LENGTH = 3;

function extractDomainTag(url) {
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

function extractUrlKeywords(url) {
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

function extractFilenameKeywords(filename) {
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

// TEST CASES
console.log("--- Testing Tag Extraction ---");

const testItems = [
    {
        name: "Waterdrop Bottle",
        sourceUrl: "https://www.waterdrop.de/products/ricola-glass-bottle?variant=123",
        title: "Ricola Edition Glass Bottle - Limited Edition"
    },
    {
        name: "Generic Image",
        sourceUrl: "https://example.com/assets/images/img_12345.jpg",
        title: "IMG_2024.jpg"
    }
];

testItems.forEach(item => {
    console.log(`\nTesting Item: ${item.name}`);
    console.log(`URL: ${item.sourceUrl}`);
    console.log(`Title: ${item.title}`);

    const domain = extractDomainTag(item.sourceUrl);
    console.log(`Domain Tag:`, domain);

    const urlKw = extractUrlKeywords(item.sourceUrl);
    console.log(`URL Keywords:`, urlKw);

    const filenameKw = extractFilenameKeywords(item.title);
    console.log(`Filename/Title Keywords:`, filenameKw);

    const allTags = [...new Set([domain, ...urlKw, ...filenameKw].filter(Boolean))];
    console.log(`FAILED?`, allTags.length === 0 ? "YES - NO TAGS GENERATED" : "NO - Tags generated");
    console.log(`Results:`, allTags);
});
