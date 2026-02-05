(() => {
    if (window.dreamlabAreaActive) return;
    window.dreamlabAreaActive = true;

    // Create UI elements
    const overlay = document.createElement('div');
    overlay.className = 'dreamlab-area-overlay';

    const msg = document.createElement('div');
    msg.className = 'dreamlab-area-msg';
    msg.textContent = 'Drag to select area (Esc to cancel)';

    const box = document.createElement('div');
    box.className = 'dreamlab-selection-box';
    box.style.display = 'none';

    document.body.appendChild(overlay);
    document.body.appendChild(msg);
    document.body.appendChild(box);

    let isDragging = false;
    let startX = 0;
    let startY = 0;

    function cleanup() {
        overlay.remove();
        msg.remove();
        box.remove();
        document.removeEventListener('keydown', handleKey);
        window.dreamlabAreaActive = false;
    }

    function handleKey(e) {
        if (e.key === 'Escape') cleanup();
    }

    overlay.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;

        box.style.left = startX + 'px';
        box.style.top = startY + 'px';
        box.style.width = '0px';
        box.style.height = '0px';
        box.style.display = 'block';
    });

    overlay.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const currentX = e.clientX;
        const currentY = e.clientY;

        const left = Math.min(startX, currentX);
        const top = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        box.style.left = left + 'px';
        box.style.top = top + 'px';
        box.style.width = width + 'px';
        box.style.height = height + 'px';
    });

    overlay.addEventListener('mouseup', async (e) => {
        if (!isDragging) return;
        isDragging = false;

        // Get final coordinates
        const rect = box.getBoundingClientRect();

        // Hide UI immediately for screenshot
        overlay.style.display = 'none';
        box.style.display = 'none';
        msg.textContent = 'Procesing...';

        if (rect.width < 5 || rect.height < 5) {
            cleanup();
            return;
        }

        try {
            // Request full visible tab screenshot from background
            const response = await chrome.runtime.sendMessage({ action: 'CAPTURE_VISIBLE_TAB' });

            if (response && response.dataUrl) {
                cropAndSave(response.dataUrl, rect);
            } else {
                throw new Error('Failed to get screenshot');
            }
        } catch (err) {
            console.error('Dreamlab Area Capture Error:', err);
            cleanup();
        }
    });

    function cropAndSave(dataUrl, rect) {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const dpr = window.devicePixelRatio || 1;

            // Set canvas size to the selected area size (multiplied by DPR for quality)
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;

            const ctx = canvas.getContext('2d');

            // Crop source image
            // Source coords: rect.x * dpr, etc. because the screenshot is full resolution
            ctx.drawImage(
                image,
                rect.left * dpr, rect.top * dpr, rect.width * dpr, rect.height * dpr, // Source crop
                0, 0, canvas.width, canvas.height // Dest
            );

            const croppedDataUrl = canvas.toDataURL('image/png');

            // Save item
            const item = {
                type: 'image',
                content: croppedDataUrl,
                sourceUrl: window.location.href,
                timestamp: Date.now()
            };

            chrome.runtime.sendMessage({ action: 'saveCapturedItem', item: item });
            cleanup();
        };
        image.src = dataUrl;
    }

    document.addEventListener('keydown', handleKey);

})();
