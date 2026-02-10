import { STORAGE_KEY, getItems } from '../lib/storage';

function estimateDataUrlBytes(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return 0;
    const base64Part = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    return Math.ceil((base64Part.length * 3) / 4);
}

function loadImage(dataUrl) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Failed to decode image.'));
        image.src = dataUrl;
    });
}

async function compressDataUrl(dataUrl, options = {}) {
    const {
        maxDimension = 1200,
        quality = 0.72,
        mimeType = 'image/jpeg',
    } = options;

    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
        return dataUrl;
    }

    const image = await loadImage(dataUrl);
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL(mimeType, quality);
}

async function aggressivelyCompress(dataUrl) {
    const passes = [
        { maxDimension: 1200, quality: 0.72 },
        { maxDimension: 1000, quality: 0.62 },
        { maxDimension: 820, quality: 0.54 },
        { maxDimension: 680, quality: 0.48 },
    ];

    let current = dataUrl;
    let currentSize = estimateDataUrlBytes(dataUrl);

    for (const pass of passes) {
        try {
            const next = await compressDataUrl(current, pass);
            const nextSize = estimateDataUrlBytes(next);
            if (nextSize < currentSize) {
                current = next;
                currentSize = nextSize;
            }
        } catch {
            // Ignore per-image decode/compression failures and continue.
        }
    }

    return current;
}

export async function compactImageStorage(options = {}) {
    const {
        targetFreedBytes = 900 * 1024,
        maxItemsToProcess = 40,
    } = options;

    const items = getItems();
    const candidates = items
        .map((item, index) => ({
            item,
            index,
            size: estimateDataUrlBytes(item?.content),
        }))
        .filter(({ item, size }) => (
            item?.type === 'image'
            && typeof item?.content === 'string'
            && item.content.startsWith('data:image/')
            && size > 140 * 1024
        ))
        .sort((a, b) => {
            // Prefer compressing larger + older images first.
            if (b.size !== a.size) return b.size - a.size;
            return (a.item.createdAt || 0) - (b.item.createdAt || 0);
        })
        .slice(0, maxItemsToProcess);

    if (!candidates.length) {
        return { compactedCount: 0, freedBytes: 0 };
    }

    const nextItems = [...items];
    let compactedCount = 0;
    let freedBytes = 0;

    for (const candidate of candidates) {
        const original = candidate.item.content;
        const originalSize = candidate.size;
        const compressed = await aggressivelyCompress(original);
        const compressedSize = estimateDataUrlBytes(compressed);

        // Keep only meaningful gains.
        if (compressedSize > 0 && compressedSize < originalSize * 0.94) {
            nextItems[candidate.index] = {
                ...nextItems[candidate.index],
                content: compressed,
            };
            compactedCount += 1;
            freedBytes += (originalSize - compressedSize);
        }

        if (freedBytes >= targetFreedBytes) {
            break;
        }
    }

    if (compactedCount > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextItems));
        window.dispatchEvent(new Event('storage-update'));
    }

    return { compactedCount, freedBytes };
}

