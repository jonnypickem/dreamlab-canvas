# Chrome Web Store Submission Fields (Dreamlab Canvas)

Last updated: 2026-02-25
Target update version: `1.2`
Previous published version: `1.1`

## 1) "What's new in this version"

Use this in the CWS update text field:

Improved extension reliability and capture workflows: stronger launcher recovery on stale tabs, stricter package parity checks, upgraded area capture (5/10/15s recording duration + component mode), and better screenshot-first preview behavior for saved links.

## 2) Reviewer Notes

Use this in the "Notes for reviewer" field:

This update keeps the same permission and host-access surface as v1.1 (`contextMenus`, `storage`, `activeTab`, `tabs`, `scripting`, and `<all_urls>` host access).  
Major behavior changes are reliability and UX focused:
- launcher open flow now verifies widget acknowledgment and retries on stale tabs,
- extension packaging now enforces zip/source parity checks before release,
- area capture now supports 5s/10s/15s recording durations and component-mode screenshot capture,
- link saves now prioritize screenshot previews.

Compliance disclosure URLs:
- Privacy policy: https://dreamlab-canvas.vercel.app/extension-privacy-policy.html
- Data compliance: https://dreamlab-canvas.vercel.app/extension-data-compliance.html

Primary reviewer smoke path:
1. Install v1.2 and open any standard website tab.
2. Press `Alt+Shift+S` to open launcher.
3. Run "Area Capture" and verify duration selector + component mode.
4. Confirm capture executes only after explicit user action.

## 3) Single Purpose Description

Dreamlab Canvas lets users explicitly capture pages, text, images, screenshots, and recordings from websites into their Dreamlab collections for organization and creative workflow.

## 4) Permission Justification Copy

- `contextMenus`: user-triggered save actions from page/image/selection context menus.
- `storage`: stores local extension settings and capture preferences.
- `activeTab`: runs user-requested capture actions on the active tab.
- `tabs`: tab lookup/orchestration and opening extension UI tabs.
- `scripting`: injects packaged extension scripts for picker/capture overlays.
- `host_permissions <all_urls>`: required for consistent cross-site widget presence and user-triggered capture entry points without repetitive per-site prompts.

## 5) Data Use Disclosure Helper (for CWS form)

Data handled by user-triggered extension actions:
- Page URL/title and optional metadata for saved pages.
- User-selected text and image references.
- User-triggered screenshots/recordings.
- Local extension settings in `chrome.storage.local`.

Commitments:
- No sale of user data.
- No use for creditworthiness/lending.
- Data transfer only as needed to complete user-requested save actions.
