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
  selected: new Set(),
  workspaces: [],
  projects: [],
  collections: [],
  activeContext: {},
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
}

function bindEvents() {
  ui.closeButton.addEventListener('click', () => window.close());
  ui.cancelButton.addEventListener('click', () => window.close());

  ui.toggleViewButton.addEventListener('click', () => {
    void toggleImageScope();
  });

  ui.selectAllButton.addEventListener('click', () => {
    getCurrentImages().forEach((image) => state.selected.add(image.src));
    renderImages();
  });

  ui.deselectAllButton.addEventListener('click', () => {
    state.selected.clear();
    renderImages();
  });

  ui.workspaceSelect.addEventListener('change', () => {
    populateCollectionOptions(ui.workspaceSelect.value, null);
  });

  ui.saveButton.addEventListener('click', () => {
    void saveSelectedImages();
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
    label: collection.name,
  }));
  const collectionIds = collectionOptions.map((option) => option.value);

  const collectionId = pickValid(preferredCollectionId, collectionIds, null);

  setSelectOptions(ui.collectionSelect, collectionOptions, 'No collection', collectionId);
  ui.collectionSelect.disabled = !workspaceId || collectionOptions.length === 0;
}

function getCurrentImages() {
  return state.showingAll ? state.allImages : state.visibleImages;
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
  const width = Number(image?.width || image?.displayWidth || 0);
  const height = Number(image?.height || image?.displayHeight || 0);
  if (!width || !height) return '';
  return `${Math.round(width)}×${Math.round(height)}`;
}

function createImageCard(image) {
  const card = document.createElement('div');
  card.className = `image-card${state.selected.has(image.src) ? ' selected' : ''}`;
  card.setAttribute('role', 'listitem');

  const imageElement = document.createElement('img');
  imageElement.src = image.src;
  imageElement.alt = image.alt || 'Captured image';
  imageElement.loading = 'lazy';
  imageElement.draggable = false;

  imageElement.addEventListener('error', () => {
    card.remove();
    if (ui.imageGrid.children.length === 0) {
      ui.emptyState.hidden = false;
    }
  });

  const checkWrap = document.createElement('div');
  checkWrap.className = 'check-wrap';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'image-checkbox';
  checkbox.checked = state.selected.has(image.src);

  checkbox.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleSelected(image.src);
  });

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

  card.addEventListener('click', () => {
    toggleSelected(image.src);
  });

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

function toggleSelected(sourceUrl) {
  if (state.selected.has(sourceUrl)) {
    state.selected.delete(sourceUrl);
  } else {
    state.selected.add(sourceUrl);
  }
  renderImages();
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
      state.visibleImages = Array.isArray(session.visibleImages) ? session.visibleImages : [];
      state.totalCount = Number(session.totalImagesCount || state.visibleImages.length);
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

      state.allImages = Array.isArray(response.images) ? response.images : [];
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
    if (!imageMap.has(image.src)) imageMap.set(image.src, image);
  });

  const selectedImages = [];
  state.selected.forEach((sourceUrl) => {
    const image = imageMap.get(sourceUrl);
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
