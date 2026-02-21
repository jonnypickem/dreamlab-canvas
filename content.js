const DREAMLAB_ORIGINS = new Set([
  'https://dreamlab-canvas.vercel.app',
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
  getShortcutBindings: 'getShortcutBindings',
  executeCommand: 'executeCommand',
  openExtensionShortcuts: 'openExtensionShortcuts',
  getWidgetConfig: 'getWidgetConfig',
  setWidgetEnabled: 'setWidgetEnabled',
  getWidgetPrefs: 'getWidgetPrefs',
  setWidgetPrefs: 'setWidgetPrefs',
  getCaptureDestination: 'getCaptureDestination',
  setCaptureDestination: 'setCaptureDestination',
};
const SENSITIVE_HOST_PATTERN = /(bank|banking|wallet|payments?|checkout|billing|secure|auth|passport|idp|accounts?)/i;
const SENSITIVE_PATH_PATTERN = /\/(login|signin|sign-in|account|security|password|checkout|payment|billing|wallet|verification)\b/i;

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
        const payload = event.data.payload || { success: false, error: 'No data received.' };
        resolve({
          ...payload,
          appBuildId: typeof payload?.appBuildId === 'string' ? payload.appBuildId : '',
        });
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

function getShortcutBindingsFromExtension() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: BACKGROUND_ACTIONS.getShortcutBindings }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message || 'Could not load shortcuts.' });
        return;
      }
      resolve(response || { success: false, error: 'Could not load shortcuts.' });
    });
  });
}

function executeShortcutCommand(command) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      action: BACKGROUND_ACTIONS.executeCommand,
      command,
      origin: 'webapp-bridge',
    }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message || 'Command failed.' });
        return;
      }
      resolve(response || { success: false, error: 'Command failed.' });
    });
  });
}

function openExtensionShortcutSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: BACKGROUND_ACTIONS.openExtensionShortcuts }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message || 'Could not open extension shortcut settings.' });
        return;
      }
      resolve(response || { success: false, error: 'Could not open extension shortcut settings.' });
    });
  });
}

function sendBackgroundMessage(payload) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, error: chrome.runtime.lastError.message || 'Extension message failed.' });
        return;
      }
      resolve(response || { success: false, error: 'Extension message failed.' });
    });
  });
}

if (isDreamlabApp()) {
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const payload = event.data || {};
    const responseChannel = String(payload.responseChannel || '');
    if (!responseChannel) return;

    if (payload.type === 'DREAMLAB_GET_SHORTCUTS') {
      getShortcutBindingsFromExtension()
        .then((response) => {
          window.postMessage({ type: responseChannel, payload: response }, '*');
        })
        .catch((error) => {
          window.postMessage({
            type: responseChannel,
            payload: { success: false, error: error?.message || 'Could not load shortcuts.' },
          }, '*');
        });
      return;
    }

    if (payload.type === 'DREAMLAB_EXECUTE_SHORTCUT') {
      executeShortcutCommand(payload.command)
        .then((response) => {
          window.postMessage({ type: responseChannel, payload: response }, '*');
        })
        .catch((error) => {
          window.postMessage({
            type: responseChannel,
            payload: { success: false, error: error?.message || 'Command failed.' },
          }, '*');
        });
      return;
    }

    if (payload.type === 'DREAMLAB_OPEN_EXTENSION_SHORTCUT_SETTINGS') {
      openExtensionShortcutSettings()
        .then((response) => {
          window.postMessage({ type: responseChannel, payload: response }, '*');
        })
        .catch((error) => {
          window.postMessage({
            type: responseChannel,
            payload: { success: false, error: error?.message || 'Could not open extension shortcut settings.' },
          }, '*');
        });
    }
  });
}

function triggerMultiSelect() {
  if (isSensitiveSurfaceUrl(window.location.href)) {
    return {
      success: false,
      error: 'Image scanning is disabled on sensitive pages.',
      sourceUrl: window.location.href,
    };
  }

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

function isSensitiveSurfaceUrl(url) {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/i.test(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    return SENSITIVE_HOST_PATTERN.test(host) || SENSITIVE_PATH_PATTERN.test(path);
  } catch {
    return false;
  }
}

function scanPageImages(scope = 'visible') {
  async function getAllImagesWithScroll() {
    const seen = new Set();
    const merged = [];

    const appendUnique = (images) => {
      (Array.isArray(images) ? images : []).forEach((image) => {
        const src = String(image?.src || '').trim();
        if (!src || seen.has(src)) return;
        seen.add(src);
        merged.push(image);
      });
    };

    appendUnique(getAllImages());
    appendUnique(getNetworkLoadedImageCandidates());

    const scroller = document.scrollingElement || document.documentElement;
    if (!scroller) return merged;

    const originalX = window.scrollX;
    const originalY = window.scrollY;
    const scrollHeight = Math.max(
      scroller.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0,
      document.body?.scrollHeight || 0,
    );
    const maxScrollTop = Math.max(0, scrollHeight - window.innerHeight);
    if (maxScrollTop <= 0) return merged;

    const step = Math.max(280, Math.floor(window.innerHeight * 0.8));
    const maxSteps = 28;

    try {
      let y = 0;
      let steps = 0;
      while (y <= maxScrollTop && steps < maxSteps) {
        window.scrollTo({ top: y, left: originalX, behavior: 'auto' });
        // Allow lazy loaders to materialize assets.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 180));
        appendUnique(getVisibleImages());
        appendUnique(getNetworkLoadedImageCandidates());
        y += step;
        steps += 1;
      }

      if (maxScrollTop > 0) {
        window.scrollTo({ top: maxScrollTop, left: originalX, behavior: 'auto' });
        await new Promise((resolve) => setTimeout(resolve, 180));
        appendUnique(getVisibleImages());
        appendUnique(getNetworkLoadedImageCandidates());
      }
    } finally {
      window.scrollTo({ top: originalY, left: originalX, behavior: 'auto' });
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    return merged;
  }

  const run = async () => {
    if (isSensitiveSurfaceUrl(window.location.href)) {
      return {
        success: false,
        error: 'Image scanning is disabled on sensitive pages.',
        sourceUrl: window.location.href,
      };
    }

    if (scope === 'all') {
      const images = await getAllImagesWithScroll();
      return {
        success: true,
        images,
        totalCount: images.length,
        sourceUrl: window.location.href,
      };
    }

    if (scope === 'visible_with_total') {
      const visibleImages = getVisibleImages();
      let totalCount = getAllImages().length;
      let visibleWithFallback = visibleImages;

      if (visibleImages.length === 0 && totalCount === 0) {
        const fallbackImages = await getAllImagesWithScroll();
        totalCount = fallbackImages.length;
        visibleWithFallback = fallbackImages;
      }

      return {
        success: true,
        visibleImages: visibleWithFallback,
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
  };

  return run();
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
      Promise.resolve(scanPageImages(request.scope || 'visible'))
        .then((payload) => sendResponse(payload))
        .catch((error) => {
          sendResponse({ success: false, error: error?.message || 'Image scan failed.' });
        });
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
  const minSize = viewportOnly ? 24 : 8;
  if (rect.width < minSize || rect.height < minSize) return false;
  if (!viewportOnly) return true;

  return (
    rect.bottom > 0
    && rect.top < window.innerHeight
    && rect.right > 0
    && rect.left < window.innerWidth
  );
}

function getMetaImageCandidates() {
  const selectors = [
    'meta[property="og:image"]',
    'meta[property="og:image:url"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]',
    'meta[itemprop="image"]',
  ];
  const results = [];
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((meta) => {
      const content = meta.getAttribute('content') || '';
      if (content.trim()) results.push(content.trim());
    });
  });
  return results;
}

function isLikelyImageResourceUrl(sourceUrl) {
  if (!sourceUrl || typeof sourceUrl !== 'string') return false;
  const value = sourceUrl.trim();
  if (!value) return false;
  if (value.startsWith('data:image/')) return true;
  if (value.startsWith('blob:')) return true;

  try {
    const parsed = new URL(value, document.baseURI);
    const pathname = parsed.pathname || '';
    if (/\.(?:js|mjs|css|json|txt|xml|html?|woff2?|ttf|otf|eot|map)(?:$|\?)/i.test(pathname)) {
      return false;
    }

    if (/\.(avif|webp|png|jpe?g|gif|svg|bmp|ico|tiff?|jfif|heic|heif)(?:$|\?)/i.test(pathname)) {
      return true;
    }

    const formatParam = (
      parsed.searchParams.get('format')
      || parsed.searchParams.get('fm')
      || parsed.searchParams.get('f')
      || parsed.searchParams.get('ext')
      || ''
    ).toLowerCase();
    if (/(avif|webp|png|jpe?g|gif|svg|bmp|ico|tiff?|heic|heif)/i.test(formatParam)) {
      return true;
    }

    const imageQueryValue = (
      parsed.searchParams.get('url')
      || parsed.searchParams.get('image')
      || parsed.searchParams.get('img')
      || parsed.searchParams.get('src')
      || ''
    );
    if (/\.(avif|webp|png|jpe?g|gif|svg|bmp|ico|tiff?|jfif|heic|heif)(?:$|\?)/i.test(imageQueryValue)) {
      return true;
    }

    if (/\/(images?|photos?|media|assets?)\//i.test(pathname)) {
      return true;
    }

    if (/\/(?:_?next|cdn-cgi)\/image/i.test(pathname)) {
      return true;
    }
  } catch {
    if (/\.(avif|webp|png|jpe?g|gif|svg|bmp|ico|tiff?|jfif|heic|heif)(?:$|\?)/i.test(value)) {
      return true;
    }
  }

  return false;
}

function getNetworkLoadedImageCandidates() {
  const entries = (
    typeof performance !== 'undefined'
    && typeof performance.getEntriesByType === 'function'
  )
    ? performance.getEntriesByType('resource')
    : [];

  if (!Array.isArray(entries) || entries.length === 0) return [];

  const candidates = [];
  const seen = new Set();
  const imageInitiators = new Set(['img', 'image', 'picture', 'video']);

  entries.forEach((entry) => {
    const sourceUrl = String(entry?.name || '').trim();
    if (!sourceUrl || seen.has(sourceUrl)) return;

    const initiatorType = String(entry?.initiatorType || '').toLowerCase();
    const isImageInitiator = imageInitiators.has(initiatorType);
    if (!isImageInitiator && !isLikelyImageResourceUrl(sourceUrl)) return;

    seen.add(sourceUrl);
    let resolvedUrl = sourceUrl;
    let hintedWidth = 0;
    let hintedHeight = 0;

    try {
      const parsed = new URL(sourceUrl, document.baseURI);
      resolvedUrl = parsed.href;

      const widthHint = Number(
        parsed.searchParams.get('width')
        || parsed.searchParams.get('w')
        || parsed.searchParams.get('mw')
        || 0
      );
      const heightHint = Number(
        parsed.searchParams.get('height')
        || parsed.searchParams.get('h')
        || parsed.searchParams.get('mh')
        || 0
      );

      if (Number.isFinite(widthHint) && widthHint > 0) hintedWidth = Math.round(widthHint);
      if (Number.isFinite(heightHint) && heightHint > 0) hintedHeight = Math.round(heightHint);
    } catch {
      // Keep raw URL when it cannot be parsed.
    }

    candidates.push({
      src: resolvedUrl,
      alt: '',
      width: hintedWidth,
      height: hintedHeight,
      displayWidth: hintedWidth,
      displayHeight: hintedHeight,
      fromNetwork: true,
    });
  });

  return candidates;
}

function deepScanImages(viewportOnly) {
  const results = [];
  const seenUrls = new Set();

  function addResolvedCandidate(resolvedUrl, payload = {}) {
    if (!resolvedUrl || seenUrls.has(resolvedUrl)) return;
    seenUrls.add(resolvedUrl);

    const intrinsicWidth = Number(payload.width || 0);
    const intrinsicHeight = Number(payload.height || 0);
    const displayWidth = Number(payload.displayWidth || intrinsicWidth || 0);
    const displayHeight = Number(payload.displayHeight || intrinsicHeight || 0);

    results.push({
      src: resolvedUrl,
      alt: payload.alt || '',
      width: Number.isFinite(intrinsicWidth) && intrinsicWidth > 0 ? Math.round(intrinsicWidth) : 0,
      height: Number.isFinite(intrinsicHeight) && intrinsicHeight > 0 ? Math.round(intrinsicHeight) : 0,
      displayWidth: Number.isFinite(displayWidth) && displayWidth > 0 ? Math.round(displayWidth) : 0,
      displayHeight: Number.isFinite(displayHeight) && displayHeight > 0 ? Math.round(displayHeight) : 0,
      fromNetwork: Boolean(payload.fromNetwork),
    });
  }

  function addCandidate(sourceUrl, element, altText = '') {
    if (!sourceUrl) return;

    let resolvedUrl = sourceUrl;
    try {
      resolvedUrl = new URL(sourceUrl, document.baseURI).href;
    } catch {
      // Keep raw URL.
    }

    const rect = getElementRect(element);
    addResolvedCandidate(resolvedUrl, {
      alt: altText,
      width: element.naturalWidth || Math.round(rect.width),
      height: element.naturalHeight || Math.round(rect.height),
      displayWidth: Math.round(rect.width),
      displayHeight: Math.round(rect.height),
      fromNetwork: false,
    });
  }

  function addNetworkCandidate(candidate) {
    const src = String(candidate?.src || '').trim();
    if (!src) return;
    addResolvedCandidate(src, candidate);
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

  document.querySelectorAll('[data-src], [data-original], [data-lazy-src], [data-bg], [data-background], [data-image], [poster]').forEach((element) => {
    const rect = element.getBoundingClientRect();
    if (!isVisibleRect(rect, viewportOnly)) return;

    const srcsetUrl = getBestUrlFromSrcset(
      element.getAttribute('data-srcset')
      || element.getAttribute('srcset')
      || ''
    );
    const candidate = srcsetUrl
      || element.getAttribute('data-src')
      || element.getAttribute('data-original')
      || element.getAttribute('data-lazy-src')
      || element.getAttribute('data-bg')
      || element.getAttribute('data-background')
      || element.getAttribute('data-image')
      || element.getAttribute('poster');
    if (candidate) addCandidate(candidate, element, element.getAttribute('alt') || '');
  });

  document.querySelectorAll('[style*="background-image"], [style*="background:"]').forEach((element) => {
    const rect = element.getBoundingClientRect();
    if (!isVisibleRect(rect, viewportOnly)) return;

    const backgroundUrl = getBackgroundUrl(element);
    if (backgroundUrl) addCandidate(backgroundUrl, element);
  });

  const allElements = document.querySelectorAll('*');
  const limit = Math.min(allElements.length, 5000);
  for (let index = 0; index < limit; index += 1) {
    const element = allElements[index];
    const rect = element.getBoundingClientRect();
    if (!isVisibleRect(rect, viewportOnly)) continue;

    const backgroundUrl = getBackgroundUrl(element);
    if (backgroundUrl) addCandidate(backgroundUrl, element);

    const beforeBackground = getBackgroundUrl(element, ':before');
    if (beforeBackground) addCandidate(beforeBackground, element);

    const afterBackground = getBackgroundUrl(element, ':after');
    if (afterBackground) addCandidate(afterBackground, element);
  }

  if (results.length === 0) {
    getMetaImageCandidates().forEach((metaImage) => addCandidate(metaImage, document.body || document.documentElement));
  }

  if (!viewportOnly || results.length === 0) {
    getNetworkLoadedImageCandidates().forEach(addNetworkCandidate);
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
  { code: 'KeyK', command: 'pick-color' },
  { code: 'KeyA', command: 'area-select' },
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
  // execution if script scope is expanded to iframes in future updates.
  if (window !== window.top) return;
  // Keep always-on behavior, but avoid capture shortcut forwarding on sensitive pages.
  if (isSensitiveSurfaceUrl(window.location.href)) return;

  chrome.runtime.sendMessage({
    action: 'executeCommand',
    command: match.command,
    origin: 'content-fallback',
    keySignature: `${match.command}:${Date.now()}`,
  });
}, true);
