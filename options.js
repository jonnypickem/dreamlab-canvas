const ACTIONS = {
  getWidgetBehaviorSettings: 'getWidgetBehaviorSettings',
  setWidgetBehaviorSettings: 'setWidgetBehaviorSettings',
  getWidgetHotkeys: 'getWidgetHotkeys',
  setWidgetHotkeys: 'setWidgetHotkeys',
  getComplianceState: 'getComplianceState',
  getPrivacySummary: 'getPrivacySummary',
  openComplianceDoc: 'openComplianceDoc',
};

const DEFAULT_SETTINGS = {
  excludedDomains: [],
  positionPreset: 'bottom-right',
  offsetX: 20,
  offsetY: 20,
};
const DEFAULT_HOTKEYS = Object.freeze({
  'save-page': 'S',
  'capture-visible': 'I',
  'capture-full-page': 'P',
  'smart-picker': 'M',
  'pick-color': 'K',
  'area-capture': 'A',
});

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
  ui.complianceSummary = document.getElementById('compliance-summary');
  ui.privacySummary = document.getElementById('privacy-summary');
  ui.openPrivacyDoc = document.getElementById('open-privacy-doc');
  ui.openComplianceDoc = document.getElementById('open-compliance-doc');
  ui.resetHotkeys = document.getElementById('reset-hotkeys');
  ui.hotkeyInputs = Array.from(document.querySelectorAll('[data-hotkey-action]'));
}

function bindEvents() {
  ui.saveSettings?.addEventListener('click', () => {
    void saveSettings();
  });
  ui.resetDefaults?.addEventListener('click', () => {
    applyFormValues(DEFAULT_SETTINGS);
    setStatus('Defaults restored in form. Click Save Settings to apply.', '');
  });
  ui.openPrivacyDoc?.addEventListener('click', () => {
    void openComplianceDoc('privacy');
  });
  ui.openComplianceDoc?.addEventListener('click', () => {
    void openComplianceDoc('compliance');
  });
  ui.resetHotkeys?.addEventListener('click', () => {
    applyHotkeyValues(DEFAULT_HOTKEYS);
    setStatus('Default hotkeys restored in form. Click Save Settings to apply.', '');
  });
  ui.hotkeyInputs.forEach((input) => {
    input.addEventListener('input', () => {
      input.value = normalizeHotkeyChar(input.value);
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

function normalizeHotkeyChar(value) {
  const token = String(value || '').trim().toUpperCase();
  if (token.length !== 1) return '';
  return /^[A-Z0-9]$/.test(token) ? token : '';
}

function applyHotkeyValues(map) {
  const source = map && typeof map === 'object' ? map : {};
  ui.hotkeyInputs.forEach((input) => {
    const actionId = String(input.getAttribute('data-hotkey-action') || '');
    input.value = normalizeHotkeyChar(source[actionId] || DEFAULT_HOTKEYS[actionId] || '');
  });
}

function readHotkeyValues() {
  const map = {};
  const seen = new Set();
  for (const input of ui.hotkeyInputs) {
    const actionId = String(input.getAttribute('data-hotkey-action') || '');
    if (!actionId) continue;
    const token = normalizeHotkeyChar(input.value);
    if (!token) {
      throw new Error('Each action hotkey must be one letter (A-Z) or digit (0-9).');
    }
    if (seen.has(token)) {
      throw new Error(`Duplicate hotkey "${token}" is not allowed.`);
    }
    seen.add(token);
    map[actionId] = token;
  }
  return map;
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
    const [settingsResponse, hotkeysResponse] = await Promise.all([
      runtimeMessage({ action: ACTIONS.getWidgetBehaviorSettings }, { retries: 2 }),
      runtimeMessage({ action: ACTIONS.getWidgetHotkeys }, { retries: 2 }).catch(() => null),
    ]);

    if (!settingsResponse?.success) {
      throw new Error(settingsResponse?.error || 'Could not load widget settings.');
    }
    applyFormValues(settingsResponse.settings || DEFAULT_SETTINGS);
    if (hotkeysResponse?.success && hotkeysResponse.hotkeys?.actionKeyMap) {
      applyHotkeyValues(hotkeysResponse.hotkeys.actionKeyMap);
    } else {
      applyHotkeyValues(DEFAULT_HOTKEYS);
    }
    const [complianceResponse, privacyResponse] = await Promise.all([
      runtimeMessage({ action: ACTIONS.getComplianceState }, { retries: 2 }).catch(() => null),
      runtimeMessage({ action: ACTIONS.getPrivacySummary }, { retries: 2 }).catch(() => null),
    ]);
    renderComplianceSummary(complianceResponse?.compliance, privacyResponse?.privacy);
    setStatus('Widget settings loaded.');
  } catch (error) {
    applyFormValues(DEFAULT_SETTINGS);
    applyHotkeyValues(DEFAULT_HOTKEYS);
    setStatus(error?.message || 'Could not load widget settings.', 'error');
  }
}

function renderComplianceSummary(compliance, privacy) {
  if (ui.complianceSummary) {
    const access = compliance?.allSitesAccessRequired
      ? 'Required host access includes all websites (<all_urls>).'
      : 'Host access is scoped to a limited domain list.';
    ui.complianceSummary.textContent = `${access} Disclosure version: ${compliance?.disclosureVersion || 'unknown'}.`;
  }
  if (ui.privacySummary) {
    ui.privacySummary.textContent = privacy?.defaultBehavior
      || 'Capture and transmission should only occur after user actions.';
  }
}

async function saveSettings() {
  const settings = readFormValues();
  setStatus('Saving widget settings...');

  try {
    const hotkeyMap = readHotkeyValues();

    const settingsResponse = await runtimeMessage({
      action: ACTIONS.setWidgetBehaviorSettings,
      settings,
    });

    if (!settingsResponse?.success) {
      throw new Error(settingsResponse?.error || 'Could not save widget settings.');
    }

    const hotkeysResponse = await runtimeMessage({
      action: ACTIONS.setWidgetHotkeys,
      hotkeys: { actionKeyMap: hotkeyMap },
    });

    if (!hotkeysResponse?.success) {
      throw new Error(hotkeysResponse?.error || 'Could not save widget hotkeys.');
    }

    applyFormValues(settingsResponse.settings || settings);
    applyHotkeyValues(hotkeysResponse.hotkeys?.actionKeyMap || hotkeyMap);
    setStatus('Widget settings saved.', 'success');
  } catch (error) {
    setStatus(error?.message || 'Could not save widget settings.', 'error');
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
