# Dreamlab Canvas Extension Compliance Prerequisites

Last updated: 2026-02-25

## Release Scope

This checklist gates Chrome Web Store update submissions for the Dreamlab Canvas MV3 extension.

## Required Artifacts

- Updated extension version in `manifest.json` (must be higher than currently published version).
- Deterministic package artifact: `dreamlab-canvas-extension.zip`.
- Verified parity between zip and source extension files.
- Reviewer-facing submission text updated for current release behavior.

## Pre-Package Compliance Checks

1. Confirm permission and host scope are intentional:
   - `contextMenus`, `storage`, `activeTab`, `tabs`, `scripting`
   - `host_permissions`: `https://dreamlab-canvas.vercel.app/*`, `<all_urls>`
2. Confirm no localhost/dev host entries exist in manifest/runtime production paths.
3. Confirm disclosure parity:
   - Popup/options explain all-sites host access and user-triggered capture model.
   - Public policy pages match runtime behavior.
4. Confirm safety controls are active:
   - Unsupported browser/system URLs blocked.
   - Sensitive auth/payment/account-like pages blocked for capture actions.
   - Local/private/internal metadata extraction targets blocked.
   - Extraction fetch controls bounded (timeout + response-size limit).
5. Confirm no remote code execution patterns:
   - No `eval`, `new Function`, or remote script execution for extension runtime logic.
6. Confirm package includes only required runtime assets (no source app build output, docs, or dev files).

## Build and Verify Commands

```bash
npm run extension:release
```

Expected result:
- `dreamlab-canvas-extension.zip` recreated.
- Zip/source parity checks pass.
- Launcher contract token checks pass.

## Post-Build Manual Smoke Checks

1. Load updated unpacked extension and hard-refresh an existing Dreamlab app tab.
2. Verify launcher shortcut (`Alt+Shift+S`) opens widget without stale-action errors.
3. Verify save page, image review, full screenshot, area screenshot, and area recording flows.
4. Verify area recording duration preference (`5s/10s/15s`) persists.
5. Verify component mode in area capture saves a component screenshot.
6. Verify popup/options compliance links open:
   - `https://dreamlab-canvas.vercel.app/extension-privacy-policy.html`
   - `https://dreamlab-canvas.vercel.app/extension-data-compliance.html`

## Submission Notes Guardrail

If permissions or host scope are unchanged, explicitly state this in reviewer notes to reduce re-review ambiguity.
