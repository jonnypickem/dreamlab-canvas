const DREAMLAB_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);

const STORAGE_KEYS = {
  pendingCapture: 'pendingCapture',
  multiSelectState: 'multiSelectState',
};

const ACTIONS = {
  ping: 'ping',
  saveCapturedItem: 'saveCapturedItem',
  openMultiSelect: 'openMultiSelect',
  getDreamlabOrgData: 'getDreamlabOrgData',
  getMultiSelectState: 'getMultiSelectState',
  scanSourceImages: 'scanSourceImages',
};

const CONTENT_ACTIONS = {
  saveItem: 'SAVE_ITEM',
  getOrgData: 'GET_ORG_DATA',
  scanPageImages: 'SCAN_PAGE_IMAGES',
};

const CONTEXT_MENU_IDS = {
  image: 'save-to-dreamlab-image',
  text: 'save-to-dreamlab-text',
  page: 'save-to-dreamlab-page',
};

function isDreamlabUrl(url) {
  try {
    const parsed = new URL(url);
    return DREAMLAB_ORIGINS.has(parsed.origin);
  } catch {
    return false;
  }
}

function queryTabs(queryInfo) {
  return new Promise((resolve, reject) => {
    chrome.tabs.query(queryInfo, (tabs) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(Array.isArray(tabs) ? tabs : []);
    });
  });
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

function executeScript(tabId, files) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files,
      },
      (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result || []);
      }
    );
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isMissingReceiverError(error) {
  const message = String(error?.message || '');
  return /receiving end does not exist/i.test(message);
}

async function sendTabMessageWithBridge(tabId, message) {
  try {
    return await sendTabMessage(tabId, message);
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    // Content scripts can be absent on existing tabs after extension reload/update.
    await executeScript(tabId, ['content.js']);
    await wait(60);
    return await sendTabMessage(tabId, message);
  }
}

function getStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(result || {});
    });
  });
}

function setStorage(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function removeStorage(keys) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve();
    });
  });
}

function createWindow(createData) {
  return new Promise((resolve, reject) => {
    chrome.windows.create(createData, (win) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(win);
    });
  });
}

async function getDreamlabTabs() {
  const tabs = await queryTabs({});
  return tabs.filter((tab) => isDreamlabUrl(tab.url));
}

async function getPreferredDreamlabTab() {
  const activeTabs = await queryTabs({ active: true, currentWindow: true });
  const activeDreamlab = activeTabs.find((tab) => isDreamlabUrl(tab.url));
  if (activeDreamlab) return activeDreamlab;

  const dreamlabTabs = await getDreamlabTabs();
  if (dreamlabTabs.length === 0) {
    throw new Error('Dreamlab web app is not open.');
  }

  return [...dreamlabTabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
}

function isUsefulDescription(description) {
  if (!description || typeof description !== 'string') return false;
  const trimmed = description.trim();
  if (trimmed.length < 10) return false;
  if (/^https?:\/\//i.test(trimmed)) return false;
  if (/^[a-f0-9-]{20,}$/i.test(trimmed)) return false;
  return true;
}

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.image,
      title: 'Save Image to Dreamlab',
      contexts: ['image'],
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.text,
      title: 'Save Selection to Dreamlab',
      contexts: ['selection'],
    });

    chrome.contextMenus.create({
      id: CONTEXT_MENU_IDS.page,
      title: 'Save Page to Dreamlab',
      contexts: ['page', 'link'],
    });
  });
}

async function fetchMetadataFromUrl(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  const html = await response.text();

  const getMetaMatch = (property) => {
    const regex = new RegExp(
      `<meta[^>]*property=["'](?:og:|twitter:)?${property}["'][^>]*content=["']([^"']+)["']|<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:og:|twitter:)?${property}["']`,
      'i'
    );
    const match = html.match(regex);
    return match ? (match[1] || match[2]) : null;
  };

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = getMetaMatch('title') || (titleMatch ? titleMatch[1] : null);
  let image = getMetaMatch('image:secure_url') || getMetaMatch('image:url') || getMetaMatch('image');

  if (image && !image.startsWith('http')) {
    try {
      image = new URL(image, url).href;
    } catch {
      image = null;
    }
  }

  return {
    title: title || null,
    image: image || null,
    description: getMetaMatch('description') || null,
  };
}

async function getPageMetadata(tabId, targetUrl) {
  const normalize = (candidate) => {
    try {
      const parsed = new URL(candidate);
      return (parsed.origin + parsed.pathname).replace(/\/$/, '').replace('://www.', '://');
    } catch {
      return candidate;
    }
  };

  try {
    const [activeTab] = await queryTabs({ active: true, currentWindow: true });
    const isCurrentPage = activeTab && normalize(activeTab.url) === normalize(targetUrl);

    if (isCurrentPage) {
      let domResult = {};
      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            const getMeta = (name) => {
              const element = document.querySelector(`meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`);
              return element ? element.getAttribute('content') : null;
            };

            const title = getMeta('og:title') || getMeta('twitter:title') || document.title;
            let image = getMeta('og:image:secure_url')
              || getMeta('og:image:url')
              || getMeta('og:image')
              || getMeta('twitter:image')
              || getMeta('image');

            if (image && !image.startsWith('http')) {
              try {
                image = new URL(image, window.location.href).href;
              } catch {
                const anchor = document.createElement('a');
                anchor.href = image;
                image = anchor.href;
              }
            }

            return {
              title: title || null,
              image: image || null,
              description: getMeta('og:description') || getMeta('description') || null,
            };
          },
        });
        domResult = result?.[0]?.result || {};
      } catch {
        // Keep fallback path.
      }

      if (domResult.image) return domResult;

      try {
        const fallback = await fetchMetadataFromUrl(targetUrl);
        return {
          title: domResult.title || fallback.title,
          image: fallback.image,
          description: domResult.description || fallback.description,
        };
      } catch {
        return domResult;
      }
    }

    return await fetchMetadataFromUrl(targetUrl);
  } catch {
    return {};
  }
}

async function requestImageScan(tabId, scope = 'visible') {
  const response = await sendTabMessageWithBridge(tabId, {
    action: CONTENT_ACTIONS.scanPageImages,
    scope,
  });

  if (!response || response.success !== true) {
    throw new Error(response?.error || 'Could not scan images on this page.');
  }

  return response;
}

async function openMultiSelectWindow({ sourceTabId, sourceUrl, visibleImages, totalImagesCount }) {
  const state = {
    sourceTabId: sourceTabId || null,
    sourceUrl: sourceUrl || '',
    visibleImages: Array.isArray(visibleImages) ? visibleImages : [],
    totalImagesCount: Number(totalImagesCount || 0),
    openedAt: Date.now(),
  };

  await setStorage({ [STORAGE_KEYS.multiSelectState]: state });

  await createWindow({
    url: 'multi-select.html',
    type: 'popup',
    width: 920,
    height: 700,
    focused: true,
  });
}

async function saveItemToWebApp(item) {
  const targetTab = await getPreferredDreamlabTab();
  const response = await sendTabMessageWithBridge(targetTab.id, {
    action: CONTENT_ACTIONS.saveItem,
    item,
  });

  if (!response || response.success !== true) {
    throw new Error(response?.error || 'Failed to save to Dreamlab web app.');
  }
}

async function queuePendingAndTrySave(item) {
  await setStorage({ [STORAGE_KEYS.pendingCapture]: item });

  try {
    await saveItemToWebApp(item);
    await removeStorage(STORAGE_KEYS.pendingCapture);
  } catch {
    // Keep pending capture for popup review.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;

  let item = null;

  if (info.menuItemId === CONTEXT_MENU_IDS.image) {
    const metadata = await getPageMetadata(tab.id, tab.url);
    item = {
      type: 'image',
      content: info.srcUrl,
      title: metadata.title || tab.title || null,
      description: isUsefulDescription(metadata.description) ? metadata.description : null,
      sourceUrl: tab.url,
      timestamp: Date.now(),
    };
  } else if (info.menuItemId === CONTEXT_MENU_IDS.text) {
    item = {
      type: 'text',
      content: info.selectionText,
      sourceUrl: tab.url,
      timestamp: Date.now(),
    };
  } else if (info.menuItemId === CONTEXT_MENU_IDS.page) {
    const urlToScrape = info.linkUrl || tab.url;
    const metadata = await getPageMetadata(tab.id, urlToScrape);
    item = {
      type: 'link',
      content: metadata.title || tab.title || urlToScrape,
      title: metadata.title || tab.title || null,
      description: isUsefulDescription(metadata.description) ? metadata.description : null,
      thumbnail: metadata.image || null,
      sourceUrl: urlToScrape,
      timestamp: Date.now(),
    };
  }

  if (item) {
    await queuePendingAndTrySave(item);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  try {
    if (command === 'save-page') {
      const [tab] = await queryTabs({ active: true, currentWindow: true });
      if (!tab) return;

      let selectedText = '';
      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => String(window.getSelection() || '').trim(),
        });
        selectedText = result?.[0]?.result || '';
      } catch {
        selectedText = '';
      }

      if (selectedText) {
        await queuePendingAndTrySave({
          type: 'text',
          content: selectedText,
          sourceUrl: tab.url,
          timestamp: Date.now(),
        });
      } else {
        const metadata = await getPageMetadata(tab.id, tab.url);
        await queuePendingAndTrySave({
          type: 'link',
          content: metadata.title || tab.title || tab.url,
          title: metadata.title || tab.title || null,
          description: isUsefulDescription(metadata.description) ? metadata.description : null,
          thumbnail: metadata.image || null,
          sourceUrl: tab.url,
          timestamp: Date.now(),
        });
      }
      return;
    }

    if (command === 'capture-visible') {
      const [tab] = await queryTabs({ active: true, currentWindow: true });
      if (!tab?.id) return;

      const scan = await requestImageScan(tab.id, 'visible_with_total');
      await openMultiSelectWindow({
        sourceTabId: tab.id,
        sourceUrl: scan.sourceUrl || tab.url || '',
        visibleImages: scan.visibleImages || [],
        totalImagesCount: scan.totalCount || 0,
      });
      return;
    }

    if (command === 'smart-picker') {
      const [tab] = await queryTabs({ active: true, currentWindow: true });
      if (!tab?.id) return;

      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['picker.css'],
      });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['picker.js'],
      });
    }
  } catch (error) {
    console.error('Command handling failed:', error?.message || error);
  }
});

async function handleRuntimeMessage(request, sender) {
  switch (request?.action) {
    case ACTIONS.ping:
      return { success: true, worker: 'ready', at: Date.now() };

    case ACTIONS.saveCapturedItem: {
      if (!request.item || typeof request.item !== 'object') {
        return { success: false, error: 'No capture payload provided.' };
      }
      await saveItemToWebApp(request.item);
      return { success: true };
    }

    case ACTIONS.openMultiSelect: {
      await openMultiSelectWindow({
        sourceTabId: request.sourceTabId || sender?.tab?.id || null,
        sourceUrl: request.sourceUrl || sender?.tab?.url || '',
        visibleImages: request.images || [],
        totalImagesCount: request.totalImagesCount || (request.images || []).length,
      });
      return { success: true };
    }

    case ACTIONS.getDreamlabOrgData: {
      const tab = await getPreferredDreamlabTab();
      const response = await sendTabMessageWithBridge(tab.id, { action: CONTENT_ACTIONS.getOrgData });
      if (!response || response.success !== true) {
        return { success: false, error: response?.error || 'Could not load Dreamlab organization data.' };
      }

      return {
        success: true,
        sourceTabId: tab.id,
        workspaces: response.workspaces || [],
        projects: response.projects || [],
        collections: response.collections || [],
        activeContext: response.activeContext || {},
      };
    }

    case ACTIONS.getMultiSelectState: {
      const stored = await getStorage(STORAGE_KEYS.multiSelectState);
      return { success: true, state: stored?.[STORAGE_KEYS.multiSelectState] || null };
    }

    case ACTIONS.scanSourceImages: {
      const stored = await getStorage(STORAGE_KEYS.multiSelectState);
      const sourceTabId = request.sourceTabId || stored?.[STORAGE_KEYS.multiSelectState]?.sourceTabId;
      if (!sourceTabId) {
        return { success: false, error: 'Source tab is not available.' };
      }

      const scan = await requestImageScan(sourceTabId, request.scope || 'visible');
      return {
        success: true,
        sourceTabId,
        sourceUrl: scan.sourceUrl || stored?.[STORAGE_KEYS.multiSelectState]?.sourceUrl || '',
        images: scan.images || [],
        visibleImages: scan.visibleImages || [],
        totalCount: Number(scan.totalCount || 0),
      };
    }

    default:
      return { success: false, error: 'Unknown action.' };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleRuntimeMessage(request, sender)
    .then((payload) => sendResponse(payload))
    .catch((error) => {
      sendResponse({ success: false, error: error?.message || 'Unexpected extension error.' });
    });
  return true;
});
