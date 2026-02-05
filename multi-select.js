// multi-select.js
let visibleImages = [];
let allImages = [];
let selectedImages = new Set();
let showingAll = false;

// Initialize
chrome.storage.local.get(['multiSelectImages', 'totalImagesCount'], (data) => {
    visibleImages = data.multiSelectImages || [];
    allImages = []; // Will be fetched if needed

    document.getElementById('visibleCount').textContent = visibleImages.length;
    document.getElementById('totalCount').textContent = data.totalImagesCount || 0;

    renderImages(visibleImages);
});

// Render image grid
function renderImages(images) {
    const grid = document.getElementById('imageGrid');
    grid.innerHTML = '';

    images.forEach((img, index) => {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.dataset.index = index;

        // Prevent dragging image to ensure click works
        card.draggable = false;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'image-checkbox';
        checkbox.checked = selectedImages.has(img.src);

        // Prevent check click from bubbling if needed, but here we handle card click
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleImage(img.src, checkbox);
        });

        const imgEl = document.createElement('img');
        imgEl.src = img.src;
        imgEl.alt = img.alt || 'Image';
        imgEl.onerror = () => {
            // Remove cards for images that fail to load (CORS, broken URLs, etc.)
            card.remove();
        };

        const overlay = document.createElement('div');
        overlay.className = 'checkbox-overlay';
        overlay.appendChild(checkbox);

        card.appendChild(imgEl);
        card.appendChild(overlay);

        // Click card to toggle
        card.addEventListener('click', () => toggleImage(img.src, checkbox));

        grid.appendChild(card);
    });

    updateSelectedCount();
}

// Toggle image selection
function toggleImage(src, checkbox) {
    if (selectedImages.has(src)) {
        selectedImages.delete(src);
        checkbox.checked = false;
    } else {
        selectedImages.add(src);
        checkbox.checked = true;
    }
    updateSelectedCount();

    // Visual update for parent card border
    const card = checkbox.closest('.image-card');
    // Trigger reflow or let CSS :has handle it? CSS :has is supported in modern Chrome.
    // But purely for safety:
    if (checkbox.checked) {
        card.classList.add('selected'); // Can add .selected class if :has not supported, but strict mode implies modern chrome
    } else {
        card.classList.remove('selected');
    }
}

// Update selected count
function updateSelectedCount() {
    document.getElementById('selectedCount').textContent = selectedImages.size;

    const saveBtn = document.getElementById('saveBtn');
    saveBtn.disabled = selectedImages.size === 0;
}

// Toggle between viewport/all images
document.getElementById('toggleViewBtn').addEventListener('click', async () => {
    showingAll = !showingAll;

    if (showingAll) {
        // Fetch all images from page if not already
        if (allImages.length === 0) {
            // We need to ask the active tab to send us all images
            // NOTE: We cannot simply use chrome.tabs.query currentWindow in a POPUP 
            // because the popup IS the current window. We need the LAST active tab 
            // or search for tabs that match the source URL.
            // However, typical pattern:

            const { sourceUrl } = await chrome.storage.local.get(['sourceUrl']);

            // Find the tab that matches sourceUrl
            const tabs = await chrome.tabs.query({});
            const sourceTab = tabs.find(t => t.url === sourceUrl) || tabs.find(t => t.active && t.id !== chrome.windows.WINDOW_ID_CURRENT);

            if (sourceTab) {
                try {
                    const results = await chrome.scripting.executeScript({
                        target: { tabId: sourceTab.id },
                        func: () => {
                            // --- Deep scan (matches background.js logic) ---
                            function getBestUrlFromSrcset(srcset) {
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

                            function getBgUrl(el, pseudo = null) {
                                try {
                                    const style = window.getComputedStyle(el, pseudo);
                                    const bg = style.backgroundImage;
                                    if (bg && bg !== 'none' && bg.includes('url(')) {
                                        const matches = bg.match(/url\(['"]?(.*?)['"]?\)/g);
                                        if (matches && matches.length > 0) {
                                            return matches[0].slice(4, -1).replace(/["']/g, '');
                                        }
                                    }
                                } catch (e) {}
                                return null;
                            }

                            function getElRect(el) {
                                const rect = el.getBoundingClientRect();
                                // <picture> elements often have 0x0 rects; use inner <img> rect
                                if ((rect.width === 0 || rect.height === 0) && el.tagName === 'PICTURE') {
                                    const img = el.querySelector('img');
                                    if (img) return img.getBoundingClientRect();
                                }
                                return rect;
                            }

                            const results = [];
                            const seenUrls = new Set();

                            function add(src, el, alt = '') {
                                if (!src) return;
                                try { src = new URL(src, document.baseURI).href; } catch (e) {}
                                if (seenUrls.has(src)) return;
                                seenUrls.add(src);
                                const rect = getElRect(el);
                                results.push({
                                    src,
                                    alt,
                                    width: el.naturalWidth || Math.round(rect.width),
                                    height: el.naturalHeight || Math.round(rect.height)
                                });
                            }

                            function isBigEnough(rect) {
                                return rect.width > 50 && rect.height > 50;
                            }

                            document.querySelectorAll('img').forEach(img => {
                                if (img.closest('picture')) return; // Handled in <picture> scan for highest res
                                const rect = img.getBoundingClientRect();
                                if (!isBigEnough(rect)) return;
                                const srcsetUrl = getBestUrlFromSrcset(img.getAttribute('srcset') || img.getAttribute('data-srcset'));
                                const dataUrl = img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-full-url');
                                add(srcsetUrl || dataUrl || img.currentSrc || img.src, img, img.alt);
                            });

                            document.querySelectorAll('picture').forEach(picture => {
                                const rect = getElRect(picture);
                                if (!isBigEnough(rect)) return;
                                const sources = picture.querySelectorAll('source');
                                for (const source of sources) {
                                    const url = getBestUrlFromSrcset(source.getAttribute('srcset'));
                                    if (url) { add(url, picture); return; }
                                }
                                const img = picture.querySelector('img');
                                if (img) add(img.currentSrc || img.src, picture, img.alt);
                            });

                            document.querySelectorAll('video').forEach(video => {
                                const rect = video.getBoundingClientRect();
                                if (!isBigEnough(rect)) return;
                                if (video.poster) add(video.poster, video);
                            });

                            document.querySelectorAll('[style*="background-image"], [style*="background:"]').forEach(el => {
                                const rect = el.getBoundingClientRect();
                                if (!isBigEnough(rect)) return;
                                const bg = getBgUrl(el);
                                if (bg) add(bg, el);
                            });

                            const allEls = document.querySelectorAll('*');
                            const limit = Math.min(allEls.length, 500);
                            for (let i = 0; i < limit; i++) {
                                const el = allEls[i];
                                const rect = el.getBoundingClientRect();
                                if (rect.width <= 50 || rect.height <= 50) continue;
                                const bg = getBgUrl(el);
                                if (bg) add(bg, el);
                                const beforeBg = getBgUrl(el, ':before');
                                if (beforeBg) add(beforeBg, el);
                            }

                            return results;
                        }
                    });
                    allImages = results[0]?.result || [];
                } catch (e) {
                    console.error("Failed to fetch all images", e);
                    // Fallback to visible if fail
                    allImages = visibleImages;
                }
            } else {
                // Fallback if tab closed
                allImages = visibleImages;
            }
        }

        renderImages(allImages);

        document.getElementById('imageCount').textContent =
            `Showing all ${allImages.length} images on page`;
        document.getElementById('toggleViewBtn').innerHTML =
            `👁️ Show only visible images (${visibleImages.length})`;

    } else {
        renderImages(visibleImages);

        document.getElementById('imageCount').innerHTML =
            `Found <strong>${visibleImages.length}</strong> images in current view`;
        // We get total from storage usually, but if we fetched it, update it
        const total = allImages.length > 0 ? allImages.length : (document.getElementById('totalCount').textContent || 0);

        document.getElementById('toggleViewBtn').innerHTML =
            `📄 Show all images on page (<span id="totalCount">${total}</span> total)`;
    }
});

// Select All
document.getElementById('selectAllBtn').addEventListener('click', () => {
    const currentImages = showingAll ? allImages : visibleImages;
    currentImages.forEach(img => selectedImages.add(img.src));
    renderImages(currentImages);
});

// Deselect All
document.getElementById('deselectAllBtn').addEventListener('click', () => {
    selectedImages.clear();
    const currentImages = showingAll ? allImages : visibleImages;
    renderImages(currentImages);
});

// Save selected images
document.getElementById('saveBtn').addEventListener('click', async () => {
    if (selectedImages.size === 0) return;

    const currentImages = showingAll ? allImages : visibleImages;
    // Get full image objects for selected src
    // Handle duplicates if src appears multiple times? Set only stores unique src.
    // We map back to find the first image object with that src.
    const selected = [];
    selectedImages.forEach(src => {
        const img = currentImages.find(i => i.src === src);
        if (img) selected.push(img);
    });

    // Get current project from storage
    // Note: activeContext is stored as 'dreamlab_active_context' in LOCAL storage of web app, 
    // but extension syncs it to chrome.storage.local as 'activeWorkspaceId', 'activeProjectId'?
    // Let's check context.md or previous learnings.
    // Changelog 0.4.0: "Persistent Active Context: The app now remembers... Extension: Auto-saves captures to the currently active project"
    // Actually, background.js creates item without ID, App.jsx assigns it if undefined.
    // But here we want to direct it specifically?
    // Let's rely on background.js 'saveCapturedItem' logic or similar.
    // In multi-select.js plan: "workspaceId: activeWorkspaceId".
    // We should fetch these from storage.

    const storageData = await chrome.storage.local.get([
        'activeWorkspaceId',
        'activeProjectId',
        'sourceUrl'
    ]);

    const activeWorkspaceId = storageData.activeWorkspaceId;
    const activeProjectId = storageData.activeProjectId;

    // Save each image
    // We can send one bulk message or multiple.
    // Plan says "Save each image" loop.

    // Actually, background.js has 'saveCapturedItem' -> saveItemToWebApp.
    // But background.js also has 'saveItem' internal function.
    // We should send a message to background to save.

    // Wait, the plan says: `chrome.runtime.sendMessage({ action: 'saveItem', item: ... })`
    // But background.js typically listens for 'saveCapturedItem' from POPUP.
    // Let's check background.js again.
    // It has `chrome.runtime.onMessage.addListener((request...) => { if (request.action === 'saveCapturedItem') ... })`

    // Correct action is 'saveCapturedItem'.

    let successCount = 0;

    for (const img of selected) {
        await chrome.runtime.sendMessage({
            action: 'saveCapturedItem',
            item: {
                type: 'image',
                content: img.src,
                sourceUrl: storageData.sourceUrl || '',
                workspaceId: activeWorkspaceId,
                projectId: activeProjectId,
                metadata: {
                    width: img.width,
                    height: img.height,
                    alt: img.alt
                },
                timestamp: Date.now()
            }
        });
        successCount++;
    }

    // Show success
    showSuccess(successCount);

    // Close after 1 second
    setTimeout(() => window.close(), 1000);
});

// Show success message
function showSuccess(count) {
    const footer = document.querySelector('.modal-footer');
    footer.innerHTML = `
    <div class="success-message">
      ✓ Saved ${count} item${count > 1 ? 's' : ''} to your project
    </div>
  `;
}

// Cancel
document.getElementById('cancelBtn').addEventListener('click', () => {
    window.close();
});

document.getElementById('closeBtn').addEventListener('click', () => {
    window.close();
});
