# Dreamlab Extension Privacy Policy (Internal Draft)

## Overview
Dreamlab Capture is a browser extension that helps users capture images, links, text, colors, screenshots, and recordings into Dreamlab collections.

This policy applies to extension-side behavior and should stay aligned with runtime implementation.

## Data Categories By Feature
1. Save page/link
- Page URL, page title, metadata (title/description/thumbnail), and optional text extract.

2. Save selection
- User-selected text and source page URL.

3. Save image or image review
- Image URL/source reference, page URL, and optional image metadata.

4. Screenshot and area recording
- User-triggered screenshot/recording payload, source page URL, and capture metadata (dimensions, format, duration).

5. Widget and settings
- Widget enabled state, widget layout preferences, excluded domains, and destination context.

## User Trigger Conditions
Data capture and transmission are user-triggered only.

Allowed triggers:
- Context menu actions
- Keyboard shortcuts and extension commands
- Explicit action buttons in extension UI

Non-trigger behavior:
- Widget may render on page load
- No passive automatic capture/transmission should occur from rendering alone

## Storage And Retention
- Extension state is stored in browser extension storage (`chrome.storage.local`) for configuration and pending capture recovery.
- Captured payloads are transmitted to the Dreamlab web app tab to persist in app/backend storage.
- Retention in Dreamlab app storage lasts until user deletion.

## Sharing And Third-Party Transfer
- Captured data is sent to Dreamlab app tabs/origins to complete user-requested saves.
- The extension does not sell captured data.
- No background telemetry crawl should run without explicit user action.

## Safety Controls
- Unsupported browser/system pages are blocked.
- Sensitive auth/payment/account-like surfaces are blocked for capture.
- Metadata/text extraction blocks local/private/internal network targets.
- Request timeouts and response-size limits reduce over-collection risk.

## User Controls
Users can:
- Enable/disable the floating widget
- Configure excluded domains for widget visibility
- Set/reset capture destination preferences
- Delete captured content from Dreamlab app

## Security Notes
- Extension code is bundled locally (no remote code execution dependency for capture features).
- Sensitive page restrictions and URL validation are enforced before extraction actions.

## Internal Reference Paths
- Compliance checklist: `Project foundation/extension-compliance-prerequisites.md`
- Context reference: `Project foundation/context.md`
- Public policy URL: `https://dreamlab-canvas.vercel.app/extension-privacy-policy.html`
- Public compliance URL: `https://dreamlab-canvas.vercel.app/extension-data-compliance.html`

## Contact
For privacy or compliance issues, use your internal Dreamlab support/security contact channel.
