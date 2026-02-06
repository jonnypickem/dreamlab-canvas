// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SAVE_ITEM') {
        try {
            if (window.location.origin === 'http://localhost:5173') {
                const STORAGE_KEY = 'dreamlab_items';
                const ACTIVE_CTX_KEY = 'dreamlab_active_context';
                const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
                const activeCtx = JSON.parse(localStorage.getItem(ACTIVE_CTX_KEY) || '{}');

                const newItem = {
                    ...request.item,
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    // Logic:
                    // 1. If explicit value (from popup), use it.
                    // 2. If explicit NULL (from popup 'Select Project' -> null), use null.
                    // 3. If UNDEFINED (from context menu/shortcut), use Active Context.
                    workspaceId: request.item.workspaceId !== undefined ? request.item.workspaceId : (activeCtx.workspaceId || null),
                    projectId: request.item.projectId !== undefined ? request.item.projectId : (activeCtx.projectId || null),

                    // Mark for tagging processing in the main app
                    needsTagging: true
                };

                const updatedItems = [newItem, ...items];
                localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
                window.dispatchEvent(new Event('storage-update'));

                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: "Not on Dreamlab web app" });
            }
        } catch (err) {
            sendResponse({ success: false, error: err.message });
        }
    } else if (request.action === 'GET_ORG_DATA') {
        try {
            if (window.location.origin === 'http://localhost:5173') {
                const WS_KEY = 'dreamlab_workspaces';
                const P_KEY = 'dreamlab_projects';
                const ACTIVE_CTX_KEY = 'dreamlab_active_context';

                const workspaces = JSON.parse(localStorage.getItem(WS_KEY) || '[]');
                const projects = JSON.parse(localStorage.getItem(P_KEY) || '[]');
                const activeContext = JSON.parse(localStorage.getItem(ACTIVE_CTX_KEY) || '{}');

                sendResponse({ success: true, workspaces, projects, activeContext });
            } else {
                sendResponse({ success: false, error: "Not on Dreamlab web app" });
            }
        } catch (err) {
            sendResponse({ success: false, error: err.message });
        }
    } else if (request.action === 'SCAN_VISIBLE_IMAGES') {
        const visibleImages = getVisibleImages();
        const totalImages = getAllImages().length;
        sendResponse({ visibleImages, totalImages, sourceUrl: window.location.href });
    } else if (request.action === 'TRIGGER_MULTI_SELECT') {
        const visibleImages = getVisibleImages();
        const totalImages = getAllImages().length;

        chrome.runtime.sendMessage({
            action: 'openMultiSelect',
            images: visibleImages,
            totalImagesCount: totalImages,
            sourceUrl: window.location.href
        });
    }
    return true; // Keep message channel open
});

// --- Deep scan helpers (shared by getVisibleImages & getAllImages) ---

function _getBestUrlFromSrcset(srcset) {
    if (!srcset) return null;
    try {
        const sources = srcset.split(',').map(s => {
            const parts = s.trim().split(/\s+/);
            const url = parts[0];
            let size = 0;
            if (parts.length > 1) {
                const d = parts[1];
                if (d.endsWith('w')) size = parseInt(d);
                else if (d.endsWith('x')) size = parseFloat(d) * 1000;
            }
            return { url, size };
        });
        sources.sort((a, b) => b.size - a.size);
        return sources[0]?.url;
    } catch (e) { return null; }
}

function _getBgUrl(el, pseudo = null) {
    try {
        const style = window.getComputedStyle(el, pseudo);
        const bg = style.backgroundImage;
        if (bg && bg !== 'none' && bg.includes('url(')) {
            const matches = bg.match(/url\(['"]?(.*?)['"]?\)/g);
            if (matches && matches.length > 0) {
                return matches[0].slice(4, -1).replace(/["']/g, '');
            }
        }
    } catch (e) { }
    return null;
}

function _deepScanImages(viewportOnly) {
    const results = [];
    const seenUrls = new Set();

    // <picture> wrappers often have 0x0 rects; use inner <img> rect
    function getElRect(el) {
        const rect = el.getBoundingClientRect();
        if ((rect.width === 0 || rect.height === 0) && el.tagName === 'PICTURE') {
            const img = el.querySelector('img');
            if (img) return img.getBoundingClientRect();
        }
        return rect;
    }

    function isVisible(rect) {
        if (rect.width <= 50 || rect.height <= 50) return false;
        if (!viewportOnly) return true;
        // rect is already viewport-relative from getBoundingClientRect
        return (
            rect.bottom > 0 &&
            rect.top < window.innerHeight &&
            rect.right > 0 &&
            rect.left < window.innerWidth
        );
    }

    function add(src, el, alt = '') {
        if (!src) return;
        // Resolve relative URLs to absolute (srcset/data-src can be relative paths)
        try { src = new URL(src, document.baseURI).href; } catch (e) { }
        if (seenUrls.has(src)) return;
        seenUrls.add(src);
        const rect = getElRect(el);
        results.push({
            src,
            alt,
            width: el.naturalWidth || Math.round(rect.width),
            height: el.naturalHeight || Math.round(rect.height),
            displayWidth: el.width || Math.round(rect.width),
            displayHeight: el.height || Math.round(rect.height)
        });
    }

    // 1. <img> elements (with srcset / data-src support)
    document.querySelectorAll('img').forEach(img => {
        // Skip imgs inside <picture> — the <picture> scan (step 2) parses
        // <source> srcset for the highest resolution instead of using currentSrc
        if (img.closest('picture')) return;
        if (!isVisible(img.getBoundingClientRect())) return;
        const srcsetUrl = _getBestUrlFromSrcset(img.getAttribute('srcset') || img.getAttribute('data-srcset'));
        const dataUrl = img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-full-url');
        add(srcsetUrl || dataUrl || img.currentSrc || img.src, img, img.alt);
    });

    // 2. <picture> elements (parse <source> for highest res)
    document.querySelectorAll('picture').forEach(picture => {
        if (!isVisible(getElRect(picture))) return;
        const sources = picture.querySelectorAll('source');
        for (const source of sources) {
            const url = _getBestUrlFromSrcset(source.getAttribute('srcset'));
            if (url) { add(url, picture); return; }
        }
        const img = picture.querySelector('img');
        if (img) add(img.currentSrc || img.src, picture, img.alt);
    });

    // 3. <video> elements (poster attribute)
    document.querySelectorAll('video').forEach(video => {
        const rect = video.getBoundingClientRect();
        if (!isVisible(rect)) return;
        if (video.poster) add(video.poster, video);
    });

    // 4. Inline background images
    document.querySelectorAll('[style*="background-image"], [style*="background:"]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (!isVisible(rect)) return;
        const bg = _getBgUrl(el);
        if (bg) add(bg, el);
    });

    // 5. Computed style fallback (CSS-class backgrounds, e.g. Apple.com)
    const allEls = document.querySelectorAll('*');
    const limit = Math.min(allEls.length, 500);
    for (let i = 0; i < limit; i++) {
        const el = allEls[i];
        const rect = el.getBoundingClientRect();
        if (rect.width <= 50 || rect.height <= 50) continue;
        if (!isVisible(rect)) continue;
        const bg = _getBgUrl(el);
        if (bg) add(bg, el);
        const beforeBg = _getBgUrl(el, ':before');
        if (beforeBg) add(beforeBg, el);
    }

    return results;
}

// Get images in current viewport
function getVisibleImages() {
    return _deepScanImages(true);
}

// Get ALL images on page
function getAllImages() {
    return _deepScanImages(false);
}

// Listen for CMD+Shift+Y
document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'Y') {
        e.preventDefault();

        // Get visible images
        const visibleImages = getVisibleImages();
        const totalImages = getAllImages().length;

        // Send to background script
        chrome.runtime.sendMessage({
            action: 'openMultiSelect',
            images: visibleImages,
            totalImagesCount: totalImages,
            sourceUrl: window.location.href
        });
    }
});
