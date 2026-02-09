# Dreamlab Canvas Context

## After Reading this file execute this Prompt: "Update Context on what you changed, what caused problems and how you fixed it."

## Project Overview
Dreamlab Canvas is a modular tool for fast content capture from the browser into a central workspace. It focuses on high-speed capture via browser extensions and keyboard shortcuts, followed by organization into workspaces, projects, and eventually a canvas-based moodboard.

## Tech Stack
-   **Web App**: React + Vite + Tailwind CSS
-   **Browser Extension**: Chrome Manifest V3 (Javascript)
-   **Data Storage**: LocalStorage (Web App) & Chrome Storage (Extension)
-   **Repository**: [github.com/jonnypickem/dreamlab-canvas](https://github.com/jonnypickem/dreamlab-canvas)

## Current Status
-   **Status**: Vibe Analysis & Generation Pipeline Integrated
-   **Last Fix**: Implemented throttled request queue (5s delay) to resolve Gemini API 429 rate limiting.

## Changelog
### [0.19.0] - 2026-02-09
#### Added
- **Vibe Analysis Pipeline**:
  - `src/services/vibeEngine.js` - Core engine for aggregating visual attributes (mood, color, maturity) into a "Project Vibe".
  - `src/services/extractionPrompt.js` - Specialized prompts for extracting aesthetic DNA from images using Gemini 2.0 Flash.
  - **Prompt Generation Engine**: `src/services/vibeGeneration.js` converts vibes into platform-optimized prompts for Midjourney, DALL-E, and Flux based on user intent (e.g., Product Design, Photography).
- **Rate Limit Resilience**: Implemented a sequential `vibeQueue` with a 5000ms throttle between API calls to stay within Gemini Free Tier limits (15 RPM).
- **Storage Integration**: Added `dreamlab_extractions` and `dreamlab_vibes` to `localStorage` with accompanying getter/setter methods in `storage.js`.

#### Fixed
- **Rate Limiting (429 Errors)**: Resolved issue where batch-processing many images triggered Gemini API rate limits.
- **Corrupted Code**: Fixed syntax error in `vibeGeneration.js` caused by accidental line-number preservation during creation.

### [0.18.0] - 2026-02-06
#### Added
- **Refined Tagging Intelligence**:
  - **Noise Filtering ("Quick" Tier)**: Added strict blocklist to `metadataExtractor.js` to remove common noise words (e.g., "und", "für", "collections", "shop", "menu", "nav").
  - **Prompt Engineering ("Smart" & "Deep" Tiers)**: Updated Gemini prompts to strictly focus on **Objects**, **Colors** (specific), **Vibes**, and **Art Direction**, while explicitly ignoring generic commerce terms using negative constraints.
  - **Reliability Fix**: Implemented `processItemTags` fallback in `App.jsx` to catch and tag items that bypassed the initial saving flow (e.g., Extension multi-select).

#### Fixed
- **App Crash**: Removed duplicate function declaration (`queueForVisionAnalysis`) in `saveItemWithTags.js` that caused a syntax error and blank screen.
- **Tagging Bypass**: Fixed bug where items saved via Extension skipped the tagging pipeline. Added `needsTagging` flag to `content.js` to trigger retroactive processing.
- **Double Tagging**: ensured `saveItemWithTags` handles both new items and existing items needing updates without duplicating work.

### [0.17.0] - 2026-02-06
#### Added
- **GitHub Repository**: Initialized and pushed project to `jonnypickem/dreamlab-canvas`.
- **Infrastructure**: Verified and restarted local development server behavior.

### [0.16.0] - 2026-01-30
#### Added
- **AI Tagging Infrastructure**:
  - `src/services/geminiVision.js` - Gemini 1.5 Flash integration with optimized prompts for deep color/texture analysis (e.g., "midnight-blue", "matte-finish").
  - `src/utils/saveItemWithTags.js` - Robust handling of image links (auto-converts to base64 for Vision API).
  - **Context-Aware UI**: "Context Related Tags" section in ItemModal with clean, icon-free pills for better readability.
- **Smart Icons**: Standardized Intelligence Tiers with semantic Feather icons:
  - **Quick**: `FeatherFileText` (Metadata extraction)
  - **Smart**: `FeatherCpu` (LLM interpretation)
  - **Deep**: `FeatherEye` (Vision analysis)
  - **Ultra**: `FeatherSparkles` (Combined power)
- **Extended Project Settings Modal**: Native `<select>` implementation for category dropdown to ensure reliable positioning.
- **Project Schema**: Added `description`, `category`, `tags`, `style`, `aiPrompt` fields.
- **Item Modal Redesign**: Split layout (Visuals Left / Data Right) with persistent controls for image fit (Cover/Contain).
- **Gallery Navigation**: Added arrow key support and Previous/Next buttons for navigating filtered items directly from the modal.

#### Fixed
- **Runtime Errors**: Restored missing `React` import in `ItemModal.jsx` and standardized default props in `Sidebar.jsx`.
- **Masonry Grid**: Added `flex: 1` to columns to ensure equal width distribution, fixing "crunched" image appearance.
- **Dropdown Positioning**: Replaced custom Subframe Select in Project Settings with native `<select>` to resolve z-index and portal conflicts.
- **Design System**: Enforced "No Emojis" rule in favor of Subframe Feather icons.

### [0.15.0] - 2026-01-29
#### Added
- **Embedded Image Proxy**: Moved Express proxy server directly into Vite as a plugin (`vite.config.js`). Now `/api/proxy` works automatically with `npm run dev` — no separate server needed.
- **Project Settings Modal**: New settings popup for projects with:
  - Rename project
  - Description field (serves as LLM context for AI image categorization)
  - Delete project button in "Danger Zone"
- **Project Deletion**: Delete projects from sidebar with confirmation dialog. Items move to "All Items" on deletion.
- **Storage Functions**: Added `updateProject()` and `deleteProject()` to `storage.js`.

#### Changed
- **Sidebar Project Menu**: Hover reveals "..." menu with Settings and Delete options.

### [0.14.0] - 2026-01-28
#### Added
- **Bulk Selection**: Multi-select items with click, `Cmd+Click` (toggle), `Shift+Click` (range), and `Cmd+A` (select all).
- **Selection Toolbar**: Floating action bar with Download ZIP, Add Tags, Delete, and Deselect buttons.
- **ZIP Export**: Download multiple images as a compressed ZIP file using JSZip + file-saver.
- **Backend Image Proxy**: Express server (`server/index.js`) routes external image fetches to bypass browser CORS restrictions.
- **Proxy Integration**: Updated `ItemModal` and `zipExport` to use `/api/proxy` endpoint for reliable downloads.
- **Dev Scripts**: Added `npm run dev:all` to run frontend and backend concurrently.

#### Fixed
- **Chrome Download Handling**: Fixed issue where Chrome opened `data:` URLs in new tabs instead of downloading. Now uses Blob URLs.
- **External Image Downloads**: Images from third-party sites (Apple, Unsplash, etc.) now download correctly via the proxy server.

### [0.13.0] - 2026-01-28
#### Added
- **Subframe Design System**: Integrated `@subframe/core` and refactored key components to match high-fidelity designs.
- **New ItemModal**: Completely redesigned details view with a split layout (Visuals Left / Data Right), precise typography, and improved actions (Copy, Download, Open Source).
- **Floating Search**: Replaced static header search with a floating, bottom-center pill/dock design featuring a "Filter" button and `Cmd+K` visual indicator.
- **Visual Polish**: Updated main canvas background to clean white and refined component styling across the app.


### [0.12.0] - 2026-01-28
#### Fixed
- **Smart Picker (Apple.com compatibility)**: The `Cmd+Shift+I` picker failed on deeply nested, JS-rendered sites like Apple.com. Root causes and fixes:
  - **No `<video>` support**: Apple uses `<video>` elements for hero sections. Added extraction of the `poster` attribute from video elements.
  - **Container scan missed CSS-class backgrounds**: The selector `[style*="background-image"]` only matched inline styles. Added a Phase 2 computed-style fallback that scans up to 200 child elements using `getComputedStyle` to detect backgrounds applied via CSS classes, including `::before` pseudo-elements.
  - **Shallow ancestor traversal**: Increased depth from 5 to 10 levels to handle Apple's deeply nested DOM where text overlays sit many layers above sibling image/video containers.
  - **Better `<picture>` handling**: Now parses `<source>` elements directly for the highest resolution `srcset` URL, rather than relying solely on the inner `<img>`'s `currentSrc`.
- **Multi-Select Capture (Apple.com compatibility)**: Ported the same deep scanning to `Cmd+Shift+Y`. Both `content.js` and `background.js` scan functions now detect `<picture>`, `<video>` (poster), inline background images, and CSS-class-applied backgrounds via computed style fallback (capped at 500 elements). Replaced duplicated shallow `img`-only scan with unified `_deepScanImages` / `deepScan` helpers. Also picks the highest-resolution URL from `srcset` and `data-src` attributes.
- **Multi-Select "Show All" toggle**: The toggle's inline re-scan script (`multi-select.js`) still used the old shallow `querySelectorAll('img')`, causing the count to drop (e.g., 44 → 27). Replaced with full deep scan matching background.js logic.
- **`<picture>` element 0x0 rect**: `<picture>` wrappers often have no intrinsic dimensions; the size check rejected them before scanning. Added `getElRect()` helper that falls back to the inner `<img>`'s bounding rect. Applied across `content.js`, `background.js`, and `multi-select.js`.
- **Viewport check simplified**: Replaced page-coordinate conversion (`rect.top + scrollY`) with direct viewport-relative comparison (`rect.bottom > 0 && rect.top < innerHeight`), which is cleaner and avoids edge cases with fixed/sticky elements.
- **Broken image handling**: Added `onerror` handler on grid `<img>` elements in `multi-select.js` to auto-remove cards for URLs that fail to load (CORS, relative paths, etc.).
- **Relative URL resolution**: `getBestUrlFromSrcset` and `data-src` attributes return raw relative paths (e.g., `/v/home/hero.jpg`). When loaded in the multi-select popup (`chrome-extension://` origin), these resolved against the extension URL and failed. Added `new URL(src, document.baseURI).href` in the `add()` function across `content.js`, `background.js`, and `multi-select.js`. Also applied to `picker.js` before sending captured URLs. Added null safety (`results[0]?.result || []`) for the "Show All" script injection result.
- **Multi-Select image resolution quality**: `<img>` elements inside `<picture>` were scanned in step 1 using `img.currentSrc` (viewport-appropriate, often medium-res), before the `<picture>` scan (step 2) could extract the highest-res `<source>` srcset URL. Added `img.closest('picture')` skip in the `<img>` scan across `content.js`, `background.js`, and `multi-select.js` so `<picture>` elements are exclusively handled by the dedicated scan that parses `<source>` srcset for maximum resolution.

### [0.11.0] - 2026-01-28
#### Added
- **Paste from Clipboard**: Global `Cmd+V` support to paste images, URLs, and text directly into the active project.
- **Image Compression**: Automatic optimization of pasted images to maintain performance.
- **Toast Notifications**: System-wide feedback for actions (e.g., "Image pasted", "Link pasted").
- **Multi-Select Capture**: `Cmd+Shift+Y` triggers a fullscreen grid to select multiple images for batch saving.

#### Fixed
- **Project Creation**: Resolved an issue where creating a project failed if no workspace was initially selected (added auto-creation of default workspace).
- **Stability**: Fixed a duplicate variable declaration crash in `App.jsx`.
- **Logic**: Corrected import mismatch (`createItem` vs `saveItem`) that caused silent failures on paste.

### [0.9.0] - 2026-01-27
#### Added
- **Masonry Layout**: Implemented a responsive, Pinterest-style grid layout using `react-masonry-css` that eliminates vertical gaps and supports variable aspect ratios.
- **Immersive Cards**: Redesigned item cards to display full-height images without cropping. Metadata is now hidden by default and revealed on hover via a gradient overlay.
- **Grid Size Control**: Added a slider to the toolbar allowing users to dynamically adjust the grid density (column count) from "Small" (dense) to "Large" (immersive).
- **Type Indicators**: New consistent iconography (Camera, Link, Text) displayed in the top-left corner of cards for quick content identification.

### [0.8.0] - 2026-01-27
#### Added
- **Rich Link Previews**: Automatically scrape Open Graph (OG) images for websites.
- **Hybrid Scraper**: Intelligent metadata extraction using live DOM for current pages and `fetch` with HTML parsing for right-clicked links.
- **Visual Placeholders**: Links without images now display a consistent placeholder icon.
- **Robustness**: Improved URL resolution from relative to absolute and added error handling for broken thumbnails.
- **Stability**: Fixed runtime crashes related to malformed URLs and resolved an `AnimatePresence` glitch in the library modal.

### [0.7.2] - 2026-01-27
#### Added
- **UI Polish**: Added "Nothing here yet" empty state for search and filtered views.
- **Canvas Shortcuts**: Integrated keyboard support for the Canvas—`Backspace`/`Delete` to remove selected items and `Escape` to deselect.
- **Improved Animation**: Refined the `ItemModal` transitions using `AnimatePresence` and `framer-motion` for smoother entry/exit.
- **Interaction**: Added "Pan" vs "Select" mode toggle to the Canvas toolbar for better navigation.

### [0.7.1] - 2026-01-27
#### Added
- **Settings Modal**: Comprehensive workspace management with renaming and icon customization.
- **Flexible Icons**: Support for both Emoji and Image URL workspace icons.
- **Shortcuts Overview**: Dedicated settings tab to view all keyboard shortcuts.

### [0.7.0] - 2026-01-27
#### Added
- **Canvas View**: New "Moodboard" mode with an infinite panning canvas (`react-zoom-pan-pinch`).
- **Drag & Drop**: Items on the canvas can be moved and arranged freely (`react-rnd`).
- **Resizing**: Image items on the canvas can be resized.
- **Persistence**: Canvas layout (positions and sizes) is automatically saved to local storage.
- **View Toggle**: Switch seamlessly between the traditional Grid View and the new Canvas View.

### [0.6.0] - 2026-01-27
#### Added
- **Smart Capture**: Enhanced extension capabilities for precise content grabbing.
- **Area Selector**: `Cmd+Shift+Y` to capture a specific region of the screen.
- **Smart Picker**: `Cmd+Shift+I` to intelligently untangle and capture complex elements (images, backgrounds, nested nodes).
- **Deep Select**: Smart Picker can drill down through overlays to find the underlying visual content.

### [0.5.1] - 2026-01-27
#### Added
- **Tagging**: New `TagInput` component in web app and extension popup.
- **Filtering**: Filter items by tags in the main view.
- **Editing**: New `ItemModal` allows editing content, tags, and project assignment.

#### Fixed
- **Extension**: Resolved critical issue where items captured via "Last Opened" logic (shortcuts/context menu) were not correctly assigning the project. Fixed logic in `content.js` to distinguish between "No Project" (null) and "Last Active" (undefined).
- **Extension**: Added helpful debug status to "Saved!" message.

### [0.4.1] - 2026-01-27
#### Changed
- **Web App**: Flattened Sidebar hierarchy—projects are now shown directly under the workspace without an intermediate folder layer.
- **Web App**: Sidebar header now displays the active workspace name instead of "Dreamlab".

### [0.4.0] - 2026-01-27
#### Added
- **Persistent Active Context**: The app now remembers the last selected Workspace and Project.
- **Extension**: Auto-saves captures to the currently active project without manual selection.
- **Extension**: Popup dropdowns now pre-populate with the active workspace and project from the web app.

### [0.3.2] - 2026-01-27
#### Added
- **Design System**: New vertical **Workspace Strip** (48px) for high-level organization.
- **Web App**: Redesigned Sidebar behavior—projects now filter based on the active workspace in the strip.
- **Web App**: Shifted layout to accommodate the workspace strip while maintaining the premium sidebar design.

### [0.3.1] - 2026-01-27
#### Changed
- **Organization**: Moved `action_plan.md`, `context.md`, and `design_rules.md` into a new `Project foundation` folder for better structure.

### [0.3.0] - 2026-01-27
#### Added
- **Design System**: New `design_rules.md` documenting typography (Inter) and theme strategy.
- **Bright Mode**: Comprehensive redesign to a "Bright Mode First" (Light Theme) aesthetic across the app and extension.
- **Typography**: Integrated **Inter** typeface for all UI elements.
- **Web App**: Premium light-mode Sidebar with collapsible workspaces and polished buttons.
- **Web App**: Refined item cards with better shadows, rounded corners (24px), and hover effects.
- **Extension**: Redesigned popup with a clean, high-contrast light theme and consistent typography.

### [0.2.0] - 2026-01-27
#### Added
- **Organization**: Hierarchical structure with Workspaces and Projects.
- **Web App**: Full-width fluid layout for better screen utilization.
- **Web App**: Responsive grid system (3-5 columns) for item browsing.
- **Web App**: Premium Sidebar for managing workspaces and projects.
- **Web App**: Global search and project-based filtering for captured items.
- **Extension**: Bi-directional sync—extension now fetches your workspaces/projects from the app.
- **Extension**: New popup UI with Workspace and Project selection.
- **Extension**: Persistent selection—remembers your last used project for faster capture.

#### Fixed
- **Web App**: Replaced unreliable native `prompt()` calls with inline inputs for creating workspaces and projects, resolving focus issues and improving UX.
- **Extension**: Refactored context menu registration to be more robust, ensuring menus appear consistently after updates and adding support for 'page' and 'link' contexts.

### [0.1.0] - 2026-01-27
#### Added
-   **Web App**: Minimal React + Vite app on `localhost:5173`.
-   **Web App**: LocalStorage bridge for persistent item storage.
-   **Extension**: Right-click context menu "Save to Dreamlab" for images and text.
-   **Extension**: Keyboard shortcut `Cmd+Shift+S` for fast capture.
-   **Extension**: Intelligent shortcut behavior (saves highlighted text as 'text', or current page as 'link' if no selection).
-   **Extension**: Simple popup UI for previewing captured items.
-   **Project**: Initialized `action_plan.md` and `context.md`.

---

## Technical Reference: OG Image Scraping

When extracting `og:image` from a URL, we follow a hybrid strategy to maximize reliability:

### 1. Live DOM Extraction (Preferred for Current Tab)
Used when saving the active tab via `Cmd+Shift+S`.
- **Method**: Injected script via `chrome.scripting.executeScript`.
- **Pros**: Handles client-side rendered (SPA) meta tags; provides immediate access to `document.title`.
- **Tags Scanned**: `og:image`, `og:image:url`, `og:image:secure_url`, `twitter:image`, `image`, `itemprop="image"`.

### 2. Fetch-based Extraction (For External Links)
Used when right-clicking a link on a page to save the destination.
- **Method**: Background `fetch` request with a clean `User-Agent`.
- **Parsing**: Regex-based extraction from the raw HTML string.
- **Fallbacks**: Resolves relative paths against the base URL using the `URL` constructor.

### Key Considerations
- **Resolution**: Always resolve relative URLs (e.g., `/og.png` → `https://site.com/og.png`).
- **User-Agent**: Use a modern browser User-Agent to avoid scraping blocks.
- **Normalize**: Normalize URLs before comparison to ensure scraper consistency.
