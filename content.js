const DREAMLAB_ORIGINS = new Set([
  'https://dreamlab-canvas.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);

const STORAGE_KEYS = {
  items: 'dreamlab_items',
  workspaces: 'dreamlab_workspaces',
  projects: 'dreamlab_projects',
  collections: 'dreamlab_collections',
  activeContext: 'dreamlab_active_context',
};

const ACTIONS = {
  saveItem: 'SAVE_ITEM',
  getOrgData: 'GET_ORG_DATA',
  scanPageImages: 'SCAN_PAGE_IMAGES',
  triggerMultiSelect: 'TRIGGER_MULTI_SELECT',
  legacyScanVisibleImages: 'SCAN_VISIBLE_IMAGES',
};

const BACKGROUND_ACTIONS = {
  openMultiSelect: 'openMultiSelect',
};

const MEDIA_DB_NAME = 'dreamlab_media_db';
const MEDIA_DB_VERSION = 1;
const MEDIA_STORE = 'media_blobs';
const MEDIA_REF_PREFIX = 'idb://media/';

let mediaDbPromise = null;

function isDreamlabApp() {
  return DREAMLAB_ORIGINS.has(window.location.origin);
}

function readJsonStorage(key, fallbackValue) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallbackValue));
  } catch {
    return fallbackValue;
  }
}

function resolveContextValue(item, key, fallbackValue) {
  return Object.prototype.hasOwnProperty.call(item, key)
    ? item[key]
    : fallbackValue;
}

function getCollectionWorkspaceId(collection, projects) {
  if (!collection || typeof collection !== 'object') return null;
  if (collection.workspaceId) return collection.workspaceId;
  if (!collection.projectId) return null;
  const project = projects.find((candidate) => candidate.id === collection.projectId);
  return project?.workspaceId || null;
}

function isMediaStoreRef(value) {
  return typeof value === 'string' && value.startsWith(MEDIA_REF_PREFIX);
}

function makeMediaRef(key) {
  return `${MEDIA_REF_PREFIX}${String(key || '').trim()}`;
}

function buildImageMediaKey(itemId) {
  return `img:${String(itemId || '').trim()}`;
}

function buildThumbnailMediaKey(itemId) {
  return `thumb:${String(itemId || '').trim()}`;
}

function estimateDataUrlBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const base64Part = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return Math.ceil((base64Part.length * 3) / 4);
}

function canFetchRemoteMedia(source) {
  return typeof source === 'string'
    && (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('blob:'));
}

function dataUrlToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
    throw new Error('Expected data URL');
  }
  const [header, payload = ''] = dataUrl.split(',', 2);
  const mimeMatch = header.match(/^data:([^;]+);base64$/i);
  const mimeType = mimeMatch?.[1] || 'application/octet-stream';
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

async function mediaSourceToBlob(source) {
  if (typeof source !== 'string' || !source) {
    throw new Error('Missing media source');
  }
  if (source.startsWith('data:')) {
    return dataUrlToBlob(source);
  }
  if (canFetchRemoteMedia(source)) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch media source (${response.status})`);
    }
    return response.blob();
  }
  throw new Error('Unsupported media source for IndexedDB storage');
}

function openMediaDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (mediaDbPromise) return mediaDbPromise;

  mediaDbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(MEDIA_DB_NAME, MEDIA_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) {
        db.createObjectStore(MEDIA_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open media DB'));
  });

  return mediaDbPromise;
}

function putMediaBlob(key, blob) {
  return openMediaDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_STORE, 'readwrite');
    const store = tx.objectStore(MEDIA_STORE);
    store.put(blob, key);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error('Media write aborted'));
    tx.onerror = () => reject(tx.error || new Error('Media write failed'));
  }));
}

async function offloadImageContentForItem(item) {
  if (!item || item.type !== 'image' || typeof item.content !== 'string') return item;
  if (isMediaStoreRef(item.content)) return item;

  const id = item.id || crypto.randomUUID();
  const blob = await mediaSourceToBlob(item.content);
  if (!blob?.type?.startsWith?.('image/')) {
    throw new Error('Source is not an image');
  }
  await putMediaBlob(buildImageMediaKey(id), blob);
  return {
    ...item,
    id,
    content: makeMediaRef(buildImageMediaKey(id)),
    contentStorage: 'indexeddb',
  };
}

async function offloadLinkThumbnailForItem(item) {
  if (!item || item.type !== 'link' || typeof item.thumbnail !== 'string') return item;
  if (isMediaStoreRef(item.thumbnail)) return item;
  if (!item.thumbnail.startsWith('data:image/')) return item;

  const id = item.id || crypto.randomUUID();
  const blob = await mediaSourceToBlob(item.thumbnail);
  if (!blob?.type?.startsWith?.('image/')) {
    throw new Error('Thumbnail source is not an image');
  }
  await putMediaBlob(buildThumbnailMediaKey(id), blob);
  return {
    ...item,
    id,
    thumbnail: makeMediaRef(buildThumbnailMediaKey(id)),
    thumbnailStorage: 'indexeddb',
  };
}

async function offloadItemMediaForItem(item) {
  let current = item;
  if (!current || typeof current !== 'object') return current;
  if (!current.id) current = { ...current, id: crypto.randomUUID() };

  if (current.type === 'image') {
    current = await offloadImageContentForItem(current);
  }
  if (current.type === 'link') {
    current = await offloadLinkThumbnailForItem(current);
  }
  return current;
}

async function offloadExistingInlineMedia(items, options = {}) {
  const targetFreedBytes = Math.max(0, Number(options.targetFreedBytes || 0));
  const maxItems = Math.max(1, Number(options.maxItems || 20));
  const list = Array.isArray(items) ? items : [];

  const candidates = list
    .map((candidate, index) => ({
      candidate,
      index,
      bytes: estimateDataUrlBytes(candidate?.content) + estimateDataUrlBytes(candidate?.thumbnail),
    }))
    .filter(({ candidate, bytes }) => (
      (
        (candidate?.type === 'image'
          && typeof candidate?.content === 'string'
          && !isMediaStoreRef(candidate.content)
          && candidate.content.startsWith('data:image/'))
        || (candidate?.type === 'link'
          && typeof candidate?.thumbnail === 'string'
          && !isMediaStoreRef(candidate.thumbnail)
          && candidate.thumbnail.startsWith('data:image/'))
      )
    ))
    .sort((a, b) => b.bytes - a.bytes);

  if (candidates.length === 0) {
    return { items: list, migrated: 0, freedBytes: 0 };
  }

  const nextItems = [...list];
  let migrated = 0;
  let freedBytes = 0;

  for (const entry of candidates) {
    if (migrated >= maxItems) break;
    const { candidate, index, bytes } = entry;
    try {
      const migratedItem = await offloadItemMediaForItem(candidate);
      if (migratedItem.content !== candidate.content || migratedItem.thumbnail !== candidate.thumbnail) {
        nextItems[index] = migratedItem;
        migrated += 1;
        freedBytes += Math.max(bytes, 150_000);
      }
      if (targetFreedBytes > 0 && freedBytes >= targetFreedBytes) break;
    } catch {
      // Skip failed offload and continue.
    }
  }

  return { items: nextItems, migrated, freedBytes };
}

async function saveItemToDreamlab(item) {
  if (!isDreamlabApp()) {
    return { success: false, error: 'Not on Dreamlab web app.' };
  }

  const newItem = {
    ...item,
    id: item.id || crypto.randomUUID(),
    timestamp: Date.now(),
    needsTagging: true,
  };

  // Post the item to the web app — the React app (authenticated with Supabase)
  // will handle inserting into the database and uploading media.
  return new Promise((resolve) => {
    const responseChannel = `dreamlab-save-response-${newItem.id}`;

    const handleResponse = (event) => {
      if (event.data?.type === responseChannel) {
        window.removeEventListener('message', handleResponse);
        clearTimeout(timeout);
        resolve(event.data.payload || { success: true, itemId: newItem.id });
      }
    };

    window.addEventListener('message', handleResponse);

    // Timeout after 30s (large images may take a while to upload)
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handleResponse);
      resolve({ success: true, itemId: newItem.id }); // Optimistic — item may still be saving
    }, 30000);

    window.postMessage({
      type: 'DREAMLAB_SAVE_ITEM',
      item: newItem,
      responseChannel,
    }, '*');
  });
}

function getOrgData() {
  if (!isDreamlabApp()) {
    return { success: false, error: 'Not on Dreamlab web app.' };
  }

  // Request org data from the web app via postMessage
  return new Promise((resolve) => {
    const responseChannel = `dreamlab-org-data-response-${Date.now()}`;

    const handleResponse = (event) => {
      if (event.data?.type === responseChannel) {
        window.removeEventListener('message', handleResponse);
        clearTimeout(timeout);
        resolve(event.data.payload || { success: false, error: 'No data received.' });
      }
    };

    window.addEventListener('message', handleResponse);

    const timeout = setTimeout(() => {
      window.removeEventListener('message', handleResponse);
      resolve({ success: false, error: 'Timed out waiting for org data.' });
    }, 5000);

    window.postMessage({
      type: 'DREAMLAB_GET_ORG_DATA',
      responseChannel,
    }, '*');
  });
}

function triggerMultiSelect() {
  const visibleImages = getVisibleImages();
  const totalImages = getAllImages().length;

  chrome.runtime.sendMessage({
    action: BACKGROUND_ACTIONS.openMultiSelect,
    images: visibleImages,
    totalImagesCount: totalImages,
    sourceUrl: window.location.href,
  });

  return {
    success: true,
    visibleImages,
    totalImages,
    sourceUrl: window.location.href,
  };
}

function scanPageImages(scope = 'visible') {
  if (scope === 'all') {
    const images = getAllImages();
    return {
      success: true,
      images,
      totalCount: images.length,
      sourceUrl: window.location.href,
    };
  }

  if (scope === 'visible_with_total') {
    const visibleImages = getVisibleImages();
    const totalCount = getAllImages().length;
    return {
      success: true,
      visibleImages,
      totalCount,
      sourceUrl: window.location.href,
    };
  }

  const visibleImages = getVisibleImages();
  return {
    success: true,
    images: visibleImages,
    totalCount: visibleImages.length,
    sourceUrl: window.location.href,
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    if (request.action === ACTIONS.saveItem) {
      saveItemToDreamlab(request.item || {})
        .then((payload) => sendResponse(payload))
        .catch((error) => {
          sendResponse({ success: false, error: error?.message || 'Content script error.' });
        });
      return true;
    }

    if (request.action === ACTIONS.getOrgData) {
      getOrgData()
        .then((payload) => sendResponse(payload))
        .catch((error) => {
          sendResponse({ success: false, error: error?.message || 'Failed to get org data.' });
        });
      return true;
    }

    if (request.action === ACTIONS.scanPageImages) {
      sendResponse(scanPageImages(request.scope || 'visible'));
      return true;
    }

    if (request.action === ACTIONS.legacyScanVisibleImages) {
      const visibleImages = getVisibleImages();
      const totalImages = getAllImages().length;
      sendResponse({ success: true, visibleImages, totalImages, sourceUrl: window.location.href });
      return true;
    }

    if (request.action === ACTIONS.triggerMultiSelect) {
      sendResponse(triggerMultiSelect());
      return true;
    }

    sendResponse({ success: false, error: 'Unknown action.' });
  } catch (error) {
    sendResponse({ success: false, error: error?.message || 'Content script error.' });
  }
  return true;
});

function getBestUrlFromSrcset(srcset) {
  if (!srcset) return null;
  try {
    const sources = srcset.split(',').map((sourceItem) => {
      const parts = sourceItem.trim().split(/\s+/);
      const url = parts[0];
      let size = 0;

      if (parts.length > 1) {
        const descriptor = parts[1];
        if (descriptor.endsWith('w')) size = parseInt(descriptor, 10);
        else if (descriptor.endsWith('x')) size = Math.round(parseFloat(descriptor) * 1000);
      }

      return { url, size };
    });

    sources.sort((a, b) => b.size - a.size);
    return sources[0]?.url || null;
  } catch {
    return null;
  }
}

function getBackgroundUrl(element, pseudo = null) {
  try {
    const style = window.getComputedStyle(element, pseudo);
    const background = style.backgroundImage;
    if (!background || background === 'none' || !background.includes('url(')) {
      return null;
    }

    const match = background.match(/url\(['"]?(.*?)['"]?\)/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

function getElementRect(element) {
  const rect = element.getBoundingClientRect();
  if ((rect.width === 0 || rect.height === 0) && element.tagName === 'PICTURE') {
    const image = element.querySelector('img');
    if (image) return image.getBoundingClientRect();
  }
  return rect;
}

function isVisibleRect(rect, viewportOnly) {
  if (rect.width <= 50 || rect.height <= 50) return false;
  if (!viewportOnly) return true;

  return (
    rect.bottom > 0
    && rect.top < window.innerHeight
    && rect.right > 0
    && rect.left < window.innerWidth
  );
}

function deepScanImages(viewportOnly) {
  const results = [];
  const seenUrls = new Set();

  function addCandidate(sourceUrl, element, altText = '') {
    if (!sourceUrl) return;

    let resolvedUrl = sourceUrl;
    try {
      resolvedUrl = new URL(sourceUrl, document.baseURI).href;
    } catch {
      // Keep raw URL.
    }

    if (seenUrls.has(resolvedUrl)) return;
    seenUrls.add(resolvedUrl);

    const rect = getElementRect(element);
    results.push({
      src: resolvedUrl,
      alt: altText,
      width: element.naturalWidth || Math.round(rect.width),
      height: element.naturalHeight || Math.round(rect.height),
      displayWidth: Math.round(rect.width),
      displayHeight: Math.round(rect.height),
    });
  }

  document.querySelectorAll('img').forEach((image) => {
    if (image.closest('picture')) return;
    if (!isVisibleRect(image.getBoundingClientRect(), viewportOnly)) return;

    const srcsetUrl = getBestUrlFromSrcset(image.getAttribute('srcset') || image.getAttribute('data-srcset'));
    const dataUrl = image.getAttribute('data-src')
      || image.getAttribute('data-original')
      || image.getAttribute('data-full-url');

    addCandidate(srcsetUrl || dataUrl || image.currentSrc || image.src, image, image.alt);
  });

  document.querySelectorAll('picture').forEach((picture) => {
    if (!isVisibleRect(getElementRect(picture), viewportOnly)) return;

    const sources = picture.querySelectorAll('source');
    for (const source of sources) {
      const bestUrl = getBestUrlFromSrcset(source.getAttribute('srcset'));
      if (bestUrl) {
        addCandidate(bestUrl, picture);
        return;
      }
    }

    const image = picture.querySelector('img');
    if (image) addCandidate(image.currentSrc || image.src, picture, image.alt);
  });

  document.querySelectorAll('video').forEach((video) => {
    const rect = video.getBoundingClientRect();
    if (!isVisibleRect(rect, viewportOnly)) return;
    if (video.poster) addCandidate(video.poster, video);
  });

  document.querySelectorAll('[style*="background-image"], [style*="background:"]').forEach((element) => {
    const rect = element.getBoundingClientRect();
    if (!isVisibleRect(rect, viewportOnly)) return;

    const backgroundUrl = getBackgroundUrl(element);
    if (backgroundUrl) addCandidate(backgroundUrl, element);
  });

  const allElements = document.querySelectorAll('*');
  const limit = Math.min(allElements.length, 500);
  for (let index = 0; index < limit; index += 1) {
    const element = allElements[index];
    const rect = element.getBoundingClientRect();
    if (!isVisibleRect(rect, viewportOnly)) continue;

    const backgroundUrl = getBackgroundUrl(element);
    if (backgroundUrl) addCandidate(backgroundUrl, element);

    const beforeBackground = getBackgroundUrl(element, ':before');
    if (beforeBackground) addCandidate(beforeBackground, element);
  }

  return results;
}

function getVisibleImages() {
  return deepScanImages(true);
}

function getAllImages() {
  return deepScanImages(false);
}

// In-page keyboard shortcut fallbacks.
// Arc and some Chromium-based browsers do not fire chrome.commands,
// so we listen for keydown events directly and forward to the background.
// Uses event.code (layout-independent) because macOS Alt produces special
// characters in event.key (e.g. Cmd+Alt+S → key:"ß", code:"KeyS").
const SHORTCUT_MAP = [
  { code: 'KeyS', command: 'save-page' },
  { code: 'KeyC', command: 'capture-visible' },
  { code: 'KeyP', command: 'capture-full-page' },
  { code: 'KeyI', command: 'smart-picker' },
];

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

window.addEventListener('keydown', (event) => {
  if (event.repeat) return;

  // Accept: Option+Shift (primary), Cmd/Ctrl+Alt, Cmd/Ctrl+Shift (legacy)
  const isOptionShift = event.altKey && event.shiftKey && !event.metaKey && !event.ctrlKey;
  const mod = event.metaKey || event.ctrlKey;
  const isCmdAlt = mod && event.altKey && !event.shiftKey;
  const isCmdShift = mod && event.shiftKey && !event.altKey;
  if (!isOptionShift && !isCmdAlt && !isCmdShift) return;

  const match = SHORTCUT_MAP.find((s) => s.code === event.code);
  if (!match) return;

  // Skip when focus is in an editable field to avoid hijacking typing
  const tag = document.activeElement?.tagName;
  if (EDITABLE_TAGS.has(tag) || document.activeElement?.isContentEditable) return;

  event.preventDefault();
  event.stopPropagation();

  // Only the top frame should forward commands to avoid duplicate
  // execution from iframes (all_frames: true).
  if (window !== window.top) return;

  chrome.runtime.sendMessage({
    action: 'executeCommand',
    command: match.command,
    origin: 'content-fallback',
    keySignature: `${match.command}:${Date.now()}`,
  });
}, true);
