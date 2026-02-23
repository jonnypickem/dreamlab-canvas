# Lessons Learned

## Rules
- Convert repeated mistakes into explicit, reusable rules.
- Prefer root-cause fixes over temporary workarounds.
- Verify completion with objective evidence before marking done.
- Keep changes small, targeted, and easy to review.
- When wrapping existing layout-critical components, preserve their flex/stretch contract (`flex h-full` when child relies on `self-stretch` + `grow` behavior).
- For new floating/toggle controls, explicitly validate click-area collisions with nearby persistent controls (especially fixed rails/settings buttons).
- For persisted navigation context, store a versioned single-object payload and mirror legacy keys only for compatibility; avoid relying on fragmented multi-key reads.
- For restore arbitration, prefer context specificity (`collection > project > workspace`) before timestamp recency to avoid richer local context being overwritten by stale coarse DB context.
- For reload-critical navigation UX, write local persistence synchronously inside explicit user navigation handlers (not only in deferred effects).
- For provider-specific rich previews (for example X/Twitter), canonicalize incoming URLs before save and re-check using `og:url`/`twitter:url` fallback metadata.
- When a bug appears unresolved after code changes, verify deployment/build health first; stale production bundles can mimic logic failures.
- If foundational directories are relocated, update every runtime import/path consumer (frontend + server) before judging feature behavior.
- For multi-workspace apps, store navigation memory per workspace and restore that scope on workspace switch; avoid global reset-to-all-items behavior.
- For cross-surface destination sync (web app vs extension), include comparable `updatedAt` metadata on both sides and never mutate timestamps during read/sanitize paths.
- For dual-scope image scanners (`visible` vs `all`), keep contracts strict end-to-end; fallback recovery sets must not overwrite visible-scope payloads.
- When some captured items are intentionally unsavable, expose explicit selectability reasons in UI instead of silently blocking selection.
- When using semantic hidden states in extension UI, enforce `[hidden] { display: none !important; }` so component class rules do not accidentally keep click-blocking overlays mounted.

## Corrections Log
| Date | Issue | New Rule | Applied Where |
| --- | --- | --- | --- |
| 2026-02-23 | Sidebar fold toggle risked conflicting with workspace rail settings affordance. | Place new shell-level controls outside existing persistent control hit areas and verify both states (expanded/collapsed). | `src/App.jsx` sidebar toggle placement |
| 2026-02-23 | Sidebar wrapper change caused layout to pin to top and broke bottom-anchored shortcuts. | Preserve parent flex context when introducing wrappers around full-height sidebars (`flex h-full`), then re-check bottom anchoring behavior. | `src/App.jsx` sidebar wrapper (`flex h-full`) |
| 2026-02-23 | Reload from collection view still reset to first workspace/all items despite persisted context keys. | Replace fragmented nav persistence with normalized candidate restore (derive workspace/project from collection), specificity-first arbitration, and immediate local writes on explicit navigation actions. | `src/App.jsx`, `src/lib/storage.js`, `supabase-schema.sql` |
| 2026-02-23 | Pasted X links in wrapped/non-canonical format rendered generic cards instead of tweet previews. | Parse URL candidates from path/query/hash, normalize to canonical tweet status URL, and reconcile with OG canonical URL before persisting link items. | `src/utils/tweetCard.js`, `src/App.jsx`, `api/og.js`, `background.js` |
| 2026-02-23 | Navigation fix appeared broken, but the latest build never deployed because schema imports still pointed to removed directory. | Before re-architecting behavior, confirm production build/deploy status and resolve path/import regressions caused by directory moves. | `src/services/analysisSchemaRegistry.js`, `server/stageAQueueRuntime.js` |
| 2026-02-23 | Switching workspaces dropped user into `All Items` instead of previous context for that workspace. | Persist and restore last selected project/collection per workspace (workspace-scoped memory), and validate remembered targets against live workspace data before applying. | `src/App.jsx` |
| 2026-02-23 | Extension destination kept overriding newer web-app context because stored destination lacked reliable recency comparison and sanitize logic rewrote `updatedAt` on read. | Use timestamp-based arbitration between app active context and extension destination, include app `activeContext.updatedAt` in bridge payloads, and preserve persisted timestamps when reading destination state. | `background.js`, `src/App.jsx`, `floating-widget.js`, `multi-select.js` |
| 2026-02-23 | Image review showed all images even in visible mode and some items appeared randomly unselectable with no explanation. | Keep visible/all scan payloads separated through content -> background -> UI, and attach deterministic selectability diagnostics (reason badges + disabled controls) for hard-unsavable URLs. | `content.js`, `background.js`, `multi-select.js`, `multi-select.html`, `multi-select.css` |
| 2026-02-23 | Top rows in image review could not be selected even when items were valid. | Prevent hidden overlays from intercepting pointer events by enforcing author-level hidden display reset and non-interactive empty-state overlays. | `multi-select.css` |
