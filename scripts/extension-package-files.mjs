export const EXTENSION_ZIP_PATH = 'dreamlab-canvas-extension.zip';

export const EXTENSION_PACKAGE_FILES = Object.freeze([
  'manifest.json',
  'background.js',
  'content.js',
  'floating-widget.js',
  'popup.html',
  'popup.js',
  'popup.css',
  'options.html',
  'options.js',
  'options.css',
  'offscreen.html',
  'offscreen.js',
  'area-select.js',
  'area-select.css',
  'picker.js',
  'picker.css',
  'multi-select.html',
  'multi-select.js',
  'multi-select.css',
  'extension-design-tokens.css',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
]);

export const LAUNCHER_CONTENT_EXPECTATIONS = Object.freeze([
  'OPEN_WIDGET_KEYBOARD_MODE',
  'openWidgetKeyboardMode',
  'request.action === ACTIONS.openWidgetKeyboardMode',
  'request.action === LEGACY_OPEN_WIDGET_KEYBOARD_MODE_ACTION',
]);

export const LAUNCHER_BACKGROUND_EXPECTATIONS = Object.freeze([
  "action: CONTENT_ACTIONS.openWidgetKeyboardMode",
  'function isUnknownActionResponse(response)',
  "await executeScript(tab.id, ['content.js']);",
  '[Dreamlab Launcher] open failed',
]);
