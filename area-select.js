/**
 * Dreamlab Canvas — Area Select Overlay
 * Injected into pages for area screenshot and area video capture.
 * IIFE pattern (same as picker.js).
 */
(() => {
    // Guard against double-injection — toggle off if already active
    if (window.__dreamlabAreaSelectActive__) {
        if (typeof window.__dreamlabAreaSelectCleanup__ === 'function') {
            window.__dreamlabAreaSelectCleanup__();
        }
        return;
    }
    window.__dreamlabAreaSelectActive__ = true;

    // ── State ──────────────────────────────────────────────────────────

    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let selectionRect = null; // { x, y, width, height } in CSS pixels

    // ── DOM Elements ───────────────────────────────────────────────────

    const overlay = document.createElement('div');
    overlay.className = '__dreamlab_area_overlay__';

    const selectionBox = document.createElement('div');
    selectionBox.className = '__dreamlab_area_selection__';
    selectionBox.style.display = 'none';
    overlay.appendChild(selectionBox);

    document.documentElement.appendChild(overlay);

    // ── Selection Drawing ──────────────────────────────────────────────

    function onMouseDown(e) {
        if (e.button !== 0) return; // left click only
        // Don't start dragging if clicking on toolbar
        if (e.target.closest && e.target.closest('.__dreamlab_area_toolbar__')) return;

        startX = e.clientX;
        startY = e.clientY;
        isDragging = true;

        selectionBox.style.display = 'block';
        selectionBox.style.left = startX + 'px';
        selectionBox.style.top = startY + 'px';
        selectionBox.style.width = '0px';
        selectionBox.style.height = '0px';

        // Remove existing toolbar if re-drawing
        removeToolbar();
    }

    function onMouseMove(e) {
        if (!isDragging) return;

        const x = Math.min(e.clientX, startX);
        const y = Math.min(e.clientY, startY);
        const w = Math.abs(e.clientX - startX);
        const h = Math.abs(e.clientY - startY);

        selectionBox.style.left = x + 'px';
        selectionBox.style.top = y + 'px';
        selectionBox.style.width = w + 'px';
        selectionBox.style.height = h + 'px';
    }

    function onMouseUp(e) {
        if (!isDragging) return;
        isDragging = false;

        const x = Math.min(e.clientX, startX);
        const y = Math.min(e.clientY, startY);
        const w = Math.abs(e.clientX - startX);
        const h = Math.abs(e.clientY - startY);

        // Too small — ignore
        if (w < 10 || h < 10) {
            selectionBox.style.display = 'none';
            return;
        }

        selectionRect = { x, y, width: w, height: h };
        showToolbar();
    }

    // ── Toolbar ────────────────────────────────────────────────────────

    let toolbar = null;

    function showToolbar() {
        removeToolbar();

        toolbar = document.createElement('div');
        toolbar.className = '__dreamlab_area_toolbar__';

        // Dimensions label
        const dims = document.createElement('span');
        dims.className = '__dreamlab_area_dims__';
        dims.textContent = `${selectionRect.width} × ${selectionRect.height}`;
        toolbar.appendChild(dims);

        // Screenshot button
        const btnScreenshot = document.createElement('button');
        btnScreenshot.className = '__dreamlab_area_btn_screenshot__';
        btnScreenshot.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Screenshot`;
        btnScreenshot.addEventListener('click', handleScreenshot);
        toolbar.appendChild(btnScreenshot);

        // Record button
        const btnRecord = document.createElement('button');
        btnRecord.className = '__dreamlab_area_btn_record__';
        btnRecord.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="10"/></svg> Record 10s`;
        btnRecord.addEventListener('click', handleRecord);
        toolbar.appendChild(btnRecord);

        // Cancel button
        const btnCancel = document.createElement('button');
        btnCancel.className = '__dreamlab_area_btn_cancel__';
        btnCancel.textContent = '✕';
        btnCancel.addEventListener('click', cleanup);
        toolbar.appendChild(btnCancel);

        // Position toolbar centered below selection (or above if no room)
        const gap = 8;
        const toolbarWidth = 320; // estimated
        let toolbarX = selectionRect.x + (selectionRect.width / 2) - (toolbarWidth / 2);
        let toolbarY = selectionRect.y + selectionRect.height + gap;

        // If below viewport, position above
        if (toolbarY + 50 > window.innerHeight) {
            toolbarY = selectionRect.y - 50 - gap;
        }
        // Clamp horizontal
        toolbarX = Math.max(8, Math.min(toolbarX, window.innerWidth - toolbarWidth - 8));

        toolbar.style.left = toolbarX + 'px';
        toolbar.style.top = toolbarY + 'px';

        document.documentElement.appendChild(toolbar);

        // Re-measure and re-center after render
        requestAnimationFrame(() => {
            if (!toolbar) return;
            const rect = toolbar.getBoundingClientRect();
            let newX = selectionRect.x + (selectionRect.width / 2) - (rect.width / 2);
            newX = Math.max(8, Math.min(newX, window.innerWidth - rect.width - 8));
            toolbar.style.left = newX + 'px';
        });
    }

    function removeToolbar() {
        if (toolbar) {
            toolbar.remove();
            toolbar = null;
        }
    }

    // ── Actions ────────────────────────────────────────────────────────

    function handleScreenshot() {
        if (!selectionRect) return;

        const payload = {
            action: 'areaScreenshot',
            rect: { ...selectionRect },
            dpr: window.devicePixelRatio || 1,
            pageTitle: document.title,
            pageUrl: window.location.href,
        };

        // Remove overlay BEFORE sending message so it's not captured
        cleanup();

        // Small delay to let DOM update propagate before background captures
        setTimeout(() => {
            chrome.runtime.sendMessage(payload);
        }, 50);
    }

    function handleRecord() {
        if (!selectionRect) return;

        const payload = {
            action: 'areaRecord',
            rect: { ...selectionRect },
            dpr: window.devicePixelRatio || 1,
            pageTitle: document.title,
            pageUrl: window.location.href,
        };

        // Remove overlay BEFORE sending message so it's not captured
        cleanup();

        setTimeout(() => {
            chrome.runtime.sendMessage(payload);
        }, 50);
    }

    // ── Keyboard ───────────────────────────────────────────────────────

    function onKeyDown(e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cleanup();
        }
    }

    // ── Cleanup ────────────────────────────────────────────────────────

    function cleanup() {
        removeToolbar();
        overlay.remove();
        document.removeEventListener('keydown', onKeyDown, true);
        window.__dreamlabAreaSelectActive__ = false;
        window.__dreamlabAreaSelectCleanup__ = null;
    }

    window.__dreamlabAreaSelectCleanup__ = cleanup;

    // ── Attach Events ──────────────────────────────────────────────────

    overlay.addEventListener('mousedown', onMouseDown);
    overlay.addEventListener('mousemove', onMouseMove);
    overlay.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown, true);
})();
