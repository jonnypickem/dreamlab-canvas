const ACTIONS = {
  ping: 'ping',
  saveCapturedItem: 'saveCapturedItem',
  getDreamlabOrgData: 'getDreamlabOrgData',
  getMultiSelectState: 'getMultiSelectState',
  getMultiSelectPrefs: 'getMultiSelectPrefs',
  setMultiSelectPrefs: 'setMultiSelectPrefs',
  scanSourceImages: 'scanSourceImages',
};

const DEFAULT_MULTI_SELECT_PREFS = Object.freeze({
  resolutionTier: 'any',
  typeFilters: [],
  sortMode: 'resolution_desc',
  updatedAt: 0,
});

const ALLOWED_RESOLUTION_TIERS = new Set(['any', 'small', 'medium', 'large', 'icon']);
const ALLOWED_TYPE_FILTERS = new Set(['high', 'icon', 'profile', 'ad', 'other']);
const TYPE_LABELS = Object.freeze({
  high: 'High image',
  icon: 'Icon',
  profile: 'Profile',
  ad: 'Ad',
  other: 'Other',
});

const AD_SIZE_SIGNATURES = [
  [300, 250], [728, 90], [160, 600], [336, 280], [320, 50],
  [300, 600], [970, 250], [468, 60], [970, 90], [250, 250],
  [200, 200], [120, 600], [320, 100], [300, 50],
];

const AD_HINT_PATTERN = /(doubleclick|googlesyndication|adservice|adserver|adnxs|taboola|outbrain|criteo|sponsor|sponsored|promo|promoted|banner|campaign|advert|ads?[\/_-]|gpt-|dfp|adslot|affiliate)/i;
const PROFILE_HINT_PATTERN = /(avatar|profile|userpic|headshot|portrait|member|author|contributor|account|user(?:name)?|team-photo|bio-photo|pfp)/i;
const ICON_HINT_PATTERN = /(icon|favicon|sprite|glyph|emoji|symbol|badge|logo(?:-|_|\b))/i;

const state = {
  sourceTabId: null,
  sourceUrl: '',
  visibleImages: [],
  allImages: [],
  totalCount: 0,
  showingAll: false,
  resolutionTier: DEFAULT_MULTI_SELECT_PREFS.resolutionTier,
  typeFilters: new Set(DEFAULT_MULTI_SELECT_PREFS.typeFilters),
  sortMode: DEFAULT_MULTI_SELECT_PREFS.sortMode,
  selected: new Set(),
  imageIndex: new Map(),
  workspaces: [],
  projects: [],
  collections: [],
  destination: { workspaceId: null, collectionId: null },
  activeContext: {},
  appBuildId: '',
  isSaving: false,
};

const ui = {};
let prefsPersistToken = 0;

document.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  bindEvents();
  void initialize();
});

function cacheDom() {
  ui.closeButton = document.getElementById('closeBtn');
  ui.cancelButton = document.getElementById('cancelBtn');
  ui.toggleViewButton = document.getElementById('toggleViewBtn');
  ui.selectAllButton = document.getElementById('selectAllBtn');
  ui.deselectAllButton = document.getElementById('deselectAllBtn');
  ui.saveButton = document.getElementById('saveBtn');
  ui.imageGrid = document.getElementById('imageGrid');
  ui.emptyState = document.getElementById('emptyState');
  ui.visibleCount = document.getElementById('visibleCount');
  ui.totalCount = document.getElementById('totalCount');
  ui.selectedCount = document.getElementById('selectedCount');
  ui.sourceLabel = document.getElementById('sourceLabel');
  ui.status = document.getElementById('status');
  ui.scopeHint = document.getElementById('scopeHint');
  ui.blockedSummary = document.getElementById('blockedSummary');

  ui.workspaceSelect = document.getElementById('workspaceSelect');
  ui.collectionSelect = document.getElementById('collectionSelect');
  ui.tagsInput = document.getElementById('tagsInput');
  ui.resolutionSelect = document.getElementById('resolutionSelect');
  ui.typeFilterGroup = document.getElementById('typeFilters');
  ui.resetFiltersButton = document.getElementById('resetFiltersBtn');
}

function bindEvents() {
  ui.closeButton.addEventListener('click', () => window.close());
  ui.cancelButton.addEventListener('click', () => window.close());

  ui.toggleViewButton.addEventListener('click', () => {
    void toggleImageScope();
  });

  ui.selectAllButton.addEventListener('click', () => {
    getCurrentImages().forEach((image) => {
      if (image._analysis?.selectable) {
        state.selected.add(image.key);
      }
    });
    renderImages();
  });

  ui.deselectAllButton.addEventListener('click', () => {
    state.selected.clear();
    renderImages();
  });

  ui.workspaceSelect.addEventListener('change', () => {
    populateCollectionOptions(ui.workspaceSelect.value, null);
  });

  ui.resolutionSelect.addEventListener('change', () => {
    state.resolutionTier = sanitizeResolutionTier(ui.resolutionSelect.value);
    renderImages();
    void persistMultiSelectPrefs();
  });

  ui.typeFilterGroup?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-type-filter]');
    if (!button || !ui.typeFilterGroup.contains(button)) return;
    const typeId = String(button.getAttribute('data-type-filter') || '').trim();
    if (!ALLOWED_TYPE_FILTERS.has(typeId)) return;

    if (state.typeFilters.has(typeId)) {
      state.typeFilters.delete(typeId);
    } else {
      state.typeFilters.add(typeId);
    }

    renderImages();
    void persistMultiSelectPrefs();
  });

  ui.resetFiltersButton?.addEventListener('click', () => {
    void resetFiltersToDefault();
  });

  ui.saveButton.addEventListener('click', () => {
    void saveSelectedImages();
  });

  ui.imageGrid.addEventListener('click', (event) => {
    const card = event.target.closest('.image-card');
    if (!card || !ui.imageGrid.contains(card)) return;
    const imageKey = card.dataset.imageKey;
    if (!imageKey) return;

    const image = state.imageIndex.get(imageKey);
    if (!image) return;
    const analysis = getImageAnalysis(image);

    if (!analysis.selectable) {
      setStatus(`Cannot select this image: ${analysis.selectabilityReason}.`, 'error');
      return;
    }

    toggleSelected(imageKey);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPortClosedError(message) {
  return /message port closed before a response/i.test(String(message || ''));
}

async function runtimeMessage(message, { retries = 1 } = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, async (response) => {
      if (chrome.runtime.lastError) {
        const errorMessage = chrome.runtime.lastError.message || 'Extension message failed.';
        if (isPortClosedError(errorMessage) && retries > 0) {
          await delay(120);
          try {
            const retryResponse = await runtimeMessage(message, { retries: retries - 1 });
            resolve(retryResponse);
          } catch (error) {
            reject(error);
          }
          return;
        }

        if (isPortClosedError(errorMessage)) {
          reject(new Error('Extension reloaded. Reopen the review window and try again.'));
          return;
        }

        reject(new Error(errorMessage));
        return;
      }
      resolve(response || {});
    });
  });
}

function parseTags(raw) {
  return String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function getSourceLabel(url) {
  if (!url) return 'Source page unavailable';
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    const value = `${host}${path}`;
    if (value.length <= 110) return value;
    return `${value.slice(0, 107)}...`;
  } catch {
    const value = String(url);
    if (value.length <= 110) return value;
    return `${value.slice(0, 107)}...`;
  }
}

function setStatus(message, type = '') {
  ui.status.textContent = message || '';
  ui.status.className = 'status';
  if (type === 'success') ui.status.classList.add('success');
  if (type === 'error') ui.status.classList.add('error');
}

function sanitizeResolutionTier(value) {
  const tier = String(value || '').trim().toLowerCase();
  if (!ALLOWED_RESOLUTION_TIERS.has(tier)) return DEFAULT_MULTI_SELECT_PREFS.resolutionTier;
  return tier;
}

function sanitizeTypeFilters(values) {
  const source = Array.isArray(values) ? values : [];
  const result = [];
  const seen = new Set();

  source.forEach((entry) => {
    const token = String(entry || '').trim().toLowerCase();
    if (!ALLOWED_TYPE_FILTERS.has(token) || seen.has(token)) return;
    seen.add(token);
    result.push(token);
  });

  return result;
}

function sanitizeSortMode(value) {
  return value === 'resolution_desc'
    ? 'resolution_desc'
    : DEFAULT_MULTI_SELECT_PREFS.sortMode;
}

function sanitizePrefs(input) {
  const source = input && typeof input === 'object' ? input : {};
  return {
    resolutionTier: sanitizeResolutionTier(source.resolutionTier),
    typeFilters: sanitizeTypeFilters(source.typeFilters),
    sortMode: sanitizeSortMode(source.sortMode),
    updatedAt: Number.isFinite(Number(source.updatedAt)) ? Number(source.updatedAt) : 0,
  };
}

function applyPrefs(prefs) {
  const next = sanitizePrefs(prefs);
  state.resolutionTier = next.resolutionTier;
  state.typeFilters = new Set(next.typeFilters);
  state.sortMode = next.sortMode;
  if (ui.resolutionSelect) {
    ui.resolutionSelect.value = state.resolutionTier;
  }
  renderTypeFilters();
}

function getPrefsPayload() {
  return {
    resolutionTier: state.resolutionTier,
    typeFilters: [...state.typeFilters],
    sortMode: state.sortMode,
  };
}

async function persistMultiSelectPrefs() {
  const requestToken = ++prefsPersistToken;
  try {
    const response = await runtimeMessage({
      action: ACTIONS.setMultiSelectPrefs,
      prefs: getPrefsPayload(),
    });

    if (requestToken !== prefsPersistToken) return false;
    if (!response?.success) {
      throw new Error(response?.error || 'Could not save review filters.');
    }

    applyPrefs(response.prefs || getPrefsPayload());
    return true;
  } catch (error) {
    if (requestToken !== prefsPersistToken) return false;
    setStatus(error?.message || 'Could not save review filters.', 'error');
    return false;
  }
}

async function resetFiltersToDefault() {
  applyPrefs(DEFAULT_MULTI_SELECT_PREFS);
  renderImages();
  const persisted = await persistMultiSelectPrefs();
  if (persisted) {
    setStatus('Filters reset.', 'success');
  }
}

function pickValid(value, validValues, fallback = '') {
  if (value && validValues.includes(value)) return value;
  if (fallback && validValues.includes(fallback)) return fallback;
  return validValues[0] || '';
}

function setSelectOptions(selectElement, options, placeholderLabel, selectedValue) {
  selectElement.innerHTML = '';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = placeholderLabel;
  selectElement.appendChild(placeholder);

  options.forEach((option) => {
    const item = document.createElement('option');
    item.value = option.value;
    item.textContent = option.label;
    selectElement.appendChild(item);
  });

  selectElement.value = selectedValue || '';
}

function getCollectionWorkspaceId(collection) {
  if (!collection || typeof collection !== 'object') return null;
  if (collection.workspaceId) return collection.workspaceId;
  if (!collection.projectId) return null;

  const project = state.projects.find((candidate) => candidate.id === collection.projectId);
  return project?.workspaceId || null;
}

function getCollectionsForWorkspace(workspaceId) {
  if (!workspaceId) return [];
  return state.collections.filter((collection) => getCollectionWorkspaceId(collection) === workspaceId);
}

function getProjectName(projectId) {
  if (!projectId) return null;
  const project = state.projects.find((candidate) => candidate.id === projectId);
  return project?.name || null;
}

function formatCollectionLabel(collection) {
  const collectionName = String(collection?.name || 'Untitled').trim() || 'Untitled';
  const projectName = getProjectName(collection?.projectId);
  if (!projectName) return `Ungrouped / ${collectionName}`;
  return `${projectName} / ${collectionName}`;
}

function isLikelyRenderableImageUrl(sourceUrl) {
  if (!sourceUrl || typeof sourceUrl !== 'string') return false;
  const value = sourceUrl.trim();
  if (!value) return false;
  if (value.startsWith('data:image/')) return true;
  if (value.startsWith('blob:')) return true;

  try {
    const parsed = new URL(value);
    const pathname = parsed.pathname || '';
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

    const nestedImageParam = (
      parsed.searchParams.get('url')
      || parsed.searchParams.get('image')
      || parsed.searchParams.get('img')
      || parsed.searchParams.get('src')
      || ''
    );
    if (/\.(avif|webp|png|jpe?g|gif|svg|bmp|ico|tiff?|jfif|heic|heif)(?:$|\?)/i.test(nestedImageParam)) {
      return true;
    }

    if (/\/(?:_?next|cdn-cgi)\/image/i.test(pathname)) return true;
    if (/\/(images?|photos?|media|assets?)\//i.test(pathname)) return true;
  } catch {
    if (/\.(avif|webp|png|jpe?g|gif|svg|bmp|ico|tiff?|jfif|heic|heif)(?:$|\?)/i.test(value)) {
      return true;
    }
  }

  return false;
}

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.round(parsed);
}

function resolveImageDimensions(image) {
  const intrinsicWidth = toPositiveInt(image?.width);
  const intrinsicHeight = toPositiveInt(image?.height);
  const displayWidth = toPositiveInt(image?.displayWidth);
  const displayHeight = toPositiveInt(image?.displayHeight);

  const width = intrinsicWidth || displayWidth;
  const height = intrinsicHeight || displayHeight;
  const known = width > 0 && height > 0;

  return {
    width,
    height,
    known,
    area: known ? width * height : 0,
    maxDimension: known ? Math.max(width, height) : 0,
    aspectRatio: known ? (width / Math.max(height, 1)) : 0,
  };
}

function classifyResolutionTier(dimensions) {
  if (!dimensions.known) return 'unknown';
  if (dimensions.width <= 200 && dimensions.height <= 200) return 'icon';
  if (dimensions.width >= 1024 && dimensions.height >= 768) return 'large';
  if (dimensions.width >= 640 && dimensions.height >= 480) return 'medium';
  if (dimensions.width >= 400 && dimensions.height >= 300) return 'small';
  return 'other';
}

function isAdSizeSignature(dimensions) {
  if (!dimensions.known) return false;
  return AD_SIZE_SIGNATURES.some(([w, h]) => (
    Math.abs(dimensions.width - w) <= 10 && Math.abs(dimensions.height - h) <= 10
  ));
}

function isProbablyProfileShape(dimensions) {
  if (!dimensions.known) return false;
  const ratio = dimensions.aspectRatio;
  return ratio >= 0.55 && ratio <= 1.4 && dimensions.maxDimension <= 900;
}

function determineImageType(image, dimensions, resolutionTier) {
  const hintText = `${image?.src || ''} ${image?.alt || ''} ${image?.className || ''} ${image?.elementId || ''}`.toLowerCase();

  if (AD_HINT_PATTERN.test(hintText) || isAdSizeSignature(dimensions)) {
    return 'ad';
  }

  if (PROFILE_HINT_PATTERN.test(hintText)) {
    if (!dimensions.known || isProbablyProfileShape(dimensions)) {
      return 'profile';
    }
  }

  if (
    resolutionTier === 'icon'
    || (ICON_HINT_PATTERN.test(hintText) && (!dimensions.known || dimensions.maxDimension <= 256))
  ) {
    return 'icon';
  }

  if (dimensions.known && dimensions.width >= 1024 && dimensions.height >= 768) {
    return 'high';
  }

  return 'other';
}

function evaluateImageSelectability(src) {
  const value = String(src || '').trim();
  if (!value) {
    return { selectable: false, selectabilityReason: 'Missing image URL' };
  }

  if (value.startsWith('blob:')) {
    return { selectable: false, selectabilityReason: 'Page-local blob URL' };
  }

  if (value.startsWith('filesystem:')) {
    return { selectable: false, selectabilityReason: 'Unsupported filesystem URL' };
  }

  if (value.startsWith('data:')) {
    if (!value.startsWith('data:image/')) {
      return { selectable: false, selectabilityReason: 'Unsupported data URL' };
    }
    return { selectable: true, selectabilityReason: '' };
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return { selectable: true, selectabilityReason: '' };
    }
    if (parsed.protocol === 'data:' && value.startsWith('data:image/')) {
      return { selectable: true, selectabilityReason: '' };
    }
    return { selectable: false, selectabilityReason: `Unsupported URL scheme (${parsed.protocol})` };
  } catch {
    return { selectable: false, selectabilityReason: 'Invalid image URL' };
  }
}

function analyzeImageCandidate(image) {
  const dimensions = resolveImageDimensions(image);
  const resolutionTier = classifyResolutionTier(dimensions);
  const primaryType = determineImageType(image, dimensions, resolutionTier);
  const selectability = evaluateImageSelectability(image?.src);

  return {
    ...dimensions,
    resolutionTier,
    primaryType,
    selectable: selectability.selectable,
    selectabilityReason: selectability.selectabilityReason,
  };
}

function getImageAnalysis(image) {
  if (!image || typeof image !== 'object') {
    return {
      width: 0,
      height: 0,
      known: false,
      area: 0,
      maxDimension: 0,
      aspectRatio: 0,
      resolutionTier: 'unknown',
      primaryType: 'other',
      selectable: false,
      selectabilityReason: 'Missing image data',
    };
  }
  if (!image._analysis) {
    image._analysis = analyzeImageCandidate(image);
  }
  return image._analysis;
}

function normalizeImageList(images = []) {
  const srcCounts = new Map();
  const normalized = [];

  images.forEach((image) => {
    const src = typeof image?.src === 'string' ? image.src.trim() : '';
    if (!src) return;

    const dimensions = resolveImageDimensions(image);
    if (!dimensions.known && !isLikelyRenderableImageUrl(src)) return;

    const count = (srcCounts.get(src) || 0) + 1;
    srcCounts.set(src, count);

    const normalizedImage = {
      ...image,
      src,
      alt: typeof image?.alt === 'string' ? image.alt : '',
      className: typeof image?.className === 'string' ? image.className : '',
      elementId: typeof image?.elementId === 'string' ? image.elementId : '',
      key: `${src}#${count}`,
    };
    normalizedImage._analysis = analyzeImageCandidate(normalizedImage);
    normalized.push(normalizedImage);
  });

  return normalized;
}

function rebuildImageIndex() {
  const imageIndex = new Map();
  [...state.visibleImages, ...state.allImages].forEach((image) => {
    if (!imageIndex.has(image.key)) {
      imageIndex.set(image.key, image);
    }
  });
  state.imageIndex = imageIndex;

  const staleSelected = [];
  state.selected.forEach((key) => {
    if (!state.imageIndex.has(key)) staleSelected.push(key);
  });
  staleSelected.forEach((key) => state.selected.delete(key));
}

function hydrateDestinationSelectors() {
  const workspaceOptions = state.workspaces.map((workspace) => ({
    value: workspace.id,
    label: workspace.name,
  }));
  const workspaceIds = workspaceOptions.map((option) => option.value);

  const workspaceId = pickValid(
    state.destination.workspaceId || state.activeContext.workspaceId,
    workspaceIds,
    null
  );

  setSelectOptions(ui.workspaceSelect, workspaceOptions, 'Select workspace', workspaceId);
  ui.workspaceSelect.disabled = workspaceOptions.length === 0;

  populateCollectionOptions(
    workspaceId,
    state.destination.collectionId || state.activeContext.collectionId || null
  );
}

function populateCollectionOptions(workspaceId, preferredCollectionId) {
  const collections = getCollectionsForWorkspace(workspaceId);
  const collectionOptions = collections.map((collection) => ({
    value: collection.id,
    label: formatCollectionLabel(collection),
  })).sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  const collectionIds = collectionOptions.map((option) => option.value);

  const collectionId = pickValid(preferredCollectionId, collectionIds, null);

  setSelectOptions(ui.collectionSelect, collectionOptions, 'No collection', collectionId);
  ui.collectionSelect.disabled = !workspaceId || collectionOptions.length === 0;
}

function imageMatchesResolutionTier(image, resolutionTier) {
  if (resolutionTier === 'any') return true;
  const analysis = getImageAnalysis(image);

  if (resolutionTier === 'icon') return analysis.resolutionTier === 'icon';
  if (!analysis.known) return false;
  if (resolutionTier === 'small') return analysis.width >= 400 && analysis.height >= 300;
  if (resolutionTier === 'medium') return analysis.width >= 640 && analysis.height >= 480;
  if (resolutionTier === 'large') return analysis.width >= 1024 && analysis.height >= 768;
  return true;
}

function imageMatchesTypeFilters(image) {
  if (state.typeFilters.size === 0) return true;
  const analysis = getImageAnalysis(image);
  return state.typeFilters.has(analysis.primaryType);
}

function compareImagesByPriority(a, b) {
  const analysisA = getImageAnalysis(a);
  const analysisB = getImageAnalysis(b);

  if (analysisA.known !== analysisB.known) {
    return analysisA.known ? -1 : 1;
  }
  if (analysisA.area !== analysisB.area) {
    return analysisB.area - analysisA.area;
  }
  if (analysisA.maxDimension !== analysisB.maxDimension) {
    return analysisB.maxDimension - analysisA.maxDimension;
  }
  if (analysisA.width !== analysisB.width) {
    return analysisB.width - analysisA.width;
  }
  if (analysisA.height !== analysisB.height) {
    return analysisB.height - analysisA.height;
  }
  return String(a.key || '').localeCompare(String(b.key || ''));
}

function getCurrentImages() {
  const source = state.showingAll ? state.allImages : state.visibleImages;
  return [...source]
    .filter((image) => imageMatchesResolutionTier(image, state.resolutionTier))
    .filter((image) => imageMatchesTypeFilters(image))
    .sort(compareImagesByPriority);
}

function updateScopeUi() {
  ui.visibleCount.textContent = String(state.visibleImages.length);

  const totalCount = state.allImages.length > 0
    ? state.allImages.length
    : Number(state.totalCount || state.visibleImages.length);

  ui.totalCount.textContent = String(totalCount);

  if (state.showingAll) {
    ui.toggleViewButton.textContent = 'Show visible only';
    if (ui.scopeHint) {
      ui.scopeHint.textContent = 'All images: full-page scan results, including off-screen assets.';
    }
  } else {
    ui.toggleViewButton.textContent = 'Show all images';
    if (ui.scopeHint) {
      ui.scopeHint.textContent = 'Visible only: images currently on-screen in the source tab.';
    }
  }
}

function getSelectedImages() {
  const selectedImages = [];
  const staleKeys = [];
  state.selected.forEach((imageKey) => {
    const image = state.imageIndex.get(imageKey);
    if (!image) {
      staleKeys.push(imageKey);
      return;
    }
    selectedImages.push(image);
  });
  staleKeys.forEach((key) => state.selected.delete(key));
  return selectedImages;
}

function updateSelectedUi() {
  const selectedImages = getSelectedImages();
  ui.selectedCount.textContent = String(selectedImages.length);
  ui.saveButton.disabled = selectedImages.length === 0 || state.isSaving;
}

function renderTypeFilters() {
  if (!ui.typeFilterGroup) return;
  const buttons = ui.typeFilterGroup.querySelectorAll('[data-type-filter]');
  buttons.forEach((button) => {
    const typeId = String(button.getAttribute('data-type-filter') || '').trim();
    const isActive = state.typeFilters.has(typeId);
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function updateBlockedSummary(displayImages) {
  if (!ui.blockedSummary) return;
  const blocked = displayImages.filter((image) => !getImageAnalysis(image).selectable);

  if (!blocked.length) {
    ui.blockedSummary.textContent = '';
    ui.blockedSummary.hidden = true;
    return;
  }

  const reasonCounts = new Map();
  blocked.forEach((image) => {
    const reason = getImageAnalysis(image).selectabilityReason || 'Blocked source';
    reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
  });

  const reasonPreview = [...reasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([reason, count]) => `${reason} (${count})`)
    .join(', ');

  ui.blockedSummary.textContent = `${blocked.length} items blocked: ${reasonPreview}`;
  ui.blockedSummary.hidden = false;
}

function getImageSizeLabel(image) {
  const analysis = getImageAnalysis(image);
  if (!analysis.known) return 'Unknown';
  return `${analysis.width}×${analysis.height}`;
}

function getTypeLabel(typeId) {
  return TYPE_LABELS[typeId] || 'Other';
}

function createImageCard(image) {
  const analysis = getImageAnalysis(image);

  const card = document.createElement('div');
  card.className = `image-card${state.selected.has(image.key) ? ' selected' : ''}${analysis.selectable ? '' : ' is-unselectable'}`;
  card.setAttribute('role', 'listitem');
  card.dataset.imageKey = image.key;
  if (!analysis.selectable) {
    card.dataset.blockedReason = analysis.selectabilityReason;
    card.title = analysis.selectabilityReason;
  }

  const imageElement = document.createElement('img');
  imageElement.src = image.src;
  imageElement.alt = image.alt || 'Captured image';
  imageElement.loading = 'lazy';
  imageElement.draggable = false;
  imageElement.referrerPolicy = 'no-referrer';

  imageElement.addEventListener('error', () => {
    card.classList.add('image-card-broken');
    imageElement.style.display = 'none';
    if (!card.querySelector('.image-fallback')) {
      const fallback = document.createElement('div');
      fallback.className = 'image-fallback';
      fallback.textContent = 'Preview blocked. You can still select and save this image.';
      card.appendChild(fallback);
    }
  });

  const checkWrap = document.createElement('div');
  checkWrap.className = `check-wrap${analysis.selectable ? '' : ' is-disabled'}`;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'image-checkbox';
  checkbox.checked = state.selected.has(image.key);
  checkbox.dataset.imageKey = image.key;
  checkbox.disabled = !analysis.selectable;

  checkWrap.appendChild(checkbox);
  card.appendChild(imageElement);
  card.appendChild(checkWrap);

  const typeBadge = document.createElement('div');
  typeBadge.className = `image-type-badge type-${analysis.primaryType}`;
  typeBadge.textContent = getTypeLabel(analysis.primaryType);
  card.appendChild(typeBadge);

  if (!analysis.selectable) {
    const reasonBadge = document.createElement('div');
    reasonBadge.className = 'image-reason-badge';
    reasonBadge.textContent = analysis.selectabilityReason;
    card.appendChild(reasonBadge);
  }

  const sizeLabel = getImageSizeLabel(image);
  if (sizeLabel) {
    const meta = document.createElement('div');
    meta.className = 'image-meta';
    meta.textContent = sizeLabel;
    card.appendChild(meta);
  }

  return card;
}

function renderImages() {
  const images = getCurrentImages();
  ui.imageGrid.innerHTML = '';

  if (!images.length) {
    ui.emptyState.hidden = false;
  } else {
    ui.emptyState.hidden = true;
    images.forEach((image) => {
      ui.imageGrid.appendChild(createImageCard(image));
    });
  }

  updateScopeUi();
  renderTypeFilters();
  updateBlockedSummary(images);
  updateSelectedUi();
}

function toggleSelected(imageKey) {
  if (!imageKey) return;
  const image = state.imageIndex.get(imageKey);
  if (!image) return;
  const analysis = getImageAnalysis(image);

  if (!analysis.selectable) {
    setStatus(`Cannot select this image: ${analysis.selectabilityReason}.`, 'error');
    return;
  }

  if (state.selected.has(imageKey)) {
    state.selected.delete(imageKey);
  } else {
    state.selected.add(imageKey);
  }

  const cards = ui.imageGrid.querySelectorAll('.image-card');
  cards.forEach((card) => {
    if (card.dataset.imageKey !== imageKey) return;
    const isSelected = state.selected.has(imageKey);
    card.classList.toggle('selected', isSelected);
    const checkbox = card.querySelector('.image-checkbox');
    if (checkbox) checkbox.checked = isSelected;
  });

  updateSelectedUi();
}

async function initialize() {
  try {
    try {
      await runtimeMessage({ action: ACTIONS.ping }, { retries: 2 });
    } catch {
      // Continue; downstream requests include retries.
    }

    const [sessionResponse, prefsResponse] = await Promise.all([
      runtimeMessage({ action: ACTIONS.getMultiSelectState }),
      runtimeMessage({ action: ACTIONS.getMultiSelectPrefs }).catch(() => null),
    ]);

    if (prefsResponse?.success) {
      applyPrefs(prefsResponse.prefs || DEFAULT_MULTI_SELECT_PREFS);
    } else {
      applyPrefs(DEFAULT_MULTI_SELECT_PREFS);
    }

    const session = sessionResponse?.state;

    if (!session) {
      state.visibleImages = [];
      state.totalCount = 0;
      setStatus('No capture session found.', 'error');
    } else {
      state.sourceTabId = session.sourceTabId || null;
      state.sourceUrl = session.sourceUrl || '';
      state.visibleImages = normalizeImageList(
        Array.isArray(session.visibleImages) ? session.visibleImages : []
      );
      state.totalCount = Number(session.totalImagesCount || state.visibleImages.length);
    }

    rebuildImageIndex();

    if (!state.visibleImages.length && state.sourceTabId) {
      try {
        await refreshVisibleImages({ retries: 2 });
      } catch {
        // Keep empty state; user can still toggle to all images.
      }
    }

    ui.sourceLabel.textContent = getSourceLabel(state.sourceUrl);

    const orgResponse = await runtimeMessage({ action: ACTIONS.getDreamlabOrgData });
    if (orgResponse?.success) {
      state.workspaces = Array.isArray(orgResponse.workspaces) ? orgResponse.workspaces : [];
      state.projects = Array.isArray(orgResponse.projects) ? orgResponse.projects : [];
      state.collections = Array.isArray(orgResponse.collections) ? orgResponse.collections : [];
      state.destination = orgResponse.destination && typeof orgResponse.destination === 'object'
        ? orgResponse.destination
        : { workspaceId: null, collectionId: null };
      state.activeContext = orgResponse.activeContext && typeof orgResponse.activeContext === 'object'
        ? orgResponse.activeContext
        : {};
      state.appBuildId = typeof orgResponse.appBuildId === 'string' ? orgResponse.appBuildId : '';
      if (state.appBuildId) {
        console.info('[MultiSelect] Connected Dreamlab app build:', state.appBuildId);
      }
      hydrateDestinationSelectors();
      setStatus('');
    } else {
      hydrateDestinationSelectors();
      setStatus(orgResponse?.error || 'Open Dreamlab to load workspace targets.', 'error');
    }

    renderImages();
  } catch (error) {
    setStatus(error?.message || 'Failed to initialize image review.', 'error');
    renderImages();
  }
}

async function refreshVisibleImages({ retries = 1 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await runtimeMessage({
        action: ACTIONS.scanSourceImages,
        sourceTabId: state.sourceTabId,
        scope: 'visible_with_total',
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Could not scan visible images.');
      }

      state.visibleImages = normalizeImageList(
        Array.isArray(response.visibleImages) ? response.visibleImages : []
      );
      if (!state.allImages.length && Array.isArray(response.images) && response.images.length > 0) {
        state.allImages = normalizeImageList(response.images);
      }

      state.totalCount = Number(response.totalCount || state.visibleImages.length);
      if (response.sourceUrl) {
        state.sourceUrl = response.sourceUrl;
        ui.sourceLabel.textContent = getSourceLabel(state.sourceUrl);
      }
      rebuildImageIndex();
      return;
    } catch (error) {
      lastError = error;
      await delay(180 + attempt * 220);
    }
  }
  if (lastError) throw lastError;
}

async function toggleImageScope() {
  if (state.showingAll) {
    state.showingAll = false;
    renderImages();
    return;
  }

  if (!state.allImages.length) {
    try {
      setStatus('Loading all images...');
      const response = await runtimeMessage({
        action: ACTIONS.scanSourceImages,
        sourceTabId: state.sourceTabId,
        scope: 'all',
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Could not scan all images for this page.');
      }

      state.allImages = normalizeImageList(
        Array.isArray(response.images) ? response.images : []
      );
      if (response.totalCount) {
        state.totalCount = Number(response.totalCount || state.totalCount || state.visibleImages.length);
      }
      if (!state.sourceUrl) {
        state.sourceUrl = response.sourceUrl || '';
        ui.sourceLabel.textContent = getSourceLabel(state.sourceUrl);
      }
      rebuildImageIndex();
      setStatus('');
    } catch (error) {
      setStatus(error?.message || 'Could not load all images.', 'error');
      return;
    }
  }

  state.showingAll = true;
  renderImages();
}

async function saveSelectedImages() {
  const selectedImages = getSelectedImages().filter((image) => getImageAnalysis(image).selectable);
  if (!selectedImages.length || state.isSaving) {
    if (!state.isSaving) {
      setStatus('No selectable images selected.', 'error');
    }
    return;
  }

  state.isSaving = true;
  updateSelectedUi();
  setStatus(`Saving ${selectedImages.length} image${selectedImages.length === 1 ? '' : 's'}...`);

  const tags = parseTags(ui.tagsInput.value);
  const workspaceId = ui.workspaceSelect.value || null;
  const collectionId = ui.collectionSelect.value || null;

  let successCount = 0;
  let failureCount = 0;
  let firstErrorMessage = '';

  for (const image of selectedImages) {
    try {
      const analysis = getImageAnalysis(image);
      const response = await runtimeMessage({
        action: ACTIONS.saveCapturedItem,
        item: {
          type: 'image',
          content: image.src,
          sourceUrl: state.sourceUrl || '',
          workspaceId,
          projectId: null,
          collectionId,
          tags,
          description: image.alt || null,
          metadata: {
            width: analysis.width || null,
            height: analysis.height || null,
            displayWidth: toPositiveInt(image.displayWidth) || null,
            displayHeight: toPositiveInt(image.displayHeight) || null,
            alt: image.alt || null,
            className: image.className || null,
            elementId: image.elementId || null,
            resolutionTier: analysis.resolutionTier,
            imageType: analysis.primaryType,
          },
          timestamp: Date.now(),
        },
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Save failed.');
      }

      successCount += 1;
    } catch (error) {
      failureCount += 1;
      if (!firstErrorMessage) {
        firstErrorMessage = String(error?.message || 'Save failed.').trim() || 'Save failed.';
      }
    }
  }

  if (successCount > 0 && failureCount === 0) {
    setStatus(`Saved ${successCount} image${successCount === 1 ? '' : 's'} to Dreamlab.`, 'success');
    setTimeout(() => window.close(), 700);
  } else if (successCount > 0) {
    const detail = firstErrorMessage ? ` First error: ${firstErrorMessage}` : '';
    setStatus(`Saved ${successCount}, failed ${failureCount}.${detail}`, 'error');
  } else {
    const detail = firstErrorMessage ? ` ${firstErrorMessage}` : ' Verify Dreamlab is open.';
    setStatus(`No images were saved.${detail}`, 'error');
  }

  state.isSaving = false;
  updateSelectedUi();
}
