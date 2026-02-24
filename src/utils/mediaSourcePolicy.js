export const CANVAS_ORIGINAL_SCALE_THRESHOLD = 1.6;
export const CANVAS_ORIGINAL_PIXELS_THRESHOLD = 350_000;

function readMediaVariants(item) {
    if (!item || typeof item !== 'object') return null;
    const variants = item?.metadata?.mediaVariants;
    if (!variants || typeof variants !== 'object') return null;
    return variants;
}

export function getItemMediaVariantPaths(item) {
    const variants = readMediaVariants(item);
    const previewPath = String(variants?.previewPath || item?.thumbnail || '').trim() || null;
    const canvasPath = String(variants?.canvasPath || item?.thumbnail || item?.content || '').trim() || null;
    const originalPath = String(variants?.originalPath || item?.content || '').trim() || null;
    return {
        previewPath,
        canvasPath,
        originalPath,
    };
}

export function shouldUseOriginalForCanvas({ scale, renderedPixels } = {}) {
    const normalizedScale = Number(scale) || 1;
    const normalizedPixels = Number(renderedPixels) || 0;
    return normalizedScale >= CANVAS_ORIGINAL_SCALE_THRESHOLD
        && normalizedPixels >= CANVAS_ORIGINAL_PIXELS_THRESHOLD;
}

export function resolveItemMediaSource(item, options = {}) {
    const context = String(options?.context || 'grid').toLowerCase();
    if (!item || typeof item !== 'object') return '';

    const { previewPath, canvasPath, originalPath } = getItemMediaVariantPaths(item);

    if (item.type === 'image') {
        if (context === 'modal') return originalPath || canvasPath || previewPath || '';
        if (context === 'canvas') {
            if (shouldUseOriginalForCanvas(options)) {
                return originalPath || canvasPath || previewPath || '';
            }
            return canvasPath || previewPath || originalPath || '';
        }
        return previewPath || canvasPath || originalPath || '';
    }

    if (item.type === 'link') {
        // For link previews, prefer preview derivative when present.
        return previewPath || canvasPath || originalPath || '';
    }

    return '';
}

export function hasCompleteMediaVariants(item) {
    const variants = readMediaVariants(item);
    const previewPath = String(variants?.previewPath || '').trim();
    const canvasPath = String(variants?.canvasPath || '').trim();
    const originalPath = String(variants?.originalPath || '').trim();
    return Boolean(previewPath && canvasPath && originalPath);
}
