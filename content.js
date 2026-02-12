const DREAMLAB_ORIGINS = new Set([
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

function saveItemToDreamlab(item) {
  if (!isDreamlabApp()) {
    return { success: false, error: 'Not on Dreamlab web app.' };
  }

  const items = readJsonStorage(STORAGE_KEYS.items, []);
  const activeContext = readJsonStorage(STORAGE_KEYS.activeContext, {});
  const collections = readJsonStorage(STORAGE_KEYS.collections, []);
  const projects = readJsonStorage(STORAGE_KEYS.projects, []);

  const resolvedWorkspaceId = resolveContextValue(item, 'workspaceId', activeContext.workspaceId || null);

  let resolvedCollectionId = resolveContextValue(item, 'collectionId', activeContext.collectionId || null);
  if (resolvedCollectionId) {
    const collectionBelongsToWorkspace = collections.some(
      (collection) => (
        collection.id === resolvedCollectionId
        && getCollectionWorkspaceId(collection, projects) === resolvedWorkspaceId
      )
    );
    if (!collectionBelongsToWorkspace) {
      resolvedCollectionId = null;
    }
  }

  const newItem = {
    ...item,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    workspaceId: resolvedWorkspaceId,
    projectId: null,
    collectionId: resolvedCollectionId,
    needsTagging: true,
  };

  localStorage.setItem(STORAGE_KEYS.items, JSON.stringify([newItem, ...items]));
  window.dispatchEvent(new Event('storage-update'));

  return { success: true, itemId: newItem.id };
}

function getOrgData() {
  if (!isDreamlabApp()) {
    return { success: false, error: 'Not on Dreamlab web app.' };
  }

  return {
    success: true,
    workspaces: readJsonStorage(STORAGE_KEYS.workspaces, []),
    projects: readJsonStorage(STORAGE_KEYS.projects, []),
    collections: readJsonStorage(STORAGE_KEYS.collections, []),
    activeContext: readJsonStorage(STORAGE_KEYS.activeContext, {}),
  };
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
      sendResponse(saveItemToDreamlab(request.item || {}));
      return true;
    }

    if (request.action === ACTIONS.getOrgData) {
      sendResponse(getOrgData());
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

// Local in-page shortcut fallback for image review.
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === 'Y') {
    event.preventDefault();
    triggerMultiSelect();
  }
});
