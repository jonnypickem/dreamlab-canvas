(() => {
    const DEFAULT_MESSAGE = 'Dreamlab Picker: Click to capture an image or background (Esc to cancel)';

    if (window.dreamlabPickerActive) {
        // Toggle off if already active
        if (typeof cleanup === 'function') cleanup();
        return;
    }

    window.dreamlabPickerActive = true;
    let hoveredElement = null;

    // Create instruction message
    const msg = document.createElement('div');
    msg.className = 'dreamlab-picker-overlay-msg';
    msg.textContent = DEFAULT_MESSAGE;
    document.body.appendChild(msg);

    // Visual helper for highlighting
    function showHighlight(target, text = null) {
        if (hoveredElement) {
            hoveredElement.classList.remove('dreamlab-picker-highlight');
        }
        if (target) {
            hoveredElement = target;
            hoveredElement.classList.add('dreamlab-picker-highlight');
            if (text) {
                msg.textContent = text;
                // Revert text after a moment if it was a transient status
                if (text !== 'Captured!') {
                    setTimeout(() => {
                        if (msg.textContent === text) msg.textContent = DEFAULT_MESSAGE;
                    }, 2000);
                }
            }
        }
    }

    function highlight(e) {
        if (e.target === msg) return;
        showHighlight(e.target);
    }

    function cleanup() {
        if (hoveredElement) {
            hoveredElement.classList.remove('dreamlab-picker-highlight');
        }
        document.removeEventListener('mouseover', highlight);
        document.removeEventListener('click', handleClick, true);
        document.removeEventListener('keydown', handleKey);
        if (msg.parentNode) msg.remove();
        window.dreamlabPickerActive = false;

        // Remove function references from global scope if they were attached (not needed here as IIFE)
    }

    function handleKey(e) {
        if (e.key === 'Escape') {
            cleanup();
        }
    }

    /**
     * Main Click Handler
     */
    async function handleClick(e) {
        e.preventDefault();
        e.stopPropagation();

        const target = e.target;
        if (target === msg) return;

        let content = null;
        let visualElement = null;

        // Deep Search Strategy:
        // 1. Check Self
        // 2. Check Ancestors
        // 3. For each ancestor, SCAN ITS CHILDREN (Container Scan) for sibling images

        let currentEl = target;
        const clickRect = target.getBoundingClientRect();

        for (let i = 0; i < 10; i++) { // Check up to 10 levels up (deep DOMs like Apple.com)
            if (!currentEl || currentEl === document.body) break;

            // A. Check the element itself
            const selfContent = getVisualFromElement(currentEl);
            if (selfContent) {
                content = selfContent;
                visualElement = currentEl;
                break;
            }

            // B. Container Scan: Check children of this ancestor
            // Use this strictly for finding IMAGES that might be under/over the click
            if (i >= 0) {
                const childVisual = findProminentVisualInContainer(currentEl, clickRect);
                if (childVisual) {
                    content = childVisual.content;
                    visualElement = childVisual.element;
                    break;
                }
            }

            currentEl = currentEl.parentElement;
        }

        if (content) {
            // Resolve relative URLs to absolute
            try { content = new URL(content, document.baseURI).href; } catch (e) { }

            // Get page metadata for title/description
            const getMeta = (name) => {
                const el = document.querySelector(`meta[property="${name}"], meta[name="${name}"]`);
                return el ? el.getAttribute('content') : null;
            };
            const pageTitle = getMeta('og:title') || getMeta('twitter:title') || document.title;
            const pageDescription = getMeta('og:description') || getMeta('description');

            // Send to background
            const item = {
                type: 'image',
                content: content,
                title: pageTitle || null,
                description: pageDescription || null,
                sourceUrl: window.location.href,
                timestamp: Date.now()
            };

            showHighlight(visualElement || target, "Saving...");
            msg.style.background = '#171717';
            msg.style.borderColor = '#404040';

            const saveResponse = await new Promise((resolve) => {
                chrome.runtime.sendMessage({ action: 'saveCapturedItem', item: item }, (response) => {
                    if (chrome.runtime.lastError) {
                        resolve({
                            success: false,
                            error: chrome.runtime.lastError.message || 'Could not contact extension background worker.',
                        });
                        return;
                    }
                    resolve(response || { success: false, error: 'No response from extension.' });
                });
            });

            if (saveResponse?.success) {
                showHighlight(visualElement || target, "Captured!");
                msg.style.background = '#15803d';
                msg.style.borderColor = '#166534';
                setTimeout(cleanup, 800);
            } else {
                const errorMessage = String(saveResponse?.error || 'Failed to save capture to Dreamlab.').trim();
                msg.textContent = errorMessage || 'Failed to save capture to Dreamlab.';
                msg.style.background = '#b91c1c';
                msg.style.borderColor = '#991b1b';
            }
        } else {
            // Failure
            console.log("Dreamlab Picker: No visual content found.");
            msg.textContent = 'No image found at this location';
            msg.style.background = '#b91c1c';
            msg.style.borderColor = '#991b1b';
        }
    }

    /**
     * Scans a container for the most likely "main" image matching the click
     */
    function findProminentVisualInContainer(container, targetRect) {
        let bestCandidate = null;
        let maxArea = 0;

        function evaluateCandidate(el) {
            const visualContent = getVisualFromElement(el);
            if (!visualContent) return;

            const rect = el.getBoundingClientRect();
            if (rect.width <= 5 || rect.height <= 5) return;

            const intersects = !(rect.right < targetRect.left ||
                rect.left > targetRect.right ||
                rect.bottom < targetRect.top ||
                rect.top > targetRect.bottom);

            if (intersects) {
                const area = rect.width * rect.height;
                if (area > maxArea) {
                    maxArea = area;
                    bestCandidate = { element: el, content: visualContent };
                }
            }
        }

        // Phase 1: Fast selector-based search (img, picture, video, inline backgrounds)
        const selectorCandidates = container.querySelectorAll(
            'img, picture, video, [style*="background-image"], [style*="background:"]'
        );
        for (const el of selectorCandidates) {
            evaluateCandidate(el);
        }
        if (bestCandidate) return bestCandidate;

        // Phase 2: Computed style fallback for CSS-class-applied background images
        // (Sites like Apple.com apply backgrounds via CSS classes, not inline styles)
        const allChildren = container.querySelectorAll('*');
        const limit = Math.min(allChildren.length, 200);
        for (let i = 0; i < limit; i++) {
            const el = allChildren[i];
            const rect = el.getBoundingClientRect();
            if (rect.width <= 50 || rect.height <= 50) continue;

            const intersects = !(rect.right < targetRect.left ||
                rect.left > targetRect.right ||
                rect.bottom < targetRect.top ||
                rect.top > targetRect.bottom);
            if (!intersects) continue;

            const bg = getBg(el);
            if (bg) {
                const area = rect.width * rect.height;
                if (area > maxArea) {
                    maxArea = area;
                    bestCandidate = { element: el, content: bg };
                }
            }

            // Also check pseudo-elements on large overlapping elements
            const beforeBg = getBg(el, ':before');
            if (beforeBg) {
                const area = rect.width * rect.height;
                if (area > maxArea) {
                    maxArea = area;
                    bestCandidate = { element: el, content: beforeBg };
                }
            }
        }

        return bestCandidate;
    }

    function getVisualFromElement(el) {
        if (!el) return null;

        // 1. Check if Image
        if (el.tagName === 'IMG') {
            // Prioritize high-resolution attributes
            const srcsetUrl = getBestUrlFromSrcset(el.getAttribute('srcset') || el.getAttribute('data-srcset'));
            const dataUrl = el.getAttribute('data-src') || el.getAttribute('data-original') || el.getAttribute('data-full-url');

            if (srcsetUrl) return srcsetUrl;
            if (dataUrl) return dataUrl;

            return el.currentSrc || el.src;
        }

        // 2. Check Picture
        if (el.tagName === 'PICTURE') {
            // Parse <source> elements for the highest resolution URL
            const sources = el.querySelectorAll('source');
            let bestSourceUrl = null;
            for (const source of sources) {
                const srcset = source.getAttribute('srcset');
                const url = getBestUrlFromSrcset(srcset);
                if (url) { bestSourceUrl = url; break; } // First source is typically the largest
            }
            if (bestSourceUrl) return bestSourceUrl;

            // Fallback to the <img> inside
            const img = el.querySelector('img');
            if (img) return getVisualFromElement(img);
        }

        // 3. Check Background Image (Self)
        let bg = getBg(el);
        if (bg) {
            // Heuristic: check if there's a higher res version by manipulating the URL? 
            // Common for Shopify: _small.jpg -> .jpg
            // But for now, just return what we have.
            return bg;
        }

        // 4. Check Pseudo Elements (::before, ::after)
        const before = getBg(el, ':before');
        if (before) return before;
        const after = getBg(el, ':after');
        if (after) return after;

        // 5. Check Video (poster frame)
        if (el.tagName === 'VIDEO') {
            if (el.poster) return el.poster;
            // Try to get poster from source elements or fallback
            const source = el.querySelector('source');
            if (source && source.src) return null; // Video without poster, skip
        }

        // 6. Check SVG
        if (el.tagName === 'svg') {
            return getSvgContent(el);
        }

        return null;
    }

    /**
     * Parses srcset attribute and returns the URL of the largest image
     */
    function getBestUrlFromSrcset(srcset) {
        if (!srcset) return null;
        try {
            const sources = srcset.split(',').map(s => {
                const parts = s.trim().split(/\s+/);
                // url is first
                const url = parts[0];
                let size = 0;
                // descriptor is optional
                if (parts.length > 1) {
                    const descriptor = parts[1];
                    // '1000w' -> 1000, '2x' -> ~2000 (rough normalization)
                    if (descriptor.endsWith('w')) size = parseInt(descriptor);
                    else if (descriptor.endsWith('x')) size = parseFloat(descriptor) * 1000;
                }
                return { url, size };
            });

            // Sort descending by size
            sources.sort((a, b) => b.size - a.size);

            // Return largest
            return sources[0]?.url;
        } catch (e) {
            return null;
        }
    }

    function getBg(el, pseudo = null) {
        try {
            const style = window.getComputedStyle(el, pseudo);
            const bg = style.backgroundImage;
            if (bg && bg !== 'none' && bg.includes('url(')) {
                const matches = bg.match(/url\(['"]?(.*?)['"]?\)/g);
                if (matches && matches.length > 0) {
                    return matches[0].slice(4, -1).replace(/["']/g, '');
                }
            }
        } catch (e) { return null; }
        return null;
    }

    function getSvgContent(el) {
        try {
            const serializer = new XMLSerializer();
            const source = serializer.serializeToString(el);
            return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(source)));
        } catch (e) { return null; }
    }

    // Attach Listeners
    document.addEventListener('mouseover', highlight);
    document.addEventListener('click', handleClick, { capture: true }); // Capture phase!
    document.addEventListener('keydown', handleKey);

})();
