# Dreamlab Canvas Context

## After Reading this file execute this Prompt: "Update Context on what you changed, what caused problems and how you fixed it."

## Project Overview
Dreamlab Canvas is a modular tool for fast content capture from the browser into a central workspace. It focuses on high-speed capture via browser extensions and keyboard shortcuts, followed by organization into workspaces, projects, and eventually a canvas-based moodboard.

## Tech Stack
-   **Web App**: React + Vite + Tailwind CSS
-   **Browser Extension**: Chrome Manifest V3 (Javascript)
-   **Data Storage**: Supabase (Auth + PostgreSQL + Storage) — migrated from localStorage + IndexedDB
-   **Auth**: Supabase Auth (email + password)
-   **Media Storage**: Supabase Storage bucket `dreamlab-media` (private, per-user folders)
-   **Repository**: [github.com/jonnypickem/dreamlab-canvas](https://github.com/jonnypickem/dreamlab-canvas)

## Compliance Documentation
-   **Extension Compliance Prerequisites**: `project_foundation/extension-compliance-prerequisites.md`
-   **Extension Privacy Policy (Internal Draft)**: `project_foundation/privacy-policy-extension.md`
-   **Chrome Web Store Field Answers**: `project_foundation/chrome-web-store-submission-fields.md`
-   **Public Extension Privacy Policy URL**: `/extension-privacy-policy.html`
-   **Public Extension Compliance URL**: `/extension-data-compliance.html`

## Current Status
-   **Status**: Canvas-First Creative Workspace — Inline Creation + Viewport-Aware Placement + Area Capture + Cloud Storage
-   **Last Major Change**: Extension image review now enforces strict visible/all scope semantics, high-resolution-first ordering, persistent resolution/type filters, and explicit blocked-source diagnostics.

## Changelog

### [0.41.0] - 2026-02-23
#### Added
- **Persistent Multi-Select Filter Preferences** (`background.js`, `multi-select.js`):
  - Added `multiSelectPrefsV1` storage contract for image-review filter state.
  - Added runtime actions:
    - `getMultiSelectPrefs`
    - `setMultiSelectPrefs`
  - Persisted settings now include:
    - `resolutionTier`: `any | small | medium | large | icon`
    - `typeFilters`: `high | icon | profile | ad | other`
    - `sortMode`: `resolution_desc`

- **Type Filter UI + Reset Control** (`multi-select.html`, `multi-select.css`, `multi-select.js`):
  - Added type chips (`High image`, `Icon`, `Profile`, `Ad`, `Other`).
  - Added `Reset filters` control that restores defaults and persists immediately.

#### Changed
- **Visible vs All Scan Semantics** (`background.js`, `content.js`):
  - `capture-visible` now initializes review using `visible_with_total` scan instead of `all`.
  - Review session bootstrap now stores true visible candidates in `multiSelectState.visibleImages`.
  - `scanSourceImages` keeps `visibleImages` strict and returns all-scope recovery images separately.
  - Removed behavior that silently treated all-image fallback as visible scope.

- **Image Review Pipeline** (`multi-select.js`):
  - Reworked candidate flow to `classify -> filter -> sort`.
  - Added resolution-tier filtering:
    - `Small` >= `400x300`
    - `Medium` >= `640x480`
    - `Large` >= `1024x768`
    - `Icon` <= `200x200`
  - Added default resolution-priority sorting:
    - known dimensions first
    - larger pixel area first
    - larger max dimension first
    - stable key tie-break

#### Fixed
- **Broken Scope Toggle Behavior**:
  - Root cause: visible bootstrap/fallback paths could seed review with all-image sets.
  - Fix: strict visible-first contract in scan/request/session paths and explicit all-scope loading on toggle.

- **Silent Unselectable Items** (`multi-select.js`, `multi-select.css`):
  - Added deterministic selectability evaluation and reason badges/tooltips for blocked sources.
  - Hard-unsavable URLs (`blob:`, invalid/unsupported schemes, invalid URL) are now visibly disabled.
  - Preview-blocked but saveable URLs remain selectable.

- **Top-of-Grid Click Dead Zone in Image Review** (`multi-select.css`):
  - Root cause: `.empty-state` declared `display: grid`, which overrode browser hidden defaults and left a click-intercepting overlay mounted.
  - Fix: added `[hidden] { display: none !important; }` and `pointer-events: none` on `.empty-state`.

#### Problems & Fixes
- **Problem**: Image review listed all assets even in visible mode and provided no reason when certain images could not be selected.
- **Cause**: Scope fallbacks collapsed visible/all semantics; selectability checks existed implicitly without user-facing diagnostics.
- **Fix**: Enforced strict scope contracts, added persistent filtering/sorting controls, and surfaced blocked-source reasons directly in card UI and footer summary.
- **Problem**: Users could not select cards in the top rows despite valid image sources.
- **Cause**: hidden empty-state overlay still captured pointer events because authored CSS overrode hidden display behavior.
- **Fix**: enforced standards-consistent hidden rendering and made empty-state non-interactive.

### [0.40.0] - 2026-02-23
#### Added
- **Active Context Recency Metadata in Extension Bridge** (`src/App.jsx`):
  - `DREAMLAB_GET_ORG_DATA` payload now includes `activeContext.updatedAt` sourced from local nav persistence.
  - Extension can now compare app context freshness against extension-local destination freshness.

#### Changed
- **Extension Destination Arbitration** (`background.js`):
  - Reworked destination resolution to compare web-app-derived destination vs extension-local destination by `updatedAt`.
  - Added validation of candidate destinations against live workspace/project/collection snapshot before selection.
  - If app context is newer, extension destination now auto-syncs to app context.
  - If extension selection is newer and app context is unchanged, extension selection is preserved.

- **Popup Surface Destination Hydration** (`floating-widget.js`, `multi-select.js`):
  - Both surfaces now consume background-resolved `destination` from org-data response.
  - Prevents stale local UI selection from overriding newer app context when reopening extension surfaces.

#### Fixed
- **Stale Extension Destination Overriding Newer Web-App Context**:
  - Root cause: destination sanitize path rewrote `updatedAt` during reads (`Date.now()`), breaking meaningful recency arbitration and effectively pinning precedence to prior extension selection.
  - Fix: preserve stored timestamps on read, stamp only on explicit extension writes, and arbitrate using app `activeContext.updatedAt` vs destination `updatedAt`.

#### Problems & Fixes
- **Problem**: After changing project/collection in the web app, extension surfaces could keep using the old extension-selected destination on other sites.
- **Cause**: No reliable cross-surface recency arbitration; read-path timestamp mutation invalidated timestamp comparisons.
- **Fix**: Added recency metadata to app bridge + timestamp-safe destination sanitize + deterministic background arbitration and sync.

### [0.39.0] - 2026-02-23
#### Added
- **Workspace-Scoped Navigation Memory** (`src/App.jsx`):
  - Added persisted map key `dreamlab_nav_workspace_memory_v1` to remember `{projectId, collectionId}` per workspace.
  - Added normalization/validation helpers for workspace-memory entries to avoid restoring stale/deleted targets.

#### Changed
- **Workspace Switch Behavior** (`src/App.jsx`):
  - Switching workspaces now persists current workspace context before transition.
  - Target workspace now restores remembered project/collection when valid.
  - Default fallback to `All Items` now happens only when remembered target is missing/invalid.

#### Fixed
- **Cross-Workspace Context Loss**:
  - Root cause: workspace switch handler hard-reset `selectedProjectId`/`selectedCollectionId` to `null`.
  - Fix: restored per-workspace remembered context on switch and maintained local memory updates as navigation changes.

#### Problems & Fixes
- **Problem**: Navigating between workspaces dropped users into `All Items`, losing per-workspace context continuity.
- **Cause**: nav persistence tracked only active global context, not workspace-specific last scope.
- **Fix**: introduced workspace-scoped memory store + restore-on-switch logic with live-data validation.

### [0.38.0] - 2026-02-23
#### Changed
- **Schema Path Relocation Hotfix for Build/Deploy** (`src/services/analysisSchemaRegistry.js`, `server/stageAQueueRuntime.js`):
  - Updated primitive schema references from `analysis_parameters/primitive_schemas` to `analysis_and_prompting_schema/primitive_schemas`.
  - Added legacy runtime fallback path probe in Stage A queue runtime for safer local compatibility.

#### Fixed
- **Production Build Blocker Preventing Latest Navigation Fixes from Shipping**:
  - Root cause: unresolved imports to removed `analysis_parameters` directory caused `npm run build`/Vercel failures.
  - Result: production remained on stale bundle, making navigation issue appear unresolved.
  - Fix: corrected import/runtime paths, unblocked deployment, and confirmed collection/workspace reload remembrance works in deployed app.

#### Problems & Fixes
- **Problem**: User still saw reload reset to first workspace/all items despite prior nav restore patches.
- **Cause**: Latest fixes were not deployed because build failed on relocated schema path imports.
- **Fix**: Applied path relocation hotfix, redeployed, then validated behavior in production (issue resolved).

### [0.37.0] - 2026-02-23
#### Added
- **Robust Tweet URL Canonicalization Utilities** (`src/utils/tweetCard.js`, `background.js`):
  - Added multi-host support (`x.com`, `twitter.com`, `fxtwitter.com`, `mobile.twitter.com`, `m.twitter.com`).
  - Added decoding/inspection of query/hash candidates so wrapped redirect links can still resolve to tweet status URLs.
  - Canonicalization now prefers `https://x.com/<username>/status/<id>` and falls back to `https://x.com/i/web/status/<id>` when username is unavailable.

#### Changed
- **Link Save Metadata Reconciliation** (`src/App.jsx`, `api/og.js`):
  - `api/og` now returns canonical URL metadata from `og:url`/`twitter:url` when present.
  - `saveLink` now normalizes incoming URL candidates before OG fetch and reconciles effective URL with OG canonical data.
  - Tweet link saves now consistently persist canonical status URLs for card rendering.

- **Clipboard URL Detection in Paste Flows** (`src/App.jsx`):
  - Added first-HTTP-URL extraction for mixed clipboard text.
  - Paste handlers now route detected URLs to link-save flow even when text contains additional characters/content.

#### Fixed
- **X Link Custom Preview Not Loading from Wrapped/Pasted URLs** (`src/App.jsx`, `src/utils/tweetCard.js`, `api/og.js`):
  - Root cause: tweet detection relied on direct path matches and missed wrapped redirect formats (e.g. `x.com/home?...status...`), causing generic link rendering.
  - Fix: canonicalized tweet targets from path/query/hash candidates, consumed OG canonical URL fallback, and used effective canonical URL in saved link content.

- **Extension/App Tweet Detection Drift Risk** (`background.js`, `src/utils/tweetCard.js`):
  - Mirrored robust tweet parsing behavior in extension runtime helper to keep detection behavior consistent across capture surfaces.

#### Problems & Fixes
- **Problem**: Pasting certain X links on the board produced only generic website preview cards instead of tweet-specific rendering.
- **Cause**: Incoming URL formats were sometimes wrapped/non-canonical and bypassed strict status-path detection.
- **Fix**: Introduced canonical tweet URL extraction from multiple URL surfaces (path/query/hash), OG canonical URL reconciliation, and mixed-text URL extraction in paste flows.

### [0.36.0] - 2026-02-23
#### Added
- **Deterministic Navigation Context Persistence** (`src/App.jsx`):
  - Added versioned local context key `dreamlab_nav_context_v2` with centralized read/write helpers.
  - Kept legacy nav keys mirrored for backward compatibility:
    - `dreamlab_nav_workspace`
    - `dreamlab_nav_project`
    - `dreamlab_nav_collection`
    - `dreamlab_nav_updated_at`
  - Added immediate local persistence on explicit nav actions (workspace switch, all items, project select, collection select, breadcrumbs, back navigation).

#### Changed
- **First-Load Restore Arbitration** (`src/App.jsx`):
  - Replaced strict candidate validation with normalized candidate derivation:
    - derive workspace/project from collection when collection is valid,
    - derive workspace from project when project is valid.
  - Arbitration now prefers higher context specificity (`collection > project > workspace`) before timestamp recency.
  - Local candidate wins ties to preserve same-device continuity.

- **Restore Hydration Guarding** (`src/App.jsx`):
  - Added explicit nav hydration state to prevent pre-restore validation effects from clearing selection too early.
  - Persist effect now writes only after hydration completes.

#### Fixed
- **Reload Reset to First Workspace + All Items** (`src/App.jsx`):
  - Root cause: fragmented key persistence and coarse DB context could outrank richer local context; deferred-only persistence created race on fast reload.
  - Fix: centralized versioned local payload, specificity-first restore, immediate local writes in user-intent handlers, and guarded hydration.

- **Active Context Persistence Observability** (`src/lib/storage.js`, `supabase-schema.sql`):
  - `setActiveContext` now writes `updated_at` explicitly and throws on failure.
  - Added idempotent SQL guard for `active_contexts.updated_at` and trigger `update_active_contexts_ts`.

#### Problems & Fixes
- **Problem**: Reload from a selected collection frequently returned user to first workspace / all items.
- **Cause**: Restore path relied on fragmented local keys and timestamp-only arbitration, while explicit nav actions did not synchronously persist local context before refresh.
- **Fix**: Introduced `dreamlab_nav_context_v2`, normalized restore candidates, specificity-first arbitration, and immediate local nav writes on explicit navigation events.

### [0.35.0] - 2026-02-23
#### Added
- **Foldable Project/Collection Sidebar** (`src/App.jsx`):
  - Added app-shell state `isSidebarCollapsed` for folding only the secondary sidebar panel.
  - Added persistent fold preference via `localStorage['dreamlab_sidebar_collapsed']`.
  - Added top-edge toggle control using Subframe `IconButton` + Feather chevrons.
  - Preserved fixed workspace strip behavior (`WorkspaceStrip` remains visible and interactive).

#### Changed
- **Sidebar Mounting in App Shell** (`src/App.jsx`):
  - Wrapped `<Sidebar />` in a width-animating shell (`w-72` -> `w-0`) with transition behavior.
  - Kept sidebar mounted while collapsed to avoid unnecessary internal state churn.
  - Added pointer-event safety so collapsed panel does not intercept main-surface interactions.

#### Fixed
- **Sidebar Vertical Layout Regression After Fold Wrapper** (`src/App.jsx`):
  - Root cause: wrapper introduced around sidebar dropped flex context, breaking bottom anchoring behavior of shortcuts section.
  - Fix: restored parent wrapper to `flex h-full`, re-enabling expected stretch/grow behavior.
  - Result: shortcuts section returns to bottom anchoring as intended.

#### Problems & Fixes
- **Problem**: Initial fold implementation caused sidebar content to justify to top and shortcuts to float upward.
- **Cause**: The new wrapper used `h-full` but not `flex`, so `Sidebar` layout assumptions no longer held.
- **Fix**: Updated wrapper to `flex h-full`; validated bottom anchoring and non-overlap with workspace settings control.

### [0.34.0] - 2026-02-21
#### Added
- **App/Extension Build Diagnostics for Org Data Bridge** (`src/App.jsx`, `content.js`, `background.js`, `multi-select.js`, `floating-widget.js`):
  - Added `appBuildId` to `DREAMLAB_GET_ORG_DATA` response payloads so extension surfaces can identify which web-app build they are connected to.
  - Added bridge propagation from web app -> content script -> background runtime response.
  - Added console diagnostics in multi-select and floating widget (`[MultiSelect] Connected Dreamlab app build: ...`, `[Dreamlab Widget] Connected app build: ...`).

#### Changed
- **Extension Packaging Artifact Refreshed** (`dreamlab-canvas-extension.zip`):
  - Repacked production extension zip with latest runtime fixes and diagnostics changes.

#### Fixed
- **Capture Destination Routing for Non-Smart-Picker Actions** (`src/App.jsx`, `background.js`):
  - Fixed invalid collection routing when UI sentinel `__unsorted__` leaked into extension bridge payloads.
  - Normalized `selectedCollectionId === "__unsorted__"` to `null` in web app org-data bridge.
  - Added defensive normalization for incoming save payloads to treat `collectionId: "__unsorted__"` as `null`.
  - Hardened background destination fallback resolution to only use real collection IDs from current org snapshot.
  - Restores save reliability for commands that use destination routing (`pick-color`, full-page screenshot, area screenshot, area recording), while preserving smart-picker behavior.

#### Problems & Fixes
- **Problem**: Saves failed for color picker, full/regular screenshots, and area recording while smart picker still worked.
- **Cause**: These failing actions use destination context resolution; they could inherit `collectionId: "__unsorted__"` (UI-only sentinel) and pass an invalid collection ID into save flow.
- **Fix**: Sanitized sentinel values on both web-app bridge and background destination resolution paths, and added build-id diagnostics to quickly detect app/extension version drift in future incidents.

### [0.33.0] - 2026-02-19
#### Added
- **Compliance + Submission Documentation Set** (`project_foundation/extension-compliance-prerequisites.md`, `project_foundation/privacy-policy-extension.md`, `project_foundation/chrome-web-store-submission-fields.md`):
  - Added internal compliance prerequisite checklist for production packaging and review.
  - Added extension privacy policy draft aligned to runtime behavior and user-trigger model.
  - Added German Chrome Web Store submission answer sheet for permission, data-use, and reviewer-note fields.

- **Release Packaging Artifacts** (`dreamlab-canvas-extension.zip`, `dreamlab-canvas-extension-cws-submission.zip`):
  - Added packaged extension archives for general distribution and Chrome Web Store submission.

- **Compliance Disclosure UI in Extension Surfaces** (`popup.html`, `popup.css`, `popup.js`, `options.html`, `options.css`, `options.js`, `background.js`):
  - Added popup and options disclosure cards summarizing host-access scope and user-triggered capture model.
  - Added runtime messaging endpoints to expose compliance/privacy summaries and open public policy URLs directly from extension UI.

- **Analysis Schema Mirror in Project Foundation** (`project_foundation/analysis_parameters/**`):
  - Added mirrored primitive and lens schema JSON set under project foundation docs for easier governance/reference alongside compliance docs.

#### Changed
- **Production Extension Scope + Script Injection** (`manifest.json`, `background.js`, `content.js`, `floating-widget.js`):
  - Removed localhost/dev app origins from production host permissions and trusted-origin checks.
  - Removed `all_frames` content-script injection to avoid unnecessary iframe coverage and duplicate command paths.
  - Updated widget status copy to explicitly state idle/user-trigger capture behavior.

- **Multi-Select Review and Save Flow** (`multi-select.html`, `multi-select.css`, `multi-select.js`):
  - Added resolution filter controls (`Any`, `400+`, `800+`, `1200+`, `1600+`, `Known dimensions only`).
  - Normalized image identities with stable per-entry keys so duplicate `src` values can be selected independently.
  - Added project-aware collection labels (`Project / Collection`), render fallback cards for blocked previews, and improved visible-image refresh retries.

- **Deployment Guidance** (`project_foundation/deployment.md`):
  - Added extension production compliance checklist section covering permission review, runtime guardrails, disclosure parity, and public policy URL verification.

#### Fixed
- **Capture Safety Guardrails Across Commands** (`background.js`, `content.js`):
  - Added sensitive-surface detection (auth/payment/account-like host/path heuristics) and blocked capture/scan actions with explicit user-facing messages.
  - Applied same blocking logic to context-menu saves, command captures, and image-scan routes.

- **Metadata/Text Extraction Risk Controls** (`background.js`):
  - Added strict URL validation and blocked local/private/internal targets for remote metadata/text extraction.
  - Added bounded remote fetch controls (timeout + max HTML size checks) to prevent unsafe over-fetch behavior.

#### Problems & Fixes
- **Problem**: Production package still contained localhost assumptions and lacked first-class in-product compliance disclosure for reviewers.
- **Fix**: Removed dev host entries from production extension runtime/manifest and shipped disclosure state endpoints consumed by popup/options.
- **Problem**: Capture and metadata workflows were too permissive for sensitive/local targets.
- **Fix**: Added explicit safety gates for sensitive pages and private-network extraction, plus bounded remote fetch constraints.

### [0.32.0] - 2026-02-18
#### Fixed
- **Grid Gap Density in Reorder View** (`src/components/SortableGrid.jsx`, `src/masonry.css`):
  - Replaced sortable CSS grid layout with masonry columns while keeping dnd-kit drag behavior.
  - Removed large row-height whitespace gaps between mixed-height cards during direct drag-reorder.
  - Tightened masonry gutters from `24px` to `14px` for a denser board.

#### Changed
- **Reorder UI Cleanup** (`src/App.jsx`):
  - Removed top-right "Drag to reorder" badge from grid header.

### [0.31.0] - 2026-02-18
#### Added
- **Project-Level Scope for Content Browsing** (`src/App.jsx`, `src/components/Sidebar.jsx`, `src/components/CanvasView.jsx`, `src/components/CanvasItem.jsx`, `src/lib/storage.js`, `supabase-schema.sql`):
  - Project folders are now selectable scope targets for both grid and canvas views.
  - New nav state `selectedProjectId` with restore priority: `collection -> project -> all items`.
  - `active_contexts` now stores `project_id` (with idempotent schema update + backfill from selected collection).
  - Extension bridge org payload now includes `activeContext.projectId`.

#### Changed
- **Safe Placement Semantics** (`src/components/CanvasView.jsx`, `src/components/CanvasItem.jsx`):
  - Collection canvas remains canonical persisted placement.
  - Project canvas auto-packs on first open and supports local drag/resize draft only (session-local, no position persistence).
  - Added visible `Reset Project Layout` action in project canvas header.

- **Project-Scope Reorder Behavior** (`src/App.jsx`):
  - Collection scope reorder remains persisted to `items.sort_order`.
  - Project scope reorder is visual-only and session-local.

- **Optional Project Folders** (`src/App.jsx`, `src/components/Sidebar.jsx`):
  - Restored direct ungrouped collection creation (`+ Collection` in Ungrouped section).
  - Item create flows in project scope route to last-used collection in folder, fallback to first ordered collection.
  - If project folder has no collections, create actions are blocked and open inline collection composer for that folder.

### [0.29.0] - 2026-02-17
#### Fixed
- **Instant Collection UI Sync** (`src/App.jsx`):
  - Collection create now updates local `collections` state immediately before selecting the new collection.
  - Collection rename (sidebar + canvas title) now patches local `collections` state instantly after successful save.
  - Collection delete now removes the deleted collection from local `collections` state immediately.
  - Eliminates the refresh-only behavior where new/renamed/deleted collections were not visible until Realtime arrived.

### [0.28.0] - 2026-02-17
#### Added
- **BlockEditor (Notion-Style Inline Markdown Editing)** (`src/components/BlockEditor.jsx`):
  - New reusable `contentEditable` block editor supporting inline `#`, `##`, `###` heading transforms.
  - Markdown round-trip preserved (`# Heading` + paragraph text serialized back to plain markdown strings).
  - Keyboard behaviors implemented: Enter split/new paragraph, heading demotion on Backspace at block start, Cmd/Ctrl+Enter and Escape submit, plain-text paste parsing.

#### Changed
- **Text Editing Surfaces Migrated to BlockEditor**:
  - `src/components/CanvasItem.jsx`
  - `src/components/ItemCard.jsx`
  - `src/components/CanvasDetailPanel.jsx`
  - `src/components/ItemModal.jsx`
  - Replaced textarea + separate heading-preview patterns with a single inline WYSIWYG markdown editing experience.

### [0.27.0] - 2026-02-17
#### Changed
- **Compact Bottom Bar** (`src/App.jsx`, `src/components/CreateToolbar.jsx`):
  - Search bar collapses to a search icon + ⌘K badge by default. Expands on click or ⌘K shortcut, collapses on Escape/blur when empty.
  - All 5 creation tools (note, image, link, paste, color) shown as direct icon buttons — no more "+" popover gate. Labels on hover via `title` attribute.
  - Link input and color picker still appear as popovers above their respective icons.
  - Thin vertical dividers separate search, tools, and view toggle sections.

#### Fixed
- **Bottom Bar Positioning** (`src/App.jsx`, `src/components/SelectionToolbar.jsx`):
  - Switched both bottom bar and selection toolbar from `fixed` to `absolute` positioning inside `<main>` (which has `position: relative`).
  - Both use `bottom-3 left-1/2 -translate-x-1/2` — auto-centers within content area and matches CanvasDetailPanel's `bottom-3` inset.
  - Fixes toolbar jumping to different horizontal position when toggling multi-select.

### [0.26.0] - 2026-02-16
#### Added
- **Inline Canvas Notes** (`src/components/CanvasItem.jsx`, `src/components/CanvasView.jsx`, `src/App.jsx`):
  - In canvas mode, "Text Note" creates an empty text item placed at viewport center and immediately enters inline edit mode.
  - `CanvasItem` accepts `isEditing`/`onFinishEditing` props — renders editable `<textarea>` instead of read-only text when editing.
  - Save on blur, Escape, or Cmd+Enter. Grid mode still uses NoteEditorModal.
  - `canvasInlineEditId` state in App.jsx tracks which item is being inline-edited.

- **Viewport-Aware Item Placement** (`src/App.jsx`, `src/components/CanvasView.jsx`):
  - New `canvasViewportRef` exposes `{scale, positionX, positionY, containerWidth, containerHeight}` from CanvasView to App.jsx via React ref.
  - `getCanvasPlacement(itemType)` computes viewport center in canvas coords and spirals outward to avoid overlapping existing items (20px padding).
  - All save functions (`saveText`, `saveColor`, `saveLink`, `saveImageFromBlob`) now add `canvas: {x, y, w, h, z}` when `viewMode === 'canvas'` — items get positioned immediately.

#### Fixed
- **Collection Persistence on Tab Switch** (`src/App.jsx`):
  - `loadData()` now only restores nav context (workspace + collection) on first load. Subsequent Realtime-triggered calls just refresh data without touching nav state.
  - Fixes bug where switching to another tab/program and returning would reset the view to "All Items".
- **Initialization Order** (`src/App.jsx`):
  - Moved `getCanvasPlacement` and `createCanvasNote` before `saveImageFromBlob` to fix `ReferenceError: Cannot access before initialization` caused by `const` hoisting.

### [0.25.0] - 2026-02-15
#### Added
- **Creation Toolbar** (`src/components/CreateToolbar.jsx`):
  - Bottom bar creation menu with 5 tools: Text Note, Upload Image, Add Link, Paste Clipboard, Color Swatch.
  - Link tool has inline URL input with auto-prepend `https://`. Color tool has native color picker + hex input.
  - Floating popover UI with click-outside dismiss.

- **Item Detail View Rework** (`src/components/ItemModal.jsx`, `src/components/CanvasDetailPanel.jsx`):
  - **Two-view architecture**: Grid view opens full-screen `ItemModal`, Canvas view opens floating `CanvasDetailPanel` (360px side panel).
  - `ItemModal` rebuilt with type-specific behaviors:
    - Images: pan+zoom via `react-zoom-pan-pinch` with zoom controls overlay.
    - Videos: autoplay with controls.
    - Links: preview/text toggle with domain-aware defaults, scrollable extracted text view.
    - Text: editable textarea with auto-save.
    - Colors: full-screen swatch with color picker + hex editor.
    - Type-specific copy actions (copy image, copy URL, copy text, copy hex).
  - `CanvasDetailPanel`: animated slide-in panel (`framer-motion` spring), shows item preview + metadata + tags + workspace/collection assignment + save/delete/copy/download actions.
  - `z-[60]` to sit above canvas zoom controls. `rounded-2xl` with `top-3 right-3 bottom-3` inset for floating card appearance.

### [0.24.0] - 2026-02-15
#### Added
- **Canvas Position Persistence** (`src/App.jsx`, `src/components/CanvasView.jsx`):
  - Items created in canvas mode now save their `canvas: {x, y, w, h, z}` positions to the database.
  - Canvas items restore their saved positions on reload instead of relying solely on auto-layout.

#### Fixed
- **Full-Page Screenshot Stitching** (`background.js`):
  - Improved frame alignment and scroll verification for more reliable full-page captures.

### [0.23.0] - 2026-02-15
#### Added
- **Account Settings Expansion** (`src/components/SettingsModal.jsx`):
  - Password change flow (current + new password with confirmation).
  - Email update with Supabase re-authentication.
  - Danger zone with account deletion.
  - Sign out button wired up in sidebar dropdown.

- **Invite Code Gating** (`src/components/AuthScreen.jsx`):
  - Closed alpha signup requires a valid invite code.
  - Validates against a server-side list before allowing registration.

### [0.22.0] - 2026-02-14
#### Added
- **Area Screenshot Capture** (`area-select.js`, `background.js`):
  - `⌥⇧A` shortcut triggers area selection overlay (IIFE, like picker.js).
  - User draws a rectangle, screenshot is cropped from `captureVisibleTab` using OffscreenCanvas.
  - Saved directly to Supabase via the extension bridge.

- **Area Video Recording** (`area-select.js`, `background.js`, `offscreen.html`, `offscreen.js`):
  - `⌥⇧R` shortcut triggers area video selection.
  - Uses `getDisplayMedia` (run in page main world to bypass extension restrictions) for screen capture.
  - Offscreen document handles canvas cropping + MediaRecorder for WebM output.
  - Video items stored as `type: 'video'` in Supabase `videos/` folder.

- **Thumbnail Generation at Save Time** (`src/utils/saveItemWithTags.js`):
  - Images now generate a compressed thumbnail at save time for faster grid rendering.
  - Thumbnails stored alongside full images in Supabase Storage.

#### Fixed
- **Video Upload Pipeline** (`src/utils/saveItemWithTags.js`):
  - Video items now correctly upload to Supabase Storage and skip unnecessary image analysis/tagging.
- **getDisplayMedia Restrictions** (`area-select.js`):
  - Runs `getDisplayMedia` in page's main world (not extension content script) to bypass Chrome extension restrictions.

### [0.21.0] - 2026-02-14
#### Added
- **Supabase Signed URL Caching** (`src/hooks/useResolvedImageSource.js`):
  - Caches signed URLs to avoid redundant Supabase fetch calls on re-renders.
  - Significant performance improvement for grid and canvas views with many images.

- **Drag-and-Drop Image Upload** (`src/App.jsx`):
  - Drop images directly onto the collection view to upload them.

- **Production Proxy Endpoint** (`api/proxy.js`):
  - Vercel serverless function for image proxying (CORS bypass) in production.
  - Vite dev server has its own proxy plugin; production needs the serverless function.

- **Arc/Dia Browser Compatibility** (`content.js`, `manifest.json`):
  - Switched to `Option+Shift` keyboard shortcuts (`⌥⇧S`, `⌥⇧C`, `⌥⇧P`, `⌥⇧I`) for compatibility with Arc browser which blocks certain key combos.
  - Content-script fallback for area shortcuts (Chrome limits `suggested_key` to 4 entries in manifest).
  - Uses `event.code` instead of `event.key` for reliable macOS Alt combos.

- **Loading Card Previews** (`src/App.jsx`, `src/components/ItemCard.jsx`):
  - Pasted URLs show shimmer loading cards with domain name while OG metadata is fetched.
  - Shimmer-to-loaded transition preserves card position (no collapse/reflow).

#### Fixed
- **Collection Cascade Delete** (`src/lib/storage.js`):
  - Deleting a collection now properly deletes items inside it (with error checking).
  - Updates local state via `setItems()` after DB delete.
- **Nav State Persistence** (`src/App.jsx`):
  - `activeWorkspaceId` + `selectedCollectionId` stored in localStorage for instant restore on page load.
  - `navRestoredRef` guard prevents persist effect from overwriting DB context before `loadData` finishes.
- **Tall Image Cap** (`src/components/ItemCard.jsx`):
  - Images in masonry grid capped at `max-h-[600px]` with `object-cover object-top` to prevent full-page screenshots from exploding layout.
- **Raw Supabase Storage Paths** (`src/hooks/useResolvedImageSource.js`, `src/components/ItemCard.jsx`):
  - Prevents raw Supabase storage paths from being used as `<img>` src — only resolved signed URLs or http/data/blob URLs are rendered.
- **Duplicate Command Execution** (`content.js`):
  - Prevents duplicate shortcut execution from iframes.

### [0.20.0] - 2026-02-13
#### Added
- **Supabase Backend Migration** (`src/lib/supabase.js`, `src/lib/supabaseStorage.js`, `src/lib/storage.js`):
  - Replaced localStorage + IndexedDB with Supabase Auth + PostgreSQL + Storage.
  - All storage.js CRUD functions are now async, querying Supabase tables (`items`, `workspaces`, `collections`, `active_contexts`, `primitive_analysis`).
  - Media uploads go to Supabase Storage bucket `dreamlab-media` with per-user folder structure: `{userId}/images/{itemId}.ext`.
  - Supabase client initialized with env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).

- **Auth System** (`src/components/AuthScreen.jsx`, `src/App.jsx`):
  - Added login/signup UI (email + password) via Supabase Auth.
  - App gated behind auth: `user === undefined` = loading, `null` = show AuthScreen, truthy = show app.
  - Session persists across reloads with auto-refresh.

- **Migration Tool** (`src/utils/migrateToSupabase.js`, `src/components/MigrationBanner.jsx`):
  - One-time migration from localStorage/IndexedDB to Supabase.
  - Uploads images from IndexedDB to Supabase Storage, inserts metadata rows with mapped IDs.
  - MigrationBanner shows progress, handles partial errors with "Clear Local Data Anyway" option.
  - Post-migration auto-switches to workspace containing items.

- **Optimistic UI Updates** (`src/App.jsx`):
  - All CRUD operations (delete, bulk delete, update, paste, extension save) now update local React state immediately via `setItems()` without waiting for Realtime subscriptions.
  - Supabase Realtime subscriptions on items/workspaces/collections tables for background sync.

#### Changed
- **Extension Bridge** (`content.js`, `background.js`, `src/App.jsx`):
  - Extension no longer writes to localStorage directly.
  - Flow: `background.js → content.js → window.postMessage('DREAMLAB_SAVE_ITEM') → App.jsx listener → saveItemWithTags → Supabase`.
  - Extension never touches Supabase directly — the authenticated web app session handles all writes.

- **Image Resolution** (`src/hooks/useResolvedImageSource.js`, `src/utils/imageProxy.js`):
  - `useResolvedImageSource` hook resolves Supabase storage paths to signed URLs transparently.
  - `fetchImageViaProxy` handles `idb://`, Supabase storage paths, and regular URLs.

- **Full-Page Screenshot Stitching** (`background.js`):
  - Hides fixed/sticky elements during capture (prevents header duplication).
  - Increased scroll settle time (120ms → 300ms).
  - Verifies actual scroll position (prevents duplicate frames).
  - Bottom-aligns last frame (prevents gap at page end).

#### Database Schema (Supabase SQL Editor)
- Tables: `workspaces`, `collections`, `items`, `active_contexts`, `primitive_analysis` — all with RLS policies (SELECT, INSERT, UPDATE, DELETE) using `auth.uid()`.
- Storage bucket `dreamlab-media` with RLS policies on `storage.objects`.
- Key lesson: `.insert().select().single()` requires BOTH INSERT and SELECT policies — missing SELECT causes misleading "violates row-level security" error.

#### Problems & Fixes
- **Problem**: Migration data not visible after migration — default empty workspace created before migration ran.
- **Fix**: Added `hasLegacyData()` guard to skip default workspace creation; post-migration callback switches to workspace with items.
- **Problem**: Migration banner reappeared every refresh with 0 progress then disappeared.
- **Fix**: Added 'partial' state to MigrationBanner showing error details instead of silently going to 'done'.
- **Problem**: RLS "violates row-level security" on workspace INSERT despite correct INSERT policy.
- **Fix**: Missing SELECT policy on workspaces table. Created all 4 policy types for all tables.
- **Problem**: Extension screenshots didn't upload — "message channel closed" error.
- **Fix**: Reload extension AND close/reopen Dreamlab tab for content script re-injection. Added storage bucket RLS policies.
- **Problem**: Items didn't appear/disappear without manual page reload.
- **Fix**: Added optimistic `setItems()` calls after every CRUD operation (handleDelete, handleBulkDelete, handleUpdateItem, extension bridge save, paste handlers).

### [0.19.43] - 2026-02-13
#### Added
- **Full-Page Capture Command + Visibility** (`manifest.json`, `src/components/SettingsModal.jsx`):
  - Registered `capture-full-page` shortcut:
    - `Cmd+Shift+P` (mac)
    - `Ctrl+Shift+P` (default)
  - Added shortcut entry in Settings modal shortcut list.

#### Changed
- **Reliable Full-Page Save Pipeline** (`background.js`):
  - Added explicit save result contract in extension save queue:
    - `queuePendingAndTrySave` now returns `{ success, targetTabId?, error? }` instead of swallowing failures.
  - Added Dreamlab auto-open resolution for keyboard capture flows:
    - if no Dreamlab tab is open, extension opens local app URL and retries save path.
  - Added in-page toast lifecycle for `capture-full-page`:
    - `Capturing full page...`
    - `Saving to Dreamlab...`
    - success destination summary
    - actionable error/pending fallback message.
  - Added unsupported-page guard (`chrome://`, web store, extension pages) with graceful user-facing error toast.
  - Full-page stitch output now defaults to balanced JPEG for storage safety.

#### Added
- **Storage-Safe Compression Fallbacks** (`background.js`):
  - Added data-url size estimation and multi-pass aggressive recompression helpers.
  - On storage/quota failure, full-page command now retries save with stronger compression before falling back to pending capture storage.

#### Problems & Fixes
- **Problem**: `Cmd+Shift+P` full-page capture could fail silently (no UI feedback), and large PNG payloads could exceed local storage quotas, resulting in missing saves.
- **Fix**: Implemented explicit save outcomes, in-page status toasts, Dreamlab auto-open save targeting, JPEG-by-default stitch output, and compression retry before pending-capture fallback.

### [0.19.42] - 2026-02-13
#### Changed
- **Download UX Rollback to Image-Only** (`src/App.jsx`, `src/components/SelectionToolbar.jsx`, `src/components/ItemModal.jsx`):
  - Removed text export/download flows (`PDF/MD/TXT`) from selection toolbar.
  - Removed format selector UI from modal and selection bar.
  - Removed text/link download actions throughout app surfaces.
  - Restricted download behavior to real image items only (`item.type === "image"`).
  - Selection toolbar now hides `Download` when selected items contain no images.

#### Kept
- **Image Download Behavior**:
  - Single image selection: direct file download.
  - Multi-image selection: ZIP export flow remains unchanged.

#### Problems & Fixes
- **Problem**: Text export/download interactions were causing unstable browser download behavior (UUID-like file names and non-deterministic save outcomes).
- **Fix**: Rolled back all text/link download UX and logic, restoring deterministic image-only downloads as the default product behavior.

### [0.19.41] - 2026-02-12
#### Added
- **Hero Text System for Text Items** (`src/components/ItemCard.jsx`, `src/components/CanvasItem.jsx`, `src/utils/textPresentation.js`):
  - Added shared text presentation helpers for deterministic hero/support text composition (`title -> content -> fallback`).
  - Replaced small centered quote styling for text cards with editorial top-left hierarchy in both Grid and Canvas:
    - larger heading style
    - semibold emphasis
    - controlled line clamps
    - optional supporting excerpt when title exists.

- **Domain-Aware Link View Policy** (`src/utils/linkDomainPolicy.js`, `src/utils/linkTextPreference.js`, `src/components/ItemModal.jsx`):
  - Added hostname policy map for link defaults:
    - text-first: `medium`, `substack`, `dev.to`, `hashnode`, `linkedin`, `notion.site`
    - preview-first: `x/twitter`, `reddit`
  - Added per-domain persisted preference key: `dreamlab_link_view_prefs`.

#### Changed
- **Item Details Link Presentation** (`src/components/ItemModal.jsx`):
  - Added bottom-left segmented mode switch for links: `Preview | Text`.
  - Mode resolver now uses:
    1. item-level `linkViewMode`
    2. stored per-domain preference
    3. domain default policy
    4. fallback preview.
  - Text mode enables only when extracted text is available (`textExtract.status === "ready"`).
  - Added safe fallback messaging when text-first domains have no extracted payload.
  - Added defensive clamping for rendered extracted text payload.

- **Link Item Persistence Defaults** (`src/lib/storage.js`, `src/App.jsx`):
  - New link items default to `linkViewMode: "preview"` when not provided.

#### Extension
- **Text Extraction in Capture Pipeline (Extension-first)** (`background.js`):
  - Added domain-aware link extraction attempt during extension link capture.
  - For text-first domains, background now fetches page HTML and attaches `textExtract` payload:
    - status/source/timestamp
    - title/byline/site/excerpt/content/wordCount (when available)
  - Extraction failures never block saves and return `failed`/`unavailable` states safely.
  - For preview-first domains, capture defaults to preview mode and marks text as unavailable.

#### Problems & Fixes
- **Problem**: Text cards lacked hierarchy and link details could not switch predictably between media preview and long-form reading for article domains.
- **Fix**: Introduced shared hero-text rendering logic plus domain-aware link mode resolution with persistent per-domain user preference and extension-side extraction fallback handling.

### [0.19.40] - 2026-02-12
#### Changed
- **Collection-first Canvas + Sidebar UX Polish** (`src/App.jsx`, `src/components/Sidebar.jsx`, `src/components/CanvasView.jsx`, `src/components/CanvasItem.jsx`, `src/components/WorkspaceStrip.jsx`, `src/index.css`):
  - Removed non-essential top header clutter in canvas mode and moved to a collection-name chip anchored inside the canvas frame.
  - Added inline collection rename directly from the on-canvas title chip.
  - Standardized sidebar collection interactions with hover menu (`...`) and action menu entries (`Rename`, `Delete Collection`).
  - Updated active tab visuals and spacing:
    - stronger orange outline
    - reduced fill intensity
    - tighter vertical spacing
    - fully pill-shaped tabs (including `All Items`)
  - Improved canvas interaction behavior and layout lock so touchpad/magic-mouse movement pans canvas without drifting surrounding layout.
  - Restored balanced white framing around the canvas while keeping full canvas focus.

#### Fixed
- **Details Modal Reliability + Action Semantics** (`src/components/ItemModal.jsx`, `src/components/Toast.jsx`, `src/components/TagInput.jsx`, `src/App.jsx`):
  - Fixed white-screen regression by restoring missing `Badge` import in `ItemModal`.
  - Reworked modal tag handling to deterministic state buckets:
    - `objectiveTags`
    - `contextTags`
    - `tags` (search)
  - Tag deletion via `×` now persists immediately and removes across all relevant tag stores.
  - Copy/Download actions now resolve media source by type:
    - image items -> image
    - link items with thumbnail -> thumbnail image
    - link without thumbnail -> URL fallback / disabled download
  - Fixed copy-image flow bug caused by treating an արդեն-fetched Blob as a Response.
  - Added explicit toast feedback for copy/download success and fallback/error states.
  - Fixed toast auto-dismiss lifecycle so toasts no longer get stuck when modal-driven state rerenders.

#### Changed
- **Collection Deletion Semantics** (`src/App.jsx`, `src/lib/storage.js` usage):
  - Deleting a collection now removes items inside that collection (instead of moving them to `All Items`), with updated confirmation copy.

#### Removed
- **All Items Breadcrumb Clutter** (`src/App.jsx`):
  - Breadcrumb row now hides in `All Items` view.

#### Problems & Fixes
- **Problem**: Modal actions felt unreliable (tag delete, copy/download, persistent toast), and canvas/sidebar UI had inconsistent interaction and visual behavior after collection-mode refactor.
- **Fix**: Re-established deterministic modal state updates, corrected copy/download source selection, fixed toast lifecycle dependencies, and aligned canvas/sidebar affordances to a cleaner collection-first interaction model.

### [0.19.39] - 2026-02-12
#### Rebuilt
- **Chrome Plugin Architecture Refactor** (`background.js`, `content.js`, `manifest.json`):
  - Reworked extension message flow into a clearer action-router model in background worker:
    - `saveCapturedItem`
    - `getDreamlabOrgData`
    - `getMultiSelectState`
    - `scanSourceImages`
    - `openMultiSelect`
  - Centralized page-image scan handling through content-script action `SCAN_PAGE_IMAGES` to reduce duplicated scan logic across popup windows and command handlers.
  - Added local app host compatibility for both loopback variants and preview host:
    - `http://localhost:5173/*`
    - `http://127.0.0.1:5173/*`
    - `http://localhost:4173/*`
    - `http://127.0.0.1:4173/*`
  - Updated command descriptions and extension metadata for collection-first capture flow.

#### Changed
- **Popup UI + Capture Routing UX** (`popup.html`, `popup.css`, `popup.js`):
  - Rebuilt popup layout using a tokenized neutral/brand style system aligned with design rules.
  - Removed legacy dense inline styles and migrated to dedicated stylesheet (`popup.css`).
  - Added destination controls that match collection architecture:
    - workspace
    - project
    - collection
    - tags
  - Switched popup org-data loading to background-mediated API (`getDreamlabOrgData`) instead of direct tab-query coupling.

- **Multi-Select Review UI + Flow** (`multi-select.html`, `multi-select.css`, `multi-select.js`):
  - Rebuilt image review modal styling/layout to align with plugin design direction and remove emoji-based labels.
  - Added destination controls (workspace/project/collection/tags) directly in multi-select save flow.
  - Added scope toggle behavior backed by background scan action (`scanSourceImages`) for reliable all-images retrieval from source tab.
  - Added clearer save-state/status feedback and selected-count behavior.

- **Smart Picker Visual Language Alignment** (`picker.css`, `picker.js`):
  - Updated picker highlight and status chip colors to brand/semantic palette.
  - Updated copy and state transitions to non-emoji UI messaging.

#### Removed
- **Dead Area Selection Runtime**:
  - Removed unused files:
    - `area-selector.css`
    - `area-selector.js`
  - This path was no longer wired into active command flow and created architectural noise.

#### Problems & Fixes
- **Problem**: Extension code had diverging UX patterns (popup vs multi-select), duplicated scan logic, localhost-only host assumptions, and outdated collection targeting support.
- **Fix**: Rebuilt extension around a background-driven message contract, shared content scan endpoint, collection-aware destination controls, and design-rule-aligned UI surfaces.

### [0.19.38] - 2026-02-12
#### Changed
- **App Locked to Collection Flow** (`src/App.jsx`):
  - Removed mode switching state and persistence (`dreamlab_work_mode`).
  - Removed Vibe/Creation navigation, headers, and render branches.
  - Collection flow is now the default and only workspace mode.
  - Floating bottom bar now focuses only on collection search/filter actions.
  - Pipeline debug view now reports Stage A only.

#### Removed
- **Vibe Mode UI + Pipeline**:
  - Removed `src/components/VibeModePanel.jsx`.
  - Removed `src/services/vibePipeline.js`.
  - Removed `src/services/lensRouting.js`.

- **Creation Mode UI + Generation Services**:
  - Removed `src/components/CreationCanvas.jsx`.
  - Removed `src/components/CreationModePanel.jsx`.
  - Removed `src/services/geminiImage.js`.

#### Problems & Fixes
- **Problem**: Collection/plugin work was sharing a mixed-mode codepath with Vibe and Creation features, increasing UI complexity and maintenance risk for this branch goal.
- **Fix**: Split branch to a collection-first architecture and removed non-essential mode surfaces/services so only collection + capture pathways remain active.

### [0.19.37] - 2026-02-12
#### Added
- **Stage A Backend Queue Runtime + API Endpoints** (`server/stageAQueueRuntime.js`, `server/index.js`, `vite.config.js`):
  - Added dedicated Stage A runtime with schema loading, batch planning, adaptive backoff, and in-memory result snapshots by `itemId`.
  - Added Stage A endpoints:
    - `POST /api/stagea/enqueue`
    - `GET /api/stagea/status`
    - `GET /api/stagea/result`
  - Mirrored Stage A endpoints inside Vite dev middleware so frontend uses one `/api/stagea/*` contract in dev and server modes.

#### Changed
- **Primitive Analysis Uses Remote Queue First** (`src/services/primitiveAnalysis.js`):
  - Stage A now queues to backend first, then polls remote status/results.
  - Added automatic fallback to local queue if remote enqueue fails.
  - Added TPM-safe primitive chunking (`STAGE_A_MAX_PRIMITIVES_PER_CALL`) and updated model defaults to `gemini-2.5-pro`.
  - Added per-item `rate_limited` handling with `analysisRetryAt` so retries wait for cooldown windows.

- **Backfill Throughput + Cooldown Safety** (`src/App.jsx`, `src/utils/analysisStatus.js`):
  - Increased backfill cadence and queue batch size for faster recovery on large image sets.
  - Backfill now skips items currently in active `rate_limited` cooldown.
  - `rate_limited` now counts as in-progress for analysis status interpretation.

- **Model Alignment Across Pipelines** (`src/services/geminiVision.js`, `src/services/vibePipeline.js`):
  - Updated vision and vibe chat default model fallbacks from `gemini-2.0-flash` to `gemini-2.5-pro`.

#### Problems & Fixes
- **Problem**: Stage A local-only processing was still vulnerable to Gemini 429 bursts, creating stale in-progress loops and slow backfill on larger queues.
- **Fix**: Moved Stage A orchestration to a backend queue runtime with adaptive global pauses, per-item retry scheduling, and remote status/result syncing to prevent repeated hammering during cooldown periods.

### [0.19.36] - 2026-02-10
#### Rebuilt
- **Creation Node Canvas Restored** (`src/components/CreationCanvas.jsx`, `src/App.jsx`):
  - Reintroduced Creation mode as a node-based canvas workflow after pipeline cleanup removed the previous implementation.
  - Added node types:
    - Prompt Input
    - Vibe
    - Collection Image
    - Image Generation
    - Generation Result
  - Restored slot-based wiring:
    - output slot -> input slot
    - type-checked connections (`text`, `vibe`, `image`)
    - connection chip toolbar with disconnect support
  - Restored canvas mechanics:
    - draggable/resizable nodes
    - visual edge rendering between ports
    - per-project flow persistence (`dreamlab_creation_flow_<projectId>`)
  - Restored generation execution path:
    - bottom-bar `Generate` trigger routes through `runSignal`
    - generation node composes prompt + vibe + refs and calls Gemini image generation
    - missing result node is auto-created and auto-wired
  - Restored result actions:
    - `Download`
    - `Add to Collection` via `saveItemWithTags` (fallback to `Generated Outputs` when no collection is selected)

#### Problems & Fixes
- **Problem**: Creation mode had regressed to a simple panel and no longer matched the node-based canvas flow used previously.
- **Fix**: Rebuilt `CreationCanvas` from scratch and rewired `Creation` mode in `App.jsx` to use the restored graph-based workflow and run trigger.

### [0.19.35] - 2026-02-09
#### Fixed
- **Collection Renaming Reliability** (`src/components/Sidebar.jsx`, `src/App.jsx`):
  - Replaced prompt-based collection rename with inline editing in sidebar.
  - Rename now supports:
    - double-click collection row
    - settings icon click on collection row
    - save on `Enter` / blur
    - cancel on `Escape`
  - Keeps `updateCollection()` persistence and success toast feedback.

### [0.19.34] - 2026-02-09
#### Added
- **Collection Rename in Sidebar** (`src/components/Sidebar.jsx`, `src/App.jsx`):
  - Collections listed under projects can now be renamed.
  - Rename options:
    - double-click collection row
    - click the collection settings icon on hover
  - Rename is persisted via `updateCollection()` and confirmed with toast feedback.

### [0.19.33] - 2026-02-09
#### Changed
- **Sidebar Now Shows Collections Under Projects** (`src/components/Sidebar.jsx`, `src/App.jsx`):
  - Added nested collection items below each project in the sidebar.
  - Added active-state highlight for selected collection.
  - Clicking a collection in sidebar now selects both project + collection and routes into Collection mode.

### [0.19.32] - 2026-02-09
#### Changed
- **Automatic Save to Generated Outputs on Generation** (`src/components/CreationCanvas.jsx`):
  - After each successful generation run, generated images are now automatically saved to the project’s `Generated Outputs` collection.
  - Auto-save runs silently in the generation pipeline and no longer requires manual button click.
  - Generation node status now includes auto-save summary (saved count / failed count).

#### Changed
- **Manual Save Path Refactor** (`src/components/CreationCanvas.jsx`):
  - Refactored `addImageToProject()` to support `silent` mode for internal auto-save usage.
  - Manual `Add to Generated` action still works as a fallback.

### [0.19.31] - 2026-02-09
#### Added
- **Dedicated Generated Outputs Collection** (`src/lib/storage.js`, `src/components/CreationCanvas.jsx`):
  - Added `getOrCreateGeneratedCollection(projectId)` helper with persistent collection kind `generated_outputs`.
  - Creation result saves now auto-route to this dedicated collection, instead of the currently open collection.

#### Changed
- **Creation Result Save UX** (`src/components/CreationCanvas.jsx`):
  - Updated result action label to `Add to Generated`.
  - Updated save success messages/status to explicitly mention `Generated Outputs`.
  - Fixed save-status badge logic to correctly show success for saved states.

#### Changed
- **Collection Overview Labeling** (`src/App.jsx`):
  - `Generated Outputs` cards now display a `Generated` badge for easier recognition.

### [0.19.30] - 2026-02-09
#### Added
- **Collection Layer Under Projects** (`src/lib/storage.js`, `src/App.jsx`):
  - Introduced `Workspace → Project → Collection` hierarchy.
  - Added collection storage key and CRUD helpers:
    - `getCollections()`
    - `createCollection()`
    - `updateCollection()`
    - `deleteCollection()`
  - Added `collectionId` on saved items so captures are scoped to a collection.
  - Active context now persists `collectionId` with workspace/project selection.

#### Changed
- **Project View Now Shows Collection Cards** (`src/App.jsx`):
  - In Collection mode, selecting a project opens a collection overview grid (cards), not immediate item clutter.
  - Added `New Collection` flow directly in project collection overview.
  - Added support for legacy `Unsorted` items (project items without a collection).

#### Added
- **Breadcrumb + Back Navigation** (`src/App.jsx`):
  - Added breadcrumb path in header:
    - Workspace > Project > Collection
  - Added back arrow action to move up one level:
    - Collection → Project collections
    - Project collections → Workspace/all items

#### Changed
- **Creation Save Respects Active Collection** (`src/components/CreationCanvas.jsx`):
  - Generated images added from Creation mode now persist to the currently active collection.

#### Changed
- **Item Reassignment Safety** (`src/components/ItemModal.jsx`):
  - When moving an item to another project from Item Modal, `collectionId` resets to avoid invalid cross-project collection references.

### [0.19.29] - 2026-02-09
#### Changed
- **Vibe Composer Stays in Edit Context** (`src/components/VibePanel.jsx`):
  - While creating/editing, the overview stays hidden so only the editing panel is visible.
  - `Analyze` now remains a preview step (no auto-close / no auto-save).
  - `Save Vibe` now re-applies the *current* controls (including updated color direction) at save-time to avoid stale prompt output.

#### Changed
- **Vibe Overview Simplified to Compact Cards** (`src/components/VibePanel.jsx`):
  - Replaced dense cards with smaller cards focused on:
    - title
    - intent label
    - color palette swatches
    - tiny keyword previews
  - Removed always-open heavy details by default.
  - Added click-to-open detail panel with a close action.

#### Added
- **Clear Edit Access for Existing Vibes** (`src/components/VibePanel.jsx`):
  - Added direct `Edit` action from each vibe card.
  - Added detail-panel edit action for deeper adjustments.
  - Deletion remains available but no longer the primary visible action.

### [0.19.28] - 2026-02-09
#### Added
- **JSON-First Vibe Output**:
  - Vibe creation now stores a full `contract` object on each vibe card (`src/components/VibePanel.jsx`).
  - Added `Export Contract JSON` action on vibe cards for downloadable `.json` contracts.

#### Changed
- **Vibe Node Exposes Contract JSON Output Slot** (`src/components/CreationCanvas.jsx`):
  - Added second output on `Vibe` node: `Contract JSON` (text slot).
  - Selected vibe card now provides both:
    - structured `vibe_profile` payload
    - raw serialized contract JSON payload

#### Changed
- **Generation Uses Stored Contract When Available**:
  - Added `compileContractPrompt()` in `src/services/vibeGeneration.js`.
  - Creation generation now compiles directly from stored vibe-card contract JSON when present, with runtime overrides for:
    - subject
    - structure lock policy
    - must-include / avoid
    - reference usage
  - Falls back to generated contract path for legacy cards without a stored contract.

#### Why
- Reduces prompt drift by treating vibe cards as persistent contract artifacts instead of rebuilding from noisy context each run.
- Improves debuggability and portability of vibe outputs across nodes and sessions.

### [0.19.27] - 2026-02-09
#### Added
- **Color Direction Controls in Vibe Creation** (`src/components/VibePanel.jsx`):
  - Added new `Color Direction` section in the vibe composer with:
    - quick color chips (pink, red, orange, yellow, green, mint, cyan, blue, purple, black, white)
    - custom color input (`Custom Colors`)
  - Added refinement fields:
    - `colorSelections`
    - `colorTargets`

#### Changed
- **Color Targets Persist on Vibe Cards** (`src/components/VibePanel.jsx`):
  - Saved color targets into each vibe card as `colorTargets`.
  - Added card UI block to display color targets with mini swatches.

#### Changed
- **Color Targets Flow Into Prompt Intent** (`src/components/VibePanel.jsx`):
  - Color targets are translated into `must include` cues (`color direction: ...`) during card creation.
  - These cues are then available to creation-node generation via existing vibe-card `mustInclude` pass-through.

### [0.19.26] - 2026-02-09
#### Changed
- **Vibe Creation UI Refactor (Bento + Steps)** (`src/components/VibePanel.jsx`):
  - Reworked the vibe composer into a clearer 3-step workflow:
    - Step 1: Objective template selection
    - Step 2: Controls (structure policy, exclusions, priorities)
    - Step 3: Analyze
  - Increased spacing and grouped related controls by proximity for lower cognitive load.
  - Added Bento-style sections:
    - Objective Template
    - Core Intent
    - Structure Policy + Quick Exclusions
    - Priority Mix sliders
    - Must Include / Avoid

#### Added
- **Objective Control Parameters on Vibe Cards** (`src/components/VibePanel.jsx`):
  - Added persistent per-card fields:
    - `structurePolicy` (`strict` | `soft`)
    - `priorities` (structure, color, typography, composition, imagery)
    - `exclusions` (quick exclusion chips)
  - Card view now surfaces:
    - structure policy summary
    - top priority summary
    - selected quick exclusions

#### Changed
- **Generation Now Reads Vibe Objective Controls** (`src/components/CreationCanvas.jsx`):
  - Vibe node output now includes `structurePolicy` and `priorities`.
  - Generation contract uses vibe-card `structurePolicy` as precedence for structure lock behavior.
  - Priority weights are forwarded into contract generation.

#### Changed
- **Contract Prompt Compiler Enriched with Priority Layer** (`src/services/vibeGeneration.js`):
  - Added priority normalization and top-priority hint synthesis.
  - Contract prompt now includes explicit `PRIORITIES` section.
  - `mustInclude` now injects priority emphasis so objective weighting stays visible in generation prompts.

### [0.19.25] - 2026-02-09
#### Added
- **Contract-Based Prompt Compiler** (`src/services/vibeGeneration.js`):
  - Added `generateContractPrompt()` and `generateContractPromptForProject()` for all intents.
  - New normalized contract structure:
    - `invariants`
    - `editableSlots`
    - `styleCues`
    - `mustInclude`
    - `forbidden`
    - `textSlots`
  - Compiles shorter structured prompts with explicit sections:
    - `LOCKED STRUCTURE`
    - `EDITABLE SLOTS`
    - `STYLE DIRECTION`
    - `MUST INCLUDE`
    - `FORBIDDEN`

#### Changed
- **Creation Flow Uses Contract Prompts** (`src/components/CreationCanvas.jsx`):
  - Replaced large blended prompt composition with contract-based prompt composition in `runGenerationNode()`.
  - Preserves dynamic behavior across all vibe intents while keeping prompt hierarchy consistent.
  - Uses first reference as structure lock and remaining references as style references when available.

#### Changed
- **Prompt Modal Uses Contract Prompts** (`src/components/PromptGenerationModal.jsx`):
  - Prompt preview now uses `generateContractPromptForProject()` for cleaner and stricter outputs.

#### Added
- **Lightweight Forbidden-Cue Repair Retry** (`src/components/CreationCanvas.jsx`):
  - Added one automatic retry pass if Gemini text response explicitly mentions forbidden cues.
  - Retry enforces strict correction while preserving structure invariants.

#### Problems & Fixes
- **Problem**: Long, mixed prompts over-weighted noisy extracted details and weakened slot-level control.
- **Fix**: Introduced contract compiler that prioritizes invariant structure and editable slot rules before style cues.
- **Problem**: Negative constraints were diluted by prompt sprawl.
- **Fix**: Centralized and normalized forbidden list generation in contract output.

### [0.19.24] - 2026-02-09
#### Changed
- **Hero Ref → Structure Reference** (`src/components/CreationCanvas.jsx`):
  - Renamed generation input socket label from `Hero Ref` to `Structure Reference`.
  - Renamed in-node preview section label to `Structure Reference` for clearer mental model.

#### Added
- **Structure Lock Toggle in Generation Node** (`src/components/CreationCanvas.jsx`):
  - Added `Lock Structure Reference` toggle to the `Image Generation` node UI.
  - Added persisted node flag `useStructureReference` (default `true`) so existing/saved flows remain backward compatible.
  - Prompt composition now branches:
    - toggle ON: preserve structure/composition from structure reference
    - toggle OFF: treat structure reference as style guidance only

#### Added
- **Mockup Vibe Intent + Hierarchy Contract**:
  - Added new intent `mockup_vibe` in `src/services/vibeGeneration.js`.
  - Added new Vibe template and design-type option in `src/components/VibePanel.jsx`.
  - Added `Mockup Vibe` option to generation intent selector in `src/components/CreationCanvas.jsx`.
  - Added default `Mockup Vibe` profile in `src/lib/vibeProfiles.js` and updated profile hydration to append missing defaults for older projects.
  - Generation flow now enforces a clearer hierarchy when `mockup_vibe` is active:
    - preserve structure invariants
    - change editable slots (flavor/name/hero graphic accents)
    - apply style direction
  - `mustInclude` / `avoid` from Vibe cards are now propagated into generation composition.

#### Problems & Fixes
- **Problem**: Structure-reference behavior was discussed but no visible control existed in UI.
- **Fix**: Added explicit toggle + wiring to prompt composition so behavior is user-controllable at run time.
- **Problem**: Mockup use case needed flavor-agnostic structure preservation across variants.
- **Fix**: Added dedicated mockup intent and prompt hierarchy scaffolding to prioritize layout invariants over style swaps.

### [0.19.23] - 2026-02-09
#### Improved
- **Automatic Storage Compaction on Quota Errors**:
  - Added `src/utils/storageCompaction.js` to recompress large stored image payloads in `dreamlab_items`.
  - Paste flow (`src/App.jsx`) now attempts one automatic compaction pass on quota error, then retries save.
  - Creation result add-to-collection flow (`src/components/CreationCanvas.jsx`) now also compacts and retries on quota error.

### [0.19.22] - 2026-02-09
#### Fixed
- **Paste-to-Collection Quota Robustness** (`src/App.jsx`):
  - Added progressive image compression retry loop for pasted local images before save.
  - Added explicit quota detection and user-friendly “Storage is full” error message instead of raw browser exception text.
  - Added base64-paste path fallback to blob-based save pipeline to apply the same compression/retry logic.

### [0.19.21] - 2026-02-09
#### Fixed
- **Collection Paste from Local Disk** (`src/App.jsx`):
  - Added clipboard `files` handling for image paste flows (local disk copy/paste cases that do not expose `items[i].type` as expected).
  - Hardened image compression fallback (canvas/context/image decode failures now fall back to original blob).
  - Updated image paste save flow to await `saveItemWithTags` and only show success toast after confirmed save.
  - Added explicit error toasts for unreadable/failed pasted image payloads.

### [0.19.20] - 2026-02-09
#### Fixed
- **Blank Screen After Generation (Creation Mode)** (`src/components/CreationCanvas.jsx`):
  - Root cause: creation-flow persistence attempted to store large generated base64 images in `localStorage`, causing `QuotaExceededError`.
  - Added sanitized graph persistence that strips heavy generated image payloads from saved flow state.
  - Wrapped flow persistence in safe error handling so quota failures no longer crash the UI.

### [0.19.19] - 2026-02-09
#### Fixed
- **LocalStorage Quota Failures on Add to Collection** (`src/components/CreationCanvas.jsx`):
  - Added automatic image optimization/compression before saving generated outputs to collection.
  - Added quota-aware retry with more aggressive compression.
  - Added explicit `Storage full` failure state and actionable error toast when save still cannot fit.
  - Prevents indefinite add-button loading behavior under storage pressure.

### [0.19.18] - 2026-02-09
#### Fixed
- **Live Edge Movement While Dragging Nodes** (`src/components/CreationCanvas.jsx`):
  - Node positions now update during drag (`onDrag`), so connection lines move in real time instead of only after drop.

#### Fixed
- **Add to Collection Spinner Stuck** (`src/components/CreationCanvas.jsx`):
  - Result-node add action now saves immediately via `saveItem` and marks items as `needsTagging` for background processing.
  - Prevents long-running tagging calls from blocking the button loading state.
  - Updated button label to `Add to Collection`.

### [0.19.17] - 2026-02-09
#### Added
- **Hero Reference Socket for Image Generation** (`src/components/CreationCanvas.jsx`):
  - Added dedicated `Hero Ref` input socket on `Image Generation` node.
  - Hero reference is prioritized as the first reference image during generation.

#### Added
- **Collection Image Node** (`src/components/CreationCanvas.jsx`):
  - New node type to select an image directly from the current project collection.
  - Outputs selected image via `Image Out` socket for connection into `Hero Ref`.
  - Includes inline preview and empty-state guidance when no project images exist.

#### Changed
- **Creation Canvas Wiring/UI**:
  - Added `Collection Image` to left Add Node rail.
  - Updated default flow to include/wire a `Collection Image` node into generation hero reference.
  - Added hero-reference preview section inside the generation node.

### [0.19.16] - 2026-02-09
#### Changed
- **Generation Result Node Simplified** (`src/components/CreationCanvas.jsx`):
  - Reworked result node UI to display the primary generated image only.
  - Removed verbose prompt/image list layout from the result node.
  - Added two direct actions:
    - `Download` (primary, prominent)
    - `Add to Project` (secondary)
  - Added inline save-status feedback for add-to-project action.

#### Added
- **Add to Project from Result Node**:
  - Connected result-node save action to existing `saveItemWithTags` pipeline, so generated outputs can be inserted into the current project collection directly from Creation mode.

### [0.19.15] - 2026-02-09
#### Added
- **Creation Board Vibe Node** (`src/components/CreationCanvas.jsx`):
  - Added a dedicated `Vibe` node type (`vibeCard`) with a selectable dropdown of project `vibeCards`.
  - Node outputs a `vibe_profile` payload compatible with existing Generation node input slots.
  - Users can now choose which saved Vibe card to run in Creation mode without manual JSON edits.

#### Changed
- **Default Creation Flow**:
  - Default wiring now uses the new `Vibe` node into `Image Generation` instead of relying on a seeded profile node.
  - Added `Vibe` to left-side **Add Node** bar.
  - Added auto-fallback behavior when selected Vibe card is missing/deleted (selects next available card).

### [0.19.14] - 2026-02-09
#### Changed
- **Adaptive Focus Instruction in Vibe Composer** (`src/components/VibePanel.jsx`):
  - `What should this analysis focus on?` now auto-adapts from:
    - selected template
    - what the user is trying to create
    - project prompt context (audience + tone)
  - Focus text updates dynamically until manually edited by the user.
  - Added explicit UI guidance that this field is sent to Gemini during Analyze.

#### Changed
- **Analyze Action Now Sends User Focus to Gemini Deep Synthesis**:
  - `VibePanel` now builds a run-specific analysis context (template, goal, focus, must-include, avoid) and passes it into deep analysis.
  - `App` deep-analysis handler now accepts `analysisContext` and returns structured results to callers.
  - `synthesizeProjectVibe(projectId, analysisContext)` now injects `ANALYSIS INTENT` instructions into the deep synthesis prompt and stores analysis context metadata in `deepInsights`.

### [0.19.13] - 2026-02-09
#### Changed
- **Vibe Window Rebuilt From Scratch** (`src/components/VibePanel.jsx`):
  - Replaced the previous stacked vibe/intelligence view with a two-pane workspace:
    - **Center**: Vibe Cards canvas
    - **Right Panel**: project details + optional prompt-refinement fields
  - Added empty-state flow with `Create Vibe` placeholder when no cards exist.
  - Added guided creation flow:
    - template selection (illustration, packaging, photography, brand style, logo/identity)
    - refinement fields (name, goal, focus, must include, avoid)
    - `Analyze` action to generate a full vibe card.
  - Added full result cards with:
    - rename support
    - style/mood/palette summaries + color swatches
    - generated prompt preview and avoid cues
    - extraction count + maturity badges

#### Added
- **Project-level Vibe Card Persistence**:
  - Added `vibeCards` to project schema defaults in `src/lib/storage.js`.
  - Added migration/hydration fallback in `src/App.jsx` for existing projects without `vibeCards`.

#### Problems & Fixes
- **Problem**: Old Vibe UI mixed too many layers (brief + profile previews + deep output) and increased cognitive load.
- **Fix**: Split responsibilities into a creation-first center workspace and a dedicated refinement sidepanel, with explicit template-to-analysis flow.

### [0.19.12] - 2026-02-09
#### Added
- **Multi-Vibe Node Workflow** (`src/components/CreationCanvas.jsx`):
  - Added a new `Vibe Profile` node type that creates alternate vibe variants from the same collection.
  - Added dedicated preset vibe nodes in the left node bar:
    - Product Photography Vibe
    - Illustration Vibe
    - Brand Style Vibe
    - Logo Vibe
  - Each Vibe Profile node has:
    - profile name
    - intent mapping
    - profile focus text (added to generation subject)

#### Changed
- **Generation Node Vibe Input**:
  - `Image Generation` node now accepts both raw vibe and vibe-profile outputs.
  - If connected to a Vibe Profile node, generation automatically uses that profile’s mapped intent and surfaces “Using <profile>” in-node.
  - Updated default creation flow to include and wire a Product Photography Vibe profile node.

### [0.19.11] - 2026-02-09
#### Changed
- **Rate-Limit Safe Vibe Mechanism** (`src/services/vibeEngine.js`):
  - Added global Gemini call pacing across vibe extraction + deep synthesis.
  - Added adaptive 429 backoff escalation and gradual cooldown recovery.
  - Added retry/requeue for per-image extraction tasks on 429 (instead of dropping failed items).
  - Moved queue scheduling to lightweight polling while API pacing is handled centrally.

#### Improved
- **Smart Collection Scan Payload**:
  - Deep synthesis now uses a compact strategy payload:
    - summarized collection statistics (top mediums, palettes, colors, shot types, etc.)
    - smaller sampled snapshot set (top 16 relevant images)
  - This reduces token pressure and lowers resource-exhausted failures during deep scans.

### [0.19.10] - 2026-02-09
#### Changed
- **Vibe Entry Initialization** (`src/App.jsx`):
  - When switching to `Vibe` mode, the app now uses existing project metadata as first inputs:
    - hydrates `vibeBrief.productOrBrand` from project name
    - hydrates `vibeBrief.contentNotes` from project description (if brief is still empty)
    - maps project category to a reasonable `vibeBrief.designType`

#### Improved
- **Smart Collection Scan Strategy** (`src/App.jsx`):
  - Added automatic deep-analysis trigger logic on Vibe mode entry with guardrails:
    - only runs with enough extraction signal (`>= 6`)
    - runs when deep insights are missing or stale
    - detects staleness by timestamp and sample-size growth
    - applies per-project cooldown to avoid repeated expensive scans

### [0.19.9] - 2026-02-09
#### Improved
- **Deeper Vibe Intelligence Pipeline**:
  - Expanded `aggregateProjectVibe()` in `src/services/vibeEngine.js` to preserve more extracted dimensions:
    - style: art movement
    - mood: aesthetic
    - composition: framing + aspect ratio
    - lighting: direction + mood lighting
    - color: accent colors + color grade
    - texture: surface quality + common effects
    - technical: lens, depth of field, photography ratio
    - subject patterns: secondary subjects
  - Added `synthesizeProjectVibe(projectId)` for project-level deep synthesis over the extraction set with Gemini, saved as `vibe.deepInsights`.

#### Added
- **Guided Vibe Brief UI** (`src/components/VibePanel.jsx`):
  - Reworked Vibe mode into a lower-cognitive workflow:
    - Step 1: “What are you creating?” brief (design type, product/brand, audience, tone, color/type/content notes, constraints)
    - Step 2: Vibe intelligence status with one-click deep analysis
    - Step 3: Deep strategy output cards (style archetypes, principles, color/typography direction, must-include signals)
  - Added save action for project brief and deep-analysis trigger.

#### Changed
- **Prompt Generation Context Quality**:
  - `src/services/vibeGeneration.js` now incorporates:
    - project brief (`project.vibeBrief`)
    - deep strategy insights (`projectVibe.deepInsights`)
    - richer technical context from aggregated vibe
  - `src/components/PromptGenerationModal.jsx` now pre-fills intent/subject from project brief.
  - `src/components/CreationCanvas.jsx` now passes project context into prompt generation so node runs use the same strategic brief.

#### Data Model
- `src/lib/storage.js` `createProject()` now initializes a `vibeBrief` object for new projects.

### [0.19.8] - 2026-02-09
#### Added
- **Generation Result Node** (`src/components/CreationCanvas.jsx`):
  - Added a new `Generation Result` node type with dedicated input slots:
    - `Prompt In` (text)
    - `Images In` (images)
  - Added `Generation Result` to the left **Add Node** bar.
  - Added rendering UI for connected prompt text and generated image outputs.

#### Changed
- **Automatic Result Wiring**:
  - On successful generation, if no result node is connected to a generation node, the canvas now auto-creates and auto-connects a result node.
  - Added legacy edge normalization support for `generate -> result` connections.

### [0.19.7] - 2026-02-09
#### Changed
- **Nano Banana Pro API Targeting**:
  - Updated `src/services/geminiImage.js` default image model to `gemini-3-pro-image-preview` (Nano Banana Pro).
  - Added alias mapping support (`nano banana pro`, `nano-banana-pro`, etc.) to resolve to the correct Gemini model ID.
  - Added model fallback logic to `gemini-2.5-flash-image` when a model is unavailable for a given API key.
  - Improved model error handling and surfaced model-attempt diagnostics.

#### Improved
- **Creation Feedback**:
  - Updated `src/components/CreationCanvas.jsx` generation status to include the model used for the run.

### [0.19.6] - 2026-02-09
#### Changed
- **Dedicated Node I/O Slots** (`src/components/CreationCanvas.jsx`):
  - Reworked flow connections to use explicit per-port wiring (port-to-port), not generic node-level linking.
  - Added dedicated input slots and output slots per node type.
  - Added strict compatibility checks (`text`, `vibe`, `images`) when connecting ports.
  - Generation node now has explicit input slots (`Prompt`, `Vibe`, `Refs`) and output slots (`Prompt Out`, `Images Out`).

#### Added
- **Node Management**:
  - Added a left-side **Add Node** bar with quick actions for Prompt, Vibe JSON, Image Input, and Image Generation nodes.
  - Added per-node delete actions (trash icon in each node header).
  - Added edge migration logic so older saved flows still load into the new slot-based model.

### [0.19.5] - 2026-02-09
#### Added
- **Gemini Image Generation in Creation Flow**:
  - Added `src/services/geminiImage.js` to generate images using the existing Gemini API key setup.
  - Supports optional reference images from the Image Input node.
  - Parses Gemini inline image responses and returns displayable data URLs.

#### Changed
- **Creation Canvas Execution** (`src/components/CreationCanvas.jsx`):
  - `Generate` run now triggers both prompt generation and Gemini image generation.
  - Added generation state handling (`Generating with Gemini...`).
  - Added generated image preview grid inside the Image Generation node.
  - Added error/info feedback for invalid Vibe JSON, missing vibe data, and Gemini failures.

### [0.19.4] - 2026-02-09
#### Added
- **Creation Node Canvas (Flora-style workmode)**:
  - Added `src/components/CreationCanvas.jsx` and wired it into `Creation` mode in `src/App.jsx`.
  - Node types included:
    - Prompt Input node (subject prompt text)
    - Vibe JSON node (editable JSON payload)
    - Image Input node (reference image URLs)
    - Image Generation node (intent/platform + generated prompt outputs)
  - Added draggable node layout with visual connections between nodes.
  - Added connect/disconnect workflow:
    - Start from right-dot (output) and connect to left-dot (input).
    - Existing connections can be removed from the connection toolbar.
  - Added flow persistence in localStorage per project (`dreamlab_creation_flow_<projectId>`).

#### Changed
- **Bottom Floating Bar**:
  - In `Creation` mode, right-side action now shows `Generate`.
  - Clicking `Generate` runs connected nodes and writes output into the Image Generation node.

#### Problems & Fixes
- **Problem**: Vibe and creation logic were split across panel + modal, not node-based.
- **Fix**: Introduced a dedicated execution canvas that consolidates prompt input, vibe JSON, and generation output in one flow surface.

### [0.19.3] - 2026-02-09
#### Changed
- **Workmode Navigation**:
  - Added bottom workmode switch in `src/App.jsx` with `Collection`, `Vibe`, and `Creation` modes next to the search field.
  - Moved Vibe display out of the collection header into dedicated `Vibe` mode.
  - Added dedicated `Creation` mode entry point to open the prompt generator.

#### Improved
- **Prompt Richness** (`src/services/vibeGeneration.js`):
  - Relaxed field filtering so more vibe fields survive into generation.
  - Reduced aggressive consensus gating for lower-priority fields.
  - Expanded color/keyword/texture inclusion in universal prompts.
  - Increased Midjourney trim limit from ~60 words to ~120 words.

### [0.19.2] - 2026-02-09
#### Added
- **Prompt Generation UI**:
  - Added `src/components/PromptGenerationModal.jsx` with intent selector, subject input, platform selector, prompt preview, and copy-to-clipboard action.
  - Integrated modal into `src/App.jsx` and connected it to toast feedback.
  - Added `Generate` action to `src/components/VibePanel.jsx`, opening the modal directly from the vibe card.

#### Problems & Fixes
- **Problem**: Designers had no in-app path from the vibe summary to prompt output.
- **Fix**: Connected Vibe Panel to `generatePromptForProject()` with a guided modal flow and validation for required subject input.

### [0.19.1] - 2026-02-09
#### Added
- **Vibe UI Panel (Project View)**:
  - Added `src/components/VibePanel.jsx` and integrated it into `App.jsx` under the project header.
  - Displays maturity badge, mood, dominant style, palette label, color swatches, atmosphere keywords, and extraction count.
  - Includes collapse/expand control to reduce visual load in grid view.
  - Shows a subtle guidance state for nascent vibes: "Add more images to strengthen the vibe."

#### Fixed
- **Project visibility gap**: Designers can now inspect current aggregated vibe state directly in the UI without opening devtools/localStorage.

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
