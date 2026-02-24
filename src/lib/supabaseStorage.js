import { supabase, getCurrentUserId } from './supabase';

const BUCKET = 'dreamlab-media';
const MEDIA_VARIANT_VERSION = 1;
const SIGNED_URL_DB_NAME = 'dreamlab_signed_url_cache';
const SIGNED_URL_DB_VERSION = 1;
const SIGNED_URL_STORE = 'urls';
const _signedUrlInFlight = new Map();
let _signedUrlDbPromise = null;

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
        .upload(path, blob, {
            contentType: blob.type,
            upsert: true,
            cacheControl: type === 'thumbnail' ? '31536000, immutable' : '86400',
        });

    if (error) throw error;
    return path;
}

export async function uploadMediaVariant(blob, itemId, variantType, mediaType = 'image') {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('Must be authenticated to upload media variants.');
    const variant = String(variantType || '').trim().toLowerCase();
    if (!['preview', 'canvas', 'original'].includes(variant)) {
        throw new Error('Invalid media variant type.');
    }

    const folder = mediaType === 'video' ? 'videos' : 'images';
    const ext = blob.type === 'image/png' ? 'png'
        : blob.type === 'image/webp' ? 'webp'
            : blob.type === 'image/gif' ? 'gif'
                : blob.type === 'video/webm' ? 'webm'
                    : blob.type === 'video/mp4' ? 'mp4'
                        : 'jpg';
    const path = `${userId}/${folder}/${itemId}.${variant}.v${MEDIA_VARIANT_VERSION}.${ext}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, {
            contentType: blob.type,
            upsert: true,
            cacheControl: '31536000, immutable',
        });
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

function canUseIndexedDb() {
    return typeof indexedDB !== 'undefined';
}

function openSignedUrlDb() {
    if (!canUseIndexedDb()) {
        return Promise.reject(new Error('IndexedDB unavailable'));
    }
    if (_signedUrlDbPromise) return _signedUrlDbPromise;

    _signedUrlDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(SIGNED_URL_DB_NAME, SIGNED_URL_DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(SIGNED_URL_STORE)) {
                db.createObjectStore(SIGNED_URL_STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed to open signed URL cache DB'));
    });
    return _signedUrlDbPromise;
}

async function readPersistedSignedUrl(pathOrUrl) {
    try {
        const db = await openSignedUrlDb();
        return await new Promise((resolve) => {
            const tx = db.transaction(SIGNED_URL_STORE, 'readonly');
            const store = tx.objectStore(SIGNED_URL_STORE);
            const req = store.get(pathOrUrl);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => resolve(null);
        });
    } catch {
        return null;
    }
}

async function writePersistedSignedUrl(pathOrUrl, payload) {
    try {
        const db = await openSignedUrlDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(SIGNED_URL_STORE, 'readwrite');
            const store = tx.objectStore(SIGNED_URL_STORE);
            store.put(payload, pathOrUrl);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Signed URL cache write failed'));
            tx.onabort = () => reject(tx.error || new Error('Signed URL cache write aborted'));
        });
    } catch {
        // Best-effort persistence only.
    }
}

async function deletePersistedSignedUrl(pathOrUrl) {
    try {
        const db = await openSignedUrlDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(SIGNED_URL_STORE, 'readwrite');
            const store = tx.objectStore(SIGNED_URL_STORE);
            store.delete(pathOrUrl);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('Signed URL cache delete failed'));
            tx.onabort = () => reject(tx.error || new Error('Signed URL cache delete aborted'));
        });
    } catch {
        // Best-effort persistence only.
    }
}

export function invalidateMediaUrl(pathOrUrl) {
    if (!pathOrUrl || typeof pathOrUrl !== 'string') return;
    _signedUrlCache.delete(pathOrUrl);
    _signedUrlInFlight.delete(pathOrUrl);
    void deletePersistedSignedUrl(pathOrUrl);
}

/**
 * Get a signed URL for a storage path. Returns the input as-is for
 * http(s) URLs, data-URLs, and legacy idb:// references.
 * @param {string} pathOrUrl
 * @param {number} expiresIn  seconds (default 1 hour)
 * @returns {Promise<string>}
 */
export async function getMediaUrl(pathOrUrl, expiresIn = 3600, options = {}) {
    if (!pathOrUrl) return '';
    const normalizedExpiresIn = Number.isFinite(Number(expiresIn))
        ? Number(expiresIn)
        : 3600;
    const normalizedOptions = (expiresIn && typeof expiresIn === 'object')
        ? expiresIn
        : options;
    const forceRefresh = Boolean(normalizedOptions?.forceRefresh);

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

    if (!isSupabaseStoragePath(pathOrUrl)) {
        return '';
    }

    if (forceRefresh) {
        invalidateMediaUrl(pathOrUrl);
    }

    // Check cache first
    const cached = _signedUrlCache.get(pathOrUrl);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.url;
    }
    const persisted = await readPersistedSignedUrl(pathOrUrl);
    if (persisted?.url && Date.now() < Number(persisted.expiresAt || 0)) {
        _signedUrlCache.set(pathOrUrl, {
            url: persisted.url,
            expiresAt: Number(persisted.expiresAt || 0),
        });
        return persisted.url;
    }

    const inFlight = _signedUrlInFlight.get(pathOrUrl);
    if (inFlight) return inFlight;

    const resolvePromise = (async () => {
        // Supabase storage path — get a signed URL.
        const { data, error } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(pathOrUrl, normalizedExpiresIn);

        if (error) throw error;
        const url = data?.signedUrl || '';

        // Cache the signed URL
        if (url) {
            const expiresAt = Date.now() + (normalizedExpiresIn * 1000) - CACHE_MARGIN_MS;
            _signedUrlCache.set(pathOrUrl, {
                url,
                expiresAt,
            });
            void writePersistedSignedUrl(pathOrUrl, { url, expiresAt });
        }

        return url;
    })().finally(() => {
        _signedUrlInFlight.delete(pathOrUrl);
    });

    _signedUrlInFlight.set(pathOrUrl, resolvePromise);
    return resolvePromise;
}

export async function getMediaUrls(paths = [], expiresIn = 3600) {
    const uniquePaths = [...new Set((Array.isArray(paths) ? paths : []).filter(Boolean))];
    if (uniquePaths.length === 0) return {};
    const entries = await Promise.all(uniquePaths.map(async (path) => [path, await getMediaUrl(path, expiresIn)]));
    return Object.fromEntries(entries);
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteMedia(path) {
    if (!path || path.startsWith('idb://') || path.startsWith('data:')) return;

    _signedUrlCache.delete(path);
    _signedUrlInFlight.delete(path);

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
    const path = value.trim();
    if (!path) return false;
    if (
        path.startsWith('http://')
        || path.startsWith('https://')
        || path.startsWith('data:')
        || path.startsWith('blob:')
        || path.startsWith('idb://')
    ) {
        return false;
    }
    if (!path.includes('/')) return false;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return /\/(images|thumbnails|videos)\//.test(normalized);
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
