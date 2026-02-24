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
    const candidates = getItemMediaCandidatePaths(item, options);
    return candidates[0] || '';
}

export function getItemMediaCandidatePaths(item, options = {}) {
    const context = String(options?.context || 'grid').toLowerCase();
    if (!item || typeof item !== 'object') return [];

    const { previewPath, canvasPath, originalPath } = getItemMediaVariantPaths(item);
    const ordered = [];
    const pushCandidate = (value) => {
        const path = String(value || '').trim();
        if (!path) return;
        if (ordered.includes(path)) return;
        ordered.push(path);
    };

    if (item.type === 'image') {
        if (context === 'modal') {
            pushCandidate(originalPath);
            pushCandidate(canvasPath);
            pushCandidate(previewPath);
            return ordered;
        }
        if (context === 'canvas') {
            if (shouldUseOriginalForCanvas(options)) {
                pushCandidate(originalPath);
                pushCandidate(canvasPath);
                pushCandidate(previewPath);
                return ordered;
            }
            pushCandidate(canvasPath);
            pushCandidate(previewPath);
            pushCandidate(originalPath);
            return ordered;
        }
        pushCandidate(previewPath);
        pushCandidate(canvasPath);
        pushCandidate(originalPath);
        return ordered;
    }

    if (item.type === 'link') {
        pushCandidate(previewPath);
        pushCandidate(canvasPath);
        pushCandidate(originalPath);
        return ordered;
    }

    return ordered;
}

export function hasCompleteMediaVariants(item) {
    const variants = readMediaVariants(item);
    const previewPath = String(variants?.previewPath || '').trim();
    const canvasPath = String(variants?.canvasPath || '').trim();
    const originalPath = String(variants?.originalPath || '').trim();
    return Boolean(previewPath && canvasPath && originalPath);
}
