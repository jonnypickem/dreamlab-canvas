const ACTIONS = {
  ping: 'ping',
  saveCapturedItem: 'saveCapturedItem',
  getDreamlabOrgData: 'getDreamlabOrgData',
};

const STORAGE_KEYS = {
  pendingCapture: 'pendingCapture',
};

const state = {
  pendingCapture: null,
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
  ui.previewContainer = document.getElementById('preview-container');
  ui.previewText = document.getElementById('preview-text');
  ui.workspaceSelect = document.getElementById('workspace-select');
  ui.collectionSelect = document.getElementById('collection-select');
  ui.tagsInput = document.getElementById('tags-input');
  ui.saveButton = document.getElementById('save-btn');
  ui.refreshButton = document.getElementById('refresh-btn');
  ui.status = document.getElementById('status');
}

function bindEvents() {
  ui.workspaceSelect.addEventListener('change', () => {
    const workspaceId = ui.workspaceSelect.value;
    populateCollectionOptions(workspaceId, null);
  });

  ui.refreshButton.addEventListener('click', () => {
    void refreshOrganizationData({ preserveSelection: true });
  });

  ui.saveButton.addEventListener('click', () => {
    void handleSave();
  });
}

async function initialize() {
  try {
    await runtimeMessage({ action: ACTIONS.ping }, { retries: 2 });
  } catch {
    // Continue; downstream calls include retries.
  }

  await Promise.all([
    loadPendingCapture(),
    refreshOrganizationData(),
  ]);
  renderPreview();
  updateSaveButtonState();
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
          reject(new Error('Extension reloaded. Reopen the popup and try again.'));
          return;
        }

        reject(new Error(errorMessage));
        return;
      }
      resolve(response || {});
    });
  });
}

async function loadPendingCapture() {
  try {
    const data = await getStorage(STORAGE_KEYS.pendingCapture);
    state.pendingCapture = data?.[STORAGE_KEYS.pendingCapture] || null;
  } catch (error) {
    setStatus(error?.message || 'Could not read pending capture.', 'error');
  }
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

function pickValid(value, validValues, fallback = '') {
  if (value && validValues.includes(value)) return value;
  if (fallback && validValues.includes(fallback)) return fallback;
  return validValues[0] || '';
}

function hydrateDestinationSelectors(preferred = {}) {
  const workspaceOptions = state.workspaces.map((workspace) => ({
    value: workspace.id,
    label: workspace.name,
  }));
  const workspaceIds = workspaceOptions.map((option) => option.value);

  const workspaceId = pickValid(
    preferred.workspaceId,
    workspaceIds,
    state.activeContext.workspaceId
  );

  setSelectOptions(ui.workspaceSelect, workspaceOptions, 'Select workspace', workspaceId);
  ui.workspaceSelect.disabled = workspaceOptions.length === 0;

  populateCollectionOptions(
    workspaceId,
    preferred.collectionId || state.activeContext.collectionId || null
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

async function refreshOrganizationData({ preserveSelection = false } = {}) {
  const preferred = preserveSelection
    ? {
      workspaceId: ui.workspaceSelect.value || null,
      collectionId: ui.collectionSelect.value || null,
    }
    : {};

  try {
    const response = await runtimeMessage({ action: ACTIONS.getDreamlabOrgData });

    if (!response?.success) {
      setStatus(response?.error || 'Open Dreamlab in a browser tab to sync destinations.', 'error');
      state.workspaces = [];
      state.projects = [];
      state.collections = [];
      state.activeContext = {};
      hydrateDestinationSelectors(preferred);
      return;
    }

    state.workspaces = Array.isArray(response.workspaces) ? response.workspaces : [];
    state.projects = Array.isArray(response.projects) ? response.projects : [];
    state.collections = Array.isArray(response.collections) ? response.collections : [];
    state.activeContext = response.activeContext && typeof response.activeContext === 'object'
      ? response.activeContext
      : {};

    hydrateDestinationSelectors(preferred);
    setStatus('');
  } catch (error) {
    setStatus(error?.message || 'Could not load organization data.', 'error');
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncateText(value, maxLength = 140) {
  const text = String(value || '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

function renderPreview() {
  if (!state.pendingCapture) {
    ui.previewContainer.innerHTML = '<div class="preview-empty">No pending capture found.</div>';
    return;
  }

  const capture = state.pendingCapture;
  const source = capture.sourceUrl ? escapeHtml(capture.sourceUrl) : '';

  if (capture.type === 'image') {
    ui.previewContainer.innerHTML = `
      <div class="preview-meta">
        <span class="preview-type">Image Capture</span>
        <img class="preview-image" src="${escapeHtml(capture.content)}" alt="Pending capture" />
        ${source ? `<span class="preview-source">${source}</span>` : ''}
      </div>
    `;
    return;
  }

  const title = capture.title || capture.content || 'Pending capture';
  const subtitle = capture.description || capture.content || '';

  ui.previewContainer.innerHTML = `
    <div class="preview-meta">
      <span class="preview-type">${capture.type === 'text' ? 'Text Capture' : 'Link Capture'}</span>
      <span class="preview-title">${escapeHtml(truncateText(title, 120))}</span>
      ${subtitle ? `<span class="preview-subtitle">${escapeHtml(truncateText(subtitle, 180))}</span>` : ''}
      ${source ? `<span class="preview-source">${source}</span>` : ''}
    </div>
  `;
}

function parseTags(raw) {
  return String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function setStatus(message, type = '') {
  ui.status.textContent = message || '';
  ui.status.className = 'status';
  if (type === 'success') ui.status.classList.add('success');
  if (type === 'error') ui.status.classList.add('error');
}

function updateSaveButtonState() {
  ui.saveButton.disabled = !state.pendingCapture || state.isSaving;
}

async function handleSave() {
  if (!state.pendingCapture || state.isSaving) return;

  state.isSaving = true;
  updateSaveButtonState();
  setStatus('Saving capture...');

  try {
    const payload = {
      ...state.pendingCapture,
      workspaceId: ui.workspaceSelect.value || null,
      projectId: null,
      collectionId: ui.collectionSelect.value || null,
      tags: parseTags(ui.tagsInput.value),
    };

    const response = await runtimeMessage({
      action: ACTIONS.saveCapturedItem,
      item: payload,
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Could not save capture.');
    }

    await removeStorage(STORAGE_KEYS.pendingCapture);
    state.pendingCapture = null;
    ui.tagsInput.value = '';
    renderPreview();
    setStatus('Saved to Dreamlab.', 'success');
  } catch (error) {
    setStatus(error?.message || 'Could not save capture.', 'error');
  } finally {
    state.isSaving = false;
    updateSaveButtonState();
  }
}
