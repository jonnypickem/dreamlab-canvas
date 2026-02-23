# Lessons Learned

## Rules
- Convert repeated mistakes into explicit, reusable rules.
- Prefer root-cause fixes over temporary workarounds.
- Verify completion with objective evidence before marking done.
- Keep changes small, targeted, and easy to review.
- When wrapping existing layout-critical components, preserve their flex/stretch contract (`flex h-full` when child relies on `self-stretch` + `grow` behavior).
- For new floating/toggle controls, explicitly validate click-area collisions with nearby persistent controls (especially fixed rails/settings buttons).

## Corrections Log
| Date | Issue | New Rule | Applied Where |
| --- | --- | --- | --- |
| 2026-02-23 | Sidebar fold toggle risked conflicting with workspace rail settings affordance. | Place new shell-level controls outside existing persistent control hit areas and verify both states (expanded/collapsed). | `src/App.jsx` sidebar toggle placement |
| 2026-02-23 | Sidebar wrapper change caused layout to pin to top and broke bottom-anchored shortcuts. | Preserve parent flex context when introducing wrappers around full-height sidebars (`flex h-full`), then re-check bottom anchoring behavior. | `src/App.jsx` sidebar wrapper (`flex h-full`) |
