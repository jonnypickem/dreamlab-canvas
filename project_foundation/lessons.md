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

## Corrections Log
| Date | Issue | New Rule | Applied Where |
| --- | --- | --- | --- |
| 2026-02-23 | Sidebar fold toggle risked conflicting with workspace rail settings affordance. | Place new shell-level controls outside existing persistent control hit areas and verify both states (expanded/collapsed). | `src/App.jsx` sidebar toggle placement |
| 2026-02-23 | Sidebar wrapper change caused layout to pin to top and broke bottom-anchored shortcuts. | Preserve parent flex context when introducing wrappers around full-height sidebars (`flex h-full`), then re-check bottom anchoring behavior. | `src/App.jsx` sidebar wrapper (`flex h-full`) |
| 2026-02-23 | Reload from collection view still reset to first workspace/all items despite persisted context keys. | Replace fragmented nav persistence with normalized candidate restore (derive workspace/project from collection), specificity-first arbitration, and immediate local writes on explicit navigation actions. | `src/App.jsx`, `src/lib/storage.js`, `supabase-schema.sql` |
| 2026-02-23 | Pasted X links in wrapped/non-canonical format rendered generic cards instead of tweet previews. | Parse URL candidates from path/query/hash, normalize to canonical tweet status URL, and reconcile with OG canonical URL before persisting link items. | `src/utils/tweetCard.js`, `src/App.jsx`, `api/og.js`, `background.js` |
