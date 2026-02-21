const ACTIONS = {
  ping: 'ping',
  saveCapturedItem: 'saveCapturedItem',
  getDreamlabOrgData: 'getDreamlabOrgData',
  getMultiSelectState: 'getMultiSelectState',
  scanSourceImages: 'scanSourceImages',
};

const state = {
  sourceTabId: null,
  sourceUrl: '',
  visibleImages: [],
  allImages: [],
  showingAll: false,
  resolutionFilter: 'any',
  selected: new Set(),
  workspaces: [],
  projects: [],
  collections: [],
  activeContext: {},
  appBuildId: '',
  isSaving: false,
};

const ui = {};

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

  ui.workspaceSelect = document.getElementById('workspaceSelect');
  ui.collectionSelect = document.getElementById('collectionSelect');
  ui.tagsInput = document.getElementById('tagsInput');
  ui.resolutionSelect = document.getElementById('resolutionSelect');
}

function bindEvents() {
  ui.closeButton.addEventListener('click', () => window.close());
  ui.cancelButton.addEventListener('click', () => window.close());

  ui.toggleViewButton.addEventListener('click', () => {
    void toggleImageScope();
  });

  ui.selectAllButton.addEventListener('click', () => {
    getCurrentImages().forEach((image) => state.selected.add(image.key));
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
    state.resolutionFilter = ui.resolutionSelect.value || 'any';
    renderImages();
  });

  ui.saveButton.addEventListener('click', () => {
    void saveSelectedImages();
  });

  ui.imageGrid.addEventListener('click', (event) => {
    const checkbox = event.target.closest('.image-checkbox');
    if (checkbox) {
      event.stopPropagation();
      toggleSelected(checkbox.dataset.imageKey);
      return;
    }

    const card = event.target.closest('.image-card');
    if (!card || !ui.imageGrid.contains(card)) return;
    toggleSelected(card.dataset.imageKey);
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

function normalizeImageList(images = []) {
  const srcCounts = new Map();
  const normalized = [];

  images.forEach((image) => {
    const src = typeof image?.src === 'string' ? image.src.trim() : '';
    if (!src) return;
    const width = Number(image?.width || image?.displayWidth || 0);
    const height = Number(image?.height || image?.displayHeight || 0);
    const hasSizeHint = Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0;
    if (!hasSizeHint && !isLikelyRenderableImageUrl(src)) return;

    const count = (srcCounts.get(src) || 0) + 1;
    srcCounts.set(src, count);

    normalized.push({
      ...image,
      src,
      key: `${src}#${count}`,
    });
  });

  return normalized;
}

function hydrateDestinationSelectors() {
  const workspaceOptions = state.workspaces.map((workspace) => ({
    value: workspace.id,
    label: workspace.name,
  }));
  const workspaceIds = workspaceOptions.map((option) => option.value);

  const workspaceId = pickValid(
    state.activeContext.workspaceId,
    workspaceIds,
    null
  );

  setSelectOptions(ui.workspaceSelect, workspaceOptions, 'Select workspace', workspaceId);
  ui.workspaceSelect.disabled = workspaceOptions.length === 0;

  populateCollectionOptions(workspaceId, state.activeContext.collectionId || null);
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

function getCurrentImages() {
  const source = state.showingAll ? state.allImages : state.visibleImages;
  return source.filter((image) => imageMatchesResolution(image, state.resolutionFilter));
}

function getImageDimensions(image) {
  const width = Number(image?.width || image?.displayWidth || 0);
  const height = Number(image?.height || image?.displayHeight || 0);
  return {
    width: Number.isFinite(width) && width > 0 ? width : 0,
    height: Number.isFinite(height) && height > 0 ? height : 0,
  };
}

function imageMatchesResolution(image, filter = 'any') {
  if (filter === 'any') return true;

  const { width, height } = getImageDimensions(image);
  if (filter === 'known') return width > 0 && height > 0;
  if (width <= 0 || height <= 0) return false;

  const maxDimension = Math.max(width, height);
  if (filter === 'sm') return maxDimension >= 400;
  if (filter === 'md') return maxDimension >= 800;
  if (filter === 'lg') return maxDimension >= 1200;
  if (filter === 'xl') return maxDimension >= 1600;
  return true;
}

function updateScopeUi() {
  ui.visibleCount.textContent = String(state.visibleImages.length);

  const totalCount = state.allImages.length > 0
    ? state.allImages.length
    : Number(state.totalCount || state.visibleImages.length);

  ui.totalCount.textContent = String(totalCount);

  ui.toggleViewButton.textContent = state.showingAll
    ? 'Show visible only'
    : 'Show all images';
}

function updateSelectedUi() {
  ui.selectedCount.textContent = String(state.selected.size);
  ui.saveButton.disabled = state.selected.size === 0 || state.isSaving;
}

function getImageSizeLabel(image) {
  const { width, height } = getImageDimensions(image);
  if (!width || !height) return '';
  return `${Math.round(width)}×${Math.round(height)}`;
}

function createImageCard(image) {
  const card = document.createElement('div');
  card.className = `image-card${state.selected.has(image.key) ? ' selected' : ''}`;
  card.setAttribute('role', 'listitem');
  card.dataset.imageKey = image.key;

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
  checkWrap.className = 'check-wrap';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'image-checkbox';
  checkbox.checked = state.selected.has(image.key);
  checkbox.dataset.imageKey = image.key;

  checkWrap.appendChild(checkbox);
  card.appendChild(imageElement);
  card.appendChild(checkWrap);

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
  updateSelectedUi();
}

function toggleSelected(imageKey) {
  if (!imageKey) return;
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

    const sessionResponse = await runtimeMessage({ action: ACTIONS.getMultiSelectState });
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

    if (!state.visibleImages.length && state.sourceTabId) {
      try {
        await refreshVisibleImages({ retries: 2 });
      } catch {
        // Keep empty state; user can still toggle to all images.
      }
    }

    ui.sourceLabel.textContent = getSourceLabel(state.sourceUrl);
    renderImages();

    const orgResponse = await runtimeMessage({ action: ACTIONS.getDreamlabOrgData });
    if (orgResponse?.success) {
      state.workspaces = Array.isArray(orgResponse.workspaces) ? orgResponse.workspaces : [];
      state.projects = Array.isArray(orgResponse.projects) ? orgResponse.projects : [];
      state.collections = Array.isArray(orgResponse.collections) ? orgResponse.collections : [];
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
      state.totalCount = Number(response.totalCount || state.visibleImages.length);
      if (response.sourceUrl) {
        state.sourceUrl = response.sourceUrl;
        ui.sourceLabel.textContent = getSourceLabel(state.sourceUrl);
      }
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
      if (!state.sourceUrl) {
        state.sourceUrl = response.sourceUrl || '';
        ui.sourceLabel.textContent = getSourceLabel(state.sourceUrl);
      }
      setStatus('');
    } catch (error) {
      setStatus(error?.message || 'Could not load all images.', 'error');
      return;
    }
  }

  state.showingAll = true;
  renderImages();
}

function getSelectedImages() {
  const imageMap = new Map();
  [...state.visibleImages, ...state.allImages].forEach((image) => {
    if (!imageMap.has(image.key)) imageMap.set(image.key, image);
  });

  const selectedImages = [];
  state.selected.forEach((imageKey) => {
    const image = imageMap.get(imageKey);
    if (image) selectedImages.push(image);
  });

  return selectedImages;
}

async function saveSelectedImages() {
  const selectedImages = getSelectedImages();
  if (!selectedImages.length || state.isSaving) return;

  state.isSaving = true;
  updateSelectedUi();
  setStatus(`Saving ${selectedImages.length} image${selectedImages.length === 1 ? '' : 's'}...`);

  const tags = parseTags(ui.tagsInput.value);
  const workspaceId = ui.workspaceSelect.value || null;
  const collectionId = ui.collectionSelect.value || null;

  let successCount = 0;
  let failureCount = 0;

  for (const image of selectedImages) {
    try {
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
            width: image.width || null,
            height: image.height || null,
            displayWidth: image.displayWidth || null,
            displayHeight: image.displayHeight || null,
            alt: image.alt || null,
          },
          timestamp: Date.now(),
        },
      });

      if (!response?.success) {
        throw new Error(response?.error || 'Save failed.');
      }

      successCount += 1;
    } catch {
      failureCount += 1;
    }
  }

  if (successCount > 0 && failureCount === 0) {
    setStatus(`Saved ${successCount} image${successCount === 1 ? '' : 's'} to Dreamlab.`, 'success');
    setTimeout(() => window.close(), 700);
  } else if (successCount > 0) {
    setStatus(`Saved ${successCount}, failed ${failureCount}.`, 'error');
  } else {
    setStatus('No images were saved. Verify Dreamlab is open.', 'error');
  }

  state.isSaving = false;
  updateSelectedUi();
}
