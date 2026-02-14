import { supabase, getCurrentUserId } from './supabase';

const BUCKET = 'dreamlab-media';

/**
 * Upload a Blob to Supabase Storage.
 * @param {Blob} blob
 * @param {string} itemId
 * @param {'image'|'thumbnail'} type
 * @returns {Promise<string>} storage path (e.g. "{userId}/images/{itemId}.jpg")
 */
export async function uploadMedia(blob, itemId, type = 'image') {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Must be authenticated to upload media.');

    const folder = type === 'thumbnail' ? 'thumbnails'
        : type === 'video' ? 'videos'
            : 'images';
    const ext = blob.type === 'image/png' ? 'png'
        : blob.type === 'image/webp' ? 'webp'
            : blob.type === 'image/gif' ? 'gif'
                : blob.type === 'video/webm' ? 'webm'
                    : blob.type === 'video/mp4' ? 'mp4'
                        : 'jpg';
    const path = `${userId}/${folder}/${itemId}.${ext}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: blob.type, upsert: true });

    if (error) throw error;
    return path;
}

/**
 * Upload a data-URL string to Supabase Storage.
 */
export async function uploadDataUrl(dataUrl, itemId, type = 'image') {
    const blob = dataUrlToBlob(dataUrl);
    return uploadMedia(blob, itemId, type);
}

/**
 * In-memory cache for signed URLs to avoid redundant network requests
 * when switching collections or re-rendering cards.
 * Entries expire 5 minutes before the signed URL itself to avoid stale URLs.
 */
const _signedUrlCache = new Map();
const CACHE_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry

/**
 * Get a signed URL for a storage path. Returns the input as-is for
 * http(s) URLs, data-URLs, and legacy idb:// references.
 * @param {string} pathOrUrl
 * @param {number} expiresIn  seconds (default 1 hour)
 * @returns {Promise<string>}
 */
export async function getMediaUrl(pathOrUrl, expiresIn = 3600) {
    if (!pathOrUrl) return '';

    // Already a renderable URL — pass through.
    if (
        pathOrUrl.startsWith('http://') ||
        pathOrUrl.startsWith('https://') ||
        pathOrUrl.startsWith('data:') ||
        pathOrUrl.startsWith('blob:')
    ) {
        return pathOrUrl;
    }

    // Legacy IndexedDB reference — resolve via old store during migration.
    if (pathOrUrl.startsWith('idb://')) {
        try {
            const { resolveRenderableMediaSrc } = await import('./mediaStore');
            return await resolveRenderableMediaSrc(pathOrUrl);
        } catch {
            return '';
        }
    }

    // Check cache first
    const cached = _signedUrlCache.get(pathOrUrl);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.url;
    }

    // Supabase storage path — get a signed URL.
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(pathOrUrl, expiresIn);

    if (error) throw error;
    const url = data?.signedUrl || '';

    // Cache the signed URL
    if (url) {
        _signedUrlCache.set(pathOrUrl, {
            url,
            expiresAt: Date.now() + (expiresIn * 1000) - CACHE_MARGIN_MS,
        });
    }

    return url;
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteMedia(path) {
    if (!path || path.startsWith('idb://') || path.startsWith('data:')) return;

    _signedUrlCache.delete(path);

    const { error } = await supabase.storage
        .from(BUCKET)
        .remove([path]);

    if (error) throw error;
}

/**
 * Check whether a content/thumbnail value is a Supabase storage path
 * (as opposed to a data-URL, http URL, or idb:// ref).
 */
export function isSupabaseStoragePath(value) {
    if (!value || typeof value !== 'string') return false;
    // Supabase paths look like "{uuid}/images/{uuid}.jpg"
    return /^[0-9a-f-]+\/(images|thumbnails|videos)\//.test(value);
}

// ── helpers ──────────────────────────────────────────────────────────

function dataUrlToBlob(dataUrl) {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
}
