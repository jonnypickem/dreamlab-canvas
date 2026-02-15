/**
 * Generate a thumbnail blob from an image blob.
 * Returns a resized JPEG suitable for grid/card views.
 *
 * @param {Blob} blob  Original image blob
 * @param {Object} opts
 * @param {number} opts.maxDimension  Longest side cap (default 800)
 * @param {number} opts.quality       JPEG quality 0-1 (default 0.75)
 * @returns {Promise<Blob>} Resized JPEG blob (falls back to original on error)
 */
export function generateThumbnail(blob, { maxDimension = 800, quality = 0.75 } = {}) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);

        img.onload = () => {
            let width = img.width;
            let height = img.height;

            // Skip if already small enough
            if (width <= maxDimension && height <= maxDimension) {
                URL.revokeObjectURL(url);
                resolve(blob);
                return;
            }

            if (width > height) {
                height = height * (maxDimension / width);
                width = maxDimension;
            } else {
                width = width * (maxDimension / height);
                height = maxDimension;
            }

            const canvas = document.createElement('canvas');
            canvas.width = Math.round(width);
            canvas.height = Math.round(height);
            const ctx = canvas.getContext('2d');
            if (!ctx) { URL.revokeObjectURL(url); resolve(blob); return; }

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(
                (b) => { URL.revokeObjectURL(url); resolve(b || blob); },
                'image/jpeg',
                quality,
            );
        };

        img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
        img.src = url;
    });
}
