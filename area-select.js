/**
 * Dreamlab Canvas — Area Select Overlay
 * Injected into pages for area screenshot and area video capture.
 * IIFE pattern (same as picker.js).
 */
(() => {
    if (window.__dreamlabAreaSelectActive__) {
        if (typeof window.__dreamlabAreaSelectCleanup__ === 'function') {
            window.__dreamlabAreaSelectCleanup__();
        }
        return;
    }
    window.__dreamlabAreaSelectActive__ = true;

    const DURATION_STEPS = [5, 10, 15];
    const DEFAULT_DURATION_SEC = 10;
    const MIN_SELECTION_SIDE = 10;
    const MIN_COMPONENT_SIDE = 12;

    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let selectionRect = null;
    let isRecording = false;
    let componentPickMode = false;
    let recordDurationSec = DEFAULT_DURATION_SEC;

    let toolbar = null;
    let dimsLabel = null;
    let recordButton = null;
    let componentButton = null;
    let durationSlider = null;
    let durationValueLabel = null;
    let hoveredComponent = null;

    const overlay = document.createElement('div');
    overlay.className = '__dreamlab_area_overlay__';

    const selectionBox = document.createElement('div');
    selectionBox.className = '__dreamlab_area_selection__';
    selectionBox.style.display = 'none';
    overlay.appendChild(selectionBox);

    const componentHighlight = document.createElement('div');
    componentHighlight.className = '__dreamlab_area_component_highlight__';
    componentHighlight.style.display = 'none';

    document.documentElement.appendChild(overlay);
    document.documentElement.appendChild(componentHighlight);

    function sendRuntimeMessage(payload) {
        return new Promise((resolve) => {
            try {
                chrome.runtime.sendMessage(payload, (response) => {
                    if (chrome.runtime.lastError) {
                        resolve({
                            success: false,
                            error: chrome.runtime.lastError.message || 'Runtime messaging failed.',
                        });
                        return;
                    }
                    resolve(response || { success: false, error: 'No response from extension.' });
                });
            } catch (error) {
                resolve({ success: false, error: error?.message || 'Runtime messaging failed.' });
            }
        });
    }

    function asDuration(value) {
        const parsed = Number(value);
        return DURATION_STEPS.includes(parsed) ? parsed : DEFAULT_DURATION_SEC;
    }

    function durationToIndex(value) {
        const index = DURATION_STEPS.indexOf(asDuration(value));
        return index >= 0 ? index : 1;
    }

    function setStatus(text, state = 'muted') {
        if (!dimsLabel) return;
        dimsLabel.textContent = text;
        dimsLabel.dataset.state = state;
    }

    function updateSelectionStatus() {
        if (!selectionRect) return;
        setStatus(`${Math.round(selectionRect.width)} x ${Math.round(selectionRect.height)}`, 'muted');
    }

    function updateRecordButtonLabel() {
        if (!recordButton) return;
        recordButton.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="10"/></svg> Record ${recordDurationSec}s`;
    }

    function updateDurationUi() {
        if (durationValueLabel) durationValueLabel.textContent = `${recordDurationSec}s`;
        if (durationSlider) durationSlider.value = String(durationToIndex(recordDurationSec));
        updateRecordButtonLabel();
    }

    function setRecordDuration(nextValue, options = {}) {
        const persist = options.persist !== false;
        recordDurationSec = asDuration(nextValue);
        updateDurationUi();
        if (persist) {
            void sendRuntimeMessage({
                action: 'setAreaCapturePrefs',
                prefs: { recordDurationSec },
            });
        }
    }

    async function loadDurationPreference() {
        const response = await sendRuntimeMessage({ action: 'getAreaCapturePrefs' });
        const storedDuration = response?.prefs?.recordDurationSec;
        setRecordDuration(storedDuration, { persist: false });
    }

    function isPointInsideRect(x, y, rect) {
        if (!rect) return false;
        return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }

    function rectsIntersect(left, right) {
        if (!left || !right) return false;
        return (
            left.x < right.x + right.width
            && left.x + left.width > right.x
            && left.y < right.y + right.height
            && left.y + left.height > right.y
        );
    }

    function clampRectToViewport(rect) {
        const x1 = Math.max(0, Math.min(window.innerWidth, rect.x));
        const y1 = Math.max(0, Math.min(window.innerHeight, rect.y));
        const x2 = Math.max(0, Math.min(window.innerWidth, rect.x + rect.width));
        const y2 = Math.max(0, Math.min(window.innerHeight, rect.y + rect.height));
        const width = x2 - x1;
        const height = y2 - y1;
        if (width <= 0 || height <= 0) return null;
        return { x: x1, y: y1, width, height };
    }

    function resolveUnderlyingElement(clientX, clientY) {
        const previousPointerEvents = overlay.style.pointerEvents;
        overlay.style.pointerEvents = 'none';
        const element = document.elementFromPoint(clientX, clientY);
        overlay.style.pointerEvents = previousPointerEvents;
        return element;
    }

    function isVisualElement(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
        const tag = String(el.tagName || '').toUpperCase();
        if (['IMG', 'PICTURE', 'VIDEO', 'CANVAS', 'SVG'].includes(tag)) return true;
        const style = window.getComputedStyle(el);
        return style.backgroundImage && style.backgroundImage !== 'none';
    }

    function resolveComponentCandidate(clientX, clientY) {
        if (!selectionRect || !isPointInsideRect(clientX, clientY, selectionRect)) {
            return null;
        }

        const target = resolveUnderlyingElement(clientX, clientY);
        if (!target || target === document.documentElement || target === document.body) {
            return null;
        }

        const candidates = [];
        let node = target;
        for (let depth = 0; node && node !== document.documentElement && depth < 8; depth += 1) {
            if (toolbar && toolbar.contains(node)) break;
            const rect = node.getBoundingClientRect();
            const clamped = clampRectToViewport({
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height,
            });
            if (clamped && rectsIntersect(clamped, selectionRect)
                && clamped.width >= MIN_COMPONENT_SIDE
                && clamped.height >= MIN_COMPONENT_SIDE) {
                candidates.push({
                    element: node,
                    rect: clamped,
                    isVisual: isVisualElement(node),
                });
                if (isVisualElement(node)) break;
            }
            node = node.parentElement;
        }

        if (!candidates.length) return null;
        const visual = candidates.find((entry) => entry.isVisual);
        return visual || candidates[0];
    }

    function clearComponentHover() {
        hoveredComponent = null;
        componentHighlight.style.display = 'none';
    }

    function paintComponentHover(candidate) {
        hoveredComponent = candidate;
        componentHighlight.style.display = 'block';
        componentHighlight.style.left = `${candidate.rect.x}px`;
        componentHighlight.style.top = `${candidate.rect.y}px`;
        componentHighlight.style.width = `${candidate.rect.width}px`;
        componentHighlight.style.height = `${candidate.rect.height}px`;
        setStatus(`Component ${Math.round(candidate.rect.width)} x ${Math.round(candidate.rect.height)}`, 'info');
    }

    function setComponentMode(enabled) {
        componentPickMode = Boolean(enabled);
        overlay.classList.toggle('__dreamlab_area_overlay_component_mode__', componentPickMode);
        if (componentButton) {
            componentButton.classList.toggle('__dreamlab_area_btn_active__', componentPickMode);
        }
        if (componentPickMode) {
            clearComponentHover();
            setStatus('Component mode: click a component inside selection', 'info');
        } else {
            clearComponentHover();
            updateSelectionStatus();
        }
    }

    function showToolbar() {
        removeToolbar();

        toolbar = document.createElement('div');
        toolbar.className = '__dreamlab_area_toolbar__';

        dimsLabel = document.createElement('span');
        dimsLabel.className = '__dreamlab_area_dims__';
        toolbar.appendChild(dimsLabel);
        updateSelectionStatus();

        const durationWrap = document.createElement('div');
        durationWrap.className = '__dreamlab_area_duration_wrap__';

        const durationHeader = document.createElement('div');
        durationHeader.className = '__dreamlab_area_duration_header__';
        const durationLabel = document.createElement('span');
        durationLabel.textContent = 'Duration';
        durationValueLabel = document.createElement('span');
        durationValueLabel.className = '__dreamlab_area_duration_value__';
        durationHeader.appendChild(durationLabel);
        durationHeader.appendChild(durationValueLabel);
        durationWrap.appendChild(durationHeader);

        durationSlider = document.createElement('input');
        durationSlider.className = '__dreamlab_area_duration_slider__';
        durationSlider.type = 'range';
        durationSlider.min = '0';
        durationSlider.max = '2';
        durationSlider.step = '1';
        durationSlider.value = String(durationToIndex(recordDurationSec));
        durationSlider.setAttribute('aria-label', 'Recording duration');
        durationSlider.addEventListener('input', () => {
            const index = Number(durationSlider.value);
            const duration = DURATION_STEPS[index] || DEFAULT_DURATION_SEC;
            setRecordDuration(duration);
        });
        durationWrap.appendChild(durationSlider);

        const durationTicks = document.createElement('div');
        durationTicks.className = '__dreamlab_area_duration_ticks__';
        durationTicks.innerHTML = '<span>5s</span><span>10s</span><span>15s</span>';
        durationWrap.appendChild(durationTicks);
        toolbar.appendChild(durationWrap);

        const btnScreenshot = document.createElement('button');
        btnScreenshot.className = '__dreamlab_area_btn_screenshot__';
        btnScreenshot.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Screenshot`;
        btnScreenshot.addEventListener('click', handleScreenshot);
        toolbar.appendChild(btnScreenshot);

        recordButton = document.createElement('button');
        recordButton.className = '__dreamlab_area_btn_record__';
        recordButton.addEventListener('click', handleRecord);
        toolbar.appendChild(recordButton);

        componentButton = document.createElement('button');
        componentButton.className = '__dreamlab_area_btn_component__';
        componentButton.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> Component`;
        componentButton.addEventListener('click', () => setComponentMode(true));
        toolbar.appendChild(componentButton);

        const btnCancel = document.createElement('button');
        btnCancel.className = '__dreamlab_area_btn_cancel__';
        btnCancel.textContent = 'x';
        btnCancel.addEventListener('click', cleanup);
        toolbar.appendChild(btnCancel);

        updateDurationUi();

        const gap = 8;
        const toolbarWidth = 640;
        let toolbarX = selectionRect.x + (selectionRect.width / 2) - (toolbarWidth / 2);
        let toolbarY = selectionRect.y + selectionRect.height + gap;
        if (toolbarY + 56 > window.innerHeight) {
            toolbarY = selectionRect.y - 56 - gap;
        }
        toolbarX = Math.max(8, Math.min(toolbarX, window.innerWidth - toolbarWidth - 8));
        toolbar.style.left = `${toolbarX}px`;
        toolbar.style.top = `${toolbarY}px`;

        document.documentElement.appendChild(toolbar);
        requestAnimationFrame(() => {
            if (!toolbar || !selectionRect) return;
            const rect = toolbar.getBoundingClientRect();
            let x = selectionRect.x + (selectionRect.width / 2) - (rect.width / 2);
            x = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8));
            toolbar.style.left = `${x}px`;
        });
    }

    function removeToolbar() {
        if (toolbar) toolbar.remove();
        toolbar = null;
        dimsLabel = null;
        recordButton = null;
        componentButton = null;
        durationSlider = null;
        durationValueLabel = null;
    }

    function handleScreenshot() {
        if (!selectionRect) return;
        const payload = {
            action: 'areaScreenshot',
            rect: { ...selectionRect },
            dpr: window.devicePixelRatio || 1,
            pageTitle: document.title,
            pageUrl: window.location.href,
        };
        cleanup();
        setTimeout(() => {
            chrome.runtime.sendMessage(payload);
        }, 50);
    }

    async function completeComponentCapture(clientX, clientY) {
        const candidate = resolveComponentCandidate(clientX, clientY) || hoveredComponent;
        if (!candidate || !candidate.rect) {
            setStatus('Selected component is too small or invalid.', 'error');
            return;
        }
        const rect = candidate.rect;
        if (rect.width < MIN_COMPONENT_SIDE || rect.height < MIN_COMPONENT_SIDE) {
            setStatus('Selected component is too small or invalid.', 'error');
            return;
        }

        const payload = {
            action: 'areaComponentScreenshot',
            rect: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
            },
            dpr: window.devicePixelRatio || 1,
            pageTitle: document.title,
            pageUrl: window.location.href,
        };

        cleanup();
        setTimeout(() => {
            chrome.runtime.sendMessage(payload);
        }, 50);
    }

    function handleRecord() {
        if (!selectionRect || isRecording) return;
        isRecording = true;

        const rect = { ...selectionRect };
        const dpr = window.devicePixelRatio || 1;
        const pageTitle = document.title;
        const pageUrl = window.location.href;
        const requestedDurationSec = recordDurationSec;

        cleanup();

        function onRecordingResult(event) {
            if (event.source !== window) return;
            if (event.data?.type === '__dreamlab_recording_done__') {
                window.removeEventListener('message', onRecordingResult);
                isRecording = false;
                chrome.runtime.sendMessage({
                    action: 'areaRecordComplete',
                    dataUrl: event.data.dataUrl,
                    mimeType: 'video/webm',
                    durationMs: event.data.durationMs || (requestedDurationSec * 1000),
                    requestedDurationSec: event.data.requestedDurationSec || requestedDurationSec,
                    pageTitle,
                    pageUrl,
                });
            } else if (event.data?.type === '__dreamlab_recording_error__') {
                window.removeEventListener('message', onRecordingResult);
                isRecording = false;
                chrome.runtime.sendMessage({
                    action: 'areaRecordError',
                    error: event.data.error || 'Recording failed',
                    pageTitle,
                    pageUrl,
                });
            }
        }
        window.addEventListener('message', onRecordingResult);

        chrome.runtime.sendMessage({
            action: 'injectAreaRecorder',
            rect,
            dpr,
            durationSec: requestedDurationSec,
        });
    }

    function onMouseDown(event) {
        if (event.button !== 0) return;
        if (event.target.closest && event.target.closest('.__dreamlab_area_toolbar__')) return;

        if (componentPickMode) {
            event.preventDefault();
            event.stopPropagation();
            return;
        }

        startX = event.clientX;
        startY = event.clientY;
        isDragging = true;

        selectionBox.style.display = 'block';
        selectionBox.style.left = `${startX}px`;
        selectionBox.style.top = `${startY}px`;
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';

        setComponentMode(false);
        removeToolbar();
    }

    function onMouseMove(event) {
        if (componentPickMode) {
            const candidate = resolveComponentCandidate(event.clientX, event.clientY);
            if (candidate) {
                paintComponentHover(candidate);
            } else {
                clearComponentHover();
                if (selectionRect && !isPointInsideRect(event.clientX, event.clientY, selectionRect)) {
                    setStatus('Component mode: click inside selection', 'info');
                } else {
                    setStatus('No valid component at cursor.', 'error');
                }
            }
            return;
        }

        if (!isDragging) return;

        const x = Math.min(event.clientX, startX);
        const y = Math.min(event.clientY, startY);
        const width = Math.abs(event.clientX - startX);
        const height = Math.abs(event.clientY - startY);

        selectionBox.style.left = `${x}px`;
        selectionBox.style.top = `${y}px`;
        selectionBox.style.width = `${width}px`;
        selectionBox.style.height = `${height}px`;
    }

    function onMouseUp(event) {
        if (componentPickMode) {
            if (event.button !== 0) return;
            if (event.target.closest && event.target.closest('.__dreamlab_area_toolbar__')) return;
            event.preventDefault();
            event.stopPropagation();
            void completeComponentCapture(event.clientX, event.clientY);
            return;
        }

        if (!isDragging) return;
        isDragging = false;

        const x = Math.min(event.clientX, startX);
        const y = Math.min(event.clientY, startY);
        const width = Math.abs(event.clientX - startX);
        const height = Math.abs(event.clientY - startY);

        if (width < MIN_SELECTION_SIDE || height < MIN_SELECTION_SIDE) {
            selectionBox.style.display = 'none';
            selectionRect = null;
            return;
        }

        selectionRect = { x, y, width, height };
        setComponentMode(false);
        showToolbar();
    }

    function onKeyDown(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            cleanup();
        }
    }

    function cleanup() {
        removeToolbar();
        clearComponentHover();
        componentHighlight.remove();
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown, true);
        window.__dreamlabAreaSelectActive__ = false;
        window.__dreamlabAreaSelectCleanup__ = null;
    }

    window.__dreamlabAreaSelectCleanup__ = cleanup;

    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown, true);
    void loadDurationPreference();
})();
