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
    let isRecording = false;

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
        dims.textContent = `${selectionRect.width} \u00d7 ${selectionRect.height}`;
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
        btnCancel.textContent = '\u2715';
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
        if (!selectionRect || isRecording) return;
        isRecording = true;

        const rect = { ...selectionRect };
        const dpr = window.devicePixelRatio || 1;
        const pageTitle = document.title;
        const pageUrl = window.location.href;

        // Remove overlay so it's not in the recording
        cleanup();

        // Listen for the recording result from the main-world script
        function onRecordingResult(event) {
            if (event.source !== window) return;
            if (event.data?.type === '__dreamlab_recording_done__') {
                window.removeEventListener('message', onRecordingResult);
                isRecording = false;

                chrome.runtime.sendMessage({
                    action: 'areaRecordComplete',
                    dataUrl: event.data.dataUrl,
                    mimeType: 'video/webm',
                    durationMs: event.data.durationMs || 10000,
                    pageTitle,
                    pageUrl,
                });
            } else if (event.data?.type === '__dreamlab_recording_error__') {
                window.removeEventListener('message', onRecordingResult);
                isRecording = false;
            }
        }
        window.addEventListener('message', onRecordingResult);

        // Inject recording logic into the MAIN world via <script> tag.
        // getDisplayMedia is blocked in extension content scripts (isolated world)
        // but works fine in the page's main world.
        const script = document.createElement('script');
        script.textContent = `(${mainWorldRecorder.toString()})(${JSON.stringify(rect)}, ${dpr})`;
        document.documentElement.appendChild(script);
        script.remove();
    }

    /**
     * This function runs in the page's MAIN world (not the extension's isolated world).
     * It has full access to getDisplayMedia but no access to chrome.runtime.
     * Results are sent back via window.postMessage.
     */
    function mainWorldRecorder(rect, dpr) {
        (async () => {
            try {
                const stream = await navigator.mediaDevices.getDisplayMedia({
                    video: { displaySurface: 'browser' },
                    preferCurrentTab: true,
                });

                await new Promise((r) => setTimeout(r, 300));

                const cropX = Math.round(rect.x * dpr);
                const cropY = Math.round(rect.y * dpr);
                const cropW = Math.round(rect.width * dpr);
                const cropH = Math.round(rect.height * dpr);

                let canvasW = cropW;
                let canvasH = cropH;
                const maxDim = 1920;
                if (canvasW > maxDim || canvasH > maxDim) {
                    const scale = Math.min(maxDim / canvasW, maxDim / canvasH);
                    canvasW = Math.round(canvasW * scale);
                    canvasH = Math.round(canvasH * scale);
                }

                const canvas = document.createElement('canvas');
                canvas.width = canvasW;
                canvas.height = canvasH;
                canvas.style.cssText = 'position:fixed;left:-9999px;top:-9999px;pointer-events:none;opacity:0;';
                document.documentElement.appendChild(canvas);
                const ctx = canvas.getContext('2d');

                const video = document.createElement('video');
                video.srcObject = stream;
                video.muted = true;
                video.style.cssText = 'position:fixed;left:-9999px;top:-9999px;pointer-events:none;opacity:0;';
                document.documentElement.appendChild(video);
                await video.play();

                let drawing = true;
                function drawFrame() {
                    if (!drawing) return;
                    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, canvasW, canvasH);
                    requestAnimationFrame(drawFrame);
                }
                drawFrame();

                const canvasStream = canvas.captureStream(30);
                let mimeType = 'video/webm;codecs=vp9';
                if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm;codecs=vp8';
                if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

                const recorder = new MediaRecorder(canvasStream, {
                    mimeType,
                    videoBitsPerSecond: 2500000,
                });

                const chunks = [];
                recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

                // Recording indicator
                const indicator = document.createElement('div');
                indicator.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:2147483647;display:flex;align-items:center;gap:8px;padding:8px 16px;background:#171717;border:1px solid #333;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.35);font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:13px;color:#fff;pointer-events:none;';
                const blinkStyle = document.createElement('style');
                blinkStyle.textContent = '@keyframes __dl_blink{0%,100%{opacity:1}50%{opacity:0.3}}';
                document.documentElement.appendChild(blinkStyle);
                document.documentElement.appendChild(indicator);

                let countdown = 10;
                const dot = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#dc2626;animation:__dl_blink 1s ease-in-out infinite;"></span>';
                indicator.innerHTML = dot + ' Recording... 10s';
                const countdownInterval = setInterval(() => {
                    countdown--;
                    if (countdown > 0) indicator.innerHTML = dot + ' Recording... ' + countdown + 's';
                }, 1000);

                const startTime = Date.now();

                const recordingDone = new Promise((resolve) => {
                    recorder.onstop = () => {
                        drawing = false;
                        clearInterval(countdownInterval);
                        stream.getTracks().forEach((t) => t.stop());
                        canvasStream.getTracks().forEach((t) => t.stop());
                        video.srcObject = null;
                        video.remove();
                        canvas.remove();
                        indicator.remove();
                        blinkStyle.remove();
                        resolve(new Blob(chunks, { type: 'video/webm' }));
                    };
                });

                recorder.start();
                setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 10000);

                const blob = await recordingDone;
                const durationMs = Date.now() - startTime;

                const reader = new FileReader();
                const dataUrl = await new Promise((resolve, reject) => {
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Read failed'));
                    reader.readAsDataURL(blob);
                });

                window.postMessage({ type: '__dreamlab_recording_done__', dataUrl, durationMs }, '*');

            } catch (err) {
                window.postMessage({ type: '__dreamlab_recording_error__', error: err.message }, '*');
            }
        })();
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
