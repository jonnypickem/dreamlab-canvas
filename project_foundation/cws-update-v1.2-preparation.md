# CWS Update Preparation (v1.2)

Date: 2026-02-25  
Baseline archive compared: `dreamlab-canvas-extension-cws-submission.zip` (original v1.1 submission)

## Package Diff Summary vs Original Submission

Changed files (13):
- `manifest.json`
- `background.js`
- `content.js`
- `floating-widget.js`
- `area-select.js`
- `area-select.css`
- `multi-select.html`
- `multi-select.css`
- `multi-select.js`
- `options.html`
- `options.css`
- `options.js`
- `picker.js`

Approximate diff size:
- `2746` insertions
- `410` deletions

## Key Runtime Changes Since v1.1

1. Launcher open flow hardened with widget acknowledgment and stale-tab recovery.
2. Deterministic extension packaging and zip/source parity verification added.
3. Area capture upgraded:
   - recording duration preference (`5s`, `10s`, `15s`)
   - component-mode screenshot capture.
4. Link save preview behavior improved (screenshot-first path).
5. Multi-select and options workflows expanded (filtering, reliability, and settings UX).

## Release Metadata Updated for v1.2

- `manifest.json` version updated to `1.2`.
- Extension disclosure version updated to `2026-02-25` in `background.js`.
- Public policy page "Last updated" dates refreshed to February 25, 2026:
  - `public/extension-privacy-policy.html`
  - `public/extension-data-compliance.html`

## Submission Artifact

Primary upload artifact:
- `dreamlab-canvas-extension.zip`

Optional tracking copy:
- `dreamlab-canvas-extension-cws-update-v1.2.zip`

SHA-256 (`dreamlab-canvas-extension-cws-update-v1.2.zip`):
- `38f55049865cf5feb5989a0d6eed7c3028535d160f5fa0968a4b70917cba92fa`

## Text Fields Prepared

Use:
- `project_foundation/chrome-web-store-submission-fields.md`

## Compliance Checklist Reference

Use:
- `project_foundation/extension-compliance-prerequisites.md`
- `project_foundation/privacy-policy-extension.md`
