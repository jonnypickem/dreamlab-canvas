(() => {
  if (window !== window.top) return;
  if (!/^https?:$/i.test(window.location.protocol)) return;

  const HOST_ID = 'dreamlab-floating-widget-host';

  const BACKGROUND_ACTIONS = {
    getWidgetConfig: 'getWidgetConfig',
    executeCommand: 'executeCommand',
    getDreamlabOrgData: 'getDreamlabOrgData',
    setCaptureDestination: 'setCaptureDestination',
    openExtensionShortcuts: 'openExtensionShortcuts',
    openDreamlabSettings: 'openDreamlabSettings',
    logoutDreamlab: 'logoutDreamlab',
    setWidgetPrefs: 'setWidgetPrefs',
  };

  const DEFAULT_WIDGET_PREFS = {
    collapsed: true,
    density: 'compact',
    position: { right: 20, bottom: 20 },
  };

  const ICONS = {
    settings: '<path d="M12 3.5l1.35 1.62 2.1-.28.84 1.94 1.98.75-.28 2.1L20.5 12l-1.62 1.35.28 2.1-1.94.84-.75 1.98-2.1-.28L12 20.5l-1.35-1.62-2.1.28-.84-1.94-1.98-.75.28-2.1L3.5 12l1.62-1.35-.28-2.1 1.94-.84.75-1.98 2.1.28L12 3.5z" fill="none" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.7"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    back: '<path d="M14.5 6.5L9 12l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    savePage: '<path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M14 3v5h5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 13h6M9 17h6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    captureVisible: '<rect x="3.5" y="5" width="17" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 14l3-3 2.5 2.5L15 11l2 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    fullPage: '<rect x="4" y="4" width="16" height="16" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10h8M8 14h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    smartPicker: '<path d="M11 3l9 9-4 4-9-9 4-4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M6 15l-2 6 6-2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    pickColor: '<path d="M14.7 3.3l6 6-3.2 3.2-6-6z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M11.5 6.5L4 14a2.6 2.6 0 0 0 0 3.7 2.6 2.6 0 0 0 3.7 0l7.5-7.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M2 22h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    areaCapture: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  };

  const ACTION_ICON_BY_ID = {
    'save-page': ICONS.savePage,
    'capture-visible': ICONS.captureVisible,
    'capture-full-page': ICONS.fullPage,
    'smart-picker': ICONS.smartPicker,
    'pick-color': ICONS.pickColor,
    'area-capture': ICONS.areaCapture,
  };

  const state = {
    enabled: true,
    prefs: { ...DEFAULT_WIDGET_PREFS },
    destination: { workspaceId: null, collectionId: null },
    shortcuts: [],
    workspaces: [],
    projects: [],
    collections: [],
    activeContext: {},
    view: 'main',
    initialized: false,
  };

  const ui = {};

  let tokensCssCache = null;

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function iconSvg(pathMarkup) {
    return `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${pathMarkup}</svg>`;
  }

  function formatShortcutChip(shortcut) {
    const raw = String(shortcut || '').trim();
    if (!raw) return 'Unassigned';
    return raw
      .split('+')
      .map((part) => {
        const normalized = String(part || '').trim().toLowerCase();
        if (normalized === 'command' || normalized === 'cmd') return '⌘';
        if (normalized === 'ctrl' || normalized === 'control') return 'Ctrl';
        if (normalized === 'alt' || normalized === 'option') return '⌥';
        if (normalized === 'shift') return '⇧';
        if (normalized === 'up') return '↑';
        if (normalized === 'down') return '↓';
        if (normalized === 'left') return '←';
        if (normalized === 'right') return '→';
        return part.length === 1 ? part.toUpperCase() : part;
      })
      .join('');
  }

  function getCollectionWorkspaceId(collection, projects) {
    if (!collection || typeof collection !== 'object') return null;
    if (collection.workspaceId) return collection.workspaceId;
    if (!collection.projectId) return null;
    const project = (Array.isArray(projects) ? projects : []).find((candidate) => candidate.id === collection.projectId);
    return project?.workspaceId || null;
  }

  function getProjectName(projectId) {
    if (!projectId) return null;
    const project = state.projects.find((entry) => entry.id === projectId);
    return project?.name || null;
  }

  function formatCollectionLabel(collection) {
    const collectionName = String(collection?.name || 'Untitled').trim() || 'Untitled';
    const projectName = getProjectName(collection?.projectId);
    if (!projectName) return `Ungrouped / ${collectionName}`;
    return `${projectName} / ${collectionName}`;
  }

  function getCollectionsForWorkspace(workspaceId) {
    if (!workspaceId) return [];
    return state.collections
      .filter((collection) => getCollectionWorkspaceId(collection, state.projects) === workspaceId)
      .sort((a, b) => formatCollectionLabel(a).localeCompare(formatCollectionLabel(b), undefined, { sensitivity: 'base' }));
  }

  function setStatus(message, type = '') {
    const node = ui.status;
    const settingsNode = ui.settingsStatus;
    if (node) {
      node.textContent = message || '';
      node.className = `dlw-status ${type ? `is-${type}` : ''}`.trim();
    }
    if (settingsNode) {
      settingsNode.textContent = message || '';
      settingsNode.className = `dlw-status ${type ? `is-${type}` : ''}`.trim();
    }
  }

  function applyView() {
    if (!ui.mainView || !ui.settingsView) return;
    const showSettings = state.view === 'settings';
    ui.mainView.hidden = showSettings;
    ui.settingsView.hidden = !showSettings;
  }

  function setExpanded(expanded, options = {}) {
    const persist = options.persist !== false;
    const isCollapsed = !expanded;
    state.prefs = {
      ...state.prefs,
      collapsed: isCollapsed,
    };
    if (ui.panel) ui.panel.hidden = isCollapsed;
    if (ui.bubble) ui.bubble.hidden = !isCollapsed;
    if (expanded) {
      state.view = 'main';
      applyView();
      void refreshOrgData();
    }
    if (persist) {
      void sendBackgroundMessage({
        action: BACKGROUND_ACTIONS.setWidgetPrefs,
        prefs: state.prefs,
      });
    }
  }

  function setSelectOptions(select, options, placeholderText, selectedValue) {
    if (!select) return;
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = placeholderText;
    select.appendChild(placeholder);

    options.forEach((option) => {
      const item = document.createElement('option');
      item.value = option.value;
      item.textContent = option.label;
      select.appendChild(item);
    });

    select.value = selectedValue || '';
  }

  function renderDestinationSelectors() {
    const workspaceOptions = state.workspaces.map((workspace) => ({
      value: workspace.id,
      label: workspace.name,
    }));
    const workspaceId = state.destination.workspaceId
      || state.activeContext.workspaceId
      || workspaceOptions[0]?.value
      || '';

    setSelectOptions(ui.workspaceSelect, workspaceOptions, 'Select workspace', workspaceId);
    ui.workspaceSelect.disabled = workspaceOptions.length === 0;

    const collectionOptions = getCollectionsForWorkspace(workspaceId).map((collection) => ({
      value: collection.id,
      label: formatCollectionLabel(collection),
    }));

    const collectionIdCandidate = state.destination.collectionId || state.activeContext.collectionId || '';
    const collectionId = collectionOptions.some((entry) => entry.value === collectionIdCandidate)
      ? collectionIdCandidate
      : '';

    setSelectOptions(ui.collectionSelect, collectionOptions, 'No collection', collectionId);
    ui.collectionSelect.disabled = !workspaceId || collectionOptions.length === 0;
  }

  function renderActions() {
    if (!ui.actionsGrid) return;
    if (!Array.isArray(state.shortcuts) || state.shortcuts.length === 0) {
      ui.actionsGrid.innerHTML = '<div class="dlw-empty">No actions available.</div>';
      return;
    }

    ui.actionsGrid.innerHTML = state.shortcuts.map((entry) => {
      const actionId = entry.actionId || entry.command || '';
      const command = entry.executeCommand || entry.command || '';
      const icon = ACTION_ICON_BY_ID[actionId] || ICONS.savePage;
      return `
        <button class="dlw-action-tile" type="button" data-command="${escapeHtml(command)}" title="${escapeHtml(entry.description || entry.label || '')}">
          <span class="dlw-action-icon">${iconSvg(icon)}</span>
          <span class="dlw-action-label">${escapeHtml(entry.label || command || 'Action')}</span>
          <span class="dlw-shortcut-chip">${escapeHtml(formatShortcutChip(entry.shortcut))}</span>
        </button>
      `;
    }).join('');
  }

  async function runAction(command) {
    if (!command) return;
    setStatus('Running action...');
    const response = await sendBackgroundMessage({
      action: BACKGROUND_ACTIONS.executeCommand,
      command,
      origin: 'floating-widget',
    });
    if (!response?.success) {
      setStatus(response?.error || 'Action failed.', 'error');
      return;
    }
    setStatus('Action triggered.', 'success');
  }

  async function refreshOrgData() {
    const response = await sendBackgroundMessage({ action: BACKGROUND_ACTIONS.getDreamlabOrgData });
    if (!response?.success) {
      state.workspaces = [];
      state.projects = [];
      state.collections = [];
      state.activeContext = {};
      renderDestinationSelectors();
      setStatus(response?.error || 'Open Dreamlab to load destinations.', 'error');
      return;
    }

    state.workspaces = Array.isArray(response.workspaces) ? response.workspaces : [];
    state.projects = Array.isArray(response.projects) ? response.projects : [];
    state.collections = Array.isArray(response.collections) ? response.collections : [];
    state.activeContext = response.activeContext && typeof response.activeContext === 'object'
      ? response.activeContext
      : {};
    renderDestinationSelectors();
    setStatus('');
  }

  async function persistDestination(workspaceId, collectionId) {
    const destination = {
      workspaceId: workspaceId || null,
      collectionId: collectionId || null,
    };
    const response = await sendBackgroundMessage({
      action: BACKGROUND_ACTIONS.setCaptureDestination,
      destination,
    });
    if (!response?.success) {
      setStatus(response?.error || 'Could not save destination.', 'error');
      return;
    }
    state.destination = response.destination || destination;
    setStatus('Destination updated.', 'success');
  }

  async function loadTokensCssText() {
    if (tokensCssCache) return tokensCssCache;
    try {
      const url = chrome.runtime.getURL('extension-design-tokens.css');
      const response = await fetch(url);
      if (response.ok) {
        tokensCssCache = await response.text();
        return tokensCssCache;
      }
    } catch {
      // Fall through to inline fallback.
    }
    tokensCssCache = `:host{--dl-brand-primary:#ea580c;--dl-brand-primary-strong:#c2410c;--dl-brand-soft:#fff7ed;--dl-neutral-0:#fff;--dl-neutral-25:#fcfcfd;--dl-neutral-50:#fafafa;--dl-neutral-100:#f5f5f5;--dl-neutral-200:#e5e5e5;--dl-neutral-300:#d4d4d4;--dl-neutral-500:#737373;--dl-neutral-700:#404040;--dl-neutral-900:#171717;--dl-success-600:#16a34a;--dl-error-600:#dc2626;--dl-radius-sm:6px;--dl-radius-md:8px;--dl-radius-pill:999px;--dl-shadow-sm:0 1px 2px rgba(23,23,23,.08);--dl-shadow-lg:0 14px 36px rgba(23,23,23,.24);--dl-focus-ring:0 0 0 3px rgba(234,88,12,.18);} `;
    return tokensCssCache;
  }

  function widgetCss() {
    return `
      :host {
        all: initial;
        position: fixed;
        right: var(--dlw-right, 20px);
        bottom: var(--dlw-bottom, 20px);
        z-index: 2147483644;
        pointer-events: none;
        font-family: Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
      .dlw-shell { display: flex; align-items: flex-end; gap: 8px; pointer-events: none; }
      .dlw-bubble {
        pointer-events: auto;
        width: 44px;
        height: 44px;
        border-radius: var(--dl-radius-pill);
        border: 1px solid var(--dl-neutral-200);
        background: var(--dl-neutral-0);
        color: var(--dl-brand-primary);
        font-size: 12px;
        font-weight: 700;
        letter-spacing: .02em;
        cursor: pointer;
        box-shadow: var(--dl-shadow-sm);
      }
      .dlw-bubble:hover { border-color: var(--dl-brand-primary); background: var(--dl-brand-soft); }
      .dlw-panel {
        pointer-events: auto;
        width: 344px;
        border-radius: var(--dl-radius-md);
        border: 1px solid var(--dl-neutral-200);
        background: var(--dl-neutral-25);
        color: var(--dl-neutral-900);
        box-shadow: var(--dl-shadow-lg);
        overflow: hidden;
      }
      .dlw-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 12px 8px;
      }
      .dlw-title {
        margin: 0;
        font-size: 20px;
        line-height: 1;
        font-weight: 700;
        letter-spacing: -0.01em;
        color: var(--dl-neutral-900);
      }
      .dlw-header-actions { display: inline-flex; align-items: center; gap: 4px; }
      .dlw-icon-btn {
        width: 28px;
        height: 28px;
        border-radius: var(--dl-radius-sm);
        border: 1px solid var(--dl-neutral-200);
        background: var(--dl-neutral-0);
        color: var(--dl-neutral-700);
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .dlw-icon-btn:hover { border-color: var(--dl-brand-primary); color: var(--dl-brand-primary); background: var(--dl-brand-soft); }
      .dlw-icon-btn:focus-visible { outline: none; box-shadow: var(--dl-focus-ring); }
      .dlw-icon-btn svg { width: 14px; height: 14px; }
      .dlw-view { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 12px; }
      .dlw-actions-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .dlw-action-tile {
        border: 1px solid var(--dl-neutral-200);
        border-radius: var(--dl-radius-md);
        min-height: 80px;
        padding: 8px 6px;
        background: var(--dl-neutral-100);
        color: var(--dl-neutral-700);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        text-align: center;
        cursor: pointer;
      }
      .dlw-action-tile:hover { border-color: var(--dl-brand-primary); background: var(--dl-brand-soft); color: var(--dl-neutral-900); }
      .dlw-action-tile:focus-visible { outline: none; box-shadow: var(--dl-focus-ring); }
      .dlw-action-icon svg { width: 16px; height: 16px; }
      .dlw-action-label { font-size: 10px; line-height: 1.2; font-weight: 600; }
      .dlw-shortcut-chip {
        font-size: 10px;
        line-height: 1;
        font-weight: 650;
        color: var(--dl-brand-primary);
      }
      .dlw-field { display: flex; flex-direction: column; gap: 6px; }
      .dlw-label {
        font-size: 11px;
        line-height: 1;
        letter-spacing: .04em;
        text-transform: uppercase;
        font-weight: 700;
        color: var(--dl-neutral-500);
      }
      .dlw-select-wrap { position: relative; }
      .dlw-select-dot {
        position: absolute;
        left: 12px;
        top: 50%;
        transform: translateY(-50%);
        width: 10px;
        height: 10px;
        border-radius: var(--dl-radius-pill);
        pointer-events: none;
      }
      .dlw-select-dot.workspace { background: #f2cf62; }
      .dlw-select-dot.collection { background: #c177ee; }
      .dlw-select {
        appearance: none;
        width: 100%;
        min-height: 36px;
        border-radius: var(--dl-radius-pill);
        border: 1px solid var(--dl-neutral-200);
        background: var(--dl-neutral-0);
        color: var(--dl-neutral-900);
        padding: 8px 14px 8px 34px;
        font-size: 14px;
        line-height: 1.2;
        font-weight: 600;
      }
      .dlw-select:focus-visible { outline: none; box-shadow: var(--dl-focus-ring); border-color: var(--dl-brand-primary); }
      .dlw-select:disabled { color: var(--dl-neutral-500); background: var(--dl-neutral-50); }
      .dlw-status {
        min-height: 16px;
        font-size: 11px;
        line-height: 1.3;
        color: var(--dl-neutral-500);
      }
      .dlw-status.is-success { color: var(--dl-success-600); }
      .dlw-status.is-error { color: var(--dl-error-600); }
      .dlw-empty {
        grid-column: 1 / -1;
        border: 1px dashed var(--dl-neutral-300);
        border-radius: var(--dl-radius-md);
        background: var(--dl-neutral-50);
        color: var(--dl-neutral-500);
        font-size: 11px;
        line-height: 1.4;
        padding: 10px;
        text-align: center;
      }
      .dlw-settings-actions { display: flex; flex-direction: column; gap: 8px; }
      .dlw-settings-btn {
        width: 100%;
        border: 1px solid var(--dl-neutral-200);
        border-radius: var(--dl-radius-md);
        background: var(--dl-neutral-0);
        color: var(--dl-neutral-700);
        min-height: 34px;
        text-align: left;
        padding: 8px 10px;
        font-size: 12px;
        line-height: 1.2;
        font-weight: 600;
        cursor: pointer;
      }
      .dlw-settings-btn:hover { border-color: var(--dl-brand-primary); background: var(--dl-brand-soft); color: var(--dl-neutral-900); }
      .dlw-settings-btn:focus-visible { outline: none; box-shadow: var(--dl-focus-ring); }
      .dlw-settings-btn.destructive { border-color: rgba(220, 38, 38, 0.25); color: var(--dl-error-600); }
    `;
  }

  async function mountWidget() {
    if (ui.host) return;

    const host = document.createElement('div');
    host.id = HOST_ID;
    document.documentElement.appendChild(host);
    const shadowRoot = host.attachShadow({ mode: 'open' });

    const tokensStyle = document.createElement('style');
    tokensStyle.textContent = await loadTokensCssText();
    shadowRoot.appendChild(tokensStyle);

    const style = document.createElement('style');
    style.textContent = widgetCss();
    shadowRoot.appendChild(style);

    const shell = document.createElement('div');
    shell.className = 'dlw-shell';
    shell.innerHTML = `
      <button class="dlw-bubble" type="button" aria-label="Open Dreamlab Capture widget">DL</button>
      <section class="dlw-panel" hidden>
        <header class="dlw-header">
          <h2 class="dlw-title">Dreamlab Capture</h2>
          <div class="dlw-header-actions">
            <button class="dlw-icon-btn" type="button" data-role="settings-toggle" aria-label="Open widget settings">${iconSvg(ICONS.settings)}</button>
            <button class="dlw-icon-btn" type="button" data-role="collapse" aria-label="Collapse widget">${iconSvg(ICONS.close)}</button>
          </div>
        </header>
        <div class="dlw-view" data-view="main">
          <div class="dlw-actions-grid" data-role="actions-grid"></div>
          <div class="dlw-field">
            <span class="dlw-label">Workspace</span>
            <div class="dlw-select-wrap">
              <span class="dlw-select-dot workspace" aria-hidden="true"></span>
              <select class="dlw-select" data-role="workspace-select"></select>
            </div>
          </div>
          <div class="dlw-field">
            <span class="dlw-label">Collection</span>
            <div class="dlw-select-wrap">
              <span class="dlw-select-dot collection" aria-hidden="true"></span>
              <select class="dlw-select" data-role="collection-select"></select>
            </div>
          </div>
          <div class="dlw-status" data-role="status"></div>
        </div>
        <div class="dlw-view" data-view="settings" hidden>
          <div class="dlw-header-actions">
            <button class="dlw-icon-btn" type="button" data-role="settings-back" aria-label="Back to capture actions">${iconSvg(ICONS.back)}</button>
          </div>
          <div class="dlw-settings-actions">
            <button class="dlw-settings-btn" type="button" data-role="open-shortcuts">Shortcut Settings</button>
            <button class="dlw-settings-btn" type="button" data-role="open-workspace-settings">Workspace Settings</button>
            <button class="dlw-settings-btn" type="button" data-role="open-account-settings">Account</button>
            <button class="dlw-settings-btn" type="button" data-role="reset-destination">Reset Destination</button>
            <button class="dlw-settings-btn destructive" type="button" data-role="logout">Log out</button>
            <button class="dlw-settings-btn" type="button" data-role="reset-widget">Reset Widget Layout</button>
          </div>
          <div class="dlw-status" data-role="settings-status"></div>
        </div>
      </section>
    `;
    shadowRoot.appendChild(shell);

    ui.host = host;
    ui.shadowRoot = shadowRoot;
    ui.shell = shell;
    ui.bubble = shadowRoot.querySelector('.dlw-bubble');
    ui.panel = shadowRoot.querySelector('.dlw-panel');
    ui.mainView = shadowRoot.querySelector('[data-view="main"]');
    ui.settingsView = shadowRoot.querySelector('[data-view="settings"]');
    ui.actionsGrid = shadowRoot.querySelector('[data-role="actions-grid"]');
    ui.workspaceSelect = shadowRoot.querySelector('[data-role="workspace-select"]');
    ui.collectionSelect = shadowRoot.querySelector('[data-role="collection-select"]');
    ui.status = shadowRoot.querySelector('[data-role="status"]');
    ui.settingsStatus = shadowRoot.querySelector('[data-role="settings-status"]');

    ui.bubble.addEventListener('click', () => setExpanded(true));
    shadowRoot.querySelector('[data-role="collapse"]').addEventListener('click', () => setExpanded(false));

    shadowRoot.querySelector('[data-role="settings-toggle"]').addEventListener('click', () => {
      state.view = 'settings';
      applyView();
      setStatus('');
    });

    shadowRoot.querySelector('[data-role="settings-back"]').addEventListener('click', () => {
      state.view = 'main';
      applyView();
      setStatus('');
    });

    ui.actionsGrid.addEventListener('click', (event) => {
      const target = event.target?.closest?.('[data-command]');
      if (!target) return;
      const command = target.getAttribute('data-command');
      if (!command) return;
      void runAction(command);
    });

    ui.workspaceSelect.addEventListener('change', () => {
      state.destination = {
        ...state.destination,
        workspaceId: ui.workspaceSelect.value || null,
        collectionId: null,
      };
      renderDestinationSelectors();
      void persistDestination(ui.workspaceSelect.value || null, null);
    });

    ui.collectionSelect.addEventListener('change', () => {
      state.destination = {
        ...state.destination,
        workspaceId: ui.workspaceSelect.value || null,
        collectionId: ui.collectionSelect.value || null,
      };
      void persistDestination(ui.workspaceSelect.value || null, ui.collectionSelect.value || null);
    });

    shadowRoot.querySelector('[data-role="open-shortcuts"]').addEventListener('click', async () => {
      const response = await sendBackgroundMessage({ action: BACKGROUND_ACTIONS.openExtensionShortcuts });
      setStatus(response?.success ? 'Opened extension shortcut settings.' : (response?.error || 'Could not open shortcut settings.'), response?.success ? 'success' : 'error');
    });

    shadowRoot.querySelector('[data-role="open-workspace-settings"]').addEventListener('click', async () => {
      const response = await sendBackgroundMessage({
        action: BACKGROUND_ACTIONS.openDreamlabSettings,
        initialTab: 'general',
      });
      setStatus(response?.success ? 'Opened workspace settings.' : (response?.error || 'Could not open workspace settings.'), response?.success ? 'success' : 'error');
    });

    shadowRoot.querySelector('[data-role="open-account-settings"]').addEventListener('click', async () => {
      const response = await sendBackgroundMessage({
        action: BACKGROUND_ACTIONS.openDreamlabSettings,
        initialTab: 'account',
      });
      setStatus(response?.success ? 'Opened account settings.' : (response?.error || 'Could not open account settings.'), response?.success ? 'success' : 'error');
    });

    shadowRoot.querySelector('[data-role="reset-destination"]').addEventListener('click', async () => {
      const response = await sendBackgroundMessage({
        action: BACKGROUND_ACTIONS.setCaptureDestination,
        destination: { workspaceId: null, collectionId: null },
      });
      if (response?.success) {
        state.destination = response.destination || { workspaceId: null, collectionId: null };
        await refreshOrgData();
      }
      setStatus(response?.success ? 'Destination reset to active context.' : (response?.error || 'Could not reset destination.'), response?.success ? 'success' : 'error');
    });

    shadowRoot.querySelector('[data-role="logout"]').addEventListener('click', async () => {
      const response = await sendBackgroundMessage({ action: BACKGROUND_ACTIONS.logoutDreamlab });
      setStatus(response?.success ? 'Logged out from Dreamlab.' : (response?.error || 'Could not log out.'), response?.success ? 'success' : 'error');
    });

    shadowRoot.querySelector('[data-role="reset-widget"]').addEventListener('click', async () => {
      state.prefs = {
        ...DEFAULT_WIDGET_PREFS,
        position: { ...DEFAULT_WIDGET_PREFS.position },
      };
      const response = await sendBackgroundMessage({
        action: BACKGROUND_ACTIONS.setWidgetPrefs,
        prefs: state.prefs,
      });
      if (response?.success && response.prefs) {
        state.prefs = {
          ...response.prefs,
          position: {
            ...DEFAULT_WIDGET_PREFS.position,
            ...(response.prefs.position || {}),
          },
        };
      }
      applyPosition();
      setExpanded(false, { persist: true });
      setStatus(response?.success ? 'Widget layout reset.' : (response?.error || 'Could not reset widget layout.'), response?.success ? 'success' : 'error');
    });
  }

  function teardownWidget() {
    if (!ui.host) return;
    ui.host.remove();
    Object.keys(ui).forEach((key) => {
      delete ui[key];
    });
  }

  function applyPosition() {
    if (!ui.host) return;
    const right = Number(state?.prefs?.position?.right);
    const bottom = Number(state?.prefs?.position?.bottom);
    ui.host.style.setProperty('--dlw-right', `${Number.isFinite(right) ? right : DEFAULT_WIDGET_PREFS.position.right}px`);
    ui.host.style.setProperty('--dlw-bottom', `${Number.isFinite(bottom) ? bottom : DEFAULT_WIDGET_PREFS.position.bottom}px`);
  }

  async function refreshWidgetState() {
    const response = await sendBackgroundMessage({ action: BACKGROUND_ACTIONS.getWidgetConfig });
    if (!response?.success) {
      setStatus(response?.error || 'Could not load widget config.', 'error');
      return;
    }

    state.enabled = response.enabled !== false;
    state.prefs = {
      ...DEFAULT_WIDGET_PREFS,
      ...(response.prefs || {}),
      position: {
        ...DEFAULT_WIDGET_PREFS.position,
        ...((response.prefs || {}).position || {}),
      },
    };
    state.destination = response.destination || { workspaceId: null, collectionId: null };
    state.shortcuts = Array.isArray(response.shortcuts) ? response.shortcuts : [];

    if (!state.enabled) {
      teardownWidget();
      return;
    }

    await mountWidget();
    applyPosition();
    renderActions();
    applyView();

    if (state.prefs.collapsed) {
      setExpanded(false, { persist: false });
    } else {
      setExpanded(true, { persist: false });
    }

    await refreshOrgData();
  }

  function registerStorageListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (Object.prototype.hasOwnProperty.call(changes, 'widgetEnabled')) {
        void refreshWidgetState();
        return;
      }
      if (Object.prototype.hasOwnProperty.call(changes, 'captureDestination')) {
        const nextValue = changes.captureDestination?.newValue || { workspaceId: null, collectionId: null };
        state.destination = nextValue;
        renderDestinationSelectors();
      }
      if (Object.prototype.hasOwnProperty.call(changes, 'floatingWidgetPrefs')) {
        const nextPrefs = changes.floatingWidgetPrefs?.newValue || DEFAULT_WIDGET_PREFS;
        state.prefs = {
          ...DEFAULT_WIDGET_PREFS,
          ...nextPrefs,
          position: {
            ...DEFAULT_WIDGET_PREFS.position,
            ...(nextPrefs.position || {}),
          },
        };
        applyPosition();
      }
    });
  }

  async function initialize() {
    if (state.initialized) return;
    state.initialized = true;
    registerStorageListener();
    await refreshWidgetState();
  }

  void initialize();
})();
