// Check if a description is useful (not a URL, not too short, not gibberish)
function isUsefulDescription(desc) {
    if (!desc || typeof desc !== 'string') return false;
    const trimmed = desc.trim();
    if (trimmed.length < 10) return false; // Too short to be useful
    if (/^https?:\/\//i.test(trimmed)) return false; // It's a URL
    if (/^[a-f0-9-]{20,}$/i.test(trimmed)) return false; // Looks like a hash/ID
    return true;
}

function createContextMenus() {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: "save-to-dreamlab-image",
            title: "Save Image to Dreamlab",
            contexts: ["image"]
        });

        chrome.contextMenus.create({
            id: "save-to-dreamlab-text",
            title: "Save Selection to Dreamlab",
            contexts: ["selection"]
        });

        chrome.contextMenus.create({
            id: "save-to-dreamlab-page",
            title: "Save Page to Dreamlab",
            contexts: ["page", "link"]
        });

        if (chrome.runtime.lastError) {
            console.error("Context menu creation error:", chrome.runtime.lastError);
        }
    });
}

// Initialize context menus
chrome.runtime.onInstalled.addListener(() => {
    createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
    createContextMenus();
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    let item = null;

    if (info.menuItemId === "save-to-dreamlab-image") {
        const metadata = await getPageMetadata(tab.id, tab.url);
        item = {
            type: 'image',
            content: info.srcUrl,
            title: metadata.title || tab.title || null,
            description: isUsefulDescription(metadata.description) ? metadata.description : null,
            sourceUrl: tab.url,
            timestamp: Date.now()
        };
    } else if (info.menuItemId === "save-to-dreamlab-text") {
        item = {
            type: 'text',
            content: info.selectionText,
            sourceUrl: tab.url,
            timestamp: Date.now()
        };
    } else if (info.menuItemId === "save-to-dreamlab-page") {
        const urlToScrape = info.linkUrl || tab.url;
        const metadata = await getPageMetadata(tab.id, urlToScrape);
        item = {
            type: 'link',
            content: metadata.title || tab.title || urlToScrape,
            title: metadata.title || tab.title || null,
            description: isUsefulDescription(metadata.description) ? metadata.description : null,
            thumbnail: metadata.image,
            sourceUrl: urlToScrape,
            timestamp: Date.now()
        };
    }

    if (item) {
        saveItem(item);
    }
});

async function getPageMetadata(tabId, targetUrl) {
    // Helper to normalize URLs for comparison
    const normalize = (u) => {
        try {
            const url = new URL(u);
            return (url.origin + url.pathname).replace(/\/$/, '').replace('://www.', '://');
        } catch (e) { return u; }
    };

    // Fetch-based metadata extraction (works for any URL)
    const fetchMetadata = async (url) => {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
        const html = await response.text();

        const getMatch = (property) => {
            const regex = new RegExp(`<meta[^>]*property=["'](?:og:|twitter:)?${property}["'][^>]*content=["']([^"']+)["']|<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:og:|twitter:)?${property}["']`, 'i');
            const match = html.match(regex);
            return match ? (match[1] || match[2]) : null;
        };

        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = getMatch('title') || (titleMatch ? titleMatch[1] : null);
        let image = getMatch('image:secure_url') || getMatch('image:url') || getMatch('image');

        if (image && !image.startsWith('http')) {
            try {
                image = new URL(image, url).href;
            } catch (e) { }
        }

        return {
            title: title || null,
            image: image || null,
            description: getMatch('description') || null
        };
    };

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const isCurrentPage = tab && normalize(tab.url) === normalize(targetUrl);

        if (isCurrentPage) {
            // Try live DOM extraction first (handles JS-rendered meta tags)
            let domResult = {};
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId },
                    func: () => {
                        const getMeta = (name) => {
                            const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"], meta[itemprop="${name}"]`);
                            return el ? el.getAttribute('content') : null;
                        };

                        const title = getMeta('og:title') || getMeta('twitter:title') || document.title;
                        let image = getMeta('og:image:secure_url') || getMeta('og:image:url') || getMeta('og:image') || getMeta('twitter:image') || getMeta('image');

                        // Resolve relative URLs
                        if (image && !image.startsWith('http')) {
                            try {
                                image = new URL(image, window.location.href).href;
                            } catch (e) {
                                const a = document.createElement('a');
                                a.href = image;
                                image = a.href;
                            }
                        }

                        return {
                            title: title || null,
                            image: image || null,
                            description: getMeta('og:description') || getMeta('description') || null
                        };
                    }
                });
                domResult = results[0]?.result || {};
            } catch (e) {
                console.log("DOM extraction failed, will try fetch:", e);
            }

            // If DOM extraction found an image, return it
            if (domResult.image) return domResult;

            // Otherwise fall back to fetch-based extraction
            try {
                const fetchResult = await fetchMetadata(targetUrl);
                return {
                    title: domResult.title || fetchResult.title,
                    image: fetchResult.image,
                    description: domResult.description || fetchResult.description
                };
            } catch (e) {
                console.log("Fetch fallback also failed:", e);
                return domResult;
            }
        } else {
            // External link — use fetch-based extraction
            return await fetchMetadata(targetUrl);
        }
    } catch (err) {
        console.error("Metadata extraction failed:", err);
        return {};
    }
}

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
    if (command === "save-page") {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        // Get selection separately so it can't block metadata extraction
        let selection = '';
        try {
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => window.getSelection().toString(),
            });
            selection = (results[0]?.result || '').trim();
        } catch (err) {
            console.log("Could not get selection:", err);
        }

        if (selection) {
            saveItem({
                type: 'text',
                content: selection,
                sourceUrl: tab.url,
                timestamp: Date.now()
            });
        } else {
            // Always attempt metadata extraction for link saves
            const metadata = await getPageMetadata(tab.id, tab.url);
            saveItem({
                type: 'link',
                content: metadata.title || tab.title || tab.url,
                title: metadata.title || tab.title || null,
                description: isUsefulDescription(metadata.description) ? metadata.description : null,
                thumbnail: metadata.image || null,
                sourceUrl: tab.url,
                timestamp: Date.now()
            });
        }
    } else if (command === "capture-visible") {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        try {
            // Inject script to scan for images
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // --- Deep scan helpers ---
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
                        } catch (e) { }
                        return null;
                    }

                    function deepScan(viewportOnly) {
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
                            try { src = new URL(src, document.baseURI).href; } catch (e) { }
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

                        // 1. <img> elements (skip those inside <picture> — handled in step 2 for highest res)
                        document.querySelectorAll('img').forEach(img => {
                            if (img.closest('picture')) return;
                            if (!isVisible(img.getBoundingClientRect())) return;
                            const srcsetUrl = getBestUrlFromSrcset(img.getAttribute('srcset') || img.getAttribute('data-srcset'));
                            const dataUrl = img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-full-url');
                            add(srcsetUrl || dataUrl || img.currentSrc || img.src, img, img.alt);
                        });

                        // 2. <picture> elements
                        document.querySelectorAll('picture').forEach(picture => {
                            if (!isVisible(getElRect(picture))) return;
                            const sources = picture.querySelectorAll('source');
                            for (const source of sources) {
                                const url = getBestUrlFromSrcset(source.getAttribute('srcset'));
                                if (url) { add(url, picture); return; }
                            }
                            const img = picture.querySelector('img');
                            if (img) add(img.currentSrc || img.src, picture, img.alt);
                        });

                        // 3. <video> elements (poster)
                        document.querySelectorAll('video').forEach(video => {
                            const rect = video.getBoundingClientRect();
                            if (!isVisible(rect)) return;
                            if (video.poster) add(video.poster, video);
                        });

                        // 4. Inline background images
                        document.querySelectorAll('[style*="background-image"], [style*="background:"]').forEach(el => {
                            const rect = el.getBoundingClientRect();
                            if (!isVisible(rect)) return;
                            const bg = getBgUrl(el);
                            if (bg) add(bg, el);
                        });

                        // 5. Computed style fallback (CSS-class backgrounds)
                        const allEls = document.querySelectorAll('*');
                        const limit = Math.min(allEls.length, 500);
                        for (let i = 0; i < limit; i++) {
                            const el = allEls[i];
                            const rect = el.getBoundingClientRect();
                            if (rect.width <= 50 || rect.height <= 50) continue;
                            if (!isVisible(rect)) continue;
                            const bg = getBgUrl(el);
                            if (bg) add(bg, el);
                            const beforeBg = getBgUrl(el, ':before');
                            if (beforeBg) add(beforeBg, el);
                        }

                        return results;
                    }

                    return {
                        visibleImages: deepScan(true),
                        totalCount: deepScan(false).length
                    };
                }
            });

            const scanResult = results[0]?.result;
            if (scanResult) {
                // Store images and open multi-select window
                await chrome.storage.local.set({
                    multiSelectImages: scanResult.visibleImages,
                    totalImagesCount: scanResult.totalCount,
                    sourceUrl: tab.url
                });

                chrome.windows.create({
                    url: 'multi-select.html',
                    type: 'popup',
                    width: 850,
                    height: 650,
                    focused: true
                });
            }
        } catch (err) {
            console.error("Multi-select scan failed:", err);
        }
    } else if (command === "smart-picker") {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        try {
            await chrome.scripting.insertCSS({
                target: { tabId: tab.id },
                files: ["picker.css"]
            });
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["picker.js"]
            });
        } catch (err) {
            console.error("Failed to inject picker:", err);
        }
    }
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'saveCapturedItem') {
        saveItemToWebApp(request.item)
            .then(() => sendResponse({ success: true }))
            .catch((err) => sendResponse({ success: false, error: err.message }));
        return true; // Keep message channel open for async response
    } else if (request.action === 'openMultiSelect') {
        // Store images temporarily
        chrome.storage.local.set({
            multiSelectImages: request.images,
            totalImagesCount: request.totalImagesCount,
            sourceUrl: request.sourceUrl
        });

        // Open modal as popup window
        chrome.windows.create({
            url: 'multi-select.html',
            type: 'popup',
            width: 850,
            height: 650,
            focused: true
        });
    }
});

async function saveItem(item) {
    // Store as pending for the popup to show
    await chrome.storage.local.set({ pendingCapture: item });

    // Also try to save immediately if possible
    try {
        await saveItemToWebApp(item);
        // If successful, clear pending
        await chrome.storage.local.remove('pendingCapture');
    } catch (err) {
        console.log("Web app not available, keeping in pending storage", err);
        // Keep in pending storage if web app save fails (e.g. not open)
    }
}

async function saveItemToWebApp(item) {
    // Find Dreamlab tabs
    const tabs = await chrome.tabs.query({ url: "http://localhost:5173/*" });

    if (tabs.length === 0) {
        throw new Error("Dreamlab web app is not open (localhost:5173)");
    }

    // Prefer active tab in current window; fallback to most recently accessed tab.
    const activeTabs = await chrome.tabs.query({
        url: "http://localhost:5173/*",
        active: true,
        currentWindow: true
    });
    const targetTab = activeTabs[0]
        || [...tabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];

    return new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(targetTab.id, { action: 'SAVE_ITEM', item }, (response) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (response && response.success) {
                resolve();
            } else {
                reject(new Error("Failed to save to web app"));
            }
        });
    });
}
