const ACTIONS = {
  ping: 'ping',
  getWidgetConfig: 'getWidgetConfig',
  setWidgetEnabled: 'setWidgetEnabled',
  openExtensionOptions: 'openExtensionOptions',
  getComplianceState: 'getComplianceState',
  getPrivacySummary: 'getPrivacySummary',
  openComplianceDoc: 'openComplianceDoc',
};

const ui = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  bindEvents();
  void initialize();
});

function cacheDom() {
  ui.widgetEnabled = document.getElementById('widget-enabled');
  ui.status = document.getElementById('status');
  ui.openWidgetSettings = document.getElementById('open-widget-settings');
  ui.hostAccess = document.getElementById('host-access');
  ui.captureModel = document.getElementById('capture-model');
  ui.openPrivacyDoc = document.getElementById('open-privacy-doc');
  ui.openComplianceDoc = document.getElementById('open-compliance-doc');
}

function bindEvents() {
  ui.widgetEnabled?.addEventListener('change', () => {
    void updateWidgetToggle(ui.widgetEnabled.checked);
  });
  ui.openWidgetSettings?.addEventListener('click', () => {
    void openWidgetSettings();
  });
  ui.openPrivacyDoc?.addEventListener('click', () => {
    void openComplianceDoc('privacy');
  });
  ui.openComplianceDoc?.addEventListener('click', () => {
    void openComplianceDoc('compliance');
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
        reject(new Error(errorMessage));
        return;
      }
      resolve(response || {});
    });
  });
}

function setStatus(message, type = '') {
  if (!ui.status) return;
  ui.status.textContent = message || '';
  ui.status.className = 'status';
  if (type === 'success') ui.status.classList.add('success');
  if (type === 'error') ui.status.classList.add('error');
}

async function initialize() {
  try {
    await runtimeMessage({ action: ACTIONS.ping }, { retries: 2 });
  } catch {
    // Continue with config fetch below.
  }

  try {
    const widgetResponse = await runtimeMessage({ action: ACTIONS.getWidgetConfig });

    if (!widgetResponse?.success) {
      throw new Error(widgetResponse?.error || 'Could not load widget state.');
    }
    ui.widgetEnabled.checked = widgetResponse.enabled !== false;
    const [complianceResponse, privacyResponse] = await Promise.all([
      runtimeMessage({ action: ACTIONS.getComplianceState }).catch(() => null),
      runtimeMessage({ action: ACTIONS.getPrivacySummary }).catch(() => null),
    ]);
    renderDisclosure(complianceResponse?.compliance, privacyResponse?.privacy);
    setStatus('Widget state and disclosure loaded.');
  } catch (error) {
    setStatus(error?.message || 'Could not load widget state.', 'error');
  }
}

function renderDisclosure(compliance, privacy) {
  const allSites = compliance?.allSitesAccessRequired === true;
  const captureModel = String(privacy?.captureModel || '').toLowerCase();
  if (ui.hostAccess) {
    ui.hostAccess.textContent = allSites
      ? 'Site access: enabled on all websites by required host permission.'
      : 'Site access: restricted host access.';
  }
  if (ui.captureModel) {
    ui.captureModel.textContent = captureModel === 'user_triggered'
      ? 'Capture model: content is only captured and transmitted after user actions.'
      : 'Capture model: verify runtime capture trigger conditions.';
  }
}

async function updateWidgetToggle(enabled) {
  setStatus('Updating widget setting...');
  try {
    const response = await runtimeMessage({
      action: ACTIONS.setWidgetEnabled,
      enabled,
    });
    if (!response?.success) {
      throw new Error(response?.error || 'Could not update widget setting.');
    }
    ui.widgetEnabled.checked = response.enabled !== false;
    setStatus(response.enabled ? 'Floating widget enabled.' : 'Floating widget disabled.', 'success');
  } catch (error) {
    ui.widgetEnabled.checked = !enabled;
    setStatus(error?.message || 'Could not update widget setting.', 'error');
  }
}

async function openWidgetSettings() {
  setStatus('Opening widget settings...');
  try {
    const response = await runtimeMessage({ action: ACTIONS.openExtensionOptions });
    if (!response?.success) {
      throw new Error(response?.error || 'Could not open widget settings.');
    }
    setStatus('Widget settings opened.', 'success');
  } catch (error) {
    setStatus(error?.message || 'Could not open widget settings.', 'error');
  }
}

async function openComplianceDoc(docType) {
  setStatus('Opening documentation...');
  try {
    const response = await runtimeMessage({
      action: ACTIONS.openComplianceDoc,
      docType,
    });
    if (!response?.success) {
      throw new Error(response?.error || 'Could not open documentation.');
    }
    setStatus('Documentation opened.', 'success');
  } catch (error) {
    setStatus(error?.message || 'Could not open documentation.', 'error');
  }
}
