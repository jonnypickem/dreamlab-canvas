const MEDIA_DB_NAME = 'dreamlab_media_db';
const MEDIA_DB_VERSION = 1;
const MEDIA_STORE = 'media_blobs';
const MEDIA_REF_PREFIX = 'idb://media/';
const OBJECT_URL_CACHE_MAX = 350;

let dbPromise = null;
const objectUrlCache = new Map();

function evictObjectUrlCacheIfNeeded() {
    if (objectUrlCache.size <= OBJECT_URL_CACHE_MAX) return;
    for (const [key, entry] of objectUrlCache.entries()) {
        if (!entry || entry.refCount > 0) continue;
        if (entry.url) URL.revokeObjectURL(entry.url);
        objectUrlCache.delete(key);
        if (objectUrlCache.size <= OBJECT_URL_CACHE_MAX) return;
    }
}

function canUseIndexedDb() {
    return typeof indexedDB !== 'undefined';
}

function openMediaDb() {
    if (!canUseIndexedDb()) {
        return Promise.reject(new Error('IndexedDB is not available'));
    }
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(MEDIA_DB_NAME, MEDIA_DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(MEDIA_STORE)) {
                db.createObjectStore(MEDIA_STORE);
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Failed to open media database'));
    });

    return dbPromise;
}

function transaction(storeMode, operation) {
    return openMediaDb().then((db) => new Promise((resolve, reject) => {
        const tx = db.transaction(MEDIA_STORE, storeMode);
        const store = tx.objectStore(MEDIA_STORE);

        tx.onabort = () => reject(tx.error || new Error('Media database transaction aborted'));
        tx.onerror = () => reject(tx.error || new Error('Media database transaction failed'));
        tx.oncomplete = () => resolve();

        operation(store, resolve, reject);
    }));
}

export function isMediaStoreRef(value) {
    return typeof value === 'string' && value.startsWith(MEDIA_REF_PREFIX);
}

export function makeMediaStoreRef(key) {
    return `${MEDIA_REF_PREFIX}${String(key || '').trim()}`;
}

export function buildImageMediaKey(itemId) {
    return `img:${String(itemId || '').trim()}`;
}

export function buildThumbnailMediaKey(itemId) {
    return `thumb:${String(itemId || '').trim()}`;
}

export function getMediaStoreKey(refOrKey) {
    if (!refOrKey) return '';
    if (isMediaStoreRef(refOrKey)) {
        return String(refOrKey).slice(MEDIA_REF_PREFIX.length);
    }
    return String(refOrKey);
}

export function dataUrlToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
        throw new Error('Expected a data URL');
    }

    const [header, base64Payload = ''] = dataUrl.split(',', 2);
    const mimeMatch = header.match(/^data:([^;]+);base64$/i);
    const mimeType = mimeMatch?.[1] || 'application/octet-stream';
    const binary = atob(base64Payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
}

export async function putMediaBlob(key, blob) {
    const mediaKey = getMediaStoreKey(key);
    if (!mediaKey) throw new Error('Missing media key');
    if (!(blob instanceof Blob)) throw new Error('Expected media blob');

    await transaction('readwrite', (store) => {
        store.put(blob, mediaKey);
    });

    return makeMediaStoreRef(mediaKey);
}

export async function putMediaDataUrl(key, dataUrl) {
    const blob = dataUrlToBlob(dataUrl);
    return putMediaBlob(key, blob);
}

export function getMediaBlob(refOrKey) {
    const mediaKey = getMediaStoreKey(refOrKey);
    if (!mediaKey) return Promise.resolve(null);

    return transaction('readonly', (store, resolve) => {
        const request = store.get(mediaKey);
        request.onsuccess = () => {
            const value = request.result;
            resolve(value instanceof Blob ? value : null);
        };
    });
}

export async function deleteMediaBlob(refOrKey) {
    const mediaKey = getMediaStoreKey(refOrKey);
    if (!mediaKey) return;

    await transaction('readwrite', (store) => {
        store.delete(mediaKey);
    });
}

export async function deleteMediaForItems(items = []) {
    const mediaRefs = (Array.isArray(items) ? items : [])
        .flatMap((item) => [item?.content, item?.thumbnail])
        .filter((value) => isMediaStoreRef(value));

    if (mediaRefs.length === 0) return;

    await Promise.allSettled(mediaRefs.map((ref) => deleteMediaBlob(ref)));
}

export async function clearMediaStore() {
    await transaction('readwrite', (store) => {
        store.clear();
    });
}

export async function resolveRenderableMediaSrc(source) {
    if (!isMediaStoreRef(source)) return source || '';

    const existing = objectUrlCache.get(source);
    if (existing) {
        existing.refCount += 1;
        if (existing.url) return existing.url;
        return existing.promise;
    }

    const entry = {
        refCount: 1,
        url: '',
        promise: null,
    };
    objectUrlCache.set(source, entry);

    entry.promise = (async () => {
        try {
            const blob = await getMediaBlob(source);
            if (!blob) throw new Error('Media blob not found');
            const objectUrl = URL.createObjectURL(blob);
            if (objectUrlCache.get(source) !== entry || entry.refCount <= 0) {
                URL.revokeObjectURL(objectUrl);
                throw new Error('Media source was released');
            }
            entry.url = objectUrl;
            evictObjectUrlCacheIfNeeded();
            return objectUrl;
        } catch (error) {
            objectUrlCache.delete(source);
            throw error;
        }
    })();

    return entry.promise;
}

export function releaseRenderableMediaSrc(source) {
    if (!isMediaStoreRef(source)) return;
    const entry = objectUrlCache.get(source);
    if (!entry) return;

    entry.refCount = Math.max(0, Number(entry.refCount || 0) - 1);
    if (entry.refCount > 0) return;

    if (entry.url) {
        URL.revokeObjectURL(entry.url);
    }
    objectUrlCache.delete(source);
}

export async function offloadItemImageToIndexedDb(item) {
    if (!item || item.type !== 'image' || typeof item.content !== 'string') {
        return item;
    }
    if (isMediaStoreRef(item.content)) return item;
    if (!item.content.startsWith('data:image/')) return item;

    const id = item.id || crypto.randomUUID();
    const mediaKey = buildImageMediaKey(id);
    const ref = await putMediaDataUrl(mediaKey, item.content);
    return {
        ...item,
        id,
        content: ref,
        contentStorage: 'indexeddb',
    };
}

export async function offloadItemThumbnailToIndexedDb(item) {
    if (!item || item.type !== 'link' || typeof item.thumbnail !== 'string') {
        return item;
    }
    if (isMediaStoreRef(item.thumbnail)) return item;
    if (!item.thumbnail.startsWith('data:image/')) return item;

    const id = item.id || crypto.randomUUID();
    const mediaKey = buildThumbnailMediaKey(id);
    const ref = await putMediaDataUrl(mediaKey, item.thumbnail);
    return {
        ...item,
        id,
        thumbnail: ref,
        thumbnailStorage: 'indexeddb',
    };
}

export async function offloadItemMediaToIndexedDb(item) {
    let current = item;
    if (!current || typeof current !== 'object') return current;

    if (!current.id) {
        current = { ...current, id: crypto.randomUUID() };
    }

    if (current.type === 'image') {
        current = await offloadItemImageToIndexedDb(current);
    }
    if (current.type === 'link') {
        current = await offloadItemThumbnailToIndexedDb(current);
    }

    return current;
}
