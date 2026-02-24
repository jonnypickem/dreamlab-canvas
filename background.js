const DREAMLAB_ORIGINS = new Set([
  'https://dreamlab-canvas.vercel.app',
]);
const DREAMLAB_APP_URLS = [
  'https://dreamlab-canvas.vercel.app',
];

const STORAGE_KEYS = {
  pendingCapture: 'pendingCapture',
  multiSelectState: 'multiSelectState',
  multiSelectPrefs: 'multiSelectPrefsV1',
  widgetHotkeys: 'widgetHotkeysV1',
  widgetEnabled: 'widgetEnabled',
  floatingWidgetPrefs: 'floatingWidgetPrefs',
  captureDestination: 'captureDestination',
  widgetBehaviorSettings: 'widgetBehaviorSettings',
};

const ACTIONS = {
  ping: 'ping',
  saveCapturedItem: 'saveCapturedItem',
  openMultiSelect: 'openMultiSelect',
  getDreamlabOrgData: 'getDreamlabOrgData',
  getMultiSelectState: 'getMultiSelectState',
  getMultiSelectPrefs: 'getMultiSelectPrefs',
  setMultiSelectPrefs: 'setMultiSelectPrefs',
  scanSourceImages: 'scanSourceImages',
  executeCommand: 'executeCommand',
  getShortcutBindings: 'getShortcutBindings',
  openExtensionShortcuts: 'openExtensionShortcuts',
  getWidgetConfig: 'getWidgetConfig',
  setWidgetEnabled: 'setWidgetEnabled',
  getWidgetPrefs: 'getWidgetPrefs',
  setWidgetPrefs: 'setWidgetPrefs',
  getCaptureDestination: 'getCaptureDestination',
  setCaptureDestination: 'setCaptureDestination',
  getWidgetBehaviorSettings: 'getWidgetBehaviorSettings',
  setWidgetBehaviorSettings: 'setWidgetBehaviorSettings',
  getWidgetHotkeys: 'getWidgetHotkeys',
  setWidgetHotkeys: 'setWidgetHotkeys',
  openWidgetKeyboardMode: 'openWidgetKeyboardMode',
  openExtensionOptions: 'openExtensionOptions',
  getComplianceState: 'getComplianceState',
  getPrivacySummary: 'getPrivacySummary',
  openComplianceDoc: 'openComplianceDoc',
};

const COMMAND_DEFINITIONS = [
  {
    command: 'save-page',
    description: 'Open Dreamlab capture launcher',
  },
  {
    command: 'capture-visible',
    description: 'Open image capture review',
  },
  {
    command: 'capture-full-page',
    description: 'Capture full page screenshot',
  },
  {
    command: 'smart-picker',
    description: 'Pick an image or background from page',
  },
  {
    command: 'pick-color',
    description: 'Pick a color from the current page',
  },
  {
    command: 'area-select',
    description: 'Capture a selected area screenshot',
  },
  {
    command: 'area-record',
    description: 'Record a selected area',
  },
];

const ACTION_DEFINITIONS = [
  {
    actionId: 'save-page',
    label: 'Save Page',
    description: 'Save current page to Dreamlab',
    executeCommand: 'save-page',
    shortcutSourceCommands: ['save-page'],
  },
  {
    actionId: 'capture-visible',
    label: 'Image Review',
    description: 'Open image capture review',
    executeCommand: 'capture-visible',
    shortcutSourceCommands: ['capture-visible'],
  },
  {
    actionId: 'capture-full-page',
    label: 'Full Screenshot',
    description: 'Capture full page screenshot',
    executeCommand: 'capture-full-page',
    shortcutSourceCommands: ['capture-full-page'],
  },
  {
    actionId: 'smart-picker',
    label: 'Smart Picker',
    description: 'Pick an image or background from page',
    executeCommand: 'smart-picker',
    shortcutSourceCommands: ['smart-picker'],
  },
  {
    actionId: 'pick-color',
    label: 'Pick Color',
    description: 'Pick a color from the current page',
    executeCommand: 'pick-color',
    shortcutSourceCommands: ['pick-color'],
  },
  {
    actionId: 'area-capture',
    label: 'Area Capture',
    description: 'Capture screenshot or 10s recording from a selected area',
    executeCommand: 'area-select',
    shortcutSourceCommands: ['area-select', 'area-record'],
  },
];

const VALID_COMMAND_SET = new Set(COMMAND_DEFINITIONS.map((entry) => entry.command));

const CONTENT_ACTIONS = {
  saveItem: 'SAVE_ITEM',
  getOrgData: 'GET_ORG_DATA',
  scanPageImages: 'SCAN_PAGE_IMAGES',
  openWidgetKeyboardMode: 'OPEN_WIDGET_KEYBOARD_MODE',
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
const REMOTE_FETCH_TIMEOUT_MS = 8000;
const REMOTE_FETCH_MAX_HTML_BYTES = 850000;
const DISCLOSURE_VERSION = '2026-02-19';
const INTERNAL_DOCS = Object.freeze({
  compliancePath: 'Project foundation/extension-compliance-prerequisites.md',
  privacyPath: 'Project foundation/privacy-policy-extension.md',
  complianceUrl: 'https://dreamlab-canvas.vercel.app/extension-data-compliance.html',
  privacyUrl: 'https://dreamlab-canvas.vercel.app/extension-privacy-policy.html',
});
const PRIVACY_SUMMARY = Object.freeze({
  disclosureVersion: DISCLOSURE_VERSION,
  allSitesAccess: true,
  captureModel: 'user_triggered',
  defaultBehavior: 'Widget loads on pages, but capture and transmission only occur after user actions.',
  dataCategories: [
    'Page URL and page title of captured source',
    'User-selected text and selected image URLs',
    'Screenshots/recordings initiated by user commands',
    'Widget preferences and destination settings in chrome.storage.local',
  ],
  retention: 'Captured items remain in Dreamlab app storage until deleted by the user.',
  sharing: 'Data is sent to Dreamlab app tabs only when a save or org-data action is user-triggered.',
  docPath: INTERNAL_DOCS.privacyPath,
  docUrl: INTERNAL_DOCS.privacyUrl,
});
const DEFAULT_WIDGET_PREFS = Object.freeze({
  collapsed: true,
  density: 'compact',
  position: {
    right: 20,
    bottom: 20,
  },
});
const DEFAULT_WIDGET_BEHAVIOR_SETTINGS = Object.freeze({
  excludedDomains: [],
  positionPreset: 'bottom-right',
  offsetX: 20,
  offsetY: 20,
});
const WIDGET_HOTKEY_ALLOWED_CHARS = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''));
const DEFAULT_WIDGET_HOTKEYS = Object.freeze({
  actionKeyMap: Object.freeze({
    'save-page': 'S',
    'capture-visible': 'I',
    'capture-full-page': 'P',
    'smart-picker': 'M',
    'pick-color': 'K',
    'area-capture': 'A',
  }),
  updatedAt: 0,
});
const MULTI_SELECT_ALLOWED_RESOLUTION_TIERS = new Set(['any', 'small', 'medium', 'large', 'icon']);
const MULTI_SELECT_ALLOWED_TYPE_FILTERS = new Set(['high', 'icon', 'profile', 'ad', 'other']);
const DEFAULT_MULTI_SELECT_PREFS = Object.freeze({
  resolutionTier: 'any',
  typeFilters: [],
  sortMode: 'resolution_desc',
  updatedAt: 0,
});
const LINK_PREVIEW_CAPTURE_OPTIONS = Object.freeze({
  maxWidth: 1280,
  quality: 0.66,
  mimeType: 'image/jpeg',
});
const LINK_PREVIEW_CAPTURE_SETTLE_MS = 180;

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeWidgetPrefs(input) {
  const prefs = isObject(input) ? input : {};
  const positionInput = isObject(prefs.position) ? prefs.position : {};
  return {
    collapsed: typeof prefs.collapsed === 'boolean' ? prefs.collapsed : DEFAULT_WIDGET_PREFS.collapsed,
    density: prefs.density === 'cozy' ? 'cozy' : DEFAULT_WIDGET_PREFS.density,
    position: {
      right: Number.isFinite(Number(positionInput.right)) ? Number(positionInput.right) : DEFAULT_WIDGET_PREFS.position.right,
      bottom: Number.isFinite(Number(positionInput.bottom)) ? Number(positionInput.bottom) : DEFAULT_WIDGET_PREFS.position.bottom,
    },
  };
}

function sanitizeTimestamp(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function sanitizeDestination(input, options = {}) {
  const value = isObject(input) ? input : {};
  const normalizedOptions = isObject(options) ? options : {};
  const workspaceId = typeof value.workspaceId === 'string' && value.workspaceId.trim()
    ? value.workspaceId.trim()
    : null;
  const collectionId = typeof value.collectionId === 'string' && value.collectionId.trim()
    ? value.collectionId.trim()
    : null;
  const parsedUpdatedAt = sanitizeTimestamp(
    value.updatedAt
      || value.updated_at
      || value.timestamp
  );
  const fallbackUpdatedAt = sanitizeTimestamp(normalizedOptions.fallbackUpdatedAt);
  const updatedAt = normalizedOptions.touch === true
    ? Date.now()
    : (parsedUpdatedAt || fallbackUpdatedAt || 0);
  return {
    workspaceId,
    collectionId,
    updatedAt,
  };
}

function destinationsEqual(a, b, options = {}) {
  const includeUpdatedAt = options.includeUpdatedAt !== false;
  const left = sanitizeDestination(a);
  const right = sanitizeDestination(b);
  if (left.workspaceId !== right.workspaceId) return false;
  if (left.collectionId !== right.collectionId) return false;
  if (!includeUpdatedAt) return true;
  return left.updatedAt === right.updatedAt;
}

function getCollectionWorkspaceId(collection, projects) {
  if (!collection || typeof collection !== 'object') return null;
  if (collection.workspaceId) return collection.workspaceId;
  if (!collection.projectId) return null;
  const project = (Array.isArray(projects) ? projects : []).find((candidate) => candidate.id === collection.projectId);
  return project?.workspaceId || null;
}

function sanitizeDomainToken(input) {
  const value = String(input || '').trim().toLowerCase();
  if (!value) return null;
  const withoutProtocol = value.replace(/^[a-z]+:\/\//, '');
  const host = withoutProtocol.split('/')[0].split(':')[0].trim();
  const normalized = host.replace(/^\*\./, '').replace(/^\.+|\.+$/g, '');
  if (!normalized) return null;
  if (!/^[a-z0-9.-]+$/.test(normalized)) return null;
  if (!normalized.includes('.')) return null;
  if (normalized.startsWith('-') || normalized.endsWith('-')) return null;
  return normalized;
}

function sanitizeWidgetBehaviorSettings(input) {
  const value = isObject(input) ? input : {};
  const excludedDomainsRaw = Array.isArray(value.excludedDomains) ? value.excludedDomains : [];
  const domainSet = new Set();
  excludedDomainsRaw.forEach((entry) => {
    const domain = sanitizeDomainToken(entry);
    if (domain) domainSet.add(domain);
  });

  const positionPreset = new Set(['bottom-right', 'bottom-left', 'top-right', 'top-left']).has(value.positionPreset)
    ? value.positionPreset
    : DEFAULT_WIDGET_BEHAVIOR_SETTINGS.positionPreset;

  const offsetX = Number.isFinite(Number(value.offsetX))
    ? Math.max(0, Math.min(200, Math.round(Number(value.offsetX))))
    : DEFAULT_WIDGET_BEHAVIOR_SETTINGS.offsetX;
  const offsetY = Number.isFinite(Number(value.offsetY))
    ? Math.max(0, Math.min(200, Math.round(Number(value.offsetY))))
    : DEFAULT_WIDGET_BEHAVIOR_SETTINGS.offsetY;

  return {
    excludedDomains: [...domainSet],
    positionPreset,
    offsetX,
    offsetY,
  };
}

function normalizeWidgetHotkeyChar(value) {
  const token = String(value || '').trim().toUpperCase();
  if (token.length !== 1) return '';
  return WIDGET_HOTKEY_ALLOWED_CHARS.has(token) ? token : '';
}

function sanitizeWidgetHotkeys(input, options = {}) {
  const source = isObject(input) ? input : {};
  const normalizedOptions = isObject(options) ? options : {};
  const defaultMap = DEFAULT_WIDGET_HOTKEYS.actionKeyMap;
  const inputMap = isObject(source.actionKeyMap) ? source.actionKeyMap : {};

  const nextMap = {};
  const usedChars = new Set();

  ACTION_DEFINITIONS.forEach((entry) => {
    const actionId = entry.actionId;
    const requested = normalizeWidgetHotkeyChar(inputMap[actionId]);
    if (requested && !usedChars.has(requested)) {
      nextMap[actionId] = requested;
      usedChars.add(requested);
      return;
    }

    const fallback = normalizeWidgetHotkeyChar(defaultMap[actionId]);
    if (fallback && !usedChars.has(fallback)) {
      nextMap[actionId] = fallback;
      usedChars.add(fallback);
      return;
    }

    const available = [...WIDGET_HOTKEY_ALLOWED_CHARS].find((token) => !usedChars.has(token)) || '';
    nextMap[actionId] = available;
    if (available) usedChars.add(available);
  });

  const parsedUpdatedAt = sanitizeTimestamp(source.updatedAt);
  const updatedAt = normalizedOptions.touch === true
    ? Date.now()
    : (parsedUpdatedAt || DEFAULT_WIDGET_HOTKEYS.updatedAt);

  return {
    actionKeyMap: nextMap,
    updatedAt,
  };
}

function sanitizeMultiSelectPrefs(input, options = {}) {
  const value = isObject(input) ? input : {};
  const normalizedOptions = isObject(options) ? options : {};

  const resolutionTier = MULTI_SELECT_ALLOWED_RESOLUTION_TIERS.has(value.resolutionTier)
    ? value.resolutionTier
    : DEFAULT_MULTI_SELECT_PREFS.resolutionTier;

  const typeFiltersRaw = Array.isArray(value.typeFilters) ? value.typeFilters : [];
  const typeFilterSet = new Set();
  typeFiltersRaw.forEach((entry) => {
    const token = String(entry || '').trim().toLowerCase();
    if (MULTI_SELECT_ALLOWED_TYPE_FILTERS.has(token)) typeFilterSet.add(token);
  });

  const sortMode = value.sortMode === 'resolution_desc'
    ? 'resolution_desc'
    : DEFAULT_MULTI_SELECT_PREFS.sortMode;

  const parsedUpdatedAt = sanitizeTimestamp(value.updatedAt);
  const updatedAt = normalizedOptions.touch === true
    ? Date.now()
    : (parsedUpdatedAt || DEFAULT_MULTI_SELECT_PREFS.updatedAt);

  return {
    resolutionTier,
    typeFilters: [...typeFilterSet],
    sortMode,
    updatedAt,
  };
}

function isDreamlabUrl(url) {
  try {
    const parsed = new URL(url);
    return DREAMLAB_ORIGINS.has(parsed.origin);
  } catch {
    return false;
  }
}

function parseRemoteHttpUrl(url) {
  if (typeof url !== 'string' || !url.trim()) {
    return { ok: false, error: 'URL is missing.' };
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: 'Only http(s) URLs are allowed.' };
    }
    return { ok: true, parsed };
  } catch {
    return { ok: false, error: 'Invalid URL.' };
  }
}

function isPrivateIpv4Host(hostname) {
  const match = String(hostname || '').match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map((value) => Number(value));
  if (octets.some((value) => Number.isNaN(value) || value < 0 || value > 255)) return false;
  const [first, second] = octets;
  if (first === 10) return true;
  if (first === 127) return true;
  if (first === 169 && second === 254) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 0) return true;
  return false;
}

function isPrivateOrLocalHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.home')) return true;
  if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true;
  if (isPrivateIpv4Host(host)) return true;
  return false;
}

function isSensitiveSurfaceUrl(url) {
  const parsedResult = parseRemoteHttpUrl(url);
  if (!parsedResult.ok) return false;
  const parsed = parsedResult.parsed;
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();
  const sensitiveHostPattern = /(bank|banking|wallet|payments?|checkout|billing|secure|auth|passport|idp|accounts?)/i;
  const sensitivePathPattern = /\/(login|signin|sign-in|account|security|password|checkout|payment|billing|wallet|verification)\b/i;
  return sensitiveHostPattern.test(host) || sensitivePathPattern.test(path);
}

function getCaptureBlockReason(url) {
  if (isUnsupportedCaptureUrl(url)) {
    return 'Capture is not available on this page.';
  }
  if (isSensitiveSurfaceUrl(url)) {
    return 'Capture is disabled on sensitive pages for safety.';
  }
  return '';
}

function validateFetchablePageUrl(url) {
  const parsedResult = parseRemoteHttpUrl(url);
  if (!parsedResult.ok) {
    return { ok: false, error: parsedResult.error };
  }
  const parsed = parsedResult.parsed;
  if (isPrivateOrLocalHost(parsed.hostname)) {
    return { ok: false, error: 'Local/private network URLs are blocked for metadata extraction.' };
  }
  if (isUnsupportedCaptureUrl(parsed.href)) {
    return { ok: false, error: 'Unsupported URL target.' };
  }
  if (isSensitiveSurfaceUrl(parsed.href)) {
    return { ok: false, error: 'Sensitive page metadata extraction is blocked.' };
  }
  return { ok: true, url: parsed.href };
}

async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs || REMOTE_FETCH_TIMEOUT_MS);
  const fetchOptions = { ...options };
  delete fetchOptions.timeoutMs;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...fetchOptions, signal: controller.signal, cache: 'no-store', redirect: 'follow' });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPageHtmlWithLimits(url) {
  const response = await fetchWithTimeout(url, {
    timeoutMs: REMOTE_FETCH_TIMEOUT_MS,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
  }

  const contentLengthHeader = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(contentLengthHeader) && contentLengthHeader > REMOTE_FETCH_MAX_HTML_BYTES) {
    throw new Error('Page is too large to inspect safely.');
  }

  const html = await response.text();
  const sizeBytes = new TextEncoder().encode(html).length;
  if (sizeBytes > REMOTE_FETCH_MAX_HTML_BYTES) {
    throw new Error('Page is too large to inspect safely.');
  }
  return html;
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

const TWEET_HOSTS = new Set(['x.com', 'twitter.com', 'fxtwitter.com', 'mobile.twitter.com', 'm.twitter.com']);
const TWEET_USERNAME_STATUS_PATTERN = /^\/([A-Za-z0-9_]{1,20})\/status\/(\d+)/i;

function decodeTweetCandidate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function buildCanonicalTweetUrl(pathname, tweetId) {
  const usernameMatch = String(pathname || '').match(TWEET_USERNAME_STATUS_PATTERN);
  if (usernameMatch?.[1] && usernameMatch?.[2]) {
    return `https://x.com/${usernameMatch[1]}/status/${usernameMatch[2]}`;
  }
  return `https://x.com/i/web/status/${tweetId}`;
}

function getTweetInfoFromPath(pathname) {
  const path = String(pathname || '');
  const match = path.match(/\/status\/(\d+)/i);
  if (!match?.[1]) return null;
  return {
    tweetId: match[1],
    canonicalUrl: buildCanonicalTweetUrl(path, match[1]),
  };
}

function getTweetInfoFromCandidate(candidate) {
  const value = String(candidate || '').trim();
  if (!value) return null;

  const decoded = decodeTweetCandidate(value);
  const variants = decoded === value ? [value] : [value, decoded];

  for (const variant of variants) {
    if (!variant) continue;
    try {
      const parsed = new URL(variant);
      const info = getTweetInfoFromPath(parsed.pathname);
      if (info) return info;
    } catch {
      // Continue with path-pattern fallback below.
    }

    const pathLikeMatch = variant.match(/\/(?:[A-Za-z0-9_]{1,20}\/status\/\d+|i\/web\/status\/\d+|status\/\d+)/i);
    if (pathLikeMatch) {
      const info = getTweetInfoFromPath(pathLikeMatch[0]);
      if (info) return info;
    }
  }

  return null;
}

function getTweetInfo(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (!TWEET_HOSTS.has(hostname)) return null;

    const fromPath = getTweetInfoFromPath(parsed.pathname);
    if (fromPath) return fromPath;

    const queryCandidates = [
      ...parsed.searchParams.values(),
      parsed.hash ? parsed.hash.slice(1) : '',
    ];

    for (const candidate of queryCandidates) {
      const info = getTweetInfoFromCandidate(candidate);
      if (info) return info;
    }

    return null;
  } catch {
    return null;
  }
}

function isLikelyTweetAvatarImage(url) {
  const value = String(url || '').trim().toLowerCase();
  if (!value) return false;
  return (
    value.includes('/profile_images/')
    || value.includes('/profile_banners/')
    || value.includes('default_profile')
    || value.includes('abs.twimg.com')
    || value.includes('twitter_card')
  );
}

function isLikelyUrlOnlyText(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || /\s/.test(trimmed)) return false;
  if (/^https?:\/\/\S+$/i.test(trimmed)) return true;
  if (/^(www\.)?\S+\.\S+\/\S+$/i.test(trimmed)) return true;
  return false;
}

async function fetchTweetEmbed(url) {
  const tweetInfo = getTweetInfo(url);
  if (!tweetInfo) return null;

  const oEmbedUrl = `https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=${encodeURIComponent(tweetInfo.canonicalUrl)}`;
  try {
    const response = await fetchWithTimeout(oEmbedUrl, { timeoutMs: REMOTE_FETCH_TIMEOUT_MS });
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

function openExtensionOptions() {
  return new Promise((resolve, reject) => {
    chrome.runtime.openOptionsPage(() => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(true);
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
      if (!tab.url || getCaptureBlockReason(tab.url)) return false;
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

function normalizePageIdentityUrl(candidate) {
  try {
    const parsed = new URL(candidate);
    return (parsed.origin + parsed.pathname)
      .replace(/\/$/, '')
      .replace('://www.', '://');
  } catch {
    return String(candidate || '').trim();
  }
}

function isSamePageIdentity(left, right) {
  const normalizedLeft = normalizePageIdentityUrl(left);
  const normalizedRight = normalizePageIdentityUrl(right);
  if (!normalizedLeft || !normalizedRight) return false;
  return normalizedLeft === normalizedRight;
}

async function captureLinkPreviewScreenshot(tab) {
  if (!tab?.id || !tab?.windowId) return null;
  if (getCaptureBlockReason(tab.url || '')) return null;

  let originalScrollX = 0;
  let originalScrollY = 0;
  try {
    const initialScroll = await executeScriptFn(
      tab.id,
      () => ({
        x: window.scrollX || window.pageXOffset || 0,
        y: window.scrollY || window.pageYOffset || 0,
      })
    );
    originalScrollX = Math.floor(Number(initialScroll?.x) || 0);
    originalScrollY = Math.floor(Number(initialScroll?.y) || 0);
  } catch {
    return null;
  }

  try {
    await setExtensionCaptureUiVisibility(tab.id, false);
    await executeScriptFn(
      tab.id,
      async () => {
        const root = document.scrollingElement || document.documentElement;
        if (root && typeof root.scrollTo === 'function') {
          root.scrollTo({ left: 0, top: 0, behavior: 'instant' });
        }
        window.scrollTo(0, 0);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
    );
    await wait(LINK_PREVIEW_CAPTURE_SETTLE_MS);

    const rawDataUrl = await captureVisibleTab(tab.windowId, { format: 'png' });
    if (!rawDataUrl || typeof rawDataUrl !== 'string' || !rawDataUrl.startsWith('data:image/')) {
      return null;
    }

    try {
      const compressed = await compressImageDataUrl(rawDataUrl, LINK_PREVIEW_CAPTURE_OPTIONS);
      if (compressed && typeof compressed === 'string' && compressed.startsWith('data:image/')) {
        return compressed;
      }
    } catch {
      // Ignore compression issues and fall back to raw capture below.
    }

    return rawDataUrl;
  } catch {
    return null;
  } finally {
    await setExtensionCaptureUiVisibility(tab.id, true);
    try {
      await executeScriptFn(tab.id, (x, y) => {
        window.scrollTo(x, y);
      }, [originalScrollX, originalScrollY]);
    } catch {
      // Ignore scroll restore failures.
    }
  }
}

async function resolveLinkPreviewThumbnail({ tab, sourceUrl, metadataImage }) {
  const ogThumbnail = metadataImage || null;
  if (!tab?.id || !tab?.windowId) {
    return { thumbnail: ogThumbnail, previewSource: ogThumbnail ? 'og' : null };
  }
  if (getTweetInfo(sourceUrl)) {
    return { thumbnail: ogThumbnail, previewSource: ogThumbnail ? 'og' : null };
  }

  const samePageCaptureTarget = isSamePageIdentity(tab.url, sourceUrl);
  if (!samePageCaptureTarget) {
    return { thumbnail: ogThumbnail, previewSource: ogThumbnail ? 'og' : null };
  }

  const screenshotThumbnail = await captureLinkPreviewScreenshot(tab);
  if (screenshotThumbnail) {
    return { thumbnail: screenshotThumbnail, previewSource: 'screenshot' };
  }

  return { thumbnail: ogThumbnail, previewSource: ogThumbnail ? 'og' : null };
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

async function setExtensionCaptureUiVisibility(tabId, isVisible) {
  if (!tabId) return;
  try {
    await executeScriptFn(
      tabId,
      (visible) => {
        const targets = [
          '__dreamlab_extension_toast_root__',
          'dreamlab-floating-widget-host',
        ];
        targets.forEach((id) => {
          const element = document.getElementById(id);
          if (!element) return;

          if (!visible) {
            if (!Object.prototype.hasOwnProperty.call(element.dataset, 'dreamlabCaptureDisplay')) {
              element.dataset.dreamlabCaptureDisplay = element.style.display || '';
            }
            element.style.display = 'none';
            return;
          }

          const previousDisplay = Object.prototype.hasOwnProperty.call(element.dataset, 'dreamlabCaptureDisplay')
            ? element.dataset.dreamlabCaptureDisplay
            : '';
          element.style.display = previousDisplay || '';
          delete element.dataset.dreamlabCaptureDisplay;
        });
      },
      [Boolean(isVisible)]
    );
  } catch {
    // Ignore capture UI visibility toggle failures.
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

async function getWidgetEnabled() {
  const stored = await getStorage(STORAGE_KEYS.widgetEnabled);
  return stored?.[STORAGE_KEYS.widgetEnabled] !== false;
}

async function setWidgetEnabled(enabled) {
  const normalized = enabled !== false;
  await setStorage({ [STORAGE_KEYS.widgetEnabled]: normalized });
  return normalized;
}

async function getWidgetPrefs() {
  const stored = await getStorage(STORAGE_KEYS.floatingWidgetPrefs);
  return sanitizeWidgetPrefs(stored?.[STORAGE_KEYS.floatingWidgetPrefs]);
}

async function setWidgetPrefs(input) {
  const prefs = sanitizeWidgetPrefs(input);
  await setStorage({ [STORAGE_KEYS.floatingWidgetPrefs]: prefs });
  return prefs;
}

async function getMultiSelectPrefs() {
  const stored = await getStorage(STORAGE_KEYS.multiSelectPrefs);
  return sanitizeMultiSelectPrefs(stored?.[STORAGE_KEYS.multiSelectPrefs]);
}

async function setMultiSelectPrefs(input) {
  const prefs = sanitizeMultiSelectPrefs(input, { touch: true });
  await setStorage({ [STORAGE_KEYS.multiSelectPrefs]: prefs });
  return prefs;
}

async function getCaptureDestination() {
  const stored = await getStorage(STORAGE_KEYS.captureDestination);
  const hasStoredValue = Object.prototype.hasOwnProperty.call(stored || {}, STORAGE_KEYS.captureDestination);
  return hasStoredValue
    ? sanitizeDestination(stored?.[STORAGE_KEYS.captureDestination])
    : sanitizeDestination(null);
}

async function setCaptureDestination(input) {
  const destination = sanitizeDestination(input, { touch: true });
  await setStorage({ [STORAGE_KEYS.captureDestination]: destination });
  return destination;
}

async function getWidgetBehaviorSettings() {
  const stored = await getStorage(STORAGE_KEYS.widgetBehaviorSettings);
  return sanitizeWidgetBehaviorSettings(stored?.[STORAGE_KEYS.widgetBehaviorSettings]);
}

async function setWidgetBehaviorSettings(input) {
  const settings = sanitizeWidgetBehaviorSettings(input);
  await setStorage({ [STORAGE_KEYS.widgetBehaviorSettings]: settings });
  return settings;
}

async function getWidgetHotkeys() {
  const stored = await getStorage(STORAGE_KEYS.widgetHotkeys);
  return sanitizeWidgetHotkeys(stored?.[STORAGE_KEYS.widgetHotkeys]);
}

async function setWidgetHotkeys(input) {
  const hotkeys = sanitizeWidgetHotkeys(input, { touch: true });
  await setStorage({ [STORAGE_KEYS.widgetHotkeys]: hotkeys });
  return hotkeys;
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

async function getDreamlabOrgSnapshot(targetTabId = null) {
  try {
    const destinationTab = targetTabId
      ? await getTab(targetTabId).catch(() => null)
      : null;
    const tab = destinationTab?.id ? destinationTab : await getPreferredDreamlabTab();
    if (!tab?.id) return null;
    const response = await sendTabMessageWithBridge(tab.id, {
      action: CONTENT_ACTIONS.getOrgData,
    }, { frameId: 0 });
    if (!response || response.success !== true) return null;
    return {
      tabId: tab.id,
      workspaces: Array.isArray(response.workspaces) ? response.workspaces : [],
      projects: Array.isArray(response.projects) ? response.projects : [],
      collections: Array.isArray(response.collections) ? response.collections : [],
      activeContext: isObject(response.activeContext) ? response.activeContext : {},
    };
  } catch {
    return null;
  }
}

function buildDestinationFromActiveContext(activeContext, workspaces, projects, collections) {
  const context = isObject(activeContext) ? activeContext : {};
  const workspaceIds = new Set(
    (Array.isArray(workspaces) ? workspaces : [])
      .map((workspace) => workspace?.id)
      .filter(Boolean)
  );
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeCollections = Array.isArray(collections) ? collections : [];

  const activeCollection = safeCollections.find((collection) => collection.id === context.collectionId) || null;
  const activeCollectionWorkspaceId = activeCollection
    ? getCollectionWorkspaceId(activeCollection, safeProjects)
    : null;

  const activeProject = safeProjects.find((project) => project.id === context.projectId) || null;
  const activeProjectWorkspaceId = workspaceIds.has(activeProject?.workspaceId)
    ? activeProject.workspaceId
    : null;

  const activeWorkspaceId = workspaceIds.has(context.workspaceId)
    ? context.workspaceId
    : null;

  return sanitizeDestination({
    workspaceId: activeCollectionWorkspaceId || activeProjectWorkspaceId || activeWorkspaceId || null,
    collectionId: activeCollection ? activeCollection.id : null,
    updatedAt: context.updatedAt,
  });
}

function validateDestinationAgainstSnapshot(destination, workspaces, projects, collections) {
  const candidate = sanitizeDestination(destination);
  const workspaceIds = new Set(
    (Array.isArray(workspaces) ? workspaces : [])
      .map((workspace) => workspace?.id)
      .filter(Boolean)
  );
  const safeProjects = Array.isArray(projects) ? projects : [];
  const safeCollections = Array.isArray(collections) ? collections : [];

  if (candidate.collectionId) {
    const selectedCollection = safeCollections.find((collection) => collection.id === candidate.collectionId) || null;
    if (!selectedCollection) return null;
    const workspaceIdFromCollection = getCollectionWorkspaceId(selectedCollection, safeProjects);
    if (!workspaceIdFromCollection || !workspaceIds.has(workspaceIdFromCollection)) return null;
    if (candidate.workspaceId && candidate.workspaceId !== workspaceIdFromCollection) return null;
    return sanitizeDestination({
      workspaceId: workspaceIdFromCollection,
      collectionId: selectedCollection.id,
      updatedAt: candidate.updatedAt,
    });
  }

  if (candidate.workspaceId && !workspaceIds.has(candidate.workspaceId)) {
    return null;
  }

  return sanitizeDestination({
    workspaceId: candidate.workspaceId || null,
    collectionId: null,
    updatedAt: candidate.updatedAt,
  });
}

function resolveDestinationFromSnapshot(storedDestination, snapshot) {
  const preferred = sanitizeDestination(storedDestination);
  if (!snapshot) return preferred;

  const workspaces = Array.isArray(snapshot.workspaces) ? snapshot.workspaces : [];
  const collections = Array.isArray(snapshot.collections) ? snapshot.collections : [];
  const projects = Array.isArray(snapshot.projects) ? snapshot.projects : [];
  const activeContext = isObject(snapshot.activeContext) ? snapshot.activeContext : {};

  const preferredCandidate = validateDestinationAgainstSnapshot(preferred, workspaces, projects, collections);
  const appCandidateRaw = buildDestinationFromActiveContext(activeContext, workspaces, projects, collections);
  const appCandidate = validateDestinationAgainstSnapshot(appCandidateRaw, workspaces, projects, collections);

  if (!preferredCandidate && !appCandidate) {
    return sanitizeDestination(null);
  }
  if (!preferredCandidate) {
    return appCandidate;
  }
  if (!appCandidate) {
    return preferredCandidate;
  }

  const preferredHasScope = Boolean(preferredCandidate.workspaceId || preferredCandidate.collectionId);
  const appHasScope = Boolean(appCandidate.workspaceId || appCandidate.collectionId);
  if (!preferredHasScope && appHasScope) return appCandidate;
  if (!appHasScope && preferredHasScope) return preferredCandidate;

  if (preferredCandidate.updatedAt !== appCandidate.updatedAt) {
    return appCandidate.updatedAt > preferredCandidate.updatedAt
      ? appCandidate
      : preferredCandidate;
  }

  if (destinationsEqual(preferredCandidate, appCandidate, { includeUpdatedAt: false })) {
    return preferredCandidate;
  }

  // If timestamps tie, preserve explicit extension selection for continuity.
  return preferredCandidate;
}

async function resolveEffectiveCaptureDestination(targetTabId = null) {
  const storedDestination = await getCaptureDestination();
  const snapshot = await getDreamlabOrgSnapshot(targetTabId);
  const resolvedDestination = resolveDestinationFromSnapshot(storedDestination, snapshot);
  if (!destinationsEqual(storedDestination, resolvedDestination)) {
    try {
      await setStorage({ [STORAGE_KEYS.captureDestination]: resolvedDestination });
    } catch {
      // Ignore destination sync write errors; save flow should still continue.
    }
  }
  return resolvedDestination;
}

function applyDestinationToItem(item, destination) {
  const normalizedDestination = sanitizeDestination(destination);
  const sourceItem = isObject(item) ? item : {};
  const hasWorkspaceId = Object.prototype.hasOwnProperty.call(sourceItem, 'workspaceId');
  const hasCollectionId = Object.prototype.hasOwnProperty.call(sourceItem, 'collectionId');
  return {
    ...sourceItem,
    workspaceId: hasWorkspaceId
      ? sourceItem.workspaceId
      : (normalizedDestination.workspaceId || null),
    collectionId: hasCollectionId
      ? sourceItem.collectionId
      : (normalizedDestination.collectionId ?? null),
  };
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
  const validation = validateFetchablePageUrl(url);
  if (!validation.ok) {
    throw new Error(validation.error || 'URL cannot be inspected.');
  }
  const html = await fetchPageHtmlWithLimits(validation.url);
  return parseMetadataFromHtml(html, validation.url);
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getMetaMatches(html, key) {
  if (!key) return [];
  const regex = new RegExp(
    `<meta[^>]*\\b(?:property|name|itemprop)=["']${escapeRegex(key)}["'][^>]*\\bcontent=["']([^"']+)["'][^>]*>|<meta[^>]*\\bcontent=["']([^"']+)["'][^>]*\\b(?:property|name|itemprop)=["']${escapeRegex(key)}["'][^>]*>`,
    'gi'
  );
  const values = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const value = String(match[1] || match[2] || '').trim();
    if (value) values.push(value);
  }
  return values;
}

function getFirstMetaMatch(html, keys = []) {
  for (const key of keys) {
    const values = getMetaMatches(html, key);
    if (values.length > 0) return values[0];
  }
  return null;
}

function toAbsoluteUrl(candidate, baseUrl) {
  const value = String(candidate || '').trim();
  if (!value) return null;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}

function scoreMetadataImageCandidate(url, { isTweetLink = false } = {}) {
  const value = String(url || '').toLowerCase();
  if (!value) return -1;

  let score = 0;
  if (value.startsWith('https://')) score += 20;
  if (value.includes('pbs.twimg.com/media')) score += 3600;
  if (value.includes('ext_tw_video_thumb')) score += 3200;
  if (value.includes('amplify_video_thumb')) score += 3000;
  if (value.includes('tweet_video_thumb')) score += 2800;
  if (value.includes('/card_img/')) score += 1500;
  if (value.includes('twimg.com')) score += 800;

  if (isLikelyTweetAvatarImage(value)) score -= 5000;
  if (isTweetLink && value.includes('x.com')) score -= 800;

  return score;
}

function parseMetadataFromHtml(html, url) {
  if (!html || typeof html !== 'string') {
    return { title: null, image: null, description: null };
  }

  const isTweetLink = Boolean(getTweetInfo(url));
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = getFirstMetaMatch(html, ['og:title', 'twitter:title', 'title']) || (titleMatch ? titleMatch[1] : null);
  const description = getFirstMetaMatch(html, ['og:description', 'twitter:description', 'description']);

  const imageCandidates = [
    ...getMetaMatches(html, 'og:image:secure_url'),
    ...getMetaMatches(html, 'og:image:url'),
    ...getMetaMatches(html, 'og:image'),
    ...getMetaMatches(html, 'twitter:image:src'),
    ...getMetaMatches(html, 'twitter:image'),
    ...getMetaMatches(html, 'image'),
  ]
    .map((candidate) => toAbsoluteUrl(candidate, url))
    .filter(Boolean);

  const uniqueCandidates = Array.from(new Set(imageCandidates));
  uniqueCandidates.sort((left, right) => (
    scoreMetadataImageCandidate(right, { isTweetLink }) - scoreMetadataImageCandidate(left, { isTweetLink })
  ));
  const bestImage = uniqueCandidates[0] || null;
  const image = isLikelyTweetAvatarImage(bestImage) ? null : bestImage;

  return {
    title: title || null,
    image: image || null,
    description: description || null,
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
    const validation = validateFetchablePageUrl(url);
    if (!validation.ok) {
      return {
        status: 'blocked',
        source: 'extension',
        reason: validation.error || 'URL blocked.',
        extractedAt: Date.now(),
      };
    }
    const html = await fetchPageHtmlWithLimits(validation.url);
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
      siteName: siteName || normalizeDomain(validation.url) || null,
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

function normalizeTweetLinkCapture(item) {
  if (!item || item.type !== 'link') return item;
  const sourceUrl = item.sourceUrl || item.content;
  const tweetInfo = getTweetInfo(sourceUrl);
  if (!tweetInfo) return item;

  const currentEmbed = item.linkEmbed && typeof item.linkEmbed === 'object'
    ? item.linkEmbed
    : {};
  const currentTweetText = String(currentEmbed.tweetText || '').trim();
  const legacyDescription = String(item.description || '').trim();
  const normalizedCurrentTweetText = currentTweetText && !isLikelyUrlOnlyText(currentTweetText)
    ? currentTweetText
    : '';
  const normalizedLegacyDescription = legacyDescription && !isLikelyUrlOnlyText(legacyDescription)
    ? legacyDescription
    : '';
  const fallbackTweetText = normalizedCurrentTweetText || normalizedLegacyDescription || null;

  const nextEmbed = {
    ...currentEmbed,
    type: 'tweet',
    provider: currentEmbed.provider || 'x',
    status: currentEmbed.status || (fallbackTweetText ? 'fallback' : 'failed'),
    source: currentEmbed.source || (currentEmbed.status === 'ready' ? 'oembed' : 'metadata-fallback'),
    tweetId: currentEmbed.tweetId || tweetInfo.tweetId,
    url: currentEmbed.url || tweetInfo.canonicalUrl,
    tweetText: fallbackTweetText,
    fetchedAt: currentEmbed.fetchedAt || Date.now(),
  };

  const currentThumbnail = String(item.thumbnail || '').trim();
  const nextThumbnail = (currentThumbnail && isLikelyTweetAvatarImage(currentThumbnail)) ? null : item.thumbnail;

  const nextItem = {
    ...item,
    description: null,
    linkEmbed: nextEmbed,
    thumbnail: nextThumbnail,
  };
  return nextItem;
}

async function enrichLinkCapture(item) {
  const withEmbed = await maybeAttachLinkEmbed(item);
  const withTextExtract = await maybeAttachTextExtract(withEmbed);
  return normalizeTweetLinkCapture(withTextExtract);
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
    const response = await fetchWithTimeout(endpoint, {
      timeoutMs: REMOTE_FETCH_TIMEOUT_MS,
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
  try {
    const [activeTab] = await queryTabs({ active: true, currentWindow: true });
    const isCurrentPage = activeTab && isSamePageIdentity(activeTab.url, targetUrl);
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
              || getMeta('twitter:image:src')
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
              description: getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || null,
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
  const sourceTab = await getTab(tabId).catch(() => null);
  const captureBlockReason = getCaptureBlockReason(sourceTab?.url || '');
  if (captureBlockReason) {
    throw new Error(captureBlockReason);
  }

  const response = await sendTabMessageWithBridge(tabId, {
    action: CONTENT_ACTIONS.scanPageImages,
    scope,
  }, { frameId: 0 });

  if (!response || response.success !== true) {
    throw new Error(response?.error || 'Could not scan images on this page.');
  }

  return response;
}

function normalizeScanImages(scan, scope = '') {
  const normalizedScope = String(scope || '').trim().toLowerCase();
  const visibleImages = Array.isArray(scan?.visibleImages)
    ? scan.visibleImages
    : (normalizedScope === 'visible' ? (Array.isArray(scan?.images) ? scan.images : []) : []);
  const allImages = Array.isArray(scan?.images)
    ? scan.images
    : (normalizedScope === 'all' ? visibleImages : []);
  const totalCount = Number(
    scan?.totalCount
      || (normalizedScope === 'all'
        ? (allImages.length || visibleImages.length || 0)
        : (visibleImages.length || allImages.length || 0))
  );
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
    targetTab = await ensureDreamlabTab();
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
  const requestedTargetTabId = Number(options?.targetTabId) || null;
  let pendingStored = false;
  let itemWithDestination = applyDestinationToItem(item, null);

  try {
    let resolvedTargetTab = null;
    if (requestedTargetTabId) {
      try {
        const maybeTab = await getTab(requestedTargetTabId);
        if (maybeTab?.id && isDreamlabUrl(maybeTab.url)) {
          resolvedTargetTab = maybeTab;
        }
      } catch {
        // Fall back to ensureDreamlabTab below.
      }
    }

    if (!resolvedTargetTab) {
      resolvedTargetTab = await ensureDreamlabTab();
    }

    const destination = await resolveEffectiveCaptureDestination(resolvedTargetTab?.id || null);
    itemWithDestination = applyDestinationToItem(item, destination);

    if (!skipPendingStorage) {
      await setStorage({ [STORAGE_KEYS.pendingCapture]: itemWithDestination });
      pendingStored = true;
    }
    const saveResult = await saveItemToWebApp(itemWithDestination, {
      ...options,
      targetTabId: resolvedTargetTab?.id || requestedTargetTabId || null,
    });
    await removeStorage(STORAGE_KEYS.pendingCapture);
    return {
      success: true,
      targetTabId: saveResult?.targetTabId || null,
    };
  } catch (error) {
    // Keep pending capture for popup review.
    if (!pendingStored) {
      try {
        const fallbackPendingItem = skipPendingStorage
          ? {
            type: item?.type || 'image',
            title: item?.title || 'Pending Capture',
            sourceUrl: item?.sourceUrl || '',
            timestamp: Date.now(),
            error: error?.message || 'Save failed',
          }
          : {
            ...itemWithDestination,
            timestamp: itemWithDestination?.timestamp || Date.now(),
            error: error?.message || 'Save failed',
          };
        await setStorage({
          [STORAGE_KEYS.pendingCapture]: fallbackPendingItem,
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
  const targetUrl = info.linkUrl || tab.url || '';
  const captureBlockReason = getCaptureBlockReason(targetUrl);
  if (captureBlockReason) {
    if (tab.id) {
      await showInPageToast(tab.id, {
        message: captureBlockReason,
        type: 'error',
        durationMs: 4200,
      });
    }
    return;
  }

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
    const preview = await resolveLinkPreviewThumbnail({
      tab,
      sourceUrl: urlToScrape,
      metadataImage: metadata.image || null,
    });
    item = {
      type: 'link',
      content: metadata.title || tab.title || urlToScrape,
      title: metadata.title || tab.title || null,
      description: isUsefulDescription(metadata.description) ? metadata.description : null,
      thumbnail: preview.thumbnail,
      sourceUrl: urlToScrape,
      metadata: preview.previewSource ? { previewSource: preview.previewSource } : null,
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
  if (!tab) {
    throw new Error('No active tab available for command execution.');
  }

  if (command === 'save-page') {
    const captureBlockReason = getCaptureBlockReason(tab.url || '');
    if (captureBlockReason && tab.id) {
      await showInPageToast(tab.id, {
        message: captureBlockReason,
        type: 'error',
        durationMs: 4200,
      });
      throw new Error(captureBlockReason);
    }

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

    await showInPageToast(tab.id, {
      message: 'Saving page to Dreamlab...',
      type: 'info',
      durationMs: 2400,
    });

    let saveResult;
    if (selectedText) {
      saveResult = await queuePendingAndTrySave({
        type: 'text',
        content: selectedText,
        sourceUrl: tab.url,
        timestamp: Date.now(),
      });
    } else {
      const metadata = await getPageMetadata(tab.id, tab.url);
      const preview = await resolveLinkPreviewThumbnail({
        tab,
        sourceUrl: tab.url,
        metadataImage: metadata.image || null,
      });
      const linkItem = await enrichLinkCapture({
        type: 'link',
        content: metadata.title || tab.title || tab.url,
        title: metadata.title || tab.title || null,
        description: isUsefulDescription(metadata.description) ? metadata.description : null,
        thumbnail: preview.thumbnail,
        sourceUrl: tab.url,
        metadata: preview.previewSource ? { previewSource: preview.previewSource } : null,
        timestamp: Date.now(),
      });
      saveResult = await queuePendingAndTrySave(linkItem);
    }

    if (saveResult?.success) {
      const destinationSummary = await getDreamlabDestinationSummary(saveResult.targetTabId || null);
      await showInPageToast(tab.id, {
        message: `Saved to ${destinationSummary}.`,
        type: 'success',
        durationMs: 3200,
      });
      return;
    }

    const storageErrorType = classifyStorageErrorMessage(saveResult?.error);
    const errorDetail = String(saveResult?.error || '').trim();
    let message = 'Saved as pending capture; open the Dreamlab Capture popup to retry.';
    if (storageErrorType === 'indexeddb') {
      message = 'Could not write capture to browser media storage (IndexedDB). Open the Dreamlab Capture popup to retry.';
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
    throw new Error(saveResult?.error || 'Failed to save page capture.');
  }

  if (command === 'capture-visible') {
    if (!tab?.id) return;
    const captureBlockReason = getCaptureBlockReason(tab.url || '');
    if (captureBlockReason) {
      await showInPageToast(tab.id, {
        message: captureBlockReason,
        type: 'error',
        durationMs: 4200,
      });
      throw new Error(captureBlockReason);
    }

    let chosenTab = tab;
    let chosenScan = null;
    let chosenScanImages = { visibleImages: [], allImages: [], totalCount: 0 };

    try {
      chosenScan = await requestImageScan(tab.id, 'visible_with_total');
      chosenScanImages = normalizeScanImages(chosenScan, 'visible_with_total');
    } catch {
      // Try fallback tabs below.
    }

    const shouldTryFallbackTabs = !chosenScan
      || chosenScanImages.visibleImages.length === 0
      || isLikelyTrackingOrAssetUrl(chosenScan.sourceUrl || tab.url || '');

    if (shouldTryFallbackTabs) {
      const fallbackTabs = await getCaptureFallbackTabs(tab.id);
      const maxCandidates = 6;

      for (const candidate of fallbackTabs.slice(0, maxCandidates)) {
        try {
          const candidateScan = await requestImageScan(candidate.id, 'visible_with_total');
          const candidateImages = normalizeScanImages(candidateScan, 'visible_with_total');
          if (candidateImages.visibleImages.length > chosenScanImages.visibleImages.length) {
            chosenTab = candidate;
            chosenScan = candidateScan;
            chosenScanImages = candidateImages;
          } else if (
            candidateImages.visibleImages.length === chosenScanImages.visibleImages.length
            && candidateImages.totalCount > chosenScanImages.totalCount
          ) {
            chosenTab = candidate;
            chosenScan = candidateScan;
            chosenScanImages = candidateImages;
          }

          const hasGoodCoverage = candidateImages.visibleImages.length >= 6 || candidateImages.totalCount >= 12;
          const looksLikePage = !isLikelyTrackingOrAssetUrl(candidateScan.sourceUrl || candidate.url || '');
          if (hasGoodCoverage && looksLikePage) break;
        } catch {
          // Keep trying next candidates.
        }
      }
    }

    const visibleImages = chosenScanImages.visibleImages;
    const totalCount = chosenScanImages.totalCount || visibleImages.length;
    await openMultiSelectWindow({
      sourceTabId: chosenTab.id,
      sourceUrl: chosenScan?.sourceUrl || chosenTab.url || '',
      visibleImages,
      totalImagesCount: totalCount,
    });
    return;
  }

  if (command === 'capture-full-page') {
    if (!tab?.id) return;

    const captureBlockReason = getCaptureBlockReason(tab.url || '');
    if (captureBlockReason) {
      await showInPageToast(tab.id, {
        message: captureBlockReason,
        type: 'error',
        durationMs: 4200,
      });
      throw new Error(captureBlockReason);
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
      await setExtensionCaptureUiVisibility(tab.id, false);
      try {
        screenshot = await captureFullPageScreenshot(tab);
      } finally {
        await setExtensionCaptureUiVisibility(tab.id, true);
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
        const saveError = new Error(saveResult.error || 'Full-page capture save failed.');
        saveError.toastShown = true;
        throw saveError;
      }
    } catch (error) {
      if (!error?.toastShown) {
        await showInPageToast(tab.id, {
          message: error?.message || 'Full-page capture failed.',
          type: 'error',
          durationMs: 5000,
        });
      }
      throw error;
    }
    return;
  }

  if (command === 'smart-picker') {
    if (!tab?.id) return;
    const captureBlockReason = getCaptureBlockReason(tab.url || '');
    if (captureBlockReason) {
      await showInPageToast(tab.id, {
        message: captureBlockReason,
        type: 'error',
        durationMs: 4200,
      });
      throw new Error(captureBlockReason);
    }

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
    const captureBlockReason = getCaptureBlockReason(tab.url || '');
    if (captureBlockReason) {
      await showInPageToast(tab.id, {
        message: captureBlockReason,
        type: 'error',
        durationMs: 4200,
      });
      throw new Error(captureBlockReason);
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
        const colorError = new Error(payload.error || 'Color picking failed.');
        colorError.toastShown = true;
        throw colorError;
      }

      const hex = String(payload.color || '').trim().toUpperCase();
      if (!/^#[0-9A-F]{6}$/.test(hex)) {
        await showInPageToast(tab.id, {
          message: 'Picked color was invalid.',
          type: 'error',
          durationMs: 3600,
        });
        const invalidColorError = new Error('Picked color was invalid.');
        invalidColorError.toastShown = true;
        throw invalidColorError;
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
        const saveError = new Error(saveResult.error || 'Color save failed.');
        saveError.toastShown = true;
        throw saveError;
      }
    } catch (error) {
      if (!error?.toastShown) {
        await showInPageToast(tab.id, {
          message: error?.message || 'Color eyedropper failed.',
          type: 'error',
          durationMs: 4200,
        });
      }
      throw error;
    }
    return;
  }

  if (command === 'area-select' || command === 'area-record') {
    if (!tab?.id) return;
    const captureBlockReason = getCaptureBlockReason(tab.url || '');
    if (captureBlockReason) {
      await showInPageToast(tab.id, {
        message: captureBlockReason,
        type: 'error',
        durationMs: 4200,
      });
      throw new Error(captureBlockReason);
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
  return ACTION_DEFINITIONS.map((entry) => {
    const sourceCommand = entry.shortcutSourceCommands.find((name) => {
      const command = commandByName.get(name);
      return Boolean(command?.shortcut);
    }) || entry.shortcutSourceCommands[0];
    const runtimeCommand = commandByName.get(sourceCommand);
    return {
      actionId: entry.actionId,
      label: entry.label,
      description: runtimeCommand?.description || entry.description,
      executeCommand: entry.executeCommand,
      sourceCommand,
      command: entry.executeCommand,
      shortcut: runtimeCommand?.shortcut || '',
    };
  });
}

async function getWidgetConfig() {
  const [enabled, prefs, destination, shortcuts, behaviorSettings, hotkeys] = await Promise.all([
    getWidgetEnabled(),
    getWidgetPrefs(),
    getCaptureDestination(),
    getShortcutBindings(),
    getWidgetBehaviorSettings(),
    getWidgetHotkeys(),
  ]);
  return {
    enabled,
    prefs,
    destination,
    shortcuts,
    behaviorSettings,
    hotkeyMap: hotkeys.actionKeyMap || {},
  };
}

async function requestWidgetKeyboardMode(tabId, triggerSource) {
  return await sendTabMessageWithBridge(tabId, {
    action: CONTENT_ACTIONS.openWidgetKeyboardMode,
    triggerSource,
    sourceTabId: tabId,
  }, { frameId: 0 });
}

async function clearLegacyWidgetMarkers(tabId) {
  await executeScriptFn(
    tabId,
    () => {
      try {
        delete window.__dreamlabFloatingWidgetLoaded;
      } catch {
        window.__dreamlabFloatingWidgetLoaded = false;
      }
      const host = document.getElementById('dreamlab-floating-widget-host');
      if (host && host.parentNode) {
        host.parentNode.removeChild(host);
      }
      return true;
    }
  );
}

function isUnknownActionResponse(response) {
  if (!response || response.success !== false) return false;
  const message = String(response.error || '').toLowerCase();
  return message.includes('unknown action');
}

async function openWidgetKeyboardModeForTab(tabId = null, triggerSource = 'shortcut') {
  const tab = tabId
    ? await getTab(tabId).catch(() => null)
    : (await queryTabs({ active: true, currentWindow: true }))[0];

  if (!tab?.id) {
    throw new Error('No active tab available for widget launcher.');
  }

  let response = null;
  try {
    response = await requestWidgetKeyboardMode(tab.id, triggerSource);
  } catch (error) {
    response = { success: false, error: error?.message || 'Could not open capture widget launcher.' };
  }

  if (response?.success === true) {
    return { tabId: tab.id };
  }

  const firstError = String(response?.error || 'Could not open capture widget launcher.');
  const staleActionMismatch = isUnknownActionResponse(response);

  if (staleActionMismatch) {
    console.warn('[Dreamlab Launcher] Detected stale content action contract; forcing reinjection:', firstError);
  }

  // Recovery path for stale tabs after extension update/reload.
  try {
    await clearLegacyWidgetMarkers(tab.id);
  } catch {
    // Non-fatal; marker cleanup is best-effort.
  }
  if (staleActionMismatch) {
    try {
      await executeScript(tab.id, ['content.js']);
    } catch {
      // Non-fatal; follow-up retry still provides final outcome.
    }
  }
  try {
    await executeScript(tab.id, ['floating-widget.js']);
  } catch {
    // Non-fatal; the follow-up message attempt provides final outcome.
  }
  await wait(40);

  try {
    response = await requestWidgetKeyboardMode(tab.id, triggerSource);
  } catch (error) {
    response = { success: false, error: error?.message || 'Could not open capture widget launcher.' };
  }

  if (!response || response.success !== true) {
    throw new Error(response?.error || 'Could not open capture widget launcher.');
  }

  return { tabId: tab.id };
}

function getComplianceState() {
  const manifest = chrome.runtime.getManifest();
  const requiredPermissions = Array.isArray(manifest.permissions) ? manifest.permissions : [];
  const hostPermissions = Array.isArray(manifest.host_permissions) ? manifest.host_permissions : [];
  return {
    disclosureVersion: DISCLOSURE_VERSION,
    allSitesAccessRequired: hostPermissions.includes('<all_urls>'),
    hostPermissions,
    requiredPermissions,
    safetyMode: {
      userTriggeredCaptureOnly: true,
      unsupportedUrlsBlocked: true,
      sensitiveSurfacesBlocked: true,
      localNetworkMetadataBlocked: true,
      fetchTimeoutMs: REMOTE_FETCH_TIMEOUT_MS,
      fetchMaxHtmlBytes: REMOTE_FETCH_MAX_HTML_BYTES,
    },
    docs: {
      compliancePath: INTERNAL_DOCS.compliancePath,
      privacyPath: INTERNAL_DOCS.privacyPath,
      complianceUrl: INTERNAL_DOCS.complianceUrl,
      privacyUrl: INTERNAL_DOCS.privacyUrl,
    },
  };
}

function getPrivacySummary() {
  return PRIVACY_SUMMARY;
}

async function openComplianceDoc(docType) {
  const normalized = String(docType || 'privacy').toLowerCase();
  const url = normalized === 'compliance'
    ? INTERNAL_DOCS.complianceUrl
    : INTERNAL_DOCS.privacyUrl;
  await createTab({ url, active: true });
}

// Debounce map to prevent duplicate execution when both chrome.commands
// and content-script fallback fire for the same keystroke.
const _commandDebounce = new Map();
const COMMAND_DEBOUNCE_MS = 300;

async function dispatchCommand({ command, tabId, origin }) {
  if (
    command === 'save-page'
    && (origin === 'commands-api' || origin === 'content-fallback')
  ) {
    try {
      await openWidgetKeyboardModeForTab(tabId, 'launcher_shortcut');
    } catch (error) {
      console.error(`[Dreamlab Launcher] open failed (${origin}):`, error?.message || error);
      const activeTab = tabId
        ? await getTab(tabId).catch(() => null)
        : (await queryTabs({ active: true, currentWindow: true }))[0];
      if (activeTab?.id) {
        await showInPageToast(activeTab.id, {
          type: 'error',
          message: error?.message || 'Could not open capture launcher.',
          durationMs: 3400,
        });
      }
      throw error;
    }
    return;
  }

  const key = `${tabId || 'active'}:${command}`;
  const now = Date.now();
  const last = _commandDebounce.get(key) || 0;
  if (now - last < COMMAND_DEBOUNCE_MS) return;
  _commandDebounce.set(key, now);

  try {
    await executeCommandFromTab(command, tabId);
  } catch (error) {
    console.error(`Command "${command}" failed (${origin}):`, error?.message || error);
    throw error;
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  try {
    await dispatchCommand({ command, origin: 'commands-api' });
  } catch {
    // User-facing toasts are handled inside command execution paths.
  }
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
      return await queuePendingAndTrySave(request.item, {
        targetTabId: request.targetTabId || null,
        skipPendingStorage: true,
      });
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

      const workspaces = Array.isArray(response.workspaces) ? response.workspaces : [];
      const projects = Array.isArray(response.projects) ? response.projects : [];
      const collections = Array.isArray(response.collections) ? response.collections : [];
      const activeContext = isObject(response.activeContext) ? response.activeContext : {};

      const storedDestination = await getCaptureDestination();
      const resolvedDestination = resolveDestinationFromSnapshot(storedDestination, {
        workspaces,
        projects,
        collections,
        activeContext,
      });

      if (!destinationsEqual(storedDestination, resolvedDestination)) {
        try {
          await setStorage({ [STORAGE_KEYS.captureDestination]: resolvedDestination });
        } catch {
          // Non-fatal: org data can still be returned even if local sync write fails.
        }
      }

      return {
        success: true,
        sourceTabId: tab.id,
        appBuildId: typeof response.appBuildId === 'string' ? response.appBuildId : '',
        workspaces,
        projects,
        collections,
        activeContext,
        destination: resolvedDestination,
      };
    }

    case ACTIONS.getMultiSelectState: {
      const stored = await getStorage(STORAGE_KEYS.multiSelectState);
      return { success: true, state: stored?.[STORAGE_KEYS.multiSelectState] || null };
    }

    case ACTIONS.getMultiSelectPrefs: {
      const prefs = await getMultiSelectPrefs();
      return { success: true, prefs };
    }

    case ACTIONS.setMultiSelectPrefs: {
      const prefs = await setMultiSelectPrefs(request?.prefs);
      return { success: true, prefs };
    }

    case ACTIONS.executeCommand: {
      if (!VALID_COMMAND_SET.has(request.command)) {
        return { success: false, error: 'Unknown command.' };
      }
      try {
        await dispatchCommand({
          command: request.command,
          tabId: sender?.tab?.id || null,
          origin: request.origin || 'content-fallback',
        });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error?.message || `Command "${request.command}" failed.`,
        };
      }
    }

    case ACTIONS.getShortcutBindings: {
      const shortcuts = await getShortcutBindings();
      return { success: true, shortcuts };
    }

    case ACTIONS.openExtensionShortcuts: {
      try {
        await createTab({ url: 'chrome://extensions/shortcuts', active: true });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error?.message || 'Could not open extension shortcut settings.',
        };
      }
    }

    case ACTIONS.getWidgetConfig: {
      const config = await getWidgetConfig();
      return { success: true, ...config };
    }

    case ACTIONS.getComplianceState: {
      return { success: true, compliance: getComplianceState() };
    }

    case ACTIONS.getPrivacySummary: {
      return { success: true, privacy: getPrivacySummary() };
    }

    case ACTIONS.setWidgetEnabled: {
      const enabled = await setWidgetEnabled(request?.enabled);
      return { success: true, enabled };
    }

    case ACTIONS.getWidgetPrefs: {
      const prefs = await getWidgetPrefs();
      return { success: true, prefs };
    }

    case ACTIONS.setWidgetPrefs: {
      const prefs = await setWidgetPrefs(request?.prefs);
      return { success: true, prefs };
    }

    case ACTIONS.getCaptureDestination: {
      const destination = await getCaptureDestination();
      return { success: true, destination };
    }

    case ACTIONS.setCaptureDestination: {
      const destination = await setCaptureDestination(request?.destination);
      return { success: true, destination };
    }

    case ACTIONS.getWidgetBehaviorSettings: {
      const settings = await getWidgetBehaviorSettings();
      return { success: true, settings };
    }

    case ACTIONS.setWidgetBehaviorSettings: {
      const settings = await setWidgetBehaviorSettings(request?.settings);
      return { success: true, settings };
    }

    case ACTIONS.getWidgetHotkeys: {
      const hotkeys = await getWidgetHotkeys();
      return { success: true, hotkeys };
    }

    case ACTIONS.setWidgetHotkeys: {
      const hotkeys = await setWidgetHotkeys(request?.hotkeys);
      return { success: true, hotkeys };
    }

    case ACTIONS.openWidgetKeyboardMode: {
      try {
        const result = await openWidgetKeyboardModeForTab(
          request?.sourceTabId || sender?.tab?.id || null,
          request?.triggerSource || 'shortcut'
        );
        return { success: true, tabId: result.tabId };
      } catch (error) {
        return { success: false, error: error?.message || 'Could not open capture widget launcher.' };
      }
    }

    case ACTIONS.openExtensionOptions: {
      try {
        await openExtensionOptions();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error?.message || 'Could not open extension options.',
        };
      }
    }

    case ACTIONS.openComplianceDoc: {
      try {
        await openComplianceDoc(request?.docType);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error?.message || 'Could not open compliance documentation.',
        };
      }
    }

    case ACTIONS.scanSourceImages: {
      const stored = await getStorage(STORAGE_KEYS.multiSelectState);
      const sourceTabId = request.sourceTabId || stored?.[STORAGE_KEYS.multiSelectState]?.sourceTabId;
      if (!sourceTabId) {
        return { success: false, error: 'Source tab is not available.' };
      }

      const requestedScope = request.scope || 'visible';
      let scan = await requestImageScan(sourceTabId, requestedScope);
      let { visibleImages, allImages, totalCount } = normalizeScanImages(scan, requestedScope);
      let recoveredAllImages = [];

      const shouldFallbackToAll = (requestedScope === 'visible' || requestedScope === 'visible_with_total')
        && visibleImages.length === 0
        && totalCount === 0;

      if (shouldFallbackToAll) {
        try {
          const fallbackScan = await requestImageScan(sourceTabId, 'all');
          const fallback = normalizeScanImages(fallbackScan, 'all');
          if (fallback.allImages.length > 0) {
            recoveredAllImages = fallback.allImages;
            if (!scan?.sourceUrl && fallbackScan?.sourceUrl) {
              scan = {
                ...(isObject(scan) ? scan : {}),
                sourceUrl: fallbackScan.sourceUrl,
              };
            }
            totalCount = fallback.totalCount || fallback.allImages.length;
          }
        } catch {
          // Keep original scan result if fallback fails.
        }
      }

      // Keep visible scope strict: only return all-scope images for explicit all scans or recovery sets.
      const fallbackAllImages = recoveredAllImages.length > 0
        ? recoveredAllImages
        : (visibleImages.length === 0 ? allImages : []);

      return {
        success: true,
        sourceTabId,
        sourceUrl: scan.sourceUrl || stored?.[STORAGE_KEYS.multiSelectState]?.sourceUrl || '',
        images: requestedScope === 'all' ? allImages : fallbackAllImages,
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
        await setExtensionCaptureUiVisibility(tab.id, false);
        let dataUrl = null;
        try {
          dataUrl = await captureVisibleTab(tab.windowId, { format: 'png' });
        } finally {
          await setExtensionCaptureUiVisibility(tab.id, true);
        }

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
