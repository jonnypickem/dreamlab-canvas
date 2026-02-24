import { getMediaUrl, isSupabaseStoragePath, uploadMediaVariant } from '../lib/supabaseStorage';
import { updateItem } from '../lib/storage';
import { generateThumbnail } from '../utils/imageResize';
import { hasCompleteMediaVariants } from '../utils/mediaSourcePolicy';
import { getProxyUrl, isExternalUrl } from '../utils/imageProxy';

const RETRY_COOLDOWN_MS = 5 * 60 * 1000;
const EXTENDED_RETRY_COOLDOWN_MS = 20 * 60 * 1000;
const inFlight = new Set();
const retryAfterAt = new Map();
let queue = Promise.resolve();

function mergeMetadataWithVariants(item, variants) {
    const metadata = item?.metadata && typeof item.metadata === 'object'
        ? item.metadata
        : {};
    return {
        ...metadata,
        mediaVariants: {
            ...(metadata.mediaVariants || {}),
            ...variants,
            version: 1,
            updatedAt: Date.now(),
        },
    };
}

async function sourceToBlob(sourcePath) {
    if (!sourcePath) throw new Error('Missing source path for media variant backfill.');
    let fetchUrl = sourcePath;
    if (isSupabaseStoragePath(sourcePath)) {
        fetchUrl = await getMediaUrl(sourcePath);
        if (!fetchUrl) {
            throw new Error('Could not resolve storage path for media variant backfill.');
        }
    } else if (isExternalUrl(sourcePath)) {
        fetchUrl = getProxyUrl(sourcePath);
    }
    const response = await fetch(fetchUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch media source (${response.status}).`);
    }
    const blob = await response.blob();
    if (!blob.type?.startsWith('image/')) {
        throw new Error('Media variant backfill only supports images.');
    }
    return blob;
}

async function backfillImageItem(item) {
    const itemId = String(item?.id || '').trim();
    if (!itemId) return;
    if (hasCompleteMediaVariants(item)) return;
    const sourcePath = String(item?.content || item?.thumbnail || '').trim();
    if (!sourcePath) return;

    const blob = await sourceToBlob(sourcePath);
    const previewBlob = await generateThumbnail(blob, { maxDimension: 480, quality: 0.60 });
    const canvasBlob = await generateThumbnail(blob, { maxDimension: 1600, quality: 0.72 });

    const originalPath = isSupabaseStoragePath(sourcePath)
        ? sourcePath
        : await uploadMediaVariant(blob, itemId, 'original');
    const previewPath = await uploadMediaVariant(previewBlob, itemId, 'preview');
    const canvasPath = await uploadMediaVariant(canvasBlob, itemId, 'canvas');

    await updateItem(itemId, {
        content: originalPath,
        contentStorage: 'supabase',
        thumbnail: previewPath,
        thumbnailStorage: 'supabase',
        metadata: mergeMetadataWithVariants(item, {
            previewPath,
            canvasPath,
            originalPath,
        }),
    });
}

async function backfillLinkItem(item) {
    const itemId = String(item?.id || '').trim();
    if (!itemId) return;
    if (hasCompleteMediaVariants(item)) return;
    const sourcePath = String(item?.thumbnail || '').trim();
    if (!sourcePath) return;

    const blob = await sourceToBlob(sourcePath);
    const previewBlob = await generateThumbnail(blob, { maxDimension: 480, quality: 0.60 });
    const canvasBlob = await generateThumbnail(blob, { maxDimension: 1600, quality: 0.72 });

    const originalPath = isSupabaseStoragePath(sourcePath)
        ? sourcePath
        : await uploadMediaVariant(blob, itemId, 'original');
    const previewPath = await uploadMediaVariant(previewBlob, itemId, 'preview');
    const canvasPath = await uploadMediaVariant(canvasBlob, itemId, 'canvas');

    await updateItem(itemId, {
        thumbnail: previewPath,
        thumbnailStorage: 'supabase',
        metadata: mergeMetadataWithVariants(item, {
            previewPath,
            canvasPath,
            originalPath,
        }),
    });
}

async function runBackfill(item) {
    if (!item || !item.id) return;
    if (item.type === 'image') return backfillImageItem(item);
    if (item.type === 'link') return backfillLinkItem(item);
}

function getRetryDelayMs(error) {
    const message = String(error?.message || '').toLowerCase();
    if (
        message.includes('cors')
        || message.includes('failed to fetch')
        || message.includes('(400)')
        || message.includes('(401)')
        || message.includes('(403)')
        || message.includes('(404)')
    ) {
        return EXTENDED_RETRY_COOLDOWN_MS;
    }
    return RETRY_COOLDOWN_MS;
}

export function queueItemMediaVariantBackfill(item) {
    const itemId = String(item?.id || '').trim();
    if (!itemId) return;
    if (hasCompleteMediaVariants(item)) return;
    if (item.type !== 'image' && item.type !== 'link') return;
    if (inFlight.has(itemId)) return;

    const blockedUntil = Number(retryAfterAt.get(itemId) || 0);
    if (Date.now() < blockedUntil) return;

    inFlight.add(itemId);
    queue = queue
        .then(() => runBackfill(item))
        .catch((error) => {
            retryAfterAt.set(itemId, Date.now() + getRetryDelayMs(error));
        })
        .finally(() => {
            inFlight.delete(itemId);
        });
}
