const DREAMLAB_ORIGINS = new Set([
  'https://dreamlab-canvas.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
]);
const DREAMLAB_APP_URLS = [
  'https://dreamlab-canvas.vercel.app',
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4173',
  'http://localhost:4173',
];

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
  executeCommand: 'executeCommand',
  getShortcutBindings: 'getShortcutBindings',
};

const COMMAND_ACTIONS = [
  {
    command: 'save-page',
    label: 'Save Page',
    description: 'Save current page to Dreamlab',
  },
  {
    command: 'capture-visible',
    label: 'Image Selector',
    description: 'Open image capture review',
  },
  {
    command: 'capture-full-page',
    label: 'Full Page Screenshot',
    description: 'Capture full page screenshot',
  },
  {
    command: 'smart-picker',
    label: 'Smart Picker',
    description: 'Pick an image or background from page',
  },
  {
    command: 'pick-color',
    label: 'Color Eyedropper',
    description: 'Pick a color from the current page',
  },
  {
    command: 'area-select',
    label: 'Area Screenshot',
    description: 'Capture a selected area screenshot',
  },
  {
    command: 'area-record',
    label: 'Area Record',
    description: 'Record a selected area',
  },
];

const VALID_COMMAND_SET = new Set(COMMAND_ACTIONS.map((entry) => entry.command));

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

const TEXT_FIRST_DOMAINS = [
  'medium.com',
  'substack.com',
  'dev.to',
  'hashnode.com',
  'linkedin.com',
  'notion.site',
];

const PREVIEW_FIRST_DOMAINS = [
  'x.com',
  'twitter.com',
  'reddit.com',
];

const MAX_TEXT_EXTRACT_LENGTH = 50000;

function isDreamlabUrl(url) {
  try {
    const parsed = new URL(url);
    return DREAMLAB_ORIGINS.has(parsed.origin);
  } catch {
    return false;
  }
}

function normalizeDomain(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

function domainMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function getDomainDefaultMode(url) {
  const hostname = normalizeDomain(url);
  if (!hostname) return 'preview';
  if (PREVIEW_FIRST_DOMAINS.some((domain) => domainMatches(hostname, domain))) return 'preview';
  if (TEXT_FIRST_DOMAINS.some((domain) => domainMatches(hostname, domain))) return 'text';
  return 'preview';
}

function shouldAttemptTextExtraction(url) {
  return getDomainDefaultMode(url) === 'text';
}

function getTweetInfo(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (hostname !== 'x.com' && hostname !== 'twitter.com') return null;

    const match = parsed.pathname.match(/\/status\/(\d+)/i);
    if (!match?.[1]) return null;

    return {
      tweetId: match[1],
      canonicalUrl: `https://x.com${parsed.pathname}`,
    };
  } catch {
    return null;
  }
}

async function fetchTweetEmbed(url) {
  const tweetInfo = getTweetInfo(url);
  if (!tweetInfo) return null;

  const oEmbedUrl = `https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=${encodeURIComponent(tweetInfo.canonicalUrl)}`;
  try {
    const response = await fetch(oEmbedUrl);
    if (!response.ok) {
      throw new Error(`oEmbed request failed with status ${response.status}`);
    }
    const data = await response.json();
    const plainText = normalizeExtractedText(data?.html || '');
    const tweetText = plainText
      .replace(/\s*—\s*[^—]+$/, '')
      .trim()
      .slice(0, 320);

    return {
      type: 'tweet',
      provider: 'x',
      status: 'ready',
      tweetId: tweetInfo.tweetId,
      url: tweetInfo.canonicalUrl,
      authorName: data?.author_name || null,
      authorUrl: data?.author_url || null,
      html: data?.html || null,
      tweetText: tweetText || null,
      width: Number(data?.width) || null,
      fetchedAt: Date.now(),
    };
  } catch {
    return {
      type: 'tweet',
      provider: 'x',
      status: 'failed',
      tweetId: tweetInfo.tweetId,
      url: tweetInfo.canonicalUrl,
      fetchedAt: Date.now(),
    };
  }
}

async function maybeAttachLinkEmbed(item) {
  if (!item || item.type !== 'link') return item;
  const sourceUrl = item.sourceUrl || item.content;
  if (!sourceUrl) return item;

  const tweetEmbed = await fetchTweetEmbed(sourceUrl);
  if (!tweetEmbed) return item;

  return {
    ...item,
    linkEmbed: tweetEmbed,
  };
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

function getTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tab || null);
    });
  });
}

function createTab(createProperties) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(createProperties, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(tab || null);
    });
  });
}

function sendTabMessage(tabId, message, options = {}) {
  const sendOptions = {};
  if (Number.isInteger(options?.frameId)) {
    sendOptions.frameId = options.frameId;
  }

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, sendOptions, (response) => {
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

function executeScriptFn(tabId, func, args = []) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func,
        args,
      },
      (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result?.[0]?.result);
      }
    );
  });
}

const CAPTURE_VISIBLE_TAB_MIN_INTERVAL_BASE_MS = 1100;
const CAPTURE_VISIBLE_TAB_MIN_INTERVAL_MAX_MS = 2600;
const CAPTURE_VISIBLE_TAB_RATE_LIMIT_COOLDOWN_MS = 2600;
const CAPTURE_VISIBLE_TAB_MAX_RETRIES = 8;
const CAPTURE_VISIBLE_TAB_BACKOFF_BASE_MS = 900;
let lastCaptureVisibleTabCallAt = 0;
let captureVisibleTabMinIntervalMs = CAPTURE_VISIBLE_TAB_MIN_INTERVAL_BASE_MS;
let captureVisibleTabBlockedUntil = 0;
let captureVisibleTabQueue = Promise.resolve();

function isCaptureVisibleTabRateLimitError(error) {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('max_capture_visible_tab_calls_per_second')
    || message.includes('exceeds')
    || message.includes('calls_per_second')
    || (message.includes('capturevisibletab') && message.includes('quota'))
  );
}

async function waitForCaptureVisibleTabSlot() {
  const blockWaitMs = Math.max(0, captureVisibleTabBlockedUntil - Date.now());
  const elapsed = Date.now() - lastCaptureVisibleTabCallAt;
  const cadenceWaitMs = Math.max(0, captureVisibleTabMinIntervalMs - elapsed);
  const waitMs = Math.max(blockWaitMs, cadenceWaitMs);
  if (waitMs > 0) {
    await wait(waitMs);
  }
}

function onCaptureVisibleTabSuccess() {
  captureVisibleTabBlockedUntil = 0;
  captureVisibleTabMinIntervalMs = Math.max(
    CAPTURE_VISIBLE_TAB_MIN_INTERVAL_BASE_MS,
    captureVisibleTabMinIntervalMs - 120
  );
}

function onCaptureVisibleTabRateLimited(attempt) {
  const severity = Math.max(1, Number(attempt) + 1);
  captureVisibleTabMinIntervalMs = Math.min(
    CAPTURE_VISIBLE_TAB_MIN_INTERVAL_MAX_MS,
    captureVisibleTabMinIntervalMs + (220 * severity)
  );
  captureVisibleTabBlockedUntil = Math.max(
    captureVisibleTabBlockedUntil,
    Date.now() + CAPTURE_VISIBLE_TAB_RATE_LIMIT_COOLDOWN_MS
  );
}

function captureVisibleTabRaw(windowId, options = { format: 'png' }) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(windowId, options, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!dataUrl) {
        reject(new Error('Capture returned empty data.'));
        return;
      }
      resolve(dataUrl);
    });
  });
}

function captureVisibleTab(windowId, options = { format: 'png' }) {
  const runCapture = async () => {
    let attempt = 0;
    while (attempt <= CAPTURE_VISIBLE_TAB_MAX_RETRIES) {
      await waitForCaptureVisibleTabSlot();
      lastCaptureVisibleTabCallAt = Date.now();

      try {
        const dataUrl = await captureVisibleTabRaw(windowId, options);
        onCaptureVisibleTabSuccess();
        return dataUrl;
      } catch (error) {
        if (!isCaptureVisibleTabRateLimitError(error) || attempt === CAPTURE_VISIBLE_TAB_MAX_RETRIES) {
          throw error;
        }
        onCaptureVisibleTabRateLimited(attempt);
        const backoff = CAPTURE_VISIBLE_TAB_BACKOFF_BASE_MS * (attempt + 1);
        await wait(backoff);
      }
      attempt += 1;
    }

    throw new Error('captureVisibleTab failed after retries.');
  };

  const operation = captureVisibleTabQueue.then(runCapture, runCapture);
  // Keep queue alive even when an individual operation fails.
  captureVisibleTabQueue = operation.catch(() => {});
  return operation;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForTabComplete(tabId, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let resolved = false;

    const finalize = async () => {
      if (resolved) return;
      resolved = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      clearTimeout(timeout);
      try {
        resolve(await getTab(tabId));
      } catch {
        resolve(null);
      }
    };

    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId) return;
      if (changeInfo.status === 'complete') {
        void finalize();
      }
    };

    const timeout = setTimeout(() => {
      void finalize();
    }, timeoutMs);

    chrome.tabs.onUpdated.addListener(onUpdated);
    getTab(tabId)
      .then((tab) => {
        if (tab?.status === 'complete') {
          void finalize();
        }
      })
      .catch(() => {
        // Ignore eager check failures and rely on timeout.
      });
  });
}

function isUnsupportedCaptureUrl(url) {
  if (!url) return true;
  const value = String(url).toLowerCase();
  if (value.startsWith('chrome://')) return true;
  if (value.startsWith('chrome-extension://')) return true;
  if (value.startsWith('edge://')) return true;
  if (value.startsWith('about:')) return true;
  if (value.startsWith('devtools://')) return true;
  if (value.startsWith('view-source:')) return true;
  if (/^https:\/\/chromewebstore\.google\.com\//i.test(value)) return true;
  return false;
}

function isLikelyTrackingOrAssetUrl(url) {
  if (!url) return true;
  const value = String(url).toLowerCase();
  if (!/^https?:\/\//i.test(value)) return true;

  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname || '';
    const host = parsed.hostname || '';

    if (/\.(gif|png|jpe?g|webp|avif|svg|ico|css|js|mjs|json|xml|txt|map)(?:$|\?)/i.test(pathname)) return true;
    if (/\/(web-)?pixels?\b/i.test(pathname)) return true;
    if (/\/(beacon|collect|analytics|track|tracking|events?)\b/i.test(pathname)) return true;
    if (/(doubleclick|googletagmanager|google-analytics|segment|hotjar|mixpanel|amplitude|sentry|cdn-cgi)\./i.test(host)) {
      return true;
    }
  } catch {
    if (/(web-)?pixels?|beacon|collect|analytics|tracking|doubleclick|googletagmanager/i.test(value)) return true;
  }

  return false;
}

async function getCaptureFallbackTabs(excludeTabId = null) {
  const tabs = await queryTabs({ currentWindow: true });
  return tabs
    .filter((tab) => {
      if (!tab?.id || tab.id === excludeTabId) return false;
      if (!tab.url || isUnsupportedCaptureUrl(tab.url)) return false;
      if (isDreamlabUrl(tab.url)) return false;
      return /^https?:\/\//i.test(tab.url);
    })
    .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
}

function isStorageQuotaErrorMessage(message) {
  const normalized = String(message || '').toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('quota')
    || normalized.includes('exceeded')
    || normalized.includes('storage')
    || normalized.includes('setitem')
  );
}

function classifyStorageErrorMessage(message) {
  const normalized = String(message || '').toLowerCase();
  if (!normalized) return 'unknown';
  if (normalized.includes('indexeddb') || normalized.includes('media db') || normalized.includes('media database')) {
    return 'indexeddb';
  }
  if (normalized.includes('chrome.storage') || normalized.includes('storage.local') || normalized.includes('quota_bytes')) {
    return 'extension-storage';
  }
  if (
    normalized.includes('localstorage')
    || normalized.includes('setitem')
    || normalized.includes('quota')
    || normalized.includes('exceeded')
  ) {
    return 'localstorage';
  }
  return 'unknown';
}

function estimateDataUrlBytes(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return 0;
  const base64Part = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  return Math.ceil((base64Part.length * 3) / 4);
}

function buildVerticalCaptureOffsets(totalHeight, viewportHeight, overlapPx = 120) {
  const safeTotalHeight = Math.max(0, Math.floor(Number(totalHeight) || 0));
  const safeViewportHeight = Math.max(1, Math.floor(Number(viewportHeight) || 1));
  const safeOverlap = Math.max(0, Math.min(safeViewportHeight - 1, Math.floor(Number(overlapPx) || 0)));
  const step = Math.max(1, safeViewportHeight - safeOverlap);
  const maxStart = Math.max(0, safeTotalHeight - safeViewportHeight);
  const offsets = [];

  for (let y = 0; y <= maxStart; y += step) {
    offsets.push(y);
  }

  if (offsets.length === 0 || offsets[offsets.length - 1] !== maxStart) {
    offsets.push(maxStart);
  }

  return [...new Set(offsets)];
}

function calculateMedian(values = []) {
  const numeric = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (numeric.length === 0) return 0;
  const middle = Math.floor(numeric.length / 2);
  if (numeric.length % 2 === 1) return numeric[middle];
  return (numeric[middle - 1] + numeric[middle]) / 2;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function blobToDataUrl(blob) {
  const mimeType = blob?.type || 'image/png';
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);
  return `data:${mimeType};base64,${base64}`;
}

async function compressImageDataUrl(dataUrl, options = {}) {
  const {
    maxDimension = null,
    maxWidth = null,
    maxHeight = null,
    maxPixels = null,
    quality = 0.78,
    mimeType = 'image/jpeg',
  } = options;

  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  try {
    let scale = 1;
    if (Number(maxDimension) > 0) {
      const longestSide = Math.max(bitmap.width, bitmap.height);
      if (longestSide > maxDimension) {
        scale = Math.min(scale, maxDimension / longestSide);
      }
    }
    if (Number(maxWidth) > 0 && bitmap.width > maxWidth) {
      scale = Math.min(scale, maxWidth / bitmap.width);
    }
    if (Number(maxHeight) > 0 && bitmap.height > maxHeight) {
      scale = Math.min(scale, maxHeight / bitmap.height);
    }
    if (Number(maxPixels) > 0) {
      const area = bitmap.width * bitmap.height;
      if (area > maxPixels) {
        scale = Math.min(scale, Math.sqrt(maxPixels / area));
      }
    }

    scale = Math.max(0.05, Math.min(1, scale));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (!context) return dataUrl;
    context.drawImage(bitmap, 0, 0, width, height);

    const compressedBlob = await canvas.convertToBlob({
      type: mimeType,
      quality,
    });

    return await blobToDataUrl(compressedBlob);
  } finally {
    if (bitmap && typeof bitmap.close === 'function') bitmap.close();
  }
}

async function aggressiveStorageCompression(dataUrl) {
  const passes = [
    { quality: 0.68, mimeType: 'image/jpeg' },
    { quality: 0.58, mimeType: 'image/jpeg' },
    { maxPixels: 22_000_000, maxWidth: 2000, quality: 0.52, mimeType: 'image/jpeg' },
    { maxPixels: 16_000_000, maxWidth: 1700, quality: 0.48, mimeType: 'image/jpeg' },
    { maxPixels: 12_000_000, maxWidth: 1500, quality: 0.44, mimeType: 'image/jpeg' },
  ];

  let current = dataUrl;
  let currentSize = estimateDataUrlBytes(current);

  for (const pass of passes) {
    try {
      const next = await compressImageDataUrl(current, pass);
      const nextSize = estimateDataUrlBytes(next);
      if (nextSize > 0 && nextSize < currentSize) {
        current = next;
        currentSize = nextSize;
      }
    } catch {
      // Ignore per-pass compression failures.
    }
  }

  return current;
}

async function showInPageToast(tabId, { message, type = 'info', durationMs = 2600 }) {
  if (!tabId || !message) return;

  try {
    await executeScriptFn(
      tabId,
      (toastMessage, toastType, toastDuration) => {
        const rootId = '__dreamlab_extension_toast_root__';
        const toastId = '__dreamlab_extension_toast__';

        const removeTimer = window.__dreamlabToastTimer__;
        if (removeTimer) {
          clearTimeout(removeTimer);
        }

        let root = document.getElementById(rootId);
        if (!root) {
          root = document.createElement('div');
          root.id = rootId;
          root.style.position = 'fixed';
          root.style.zIndex = '2147483647';
          root.style.right = '24px';
          root.style.bottom = '24px';
          root.style.pointerEvents = 'none';
          document.documentElement.appendChild(root);
        }

        let toast = document.getElementById(toastId);
        if (!toast) {
          toast = document.createElement('div');
          toast.id = toastId;
          toast.style.minWidth = '240px';
          toast.style.maxWidth = '420px';
          toast.style.borderRadius = '12px';
          toast.style.padding = '10px 14px';
          toast.style.fontFamily = '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
          toast.style.fontSize = '13px';
          toast.style.lineHeight = '1.35';
          toast.style.boxShadow = '0 10px 24px rgba(0, 0, 0, 0.18)';
          toast.style.border = '1px solid #ebebeb';
          toast.style.background = '#ffffff';
          toast.style.color = '#171717';
          toast.style.transition = 'opacity 140ms ease, transform 140ms ease';
          toast.style.opacity = '0';
          toast.style.transform = 'translateY(8px)';
          root.appendChild(toast);
        }

        toast.textContent = String(toastMessage || '');
        toast.style.background = '#ffffff';
        toast.style.color = '#171717';
        toast.style.borderColor = '#ebebeb';

        if (toastType === 'success') {
          toast.style.background = '#f0fdf4';
          toast.style.color = '#166534';
          toast.style.borderColor = '#bbf7d0';
        } else if (toastType === 'error') {
          toast.style.background = '#fef2f2';
          toast.style.color = '#b91c1c';
          toast.style.borderColor = '#fecaca';
        }

        requestAnimationFrame(() => {
          toast.style.opacity = '1';
          toast.style.transform = 'translateY(0px)';
        });

        window.__dreamlabToastTimer__ = setTimeout(() => {
          const nextToast = document.getElementById(toastId);
          if (!nextToast) return;
          nextToast.style.opacity = '0';
          nextToast.style.transform = 'translateY(8px)';
        }, Math.max(900, Number(toastDuration) || 2600));
      },
      [message, type, durationMs]
    );
  } catch {
    // Ignore toast failures (e.g. unsupported tabs) and avoid blocking main flow.
  }
}

async function setInPageToastVisibility(tabId, isVisible) {
  if (!tabId) return;
  try {
    await executeScriptFn(
      tabId,
      (visible) => {
        const root = document.getElementById('__dreamlab_extension_toast_root__');
        if (!root) return;
        root.style.display = visible ? '' : 'none';
      },
      [Boolean(isVisible)]
    );
  } catch {
    // Ignore visibility toggle failures.
  }
}

async function hideFixedElements(tabId) {
  try {
    await executeScriptFn(tabId, () => {
      const ATTR = 'data-dreamlab-hidden-fixed';
      const viewportWidth = Math.max(1, window.innerWidth || document.documentElement?.clientWidth || 1);
      const viewportHeight = Math.max(1, window.innerHeight || document.documentElement?.clientHeight || 1);
      const viewportArea = viewportWidth * viewportHeight;
      const all = document.querySelectorAll('*');
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (el === document.documentElement || el === document.body) continue;
        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          const rect = el.getBoundingClientRect();
          if (!rect || rect.width <= 0 || rect.height <= 0) continue;

          // Ignore off-screen fixed/sticky elements.
          if (
            rect.bottom <= 0
            || rect.top >= viewportHeight
            || rect.right <= 0
            || rect.left >= viewportWidth
          ) {
            continue;
          }

          // Guardrail: large fixed containers are often the actual app shell.
          const elementArea = rect.width * rect.height;
          if (elementArea >= viewportArea * 0.85) continue;

          el.setAttribute(ATTR, el.style.visibility || '');
          el.style.visibility = 'hidden';
        }
      }
    });
  } catch {
    // Non-critical — capture will still work, just with duplicated fixed elements.
  }
}

async function restoreFixedElements(tabId) {
  try {
    await executeScriptFn(tabId, () => {
      const ATTR = 'data-dreamlab-hidden-fixed';
      const hidden = document.querySelectorAll(`[${ATTR}]`);
      for (let i = 0; i < hidden.length; i++) {
        const el = hidden[i];
        const prev = el.getAttribute(ATTR);
        el.style.visibility = prev || '';
        el.removeAttribute(ATTR);
      }
    });
  } catch {
    // Best-effort restore.
  }
}

async function captureFullPageScreenshot(tab) {
  if (!tab?.id || !tab?.windowId) {
    throw new Error('Active tab is unavailable for capture.');
  }

  const metrics = await executeScriptFn(
    tab.id,
    () => {
      const root = document.scrollingElement || document.documentElement;
      const doc = document.documentElement;
      const body = document.body;
      const viewportWidth = window.innerWidth || doc.clientWidth || root?.clientWidth || 0;
      const viewportHeight = window.innerHeight || doc.clientHeight || root?.clientHeight || 0;
      const totalHeight = Math.max(
        root?.scrollHeight || 0,
        doc.scrollHeight || 0,
        doc.offsetHeight || 0,
        doc.clientHeight || 0,
        body?.scrollHeight || 0,
        body?.offsetHeight || 0
      );
      return {
        scrollX: window.scrollX || window.pageXOffset || 0,
        scrollY: window.scrollY || window.pageYOffset || root?.scrollTop || 0,
        viewportWidth,
        viewportHeight,
        totalHeight,
        maxScrollY: Math.max(0, totalHeight - viewportHeight),
      };
    }
  );

  const viewportWidth = Math.max(1, Math.floor(Number(metrics?.viewportWidth) || 1));
  const viewportHeight = Math.max(1, Math.floor(Number(metrics?.viewportHeight) || 1));
  let totalHeight = Math.max(viewportHeight, Math.floor(Number(metrics?.totalHeight) || viewportHeight));
  const scrollX = Math.floor(Number(metrics?.scrollX) || 0);
  const scrollY = Math.floor(Number(metrics?.scrollY) || 0);
  let offsets = buildVerticalCaptureOffsets(totalHeight, viewportHeight, 120);

  // Hide fixed/sticky elements (headers, navbars, cookie banners) so they
  // don't repeat in every captured viewport frame.
  await hideFixedElements(tab.id);

  const captures = [];
  try {
    for (let index = 0; index < offsets.length; index += 1) {
      const offsetY = offsets[index];

      // Scroll and wait for layout to settle before capture.
      const settled = await executeScriptFn(
        tab.id,
        async (x, y) => {
          const root = document.scrollingElement || document.documentElement;
          if (root && typeof root.scrollTo === 'function') {
            root.scrollTo({ left: x, top: y, behavior: 'instant' });
          }
          window.scrollTo(x, y);

          await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

          const doc = document.documentElement;
          const body = document.body;
          const viewportWidth = window.innerWidth || doc.clientWidth || root?.clientWidth || 0;
          const viewportHeight = window.innerHeight || doc.clientHeight || root?.clientHeight || 0;
          const totalHeight = Math.max(
            root?.scrollHeight || 0,
            doc.scrollHeight || 0,
            doc.offsetHeight || 0,
            doc.clientHeight || 0,
            body?.scrollHeight || 0,
            body?.offsetHeight || 0
          );

          return {
            scrollY: window.scrollY || window.pageYOffset || root?.scrollTop || 0,
            viewportWidth,
            viewportHeight,
            totalHeight,
            maxScrollY: Math.max(0, totalHeight - viewportHeight),
          };
        },
        [scrollX, offsetY]
      );
      // Extra settle for lazy-loaded media and repaints.
      await wait(220);

      const dataUrl = await captureVisibleTab(tab.windowId, { format: 'png' });
      const actualY = Math.floor(Number(settled?.scrollY) || offsetY);
      const frameViewportHeight = Math.max(1, Math.floor(Number(settled?.viewportHeight) || viewportHeight));
      const frameViewportWidth = Math.max(1, Math.floor(Number(settled?.viewportWidth) || viewportWidth));
      const frameTotalHeight = Math.max(frameViewportHeight, Math.floor(Number(settled?.totalHeight) || totalHeight));

      captures.push({
        offsetY: actualY,
        viewportHeight: frameViewportHeight,
        viewportWidth: frameViewportWidth,
        totalHeight: frameTotalHeight,
        dataUrl,
      });

      // Some pages grow while scrolling (lazy loading / infinite sections).
      if (frameTotalHeight > totalHeight + 8) {
        totalHeight = frameTotalHeight;
        const extended = buildVerticalCaptureOffsets(totalHeight, viewportHeight, 120);
        const known = new Set(offsets);
        for (const value of extended) {
          if (value > offsetY && !known.has(value)) {
            offsets.push(value);
          }
        }
        offsets = offsets.sort((a, b) => a - b);
      }
    }
  } finally {
    await restoreFixedElements(tab.id);
    try {
      await executeScriptFn(tab.id, (x, y) => window.scrollTo(x, y), [scrollX, scrollY]);
    } catch {
      // Ignore restore-scroll failures.
    }
  }

  if (!captures.length) {
    throw new Error('No capture frames were generated.');
  }

  // Sort + deduplicate near-identical offsets.
  const sortedCaptures = [...captures].sort((a, b) => a.offsetY - b.offsetY);
  const uniqueCaptures = [];
  for (const frame of sortedCaptures) {
    const previous = uniqueCaptures[uniqueCaptures.length - 1];
    if (previous && Math.abs(frame.offsetY - previous.offsetY) <= 2) {
      uniqueCaptures[uniqueCaptures.length - 1] = frame;
      continue;
    }
    uniqueCaptures.push(frame);
  }

  const bitmaps = [];
  for (const frame of uniqueCaptures) {
    const response = await fetch(frame.dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const frameViewportHeight = Math.max(1, Number(frame.viewportHeight) || viewportHeight);
    const frameViewportWidth = Math.max(1, Number(frame.viewportWidth) || viewportWidth);
    const scaleX = bitmap.width / frameViewportWidth;
    const scaleY = bitmap.height / frameViewportHeight;
    bitmaps.push({
      ...frame,
      bitmap,
      viewportHeight: frameViewportHeight,
      viewportWidth: frameViewportWidth,
      scaleX: Number.isFinite(scaleX) && scaleX > 0 ? scaleX : 1,
      scaleY: Number.isFinite(scaleY) && scaleY > 0 ? scaleY : 1,
    });
  }

  try {
    const firstBitmap = bitmaps[0].bitmap;
    const referenceScaleX = calculateMedian(bitmaps.map((frame) => frame.scaleX)) || bitmaps[0].scaleX || 1;
    const referenceScaleY = calculateMedian(bitmaps.map((frame) => frame.scaleY)) || bitmaps[0].scaleY || 1;
    const observedCssHeight = Math.max(
      totalHeight,
      viewportHeight,
      ...bitmaps.map((frame) => frame.offsetY + frame.viewportHeight)
    );
    const maxFrameWidth = Math.max(...bitmaps.map((frame) => frame.bitmap.width));
    const targetWidthPx = Math.max(maxFrameWidth, Math.round(viewportWidth * referenceScaleX));
    const targetHeightPx = Math.max(firstBitmap.height, Math.round(observedCssHeight * referenceScaleY));

    const maxCanvasArea = 180_000_000;
    const area = targetWidthPx * targetHeightPx;
    const outputScale = area > maxCanvasArea ? Math.sqrt(maxCanvasArea / area) : 1;

    const canvasWidth = Math.max(1, Math.round(targetWidthPx * outputScale));
    const canvasHeight = Math.max(1, Math.round(targetHeightPx * outputScale));
    const canvas = new OffscreenCanvas(canvasWidth, canvasHeight);
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not initialize capture canvas.');
    }

    // Use white background so any unavoidable unpainted pixels are not black.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvasWidth, canvasHeight);

    const cssToOutputYPx = referenceScaleY * outputScale;
    const maxCanvasCssBottom = canvasHeight / Math.max(0.0001, cssToOutputYPx);
    let paintedUntilCss = 0;

    for (const frame of bitmaps) {
      const frameTopCss = Math.max(0, Number(frame.offsetY) || 0);
      const frameBottomCss = frameTopCss + frame.viewportHeight;
      let drawTopCss = Math.max(frameTopCss, paintedUntilCss);
      let drawBottomCss = Math.min(frameBottomCss, maxCanvasCssBottom);

      if (drawBottomCss <= drawTopCss) continue;

      const sourceTopCss = drawTopCss - frameTopCss;
      const sourceHeightCss = drawBottomCss - drawTopCss;

      const sourceY = Math.max(0, Math.round(sourceTopCss * frame.scaleY));
      let sourceHeight = Math.max(1, Math.round(sourceHeightCss * frame.scaleY));
      if (sourceY + sourceHeight > frame.bitmap.height) {
        sourceHeight = Math.max(1, frame.bitmap.height - sourceY);
      }

      const destinationY = Math.max(0, Math.round(drawTopCss * cssToOutputYPx));
      let destinationHeight = Math.max(
        1,
        Math.round((sourceHeight / Math.max(0.0001, frame.scaleY)) * cssToOutputYPx)
      );
      if (destinationY + destinationHeight > canvasHeight) {
        destinationHeight = Math.max(1, canvasHeight - destinationY);
        const maxSourceHeight = Math.max(
          1,
          Math.round((destinationHeight / Math.max(0.0001, cssToOutputYPx)) * frame.scaleY)
        );
        sourceHeight = Math.max(1, Math.min(sourceHeight, maxSourceHeight, frame.bitmap.height - sourceY));
      }

      if (destinationY >= canvasHeight || destinationHeight <= 0) continue;

      context.drawImage(
        frame.bitmap,
        0,
        sourceY,
        frame.bitmap.width,
        sourceHeight,
        0,
        destinationY,
        canvasWidth,
        destinationHeight
      );

      paintedUntilCss = Math.max(paintedUntilCss, drawBottomCss);
    }

    const stitchedBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.86 });
    const stitchedDataUrl = await blobToDataUrl(stitchedBlob);

    return {
      dataUrl: stitchedDataUrl,
      width: canvasWidth,
      height: canvasHeight,
      mimeType: 'image/jpeg',
    };
  } finally {
    bitmaps.forEach(({ bitmap }) => {
      if (bitmap && typeof bitmap.close === 'function') bitmap.close();
    });
  }
}

function isMissingReceiverError(error) {
  const message = String(error?.message || '');
  return /receiving end does not exist/i.test(message);
}

async function sendTabMessageWithBridge(tabId, message, options = {}) {
  try {
    return await sendTabMessage(tabId, message, options);
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    // Content scripts can be absent on existing tabs after extension reload/update.
    await executeScript(tabId, ['content.js']);
    await wait(60);
    return await sendTabMessage(tabId, message, options);
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

async function ensureDreamlabTab() {
  try {
    return await getPreferredDreamlabTab();
  } catch {
    let lastError = null;

    for (const appUrl of DREAMLAB_APP_URLS) {
      try {
        const created = await createTab({ url: appUrl, active: false });
        if (!created?.id) continue;
        const readyTab = await waitForTabComplete(created.id, 7000);
        if (readyTab && isDreamlabUrl(readyTab.url || appUrl)) {
          await wait(350);
          return readyTab;
        }
      } catch (error) {
        lastError = error;
      }
    }

    throw new Error(lastError?.message || 'Dreamlab web app is not open and could not be started.');
  }
}

async function getDreamlabDestinationSummary(targetTabId = null) {
  try {
    const destinationTab = targetTabId
      ? await getTab(targetTabId)
      : await getPreferredDreamlabTab();
    if (!destinationTab?.id) return 'active context';

    const response = await sendTabMessageWithBridge(destinationTab.id, {
      action: CONTENT_ACTIONS.getOrgData,
    }, { frameId: 0 });

    if (!response || response.success !== true) return 'active context';

    const activeContext = response.activeContext || {};
    const workspaces = Array.isArray(response.workspaces) ? response.workspaces : [];
    const collections = Array.isArray(response.collections) ? response.collections : [];

    const workspaceName = workspaces.find((workspace) => workspace.id === activeContext.workspaceId)?.name || '';
    const collectionName = collections.find((collection) => collection.id === activeContext.collectionId)?.name || '';

    if (workspaceName && collectionName) {
      return `${workspaceName} / ${collectionName}`;
    }
    if (collectionName) return collectionName;
    if (workspaceName) return workspaceName;
    return 'active context';
  } catch {
    return 'active context';
  }
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
  return parseMetadataFromHtml(html, url);
}

function parseMetadataFromHtml(html, url) {
  if (!html || typeof html !== 'string') {
    return { title: null, image: null, description: null };
  }

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

function withCacheBuster(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('dlcb', Date.now().toString());
    return parsed.toString();
  } catch {
    return url;
  }
}

function isLikelyStaleMetadata(metadata) {
  const title = String(metadata?.title || '').trim().toLowerCase();
  const image = String(metadata?.image || '').trim().toLowerCase();

  if (!metadata?.title && !metadata?.description && !metadata?.image) return true;
  if (!metadata?.image) return true;

  // Common generic social placeholders that are often stale.
  if (title === 'x' || title === 'x / twitter') return true;
  if (image.includes('abs.twimg.com') || image.includes('twitter_card') || image.includes('x.com')) return true;

  return false;
}

async function fetchMetadataWithFallback(url) {
  const firstPass = await fetchMetadataFromUrl(url);
  if (!isLikelyStaleMetadata(firstPass)) return firstPass;

  try {
    const cacheBustedUrl = withCacheBuster(url);
    const secondPass = await fetchMetadataFromUrl(cacheBustedUrl);
    return {
      title: secondPass?.title || firstPass?.title || null,
      image: secondPass?.image || firstPass?.image || null,
      description: secondPass?.description || firstPass?.description || null,
    };
  } catch {
    return firstPass;
  }
}

function decodeHtmlEntities(input) {
  if (!input) return '';
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtmlTags(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<\/?(article|section|main|aside|header|footer|div|p|span|h\d|li|ul|ol|br)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function normalizeExtractedText(value) {
  return decodeHtmlEntities(stripHtmlTags(value))
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMetaContent(html, keys = []) {
  for (const key of keys) {
    const regex = new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["'][^>]*>|<meta[^>]*content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`,
      'i'
    );
    const match = html.match(regex);
    const value = (match && (match[1] || match[2])) ? match[1] || match[2] : '';
    if (value) return value.trim();
  }
  return '';
}

function extractMainTextFromHtml(html) {
  const articleMatch = html.match(/<article[\s\S]*?<\/article>/i);
  const mainMatch = html.match(/<main[\s\S]*?<\/main>/i);
  const candidate = articleMatch?.[0] || mainMatch?.[0] || html;
  return normalizeExtractedText(candidate);
}

async function fetchTextExtractFromUrl(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    const html = await response.text();
    const text = extractMainTextFromHtml(html).slice(0, MAX_TEXT_EXTRACT_LENGTH);

    if (!text || text.length < 120) {
      return {
        status: 'unavailable',
        source: 'extension',
        extractedAt: Date.now(),
      };
    }

    const titleFromMeta = extractMetaContent(html, ['og:title', 'twitter:title']);
    const byline = extractMetaContent(html, ['author', 'article:author']);
    const siteName = extractMetaContent(html, ['og:site_name']);
    const description = extractMetaContent(html, ['description', 'og:description']);
    const excerpt = normalizeExtractedText(description).slice(0, 300);

    return {
      status: 'ready',
      source: 'extension',
      extractedAt: Date.now(),
      title: titleFromMeta || null,
      byline: byline || null,
      siteName: siteName || normalizeDomain(url) || null,
      content: text,
      excerpt: excerpt || text.slice(0, 300),
      wordCount: text.split(/\s+/).filter(Boolean).length,
    };
  } catch {
    return {
      status: 'failed',
      source: 'extension',
      extractedAt: Date.now(),
    };
  }
}

async function maybeAttachTextExtract(item) {
  if (!item || item.type !== 'link') return item;
  const sourceUrl = item.sourceUrl || item.content;
  if (!sourceUrl) return item;

  if (!shouldAttemptTextExtraction(sourceUrl)) {
    return {
      ...item,
      linkViewMode: 'preview',
      textExtract: item.textExtract || {
        status: 'unavailable',
        source: 'extension',
        extractedAt: Date.now(),
      },
    };
  }

  const textExtract = await fetchTextExtractFromUrl(sourceUrl);
  const linkViewMode = textExtract?.status === 'ready' ? 'text' : 'preview';
  return {
    ...item,
    textExtract,
    linkViewMode,
  };
}

async function enrichLinkCapture(item) {
  const withEmbed = await maybeAttachLinkEmbed(item);
  return await maybeAttachTextExtract(withEmbed);
}

function isPinterestHost(hostname) {
  return /(^|\.)pinterest\./i.test(String(hostname || ''));
}

function isPinterestPinUrl(url) {
  try {
    const parsed = new URL(url);
    return isPinterestHost(parsed.hostname) && /\/pin\//i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function getPinterestPinId(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/pin\/(\d+)/i);
    return match?.[1] || '';
  } catch {
    return '';
  }
}

function isLikelyGenericPinterestAsset(candidateUrl) {
  const url = String(candidateUrl || '').toLowerCase();
  if (!url) return true;

  return (
    url.includes('s.pinimg.com')
    || url.includes('/webapp/')
    || url.includes('/passets/')
    || url.includes('/images/homepage/')
    || url.includes('pinterest-logo')
    || url.includes('social-default')
    || url.includes('default_')
  );
}

function normalizePinterestCandidate(candidate) {
  if (!candidate) return null;

  if (typeof candidate === 'string') {
    return {
      src: candidate,
      width: 0,
      height: 0,
      pinId: '',
      fromPinCloseup: false,
      fromStructuredPinData: false,
      fromScan: false,
    };
  }

  if (typeof candidate !== 'object') return null;

  return {
    src: String(candidate.src || candidate.url || '').trim(),
    width: Number(candidate.width || candidate.displayWidth || 0),
    height: Number(candidate.height || candidate.displayHeight || 0),
    pinId: String(candidate.pinId || ''),
    fromPinCloseup: Boolean(candidate.fromPinCloseup),
    fromStructuredPinData: Boolean(candidate.fromStructuredPinData),
    fromScan: Boolean(candidate.fromScan),
  };
}

function scorePinterestImageCandidate(candidateUrl, width = 0, height = 0, options = {}) {
  const url = String(candidateUrl || '').trim();
  if (!url) return -1;

  const normalized = url.toLowerCase();
  let score = 0;

  if (isLikelyGenericPinterestAsset(normalized)) score -= 2600;
  if (normalized.includes('i.pinimg.com')) score += 2100;
  if (normalized.includes('/originals/')) score += 600;
  if (normalized.includes('/1200x/')) score += 320;
  if (normalized.includes('/736x/')) score += 250;
  if (normalized.includes('/474x/')) score += 120;
  if (normalized.includes('/236x/')) score -= 120;

  if (options?.pinId && normalized.includes(String(options.pinId).toLowerCase())) score += 700;
  if (options?.fromPinCloseup) score += 650;
  if (options?.fromStructuredPinData) score += 520;
  if (options?.fromScan) score += 80;

  const numericWidth = Math.max(0, Number(width || 0));
  const numericHeight = Math.max(0, Number(height || 0));
  const area = numericWidth * numericHeight;

  if (numericWidth > 0 && numericHeight > 0) {
    const ratio = numericWidth / numericHeight;
    if (ratio >= 0.45 && ratio <= 0.95) score += 160; // Most pins are portrait-ish.
    if (ratio > 1.8) score -= 120;
    if (area < 50_000) score -= 420;
  }

  score += Math.min(900, Math.floor(area / 1000));
  return score;
}

function pickBestPinterestImageCandidate(...candidates) {
  let best = null;
  let bestScore = -1;

  candidates.flat().forEach((candidate) => {
    const normalizedCandidate = normalizePinterestCandidate(candidate);
    if (!normalizedCandidate) return;

    const value = String(normalizedCandidate.src || '').trim();
    if (!value) return;

    const score = scorePinterestImageCandidate(
      value,
      normalizedCandidate.width,
      normalizedCandidate.height,
      {
        pinId: normalizedCandidate.pinId,
        fromPinCloseup: normalizedCandidate.fromPinCloseup,
        fromStructuredPinData: normalizedCandidate.fromStructuredPinData,
        fromScan: normalizedCandidate.fromScan,
      }
    );

    if (score > bestScore) {
      best = value;
      bestScore = score;
    }
  });

  return best;
}

function pickBestPinterestScanImage(images = [], pinId = '') {
  let best = null;
  let bestScore = -1;

  for (const image of images) {
    const src = String(image?.src || '').trim();
    if (!src) continue;
    const score = scorePinterestImageCandidate(
      src,
      image?.displayWidth || image?.width || 0,
      image?.displayHeight || image?.height || 0,
      {
        pinId,
        fromScan: true,
      }
    );
    if (score > bestScore) {
      best = src;
      bestScore = score;
    }
  }

  return best;
}

async function getPinterestPinMetadataFromDom(tabId) {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const makeAbsolute = (value) => {
          if (!value) return '';
          try {
            return new URL(value, window.location.href).href;
          } catch {
            return value;
          }
        };

        const getMeta = (name) => {
          const selector = `meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`;
          const element = document.querySelector(selector);
          return element ? element.getAttribute('content') : '';
        };

        const getBestUrlFromSrcset = (srcset) => {
          if (!srcset) return '';
          try {
            const entries = srcset
              .split(',')
              .map((entry) => entry.trim())
              .filter(Boolean)
              .map((entry) => {
                const [entryUrl, descriptor] = entry.split(/\s+/);
                let size = 0;
                if (descriptor?.endsWith('w')) size = Number.parseInt(descriptor, 10) || 0;
                if (descriptor?.endsWith('x')) size = Math.round((Number.parseFloat(descriptor) || 0) * 1000);
                return { entryUrl, size };
              })
              .filter((entry) => entry.entryUrl);

            entries.sort((left, right) => right.size - left.size);
            return entries[0]?.entryUrl || '';
          } catch {
            return '';
          }
        };

        const pinIdMatch = window.location.pathname.match(/\/pin\/(\d+)/i);
        const pinId = pinIdMatch?.[1] || '';

        const addCandidate = (pool, src, width = 0, height = 0, base = 0, options = {}) => {
          const absolute = makeAbsolute(src);
          if (!absolute) return;

          const normalized = absolute.toLowerCase();
          if (
            normalized.includes('s.pinimg.com')
            || normalized.includes('/webapp/')
            || normalized.includes('/images/homepage/')
            || normalized.includes('social-default')
          ) {
            base -= 2600;
          }

          let score = base;
          if (normalized.includes('i.pinimg.com')) score += 2100;
          if (normalized.includes('/originals/')) score += 600;
          if (normalized.includes('/1200x/')) score += 320;
          if (normalized.includes('/736x/')) score += 250;
          if (normalized.includes('/474x/')) score += 120;
          if (normalized.includes('/236x/')) score -= 120;
          if (pinId && normalized.includes(pinId)) score += 700;
          if (options.fromPinCloseup) score += 650;
          if (options.fromStructuredPinData) score += 520;

          const numericWidth = Math.max(0, Number(width || 0));
          const numericHeight = Math.max(0, Number(height || 0));
          if (numericWidth > 0 && numericHeight > 0) {
            const ratio = numericWidth / numericHeight;
            const area = numericWidth * numericHeight;
            if (ratio >= 0.45 && ratio <= 0.95) score += 160;
            if (ratio > 1.8) score -= 120;
            if (area < 50_000) score -= 420;
          }

          const area = Math.max(0, Number(width || 0)) * Math.max(0, Number(height || 0));
          score += Math.min(900, Math.floor(area / 1000));
          pool.push({ src: absolute, score });
        };

        const candidates = [];
        addCandidate(candidates, getMeta('og:image:secure_url'), 0, 0, 1800);
        addCandidate(candidates, getMeta('og:image:url'), 0, 0, 1700);
        addCandidate(candidates, getMeta('og:image'), 0, 0, 1600);
        addCandidate(candidates, getMeta('twitter:image:src'), 0, 0, 1500);
        addCandidate(candidates, getMeta('twitter:image'), 0, 0, 1400);
        addCandidate(candidates, getMeta('pin:media'), 0, 0, 1600);

        const pinCloseupSelectors = [
          '[data-test-id*="closeup"] img',
          '[data-test-id*="pin-closeup"] img',
          '[data-test-id*="closeup-image"] img',
          '[data-test-id*="pinImage"] img',
          '[data-test-id*="Pin"] img',
          pinId ? `a[href*="/pin/${pinId}/"] img` : '',
        ].filter(Boolean);

        pinCloseupSelectors.forEach((selector) => {
          const images = Array.from(document.querySelectorAll(selector));
          images.forEach((img) => {
            const rect = img.getBoundingClientRect();
            const srcset = getBestUrlFromSrcset(img.getAttribute('srcset') || img.getAttribute('data-srcset'));
            const src = srcset
              || img.currentSrc
              || img.getAttribute('src')
              || img.getAttribute('data-src')
              || img.getAttribute('data-full-url');

            addCandidate(
              candidates,
              src,
              img.naturalWidth || rect.width || 0,
              img.naturalHeight || rect.height || 0,
              3200,
              { fromPinCloseup: true }
            );
          });
        });

        const visibleImages = Array.from(document.querySelectorAll('img'))
          .filter((img) => {
            const rect = img.getBoundingClientRect();
            return rect.width >= 120 && rect.height >= 120;
          });

        visibleImages.forEach((img) => {
          const rect = img.getBoundingClientRect();
          const srcset = getBestUrlFromSrcset(img.getAttribute('srcset') || img.getAttribute('data-srcset'));
          const src = srcset
            || img.currentSrc
            || img.getAttribute('src')
            || img.getAttribute('data-src')
            || img.getAttribute('data-full-url');
          addCandidate(candidates, src, rect.width, rect.height, 800);
        });

        const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        jsonLdScripts.forEach((script) => {
          try {
            const parsed = JSON.parse(script.textContent || '{}');
            const queue = Array.isArray(parsed) ? parsed : [parsed];
            while (queue.length > 0) {
              const node = queue.shift();
              if (!node || typeof node !== 'object') continue;

              const imageValue = node.image;
              if (typeof imageValue === 'string') {
                addCandidate(candidates, imageValue, 0, 0, 1300);
              } else if (Array.isArray(imageValue)) {
                imageValue.forEach((entry) => {
                  if (typeof entry === 'string') addCandidate(candidates, entry, 0, 0, 1250);
                  if (entry && typeof entry === 'object' && typeof entry.url === 'string') {
                    addCandidate(candidates, entry.url, 0, 0, 1250);
                  }
                });
              } else if (imageValue && typeof imageValue === 'object' && typeof imageValue.url === 'string') {
                addCandidate(candidates, imageValue.url, 0, 0, 1300);
              }

              Object.values(node).forEach((value) => {
                if (value && typeof value === 'object') queue.push(value);
              });
            }
          } catch {
            // Ignore malformed json-ld.
          }
        });

        const rawJsonScripts = Array.from(document.querySelectorAll('script[id*="__PWS_DATA__"], script[type="application/json"]')).slice(0, 8);
        rawJsonScripts.forEach((script) => {
          const content = String(script.textContent || '');
          if (!content) return;
          const normalized = content.replace(/\\\//g, '/');
          if (pinId && !normalized.includes(pinId)) return;

          const matches = normalized.match(/https:\/\/i\.pinimg\.com\/[^\s"'\\]+/g) || [];
          const uniqueMatches = Array.from(new Set(matches)).slice(0, 40);
          uniqueMatches.forEach((candidateUrl) => {
            addCandidate(
              candidates,
              candidateUrl,
              0,
              0,
              pinId && candidateUrl.includes(pinId) ? 3000 : 2300,
              { fromStructuredPinData: true }
            );
          });
        });

        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0]?.src || '';
        const title = getMeta('og:title') || getMeta('twitter:title') || document.title || '';
        const description = getMeta('og:description') || getMeta('description') || '';
        return {
          image: best || null,
          title: title || null,
          description: description || null,
        };
      },
    });
    return result?.[0]?.result || {};
  } catch {
    return {};
  }
}

async function fetchPinterestOEmbedMetadata(url) {
  try {
    const endpoint = `https://www.pinterest.com/oembed.json?url=${encodeURIComponent(url)}&maxwidth=1200`;
    const response = await fetch(endpoint, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!response.ok) return {};

    const payload = await response.json();
    return {
      title: payload?.title || null,
      image: payload?.thumbnail_url || payload?.thumbnailUrl || null,
      description: payload?.author_name ? `By ${payload.author_name}` : null,
    };
  } catch {
    return {};
  }
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
    const pinterestPinPage = isPinterestPinUrl(targetUrl);
    const pinterestPinId = pinterestPinPage ? getPinterestPinId(targetUrl) : '';
    let pinDomMetadata = {};

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

      if (pinterestPinPage) {
        pinDomMetadata = await getPinterestPinMetadataFromDom(tabId);
        domResult = {
          title: pinDomMetadata.title || domResult.title || null,
          image: pickBestPinterestImageCandidate(
            { src: pinDomMetadata.image, pinId: pinterestPinId, fromPinCloseup: true },
            { src: domResult.image, pinId: pinterestPinId }
          ) || null,
          description: pinDomMetadata.description || domResult.description || null,
        };
      }

      if (domResult.image && !pinterestPinPage) return domResult;

      try {
        const fallback = await fetchMetadataWithFallback(targetUrl);
        const oembed = pinterestPinPage ? await fetchPinterestOEmbedMetadata(targetUrl) : {};
        const merged = {
          title: domResult.title || oembed.title || fallback.title,
          image: pinterestPinPage
            ? pickBestPinterestImageCandidate(
              { src: domResult.image, pinId: pinterestPinId, fromPinCloseup: true },
              { src: pinDomMetadata.image, pinId: pinterestPinId, fromPinCloseup: true },
              { src: oembed.image, pinId: pinterestPinId, fromStructuredPinData: true },
              { src: fallback.image, pinId: pinterestPinId }
            )
            : fallback.image,
          description: domResult.description || oembed.description || fallback.description,
        };
        if (pinterestPinPage) {
          try {
            const scan = await requestImageScan(tabId, 'all');
            const bestPinterestImage = pickBestPinterestScanImage(scan?.images || scan?.visibleImages || [], pinterestPinId);
            if (bestPinterestImage) {
              merged.image = pickBestPinterestImageCandidate(
                { src: merged.image, pinId: pinterestPinId },
                { src: bestPinterestImage, pinId: pinterestPinId, fromScan: true }
              );
            }
          } catch {
            // Keep merged metadata without scan image.
          }
        }
        return merged;
      } catch {
        if (pinterestPinPage) {
          try {
            const scan = await requestImageScan(tabId, 'all');
            const bestPinterestImage = pickBestPinterestScanImage(scan?.images || scan?.visibleImages || [], pinterestPinId);
            if (bestPinterestImage) {
              return {
                title: domResult.title || null,
                image: pickBestPinterestImageCandidate(
                  { src: domResult.image, pinId: pinterestPinId, fromPinCloseup: true },
                  { src: pinDomMetadata.image, pinId: pinterestPinId, fromPinCloseup: true },
                  { src: bestPinterestImage, pinId: pinterestPinId, fromScan: true }
                ),
                description: domResult.description || null,
              };
            }
          } catch {
            // Keep default dom result.
          }
        }
        return domResult;
      }
    }

    const fallback = await fetchMetadataWithFallback(targetUrl);
    if (!pinterestPinPage) return fallback;

    const oembed = await fetchPinterestOEmbedMetadata(targetUrl);
    return {
      title: oembed.title || fallback.title || null,
      image: pickBestPinterestImageCandidate(
        { src: oembed.image, pinId: pinterestPinId, fromStructuredPinData: true },
        { src: fallback.image, pinId: pinterestPinId }
      ) || null,
      description: oembed.description || fallback.description || null,
    };
  } catch {
    return {};
  }
}

async function requestImageScan(tabId, scope = 'visible') {
  const response = await sendTabMessageWithBridge(tabId, {
    action: CONTENT_ACTIONS.scanPageImages,
    scope,
  }, { frameId: 0 });

  if (!response || response.success !== true) {
    throw new Error(response?.error || 'Could not scan images on this page.');
  }

  return response;
}

function normalizeScanImages(scan) {
  const visibleImages = Array.isArray(scan?.visibleImages) ? scan.visibleImages : [];
  const allImages = Array.isArray(scan?.images) ? scan.images : [];
  const totalCount = Number(scan?.totalCount || (allImages.length || visibleImages.length || 0));
  return { visibleImages, allImages, totalCount };
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

  // Use tabs.create instead of windows.create — Arc blocks popup windows.
  try {
    await createWindow({
      url: 'multi-select.html',
      type: 'popup',
      width: 920,
      height: 700,
      focused: true,
    });
  } catch {
    // Fallback: open as a new tab if popup window creation fails
    await chrome.tabs.create({ url: 'multi-select.html', active: true });
  }
}

async function saveItemToWebApp(item, options = {}) {
  const explicitTabId = Number(options?.targetTabId) || null;
  let targetTab = null;

  if (explicitTabId) {
    try {
      const maybeTab = await getTab(explicitTabId);
      if (maybeTab?.id && isDreamlabUrl(maybeTab.url)) {
        targetTab = maybeTab;
      }
    } catch {
      // Fall back to preferred Dreamlab tab.
    }
  }

  if (!targetTab) {
    targetTab = await getPreferredDreamlabTab();
  }

  const response = await sendTabMessageWithBridge(targetTab.id, {
    action: CONTENT_ACTIONS.saveItem,
    item,
  }, { frameId: 0 });

  if (!response || response.success !== true) {
    throw new Error(response?.error || 'Failed to save to Dreamlab web app.');
  }

  return { targetTabId: targetTab.id };
}

async function queuePendingAndTrySave(item, options = {}) {
  const skipPendingStorage = Boolean(options?.skipPendingStorage);

  try {
    if (!skipPendingStorage) {
      await setStorage({ [STORAGE_KEYS.pendingCapture]: item });
    }
    const saveResult = await saveItemToWebApp(item, options);
    await removeStorage(STORAGE_KEYS.pendingCapture);
    return {
      success: true,
      targetTabId: saveResult?.targetTabId || null,
    };
  } catch (error) {
    // Keep pending capture for popup review.
    if (skipPendingStorage) {
      try {
        await setStorage({
          [STORAGE_KEYS.pendingCapture]: {
            type: item?.type || 'image',
            title: item?.title || 'Pending Capture',
            sourceUrl: item?.sourceUrl || '',
            timestamp: Date.now(),
            error: error?.message || 'Save failed',
          },
        });
      } catch {
        // Ignore pending fallback write failures.
      }
    }
    return {
      success: false,
      error: error?.message || 'Failed to save capture; kept as pending.',
    };
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
    item = await enrichLinkCapture(item);
  }

  if (item) {
    await queuePendingAndTrySave(item);
  }
});

async function executeCommandFromTab(command, tabId) {
  const tab = tabId
    ? await chrome.tabs.get(tabId).catch(() => null)
    : (await queryTabs({ active: true, currentWindow: true }))[0];
  if (!tab) return;

  if (command === 'save-page') {
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
      const linkItem = await enrichLinkCapture({
        type: 'link',
        content: metadata.title || tab.title || tab.url,
        title: metadata.title || tab.title || null,
        description: isUsefulDescription(metadata.description) ? metadata.description : null,
        thumbnail: metadata.image || null,
        sourceUrl: tab.url,
        timestamp: Date.now(),
      });
      await queuePendingAndTrySave(linkItem);
    }
    return;
  }

  if (command === 'capture-visible') {
    if (!tab?.id) return;

    let chosenTab = tab;
    let chosenScan = null;
    let chosenScanImages = { visibleImages: [], allImages: [], totalCount: 0 };

    try {
      chosenScan = await requestImageScan(tab.id, 'all');
      chosenScanImages = normalizeScanImages(chosenScan);
    } catch {
      // Try fallback tabs below.
    }

    const shouldTryFallbackTabs = !chosenScan
      || chosenScanImages.allImages.length === 0
      || isLikelyTrackingOrAssetUrl(chosenScan.sourceUrl || tab.url || '');

    if (shouldTryFallbackTabs) {
      const fallbackTabs = await getCaptureFallbackTabs(tab.id);
      const maxCandidates = 6;

      for (const candidate of fallbackTabs.slice(0, maxCandidates)) {
        try {
          const candidateScan = await requestImageScan(candidate.id, 'all');
          const candidateImages = normalizeScanImages(candidateScan);
          if (candidateImages.allImages.length > chosenScanImages.allImages.length) {
            chosenTab = candidate;
            chosenScan = candidateScan;
            chosenScanImages = candidateImages;
          }

          const hasGoodCoverage = candidateImages.allImages.length >= 12;
          const looksLikePage = !isLikelyTrackingOrAssetUrl(candidateScan.sourceUrl || candidate.url || '');
          if (hasGoodCoverage && looksLikePage) break;
        } catch {
          // Keep trying next candidates.
        }
      }
    }

    const allImages = chosenScanImages.allImages;
    const totalCount = chosenScanImages.totalCount || allImages.length;
    await openMultiSelectWindow({
      sourceTabId: chosenTab.id,
      sourceUrl: chosenScan?.sourceUrl || chosenTab.url || '',
      visibleImages: allImages,
      totalImagesCount: totalCount,
    });
    return;
  }

  if (command === 'capture-full-page') {
    if (!tab?.id) return;

    if (isUnsupportedCaptureUrl(tab.url)) {
      await showInPageToast(tab.id, {
        message: 'Full-page capture is not available on this page.',
        type: 'error',
        durationMs: 4200,
      });
      return;
    }

    try {
      await showInPageToast(tab.id, {
        message: 'Capturing full page...',
        type: 'info',
        durationMs: 2400,
      });

      const destinationTab = await ensureDreamlabTab();
      let screenshot = null;
      await wait(160);
      await setInPageToastVisibility(tab.id, false);
      try {
        screenshot = await captureFullPageScreenshot(tab);
      } finally {
        await setInPageToastVisibility(tab.id, true);
      }
      const originalByteEstimate = estimateDataUrlBytes(screenshot.dataUrl);

      let captureItem = {
        type: 'image',
        content: screenshot.dataUrl,
        title: tab.title || 'Full Page Screenshot',
        description: 'Full-page screenshot captured via Dreamlab extension',
        sourceUrl: tab.url || '',
        metadata: {
          captureType: 'full-page',
          width: screenshot.width,
          height: screenshot.height,
          mimeType: screenshot.mimeType || 'image/jpeg',
          estimatedBytes: originalByteEstimate,
          originalWidth: screenshot.width,
          originalHeight: screenshot.height,
          originalMimeType: screenshot.mimeType || 'image/jpeg',
        },
        timestamp: Date.now(),
      };

      await showInPageToast(tab.id, {
        message: 'Saving to Dreamlab...',
        type: 'info',
        durationMs: 2600,
      });

      let saveResult = await queuePendingAndTrySave(captureItem, {
        targetTabId: destinationTab?.id || null,
        skipPendingStorage: true,
      });

      let storageErrorType = classifyStorageErrorMessage(saveResult.error);
      const shouldRetryWithCompression = !saveResult.success
        && isStorageQuotaErrorMessage(saveResult.error)
        && storageErrorType === 'localstorage';

      if (shouldRetryWithCompression) {
        await showInPageToast(tab.id, {
          message: 'Browser localStorage is full. Retrying with stronger compression...',
          type: 'info',
          durationMs: 3200,
        });

        try {
          const compressedDataUrl = await aggressiveStorageCompression(captureItem.content);
          if (compressedDataUrl && compressedDataUrl !== captureItem.content) {
            captureItem = {
              ...captureItem,
              content: compressedDataUrl,
              metadata: {
                ...captureItem.metadata,
                compressionRetry: true,
                compressedEstimatedBytes: estimateDataUrlBytes(compressedDataUrl),
              },
            };
          }
        } catch {
          // Keep original capture payload if compression fails.
        }

        saveResult = await queuePendingAndTrySave(captureItem, {
          targetTabId: destinationTab?.id || null,
          skipPendingStorage: true,
        });
        storageErrorType = classifyStorageErrorMessage(saveResult.error);
      }

      if (saveResult.success) {
        const destinationSummary = await getDreamlabDestinationSummary(
          saveResult.targetTabId || destinationTab?.id || null
        );
        await showInPageToast(tab.id, {
          message: `Saved to ${destinationSummary}.`,
          type: 'success',
          durationMs: 3400,
        });
      } else {
        const errorDetail = String(saveResult.error || '').trim();
        let message = 'Saved as pending capture; open the Dreamlab Capture popup to retry.';
        if (storageErrorType === 'indexeddb') {
          message = 'Could not write screenshot to browser media storage (IndexedDB). Open the Dreamlab Capture popup to retry.';
        } else if (storageErrorType === 'extension-storage') {
          message = 'Extension storage (chrome.storage.local) is full. Open the Dreamlab Capture popup to retry.';
        } else if (storageErrorType === 'localstorage') {
          message = 'Dreamlab localStorage is full. Open the Dreamlab Capture popup to retry.';
        }
        const suffix = errorDetail ? ` (${errorDetail})` : '';
        await showInPageToast(tab.id, {
          message: `${message}${suffix}`,
          type: 'error',
          durationMs: 5000,
        });
      }
    } catch (error) {
      await showInPageToast(tab.id, {
        message: error?.message || 'Full-page capture failed.',
        type: 'error',
        durationMs: 5000,
      });
    }
    return;
  }

  if (command === 'smart-picker') {
    if (!tab?.id) return;

    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['picker.css'],
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['picker.js'],
    });
    return;
  }

  if (command === 'pick-color') {
    if (!tab?.id) return;
    if (isUnsupportedCaptureUrl(tab.url)) {
      await showInPageToast(tab.id, {
        message: 'Color eyedropper is not available on this page.',
        type: 'error',
        durationMs: 4200,
      });
      return;
    }

    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: 'MAIN',
        func: async () => {
          if (typeof window.EyeDropper !== 'function') {
            return { success: false, error: 'EyeDropper API is not supported in this browser.' };
          }
          try {
            const picker = new window.EyeDropper();
            const picked = await picker.open();
            return { success: true, color: picked?.sRGBHex || null };
          } catch (error) {
            if (error?.name === 'AbortError') {
              return { success: false, cancelled: true, error: 'Color picking cancelled.' };
            }
            return { success: false, error: error?.message || 'Color picking failed.' };
          }
        },
      });

      const payload = result?.[0]?.result || {};
      if (payload.cancelled) {
        await showInPageToast(tab.id, {
          message: 'Color pick cancelled.',
          type: 'info',
          durationMs: 2200,
        });
        return;
      }
      if (!payload.success) {
        await showInPageToast(tab.id, {
          message: payload.error || 'Could not pick color on this page.',
          type: 'error',
          durationMs: 4200,
        });
        return;
      }

      const hex = String(payload.color || '').trim().toUpperCase();
      if (!/^#[0-9A-F]{6}$/.test(hex)) {
        await showInPageToast(tab.id, {
          message: 'Picked color was invalid.',
          type: 'error',
          durationMs: 3600,
        });
        return;
      }

      const destinationTab = await ensureDreamlabTab();
      const colorItem = {
        type: 'color',
        content: hex,
        title: `Color ${hex}`,
        description: `Picked with eyedropper from ${tab.title || 'page'}`,
        sourceUrl: tab.url || '',
        metadata: {
          captureType: 'eyedropper',
          pickedHex: hex,
        },
        timestamp: Date.now(),
      };

      const saveResult = await queuePendingAndTrySave(colorItem, {
        targetTabId: destinationTab?.id || null,
        skipPendingStorage: true,
      });

      if (saveResult.success) {
        const dest = await getDreamlabDestinationSummary(
          saveResult.targetTabId || destinationTab?.id || null
        );
        await showInPageToast(tab.id, {
          message: `Saved ${hex} to ${dest}.`,
          type: 'success',
          durationMs: 3200,
        });
      } else {
        await showInPageToast(tab.id, {
          message: `Saved ${hex} as pending. Open popup to retry.`,
          type: 'error',
          durationMs: 4200,
        });
      }
    } catch (error) {
      await showInPageToast(tab.id, {
        message: error?.message || 'Color eyedropper failed.',
        type: 'error',
        durationMs: 4200,
      });
    }
    return;
  }

  if (command === 'area-select' || command === 'area-record') {
    if (!tab?.id) return;
    if (isUnsupportedCaptureUrl(tab.url)) {
      await showInPageToast(tab.id, {
        message: 'Area capture is not available on this page.',
        type: 'error',
        durationMs: 4200,
      });
      return;
    }

    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['area-select.css'],
    });

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['area-select.js'],
    });
  }
}

async function getShortcutBindings() {
  let commands = [];
  try {
    commands = await chrome.commands.getAll();
  } catch {
    commands = [];
  }
  const commandByName = new Map((commands || []).map((command) => [command.name, command]));
  return COMMAND_ACTIONS.map((entry) => {
    const runtimeCommand = commandByName.get(entry.command);
    return {
      command: entry.command,
      label: entry.label,
      description: runtimeCommand?.description || entry.description,
      shortcut: runtimeCommand?.shortcut || '',
    };
  });
}

// Debounce map to prevent duplicate execution when both chrome.commands
// and content-script fallback fire for the same keystroke.
const _commandDebounce = new Map();
const COMMAND_DEBOUNCE_MS = 300;

async function dispatchCommand({ command, tabId, origin }) {
  const key = `${tabId || 'active'}:${command}`;
  const now = Date.now();
  const last = _commandDebounce.get(key) || 0;
  if (now - last < COMMAND_DEBOUNCE_MS) return;
  _commandDebounce.set(key, now);

  try {
    await executeCommandFromTab(command, tabId);
  } catch (error) {
    console.error(`Command "${command}" failed (${origin}):`, error?.message || error);
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  await dispatchCommand({ command, origin: 'commands-api' });
});

/**
 * Runs in the page's MAIN world (not the extension's isolated world).
 * Has full access to getDisplayMedia but no access to chrome.runtime.
 * Results are sent back via window.postMessage → content script listener.
 *
 * Injected by background via chrome.scripting.executeScript({ world: 'MAIN' }).
 */
function mainWorldRecorder(rect, dpr) {
  (async () => {
    let areaBorder = null;
    let indicator = null;
    let blinkStyle = null;
    let countdownInterval = null;

    function cleanupUI() {
      if (areaBorder) { areaBorder.remove(); areaBorder = null; }
      if (indicator) { indicator.remove(); indicator = null; }
      if (blinkStyle) { blinkStyle.remove(); blinkStyle = null; }
      if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'browser' },
        preferCurrentTab: true,
      });

      await new Promise((r) => setTimeout(r, 300));

      const cropX = Math.round(rect.x * dpr);
      const cropY = Math.round(rect.y * dpr);
      const cropW = Math.round(rect.width * dpr);
      const cropH = Math.round(rect.height * dpr);

      let canvasW = cropW;
      let canvasH = cropH;
      const maxDim = 1920;
      if (canvasW > maxDim || canvasH > maxDim) {
        const scale = Math.min(maxDim / canvasW, maxDim / canvasH);
        canvasW = Math.round(canvasW * scale);
        canvasH = Math.round(canvasH * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      canvas.style.cssText = 'position:fixed;left:-9999px;top:-9999px;pointer-events:none;opacity:0;';
      document.documentElement.appendChild(canvas);
      const ctx = canvas.getContext('2d');

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.style.cssText = 'position:fixed;left:-9999px;top:-9999px;pointer-events:none;opacity:0;';
      document.documentElement.appendChild(video);
      await video.play();

      let drawing = true;
      function drawFrame() {
        if (!drawing) return;
        ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvasW, canvasH);
        requestAnimationFrame(drawFrame);
      }
      drawFrame();

      const canvasStream = canvas.captureStream(30);
      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

      const recorder = new MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 2500000,
      });

      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      // ── Area border indicator ──
      areaBorder = document.createElement('div');
      areaBorder.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #dc2626;border-radius:2px;box-shadow:0 0 0 1px rgba(0,0,0,0.3),0 0 12px rgba(220,38,38,0.4);transition:opacity 0.3s;'
        + 'left:' + rect.x + 'px;top:' + rect.y + 'px;width:' + rect.width + 'px;height:' + rect.height + 'px;';
      document.documentElement.appendChild(areaBorder);

      // ── Recording indicator bar ──
      indicator = document.createElement('div');
      indicator.style.cssText = 'position:fixed;z-index:2147483647;display:flex;align-items:center;gap:8px;padding:8px 16px;background:#171717;border:1px solid #333;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.35);font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;color:#fff;pointer-events:none;';
      blinkStyle = document.createElement('style');
      blinkStyle.textContent = '@keyframes __dl_blink{0%,100%{opacity:1}50%{opacity:0.3}}';
      document.documentElement.appendChild(blinkStyle);

      // Position indicator centered above the area border (or below if no room)
      var indGap = 8;
      var indY = rect.y - 42 - indGap;
      if (indY < 8) indY = rect.y + rect.height + indGap;
      var indX = rect.x + (rect.width / 2) - 80;
      indX = Math.max(8, Math.min(indX, window.innerWidth - 168));
      indicator.style.left = indX + 'px';
      indicator.style.top = indY + 'px';
      document.documentElement.appendChild(indicator);

      let countdown = 10;
      const dot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;animation:__dl_blink 1s ease-in-out infinite;"></span>';
      indicator.innerHTML = dot + ' Recording\u2026 10s';
      countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0 && indicator) indicator.innerHTML = dot + ' Recording\u2026 ' + countdown + 's';
      }, 1000);

      const startTime = Date.now();

      const recordingDone = new Promise((resolve) => {
        recorder.onstop = () => {
          drawing = false;
          cleanupUI();
          stream.getTracks().forEach((t) => t.stop());
          canvasStream.getTracks().forEach((t) => t.stop());
          video.srcObject = null;
          video.remove();
          canvas.remove();
          resolve(new Blob(chunks, { type: 'video/webm' }));
        };
      });

      recorder.start();
      setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 10000);

      // Also stop if the user stops sharing via Chrome's "Stop sharing" button
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        if (recorder.state === 'recording') recorder.stop();
      });

      const blob = await recordingDone;
      const durationMs = Date.now() - startTime;

      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Read failed'));
        reader.readAsDataURL(blob);
      });

      window.postMessage({ type: '__dreamlab_recording_done__', dataUrl, durationMs }, '*');

    } catch (err) {
      cleanupUI();
      window.postMessage({ type: '__dreamlab_recording_error__', error: err.message }, '*');
    }
  })();
}

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
      const response = await sendTabMessageWithBridge(tab.id, { action: CONTENT_ACTIONS.getOrgData }, { frameId: 0 });
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

    case ACTIONS.executeCommand: {
      if (!VALID_COMMAND_SET.has(request.command)) {
        return { success: false, error: 'Unknown command.' };
      }
      await dispatchCommand({
        command: request.command,
        tabId: sender?.tab?.id || null,
        origin: request.origin || 'content-fallback',
      });
      return { success: true };
    }

    case ACTIONS.getShortcutBindings: {
      const shortcuts = await getShortcutBindings();
      return { success: true, shortcuts };
    }

    case ACTIONS.scanSourceImages: {
      const stored = await getStorage(STORAGE_KEYS.multiSelectState);
      const sourceTabId = request.sourceTabId || stored?.[STORAGE_KEYS.multiSelectState]?.sourceTabId;
      if (!sourceTabId) {
        return { success: false, error: 'Source tab is not available.' };
      }

      const requestedScope = request.scope || 'visible';
      let scan = await requestImageScan(sourceTabId, requestedScope);
      let { visibleImages, allImages, totalCount } = normalizeScanImages(scan);

      const shouldFallbackToAll = (requestedScope === 'visible' || requestedScope === 'visible_with_total')
        && visibleImages.length === 0
        && totalCount === 0;

      if (shouldFallbackToAll) {
        try {
          const fallbackScan = await requestImageScan(sourceTabId, 'all');
          const fallback = normalizeScanImages(fallbackScan);
          if (fallback.allImages.length > 0) {
            scan = fallbackScan;
            allImages = fallback.allImages;
            visibleImages = fallback.allImages;
            totalCount = fallback.totalCount || fallback.allImages.length;
          }
        } catch {
          // Keep original scan result if fallback fails.
        }
      }

      return {
        success: true,
        sourceTabId,
        sourceUrl: scan.sourceUrl || stored?.[STORAGE_KEYS.multiSelectState]?.sourceUrl || '',
        images: allImages,
        visibleImages,
        totalCount,
      };
    }

    case 'areaScreenshot': {
      const tab = sender?.tab;
      if (!tab?.id) return { success: false, error: 'No tab.' };

      try {
        // Wait for overlay DOM removal to complete
        await wait(120);

        const dataUrl = await captureVisibleTab(tab.windowId, { format: 'png' });

        // Crop using OffscreenCanvas
        const { rect, dpr } = request;
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);

        const cropX = Math.round(rect.x * dpr);
        const cropY = Math.round(rect.y * dpr);
        const cropW = Math.round(rect.width * dpr);
        const cropH = Math.round(rect.height * dpr);

        const canvas = new OffscreenCanvas(cropW, cropH);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        bitmap.close();

        const croppedBlob = await canvas.convertToBlob({ type: 'image/png' });
        const croppedDataUrl = await blobToDataUrl(croppedBlob);

        const destinationTab = await ensureDreamlabTab();
        const captureItem = {
          type: 'image',
          content: croppedDataUrl,
          title: request.pageTitle || 'Area Screenshot',
          description: 'Area screenshot captured via Dreamlab extension',
          sourceUrl: request.pageUrl || '',
          metadata: {
            captureType: 'area',
            width: cropW,
            height: cropH,
            mimeType: 'image/png',
          },
          timestamp: Date.now(),
        };

        const saveResult = await queuePendingAndTrySave(captureItem, {
          targetTabId: destinationTab?.id || null,
          skipPendingStorage: true,
        });

        if (saveResult.success) {
          const dest = await getDreamlabDestinationSummary(
            saveResult.targetTabId || destinationTab?.id || null
          );
          await showInPageToast(tab.id, {
            message: `Area screenshot saved to ${dest}.`,
            type: 'success',
            durationMs: 3400,
          });
        } else {
          await showInPageToast(tab.id, {
            message: 'Area screenshot saved as pending. Open popup to retry.',
            type: 'error',
            durationMs: 4200,
          });
        }
        return { success: saveResult.success };
      } catch (error) {
        await showInPageToast(tab.id, {
          message: error?.message || 'Area screenshot failed.',
          type: 'error',
          durationMs: 5000,
        });
        return { success: false, error: error?.message };
      }
    }

    case 'injectAreaRecorder': {
      // Inject the recorder function into the page's MAIN world.
      // chrome.scripting.executeScript with world:'MAIN' bypasses page CSP
      // (inline <script> tags are blocked on many sites).
      const tab = sender?.tab;
      if (!tab?.id) return { success: false, error: 'No tab.' };

      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          world: 'MAIN',
          func: mainWorldRecorder,
          args: [request.rect, request.dpr],
        });
        return { success: true };
      } catch (error) {
        await showInPageToast(tab.id, {
          message: error?.message || 'Could not start recording on this page.',
          type: 'error',
          durationMs: 4200,
        });
        return { success: false, error: error?.message };
      }
    }

    case 'areaRecordError': {
      const tab = sender?.tab;
      if (tab?.id) {
        const errMsg = request.error || 'Recording failed';
        const userMsg = errMsg.includes('Permission denied') || errMsg.includes('NotAllowedError') || errMsg.includes('user denied')
          ? 'Recording cancelled — screen sharing was not granted.'
          : `Recording failed: ${errMsg}`;
        await showInPageToast(tab.id, {
          message: userMsg,
          type: 'error',
          durationMs: 4200,
        });
      }
      return { success: true };
    }

    case 'areaRecordComplete': {
      // Video was recorded in the content script via getDisplayMedia.
      // We just need to save it.
      const tab = sender?.tab;
      try {
        const destinationTab = await ensureDreamlabTab();
        const videoItem = {
          type: 'video',
          content: request.dataUrl,
          title: request.pageTitle || 'Area Recording',
          description: 'Area video recorded via Dreamlab extension',
          sourceUrl: request.pageUrl || '',
          metadata: {
            captureType: 'area-video',
            mimeType: request.mimeType || 'video/webm',
            durationMs: request.durationMs || 10000,
          },
          timestamp: Date.now(),
        };

        const saveResult = await queuePendingAndTrySave(videoItem, {
          targetTabId: destinationTab?.id || null,
          skipPendingStorage: true,
        });

        if (saveResult.success && tab?.id) {
          const dest = await getDreamlabDestinationSummary(
            saveResult.targetTabId || destinationTab?.id || null
          );
          await showInPageToast(tab.id, {
            message: `Video saved to ${dest}.`,
            type: 'success',
            durationMs: 3400,
          });
        } else if (tab?.id) {
          await showInPageToast(tab.id, {
            message: 'Video saved as pending. Open popup to retry.',
            type: 'error',
            durationMs: 4200,
          });
        }
        return { success: saveResult.success };
      } catch (error) {
        if (tab?.id) {
          await showInPageToast(tab.id, {
            message: error?.message || 'Failed to save recording.',
            type: 'error',
            durationMs: 5000,
          });
        }
        return { success: false, error: error?.message };
      }
    }

    default:
      return { success: false, error: 'Unknown action.' };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ignore messages targeted at offscreen document
  if (request?.target === 'offscreen') return false;

  handleRuntimeMessage(request, sender)
    .then((payload) => sendResponse(payload))
    .catch((error) => {
      sendResponse({ success: false, error: error?.message || 'Unexpected extension error.' });
    });
  return true;
});
