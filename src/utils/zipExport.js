import JSZip from 'jszip';
import saveAs from 'file-saver';
import { fetchImageViaProxy } from './imageProxy';

/**
 * Sanitize filename for safe filesystem use
 */
export function sanitizeFilename(name, maxLength = 50) {
    if (!name) return 'image';

    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '-')  // Replace special chars with dash
        .replace(/\s+/g, '-')            // Replace spaces with dash
        .replace(/-+/g, '-')             // Remove multiple dashes
        .replace(/^-|-$/g, '')           // Remove leading/trailing dashes
        .substring(0, maxLength);
}

/**
 * Get file extension from MIME type or URL
 */
export function getExtension(mimeType, url) {
    if (mimeType) {
        if (mimeType.includes('png')) return '.png';
        if (mimeType.includes('gif')) return '.gif';
        if (mimeType.includes('webp')) return '.webp';
        if (mimeType.includes('svg')) return '.svg';
    }

    if (url) {
        const ext = url.split('.').pop()?.toLowerCase()?.split('?')[0];
        if (['png', 'gif', 'webp', 'svg', 'jpg', 'jpeg'].includes(ext)) {
            return `.${ext === 'jpeg' ? 'jpg' : ext}`;
        }
    }

    return '.jpg'; // Default
}

/**
 * Fetch image as blob (handles both base64, local, and external URLs via proxy)
 */
async function fetchImageAsBlob(content) {
    try {
        // Use the proxy utility which handles external URLs
        return await fetchImageViaProxy(content);
    } catch (error) {
        console.warn('Failed to fetch image:', content, error);
        return null;
    }
}

/**
 * Generate ZIP filename based on project and date
 */
export function generateZipFilename(projectName, itemCount) {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sanitizedProject = sanitizeFilename(projectName || 'dreamlab', 30);
    return `${sanitizedProject}-${itemCount}-images-${date}.zip`;
}

/**
 * Export selected items as ZIP
 * @param {Array} items - Array of item objects to export
 * @param {string} projectName - Name of the project for filename
 * @param {Function} onProgress - Callback for progress updates (current, total)
 * @returns {Promise<{success: number, failed: number}>}
 */
function getExportSource(item) {
    if (!item || typeof item !== 'object') return '';
    if (item.type === 'image') return item.content || '';
    if (item.type === 'link') return item.thumbnail || '';
    return '';
}

export async function exportItemsAsZip(items, projectName, onProgress) {
    const zip = new JSZip();
    const imgFolder = zip.folder('images');

    let success = 0;
    let failed = 0;
    const usedNames = new Set();

    // Filter to only exportable items (images and links with thumbnails)
    const exportableItems = items.filter((item) => Boolean(getExportSource(item)));

    if (exportableItems.length === 0) {
        throw new Error('No images to export');
    }

    const total = exportableItems.length;

    for (let i = 0; i < exportableItems.length; i++) {
        const item = exportableItems[i];
        const source = getExportSource(item);

        try {
            const blob = await fetchImageAsBlob(source);

            if (!blob) {
                failed++;
                continue;
            }

            // Generate unique filename
            let baseName = sanitizeFilename(
                item.title || item.sourceUrl?.split('/').pop() || `image-${i + 1}`
            );
            const ext = getExtension(blob.type, source);

            // Ensure unique filename
            let filename = `${baseName}${ext}`;
            let counter = 1;
            while (usedNames.has(filename)) {
                filename = `${baseName}-${counter}${ext}`;
                counter++;
            }
            usedNames.add(filename);

            // Add to ZIP
            imgFolder.file(filename, blob);
            success++;

            // Progress callback every 5 items
            if (onProgress && (i + 1) % 5 === 0) {
                onProgress(i + 1, total);
            }
        } catch (error) {
            console.warn('Failed to process item:', item.id, error);
            failed++;
        }
    }

    if (success === 0) {
        throw new Error('Could not export images. Browser security prevents downloading images hosted on external sites (CORS).');
    }

    // Generate ZIP with DEFLATE compression level 6
    onProgress?.(total, total, 'Generating ZIP...');

    const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
    });

    // Trigger download
    const zipFilename = generateZipFilename(projectName, success);
    saveAs(zipBlob, zipFilename);

    return { success, failed, filename: zipFilename };
}
