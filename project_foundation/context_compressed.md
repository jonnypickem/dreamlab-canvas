# Dreamlab Canvas Context (Compressed)

## Purpose
This file is the fast operational context for Dreamlab Canvas.
It is a compressed, thematic counterpart to `project_foundation/context.md`, which remains the full historical source of truth.
Use this file for rapid onboarding, release prep, debugging context, and deployment safety checks.

Working rule inherited from the full context:
- After meaningful work, capture what changed, what broke, and how it was fixed.

## Product Snapshot
Dreamlab Canvas is a capture-first creative workspace that combines:
- Fast browser capture flows (image/video/area/page/metadata-triggered actions).
- Structured organization (workspace -> project -> collection -> items).
- Two working surfaces:
  - Grid for browsing, filtering, and reorder workflows.
  - Canvas for spatial ideation and viewport-aware placement.

Product direction at this stage:
- Canvas-first creative workspace with inline creation and reliable destination routing.
- Extension and app coordination hardened for cloud-backed saving and compliance-safe capture behavior.

Core product value:
- Reduce friction from web inspiration to organized assets.
- Keep capture velocity high without losing destination correctness.
- Support individual creators with lightweight but robust project/collection structure.

## Tech Stack and System Shape
Primary stack:
- Web app: React + Vite + Tailwind CSS.
- Extension: Chrome Manifest V3 JavaScript runtime.
- Backend: Supabase Auth + PostgreSQL + Storage.
- Hosting: Vercel.

System shape:
- Web app is the canonical data/UI owner for org context and saved content.
- Extension performs user-triggered capture and routes save payloads through validated destination context.
- Storage model is cloud-first (Supabase), replacing earlier local-only persistence assumptions.

High-level component boundaries:
- App/UI state and navigation context: `src/App.jsx` plus focused components under `src/components/`.
- Extension runtime entry points at repository root:
  - `manifest.json`
  - `background.js`
  - `content.js`
  - `floating-widget.js`
  - `multi-select.js`
- Server-side helpers and production runtime support:
  - `api/proxy.js`
  - `api/og.js`

Data and media:
- SQL schema baseline in `supabase-schema.sql`.
- Private media bucket: `dreamlab-media` (per-user storage model).
- RLS policy correctness is mandatory for tables and `storage.objects`.

## Compliance and Privacy Posture
Compliance posture is explicit and productized, not ad hoc.
The extension supports broad host access only with strict constraints:
- User-triggered capture model.
- Sensitive-surface blocking.
- Guardrails for private/local/internal metadata extraction.
- Bounded extraction behavior (timeouts/size limits).

Canonical compliance documentation references used by the project context:
- `project_foundation/extension-compliance-prerequisites.md`
- `project_foundation/privacy-policy-extension.md`
- `project_foundation/chrome-web-store-submission-fields.md`

Public compliance surfaces expected to remain available:
- `/extension-privacy-policy.html`
- `/extension-data-compliance.html`

Runtime behavior expectations for reviewer safety:
- No remote hosted code execution patterns.
- Permission usage is justified and aligned with disclosed behavior.
- Popup/options disclosure language matches actual runtime behavior.

## Current Status
Current status theme:
- Canvas-first workflow with inline creation, viewport-aware placement, and cloud-backed persistence.
- Extension compliance hardening shipped to support Chrome Web Store packaging and review readiness.
- App-shell navigation now supports foldable project/collection sidebar behavior with persistent user preference.
- Reload restore now uses deterministic workspace/project/collection context arbitration with immediate local writes on explicit navigation actions.
- X/Twitter link saves now normalize wrapped URLs into canonical status targets so rich preview rendering stays deterministic.
- Production deployment is unblocked after schema path relocation fix; user-confirmed collection/workspace reload remembrance now works on deployed build.
- Workspace switching now restores each workspace's own remembered project/collection context instead of resetting to `All Items`.
- Extension destination sync now reconciles app active context vs extension-local selection by recency metadata, then persists resolved destination for cross-site continuity.
- Extension image review now keeps visible/all scope strict, prioritizes high-resolution assets first, and exposes explicit blocked-source reasons for unselectable items.
- Extension keyboard workflow now uses a single launcher shortcut (`Alt+Shift+S`) and widget-scoped configurable action hotkeys.
- Launcher open path now requires widget acknowledgment and auto-recovers stale tabs via marker cleanup + reinjection retry.
- Extension release workflow now enforces deterministic packaging and zip/source parity checks before distribution.
- Grid and canvas card media-type indicators are now unified at bottom-left; grid text-card edit mode suppresses the indicator to avoid content overlap.
- `master` runtime behavior was rolled back to stable baseline `4810eff` via history-preserving revert; `project_foundation/lessons.md` was intentionally retained at latest state.

Operationally stable capabilities currently emphasized:
- Destination-aware capture saves across multiple capture modalities.
- Project-level browsing scope with collection-level canonical persistence.
- Improved multi-select reliability and better extension-to-app visibility diagnostics.

Current risk surface (actively managed):
- App/extension build drift causing subtle routing regressions.
- Invalid UI sentinel values leaking into persistence paths.
- Compliance regressions if permission/disclosure/guardrail parity drifts during iterative releases.

## Capability Themes
### 1) Capture Reliability and Routing Correctness
What improved:
- Save flows hardened for screenshot, recording, and color/link actions.
- Invalid destination values are sanitized before persistence.
- Background fallback resolution now prefers valid collection IDs from current org context.
- Tweet URL parsing now resolves wrapped redirect/query/hash formats and preserves canonical status URLs for preview-specific rendering.

Why it matters:
- Capture reliability is the product core; routing errors silently destroy trust.
- Smart picker and non-smart-picker actions now align on destination correctness.

### 2) Canvas-First Authoring and Placement
What improved:
- Inline note creation/editing in canvas mode.
- Viewport-aware placement with collision-aware offset behavior.
- Collection canvas stays canonical persisted layout.
- Project scope supports local draft layout control with reset behavior.

Why it matters:
- Spatial ideation works best when creation is immediate and placement predictable.
- Local draft behavior avoids cross-context persistence confusion.

### 3) Browsing and Scope Model Evolution
What improved:
- Project-level scope introduced with clear fallback semantics.
- Context restore order clarified (`collection -> project -> all items`).
- Ungrouped and foldered collection flows balanced for both structure and speed.

Why it matters:
- Users can operate by project intent without losing collection-level precision.
- Navigation state no longer causes frequent accidental context resets.

### 4) Editing Experience Unification
What improved:
- Text editing surfaces moved to a shared block-editor style flow.
- Markdown heading semantics preserved while enabling inline editing UX.
- Detail surfaces split by mode (grid modal vs canvas side panel) for context-appropriate editing.

Why it matters:
- Consistent editing model reduces friction and errors.
- Mode-specific detail views reduce cognitive load.

### 5) Extension Compliance Hardening
What improved:
- Production host scope tightened (dev/localhost assumptions removed).
- Sensitive page capture blocks implemented with explicit user feedback.
- Local/private/internal target protection applied in metadata extraction paths.
- Popup/options disclosure made first-class and runtime-aligned.

Why it matters:
- Compliance and review readiness now live in both docs and product behavior.
- Reduced risk of accidental policy or privacy violations under real-world use.

### 6) Observability and Debuggability
What improved:
- App build identity propagated through bridge payloads.
- Runtime diagnostics in extension surfaces identify connected app build.
- Better incident triage path when extension/app versions drift.

Why it matters:
- Fast root-cause isolation during production save failures.
- Lower mean-time-to-fix for cross-runtime integration issues.

## Key Recent Milestones
### [0.46.1] - 2026-02-25
Key outcomes:
- Restored missing compliance/submission docs referenced by project foundation and deployment rules.
- Prepared v1.2 Chrome Web Store update field copy (What's New, reviewer notes, single-purpose, permissions/data-use text).
- Bumped extension update metadata for submission eligibility (`manifest.json` `1.1` -> `1.2`, disclosure version -> `2026-02-25`).
- Added explicit CWS update prep handoff with diff summary vs original submission zip.

Net effect:
- Extension update package is submission-ready with synchronized metadata, compliance docs, and reviewer-facing answers.

### [0.46.0] - 2026-02-25
Key outcomes:
- Added area-capture duration preference contract (`areaCapturePrefsV1`) with runtime get/set actions.
- Added fixed 3-step area recording duration control (`5s/10s/15s`, default `10s`) and wired selected value through recorder injection/runtime.
- Updated recorder metadata to persist both actual duration (`durationMs`) and requested duration (`requestedDurationSec`).
- Changed recording guide border rendering to outside-offset so capture bounds remain visible without in-frame bleed.
- Added third area toolbar mode `Component` with single-element hover/select and immediate viewport screenshot save (`areaComponentScreenshot`).

Net effect:
- Area capture is more controllable (duration), cleaner in output (no border artifacts), and broader in utility (component-level single-click capture).

### [0.45.1] - 2026-02-24
Key outcomes:
- Reverted post-`0.45.0` runtime/app commits on `master` to restore `4810eff` behavior.
- Kept rollback non-destructive (revert commit `b9a1973`, no history rewrite).
- Preserved `project_foundation/lessons.md` at HEAD so operational learnings were not lost.

Net effect:
- Branch behavior returned to known-stable baseline while knowledge continuity remained intact.

### [0.45.0] - 2026-02-24
Key outcomes:
- Moved media-type badges from top-left to bottom-left in both grid and canvas card components.
- Preserved hover-only indicator behavior and existing card control placements.
- Added text-editing guard so grid text cards do not show the badge during inline edit mode.

Net effect:
- Card UI is visually consistent across surfaces and inline note editing is no longer obstructed by the type badge.

### [0.44.0] - 2026-02-24
Key outcomes:
- Added deterministic extension packaging scripts with explicit file manifest and single output path (`dreamlab-canvas-extension.zip`).
- Added artifact parity verifier that checks zip entry set + byte equality against source files.
- Added launcher-contract checks in zipped `content.js` / `background.js` to catch stale action-contract artifacts before install/share.
- Added `npm` workflow commands: `extension:package`, `extension:verify`, `extension:release`.

Net effect:
- Reinstalled extension artifacts now reliably match current source; stale zip drift no longer masks launcher fixes.

### [0.43.0] - 2026-02-24
Key outcomes:
- Added launcher open request/ack handshake between content relay and floating widget.
- Updated background launcher open flow to verify widget ack success before returning success.
- Added stale-tab recovery path: clear legacy widget marker/host, reinject `floating-widget.js`, retry open once.
- Guarded widget token stylesheet fetch against `chrome-extension://invalid/` runtime URLs to reduce invalid-runtime noise.

Net effect:
- `Alt+Shift+S` launcher behavior is now end-to-end validated and resilient on tabs that were open before extension reload/update.

### [0.42.0] - 2026-02-24
Key outcomes:
- Consolidated global keyboard entry to launcher shortcut (`Alt+Shift+S`) and routed shortcut-origin `save-page` command to widget keyboard launcher mode.
- Added persistent widget hotkey mapping contract (`widgetHotkeysV1`) with background runtime get/set actions.
- Added options-page controls for per-action hotkey customization (single-character `A-Z`/`0-9`, duplicate validation).
- Added widget await-mode behavior: mapped key executes action; unmapped key, Escape, outside click, and close button collapse the widget.
- Kept widget visual layout unchanged; changes are behavior/state only.

Net effect:
- Shortcut UX scales better under Chrome command limits while preserving strict user-triggered capture semantics.

### [0.41.0] - 2026-02-23
Key outcomes:
- Added persistent image-review filter preferences in extension storage (`multiSelectPrefsV1`) with background runtime get/set actions.
- Fixed capture bootstrap and scan contracts so visible sessions start from true on-screen candidates (`visible_with_total`) instead of all-images fallback.
- Added Google-style resolution tiers (`small`, `medium`, `large`, `icon`) with default resolution-priority sorting.
- Added deterministic type classification filters (`high`, `icon`, `profile`, `ad`, `other`) with persistent chip state and reset behavior.
- Added explicit selectability diagnostics (disabled blocked items + reason badges + blocked summary) for hard-unsavable sources.
- Fixed top-of-grid click dead-zone by enforcing author-level hidden rendering and disabling empty-state pointer interception.

Net effect:
- Image review behavior is predictable: visible mode stays visible-only, high-resolution images surface first, filter preferences persist, and blocked items no longer fail silently.

### [0.40.0] - 2026-02-23
Key outcomes:
- Added `activeContext.updatedAt` to app org-data bridge payload (`src/App.jsx`).
- Reworked extension destination arbitration in `background.js` to choose newer context between web-app and extension state.
- Preserved persisted destination timestamps on read and only stamped `updatedAt` on explicit destination writes.
- Synced resolved destination back into extension storage during org-data reads and save-path destination resolution.
- Updated floating widget and multi-select to use resolved destination returned by background.

Net effect:
- If app context changed more recently, extension adopts it; if extension selection is newer and app is unchanged, extension selection persists across sites.

### [0.39.0] - 2026-02-23
Key outcomes:
- Added workspace-scoped nav memory (`dreamlab_nav_workspace_memory_v1`) in `src/App.jsx`.
- Workspace switch now saves outgoing workspace selection and restores incoming workspace’s remembered project/collection when still valid.
- Added normalization/validation to avoid restoring deleted or cross-workspace stale IDs.

Net effect:
- Cross-workspace navigation preserves user context continuity per workspace.

### [0.38.0] - 2026-02-23
Key outcomes:
- Fixed build/deploy blocker by updating primitive schema paths to `analysis_and_prompting_schema` in both frontend registry and Stage A server runtime.
- Added legacy fallback probe in Stage A runtime to prevent local environment regressions during path transition.
- Confirmed prior navigation restore work was valid; production symptom was stale bundle from failed deploy.

Net effect:
- Vercel builds succeed again and reload remembrance behavior is confirmed working in production.

### [0.37.0] - 2026-02-23
Key outcomes:
- Added robust tweet URL canonicalization in both app and extension helpers (`src/utils/tweetCard.js`, `background.js`) with host expansion and wrapped-link candidate decoding.
- Extended OG parser (`api/og.js`) to return canonical URL metadata (`og:url` / `twitter:url`) and integrated that fallback into link-save resolution.
- Updated `saveLink` and paste handling in `src/App.jsx` to normalize incoming URLs and extract first HTTP URL from mixed clipboard text.
- Ensured saved tweet links use canonical status URLs so custom tweet preview logic receives stable inputs.

Net effect:
- Pasting X links (including wrapped/non-canonical forms) now produces the intended tweet-style preview instead of generic site fallback cards.

### [0.36.0] - 2026-02-23
Key outcomes:
- Added versioned local navigation payload `dreamlab_nav_context_v2` in `src/App.jsx`, while preserving legacy key compatibility.
- Reworked first-load restore normalization to derive missing workspace/project from valid collection/project IDs.
- Changed restore selection strategy to specificity-first (`collection > project > workspace`), then timestamp, then local tie-break.
- Added synchronous local persistence in explicit navigation handlers to survive fast reload after context changes.
- Hardened `setActiveContext` to explicitly write `updated_at` and surface Supabase write failures.
- Added idempotent SQL guard/trigger for `active_contexts.updated_at`.

Net effect:
- Reload from non-default workspace/project/collection no longer falls back to first workspace/all items when valid persisted context exists.

### [0.35.0] - 2026-02-23
Key outcomes:
- Added foldable project/collection sidebar in `src/App.jsx` with persisted collapsed state (`dreamlab_sidebar_collapsed`).
- Kept workspace strip always visible and interactive while collapsing only the secondary sidebar panel.
- Added top-edge collapse/expand toggle without conflicting with workspace settings control.
- Fixed wrapper flex regression so shortcuts remain bottom-anchored after fold-shell introduction.

Net effect:
- Better focus control in the app shell without losing workspace navigation reliability or sidebar information hierarchy.

### [0.34.0] - 2026-02-21
Key outcomes:
- Added build-diagnostic bridge path (app build ID visible to extension surfaces).
- Fixed destination routing failures for non-smart-picker actions by sanitizing `__unsorted__` collection sentinel values.
- Refreshed extension packaging artifact with routing and diagnostics fixes.

Net effect:
- Restored save reliability for color picker, full-page capture, area capture/recording where routing context had been invalid.

### [0.33.0] - 2026-02-19
Key outcomes:
- Compliance packaging/documentation set established for submission workflows.
- Production host/runtime assumptions cleaned up (localhost/dev removed from production scope).
- Sensitive-surface and metadata-risk controls hardened.
- Multi-select reliability improved (resolution filters, stable identity handling, blocked-preview fallback behavior).

Net effect:
- Substantially improved Chrome Web Store readiness and capture safety posture.

### [0.32.0] - 2026-02-18
Key outcomes:
- Reorder grid layout behavior moved toward denser masonry behavior to reduce whitespace artifacts.
- Reorder UI cleanup improved visual focus.

Net effect:
- Better spatial density and more predictable drag-reorder visual feedback.

### [0.31.0] - 2026-02-18
Key outcomes:
- Project-level browsing scope introduced.
- Active context model extended with `project_id` and context restore priority logic.
- Project canvas behavior clarified as local draft while collection canvas remains canonical persisted placement.

Net effect:
- Stronger project-centric workflow without compromising canonical collection persistence semantics.

### [0.29.0] - 2026-02-17
Key outcomes:
- Immediate local collection state sync for create/rename/delete.

Net effect:
- Eliminated stale refresh-only feedback loops and reduced UI inconsistency during frequent collection operations.

### [0.28.0] - 2026-02-17
Key outcomes:
- Introduced shared block editor and migrated major text-editing surfaces.

Net effect:
- Unified markdown-aware editing behavior across key interaction surfaces.

### [0.27.0] - 2026-02-17
Key outcomes:
- Compact, faster creation toolbar pattern and better positioning consistency.

Net effect:
- Reduced interaction cost for frequent create/search actions.

### [0.26.0] - 2026-02-16
Key outcomes:
- Inline canvas notes + viewport-aware placement.
- Navigation/context restore fixes to avoid resetting scope unexpectedly.

Net effect:
- Improved creation flow speed and stability during tab switching/realtime refresh events.

## Recurring Problems and Fix Patterns
Frequent problem categories and durable fix patterns:

1. Invalid context values entering persistence flow.
- Typical symptom: selective capture actions fail while others keep working.
- Durable fix: sanitize UI-only sentinels at both bridge and background save boundaries; validate against current org snapshot before commit.

2. Cross-runtime drift between app and extension.
- Typical symptom: behavior differences after one side updates.
- Durable fix: propagate build IDs through bridge responses, surface diagnostics in extension UI, and refresh extension package after runtime changes.

3. Navigation state regressions under realtime or tab lifecycle events.
- Typical symptom: context jumps back to "All Items" or stale scope.
- Durable fix: restore context only on initial load, but use versioned local payload + normalized candidate derivation + specificity-first arbitration; persist local context synchronously on explicit nav actions and keep subsequent realtime refreshes data-only.

4. Layout and interaction mismatch between grid and canvas workflows.
- Typical symptom: drag/reorder oddities, spacing waste, or mode-inappropriate detail behavior.
- Durable fix: separate mode-specific detail surfaces, tune density/layout behavior for the active mode, keep persistence semantics explicit per scope.

5. Compliance drift risk during rapid feature iteration.
- Typical symptom: docs and runtime behavior diverge, or production package includes dev assumptions.
- Durable fix: package-time checklist enforcement + explicit disclosure parity + sensitive-target block rules + bounded extraction controls.

6. Async persistence misuse.
- Typical symptom: partial saves or stale UI due to missing awaits.
- Durable fix: enforce async discipline in storage call sites and pair writes with explicit local state updates where immediate UX feedback is required.

7. App-shell wrapper regressions that break child flex assumptions.
- Typical symptom: sidebar sections that should pin to bottom drift upward after container refactors.
- Durable fix: preserve parent flex/stretch contracts when adding wrappers (`flex h-full` where required) and re-check top/bottom anchors after shell-level changes.

## Deployment Rules
Deployment authority for detail: `project_foundation/deployment.md`.
This section is the concise operational rule set.

### Branch and Release Flow
- Use feature branches (`codex/*` or `claude/*`) for implementation work.
- Merge feature branches into `master`; do not force-push `master`.
- Push to `master` triggers Vercel production deployment.

### Pre-Deploy Checks
- Build must pass: `npm run build`.
- Environment variables must exist both locally and in Vercel:
  - `VITE_GEMINI_API_KEY`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Supabase baseline must be valid:
  - `supabase-schema.sql` applied as required.
  - Storage bucket `dreamlab-media` exists.
  - RLS policies are in place for all required tables and `storage.objects`.

### Hosting and Runtime Rules
- Vercel configuration expects Vite production build output in `dist`.
- Keep serverless endpoints deployable and reachable:
  - `api/proxy.js`
  - `api/og.js`
- Production runtime changes that affect extension bridge behavior require extension packaging refresh and smoke validation.

### Extension Release and Compliance Rules
Before packaging/submission, confirm all of the following:
- Production host permissions are intentional and free of localhost/dev assumptions.
- Permission surface is justified and documented for reviewer-facing answers.
- Popup/options disclosures match runtime behavior:
  - all-sites access scope,
  - capture/transmission only on user-triggered actions.
- Sensitive-surface capture blocking is active.
- Local/private/internal metadata extraction targets are blocked.
- Extraction controls are bounded (timeouts/response-size limits).
- No remote hosted code execution patterns are introduced.
- Package includes only required extension runtime assets.
- Compliance docs are present and up to date:
  - `project_foundation/extension-compliance-prerequisites.md`
  - `project_foundation/privacy-policy-extension.md`
  - `project_foundation/chrome-web-store-submission-fields.md`
- Public policy pages are live and accessible without login:
  - `https://dreamlab-canvas.vercel.app/extension-privacy-policy.html`
  - `https://dreamlab-canvas.vercel.app/extension-data-compliance.html`

### Post-Deploy Smoke Checks
- Web app loads and authentication works.
- Media save/retrieval path works with Supabase storage.
- Core capture paths succeed with correct destination routing.
- Extension-to-app bridge connects correctly after extension reload.
- After extension install/update, hard-refresh active Dreamlab tabs before validation.

## Operational Guardrails
Engineering guardrails to keep reliability and compliance stable:
- Prefer minimal-impact fixes; avoid unrelated refactors in hot paths.
- Validate destination IDs against authoritative org data before save.
- Treat UI-only sentinel values as invalid persistence input.
- Keep async storage paths explicit; always `await` storage functions.
- Verify mode semantics before changing layout/edit flows:
  - Collection canvas = canonical persisted placement.
  - Project canvas = local draft behavior unless explicitly changed.
- Preserve disclosure parity whenever permissions or capture behavior changes.
- Do not ship extension runtime changes without reloading extension and hard-refreshing app tabs during validation.

Pre-merge review prompts:
- Does this change alter capture scope, permissions, or disclosure obligations?
- Could this introduce app/extension version drift failure modes?
- Does this affect destination routing or context restoration behavior?
- Are compliance docs and public policy surfaces still accurate?

## Maintenance Rule
After meaningful releases or incident fixes:
- Update `project_foundation/context.md` with detailed chronology.
- Update `project_foundation/context_compressed.md` with thematic deltas and milestone updates.
- Keep deployment rules in this file synchronized with `project_foundation/deployment.md`.
- Re-check compression ratio target: keep this file between 15% and 25% of `context.md` (bytes/lines).
- Preserve required section headings so this file remains predictable for fast operational use.
