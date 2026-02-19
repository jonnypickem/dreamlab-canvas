const ACTIONS = {
  getWidgetBehaviorSettings: 'getWidgetBehaviorSettings',
  setWidgetBehaviorSettings: 'setWidgetBehaviorSettings',
};

const DEFAULT_SETTINGS = {
  excludedDomains: [],
  positionPreset: 'bottom-right',
  offsetX: 20,
  offsetY: 20,
};

const ui = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheDom();
  bindEvents();
  void loadSettings();
});

function cacheDom() {
  ui.excludedDomains = document.getElementById('excluded-domains');
  ui.positionPreset = document.getElementById('position-preset');
  ui.offsetX = document.getElementById('offset-x');
  ui.offsetY = document.getElementById('offset-y');
  ui.saveSettings = document.getElementById('save-settings');
  ui.resetDefaults = document.getElementById('reset-defaults');
  ui.status = document.getElementById('status');
}

function bindEvents() {
  ui.saveSettings?.addEventListener('click', () => {
    void saveSettings();
  });
  ui.resetDefaults?.addEventListener('click', () => {
    applyFormValues(DEFAULT_SETTINGS);
    setStatus('Defaults restored in form. Click Save Settings to apply.', '');
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

function sanitizeDomainToken(input) {
  const value = String(input || '').trim().toLowerCase();
  if (!value) return null;
  const withoutProtocol = value.replace(/^[a-z]+:\/\//, '');
  const host = withoutProtocol.split('/')[0].split(':')[0].trim();
  const normalized = host.replace(/^\*\./, '').replace(/^\.+|\.+$/g, '');
  if (!normalized || !normalized.includes('.')) return null;
  if (!/^[a-z0-9.-]+$/.test(normalized)) return null;
  if (normalized.startsWith('-') || normalized.endsWith('-')) return null;
  return normalized;
}

function parseExcludedDomains(rawText) {
  const tokens = String(rawText || '')
    .split(/\n|,|;/g)
    .map((entry) => entry.trim())
    .filter(Boolean);

  const result = [];
  const seen = new Set();

  tokens.forEach((token) => {
    const domain = sanitizeDomainToken(token);
    if (!domain || seen.has(domain)) return;
    seen.add(domain);
    result.push(domain);
  });

  return result;
}

function sanitizeSettings(input) {
  const source = input && typeof input === 'object' ? input : {};
  const allowedPresets = new Set(['bottom-right', 'bottom-left', 'top-right', 'top-left']);
  return {
    excludedDomains: parseExcludedDomains(Array.isArray(source.excludedDomains) ? source.excludedDomains.join('\n') : ''),
    positionPreset: allowedPresets.has(source.positionPreset)
      ? source.positionPreset
      : DEFAULT_SETTINGS.positionPreset,
    offsetX: Number.isFinite(Number(source.offsetX))
      ? Math.max(0, Math.min(200, Math.round(Number(source.offsetX))))
      : DEFAULT_SETTINGS.offsetX,
    offsetY: Number.isFinite(Number(source.offsetY))
      ? Math.max(0, Math.min(200, Math.round(Number(source.offsetY))))
      : DEFAULT_SETTINGS.offsetY,
  };
}

function applyFormValues(settings) {
  const next = sanitizeSettings(settings);
  ui.excludedDomains.value = next.excludedDomains.join('\n');
  ui.positionPreset.value = next.positionPreset;
  ui.offsetX.value = String(next.offsetX);
  ui.offsetY.value = String(next.offsetY);
}

function readFormValues() {
  return sanitizeSettings({
    excludedDomains: parseExcludedDomains(ui.excludedDomains?.value || ''),
    positionPreset: ui.positionPreset?.value || DEFAULT_SETTINGS.positionPreset,
    offsetX: ui.offsetX?.value,
    offsetY: ui.offsetY?.value,
  });
}

async function loadSettings() {
  setStatus('Loading widget settings...');
  try {
    const response = await runtimeMessage({ action: ACTIONS.getWidgetBehaviorSettings }, { retries: 2 });
    if (!response?.success) {
      throw new Error(response?.error || 'Could not load widget settings.');
    }
    applyFormValues(response.settings || DEFAULT_SETTINGS);
    setStatus('Widget settings loaded.');
  } catch (error) {
    applyFormValues(DEFAULT_SETTINGS);
    setStatus(error?.message || 'Could not load widget settings.', 'error');
  }
}

async function saveSettings() {
  const settings = readFormValues();
  setStatus('Saving widget settings...');

  try {
    const response = await runtimeMessage({
      action: ACTIONS.setWidgetBehaviorSettings,
      settings,
    });

    if (!response?.success) {
      throw new Error(response?.error || 'Could not save widget settings.');
    }

    applyFormValues(response.settings || settings);
    setStatus('Widget settings saved.', 'success');
  } catch (error) {
    setStatus(error?.message || 'Could not save widget settings.', 'error');
  }
}
