# Dreamlab Extension Compliance Prerequisites

## Scope And Risk Acceptance
This checklist is for the Chrome extension package that intentionally keeps required all-sites access (`"<all_urls>"`) and an always-on widget.

Risk acceptance:
- This posture increases permission warning and review scrutiny compared to optional or on-click host access.
- The objective is best-risk-reduction while preserving product behavior.

## Mandatory Prerequisites Before Packaging
1. Production manifest keeps only required permissions.
2. Production manifest removes localhost/dev host entries.
3. `"<all_urls>"` remains explicitly justified in release notes and internal review.
4. Runtime guardrails block unsupported, local/private, and sensitive targets for metadata extraction/capture.
5. Capture and transmission only occur after explicit user actions.
6. Privacy disclosures in popup/options match actual runtime behavior.
7. No remote hosted code, dynamic eval, or runtime code injection from external sources.

## Permission Justification Map
- `host_permissions: <all_urls>`
  - Required for always-on in-page widget and cross-site user-triggered capture workflow.
- `tabs`
  - Tab query, selection, capture orchestration, and opening extension pages.
- `activeTab`
  - User-initiated capture flows and command-driven actions.
- `scripting`
  - Injection of local extension scripts/styles for picker and area capture overlays.
- `storage`
  - Persist widget configuration, destination, and pending capture state.
- `contextMenus`
  - User-triggered save actions from page/image/selection context menus.

## Data Handling Matrix
| Data | Read Trigger | Storage | Transmission |
|---|---|---|---|
| Current page URL/title | User capture action | Item payload and pending capture storage | Sent to Dreamlab app tab on save action |
| Selected text | User selection + save action | Item payload | Sent to Dreamlab app tab on save action |
| Image URLs / scanned image candidates | User image-review/capture action | Temporary extension state + saved item payload | Sent to Dreamlab app tab when user confirms save |
| Screenshots / area recordings | User command (full/page/area/video) | Temporary local storage and/or pending capture references | Sent to Dreamlab app tab on save |
| Widget settings/destination | User settings changes | `chrome.storage.local` | Not sent externally except destination context during save |

## No Silent Collection Standard
- Widget rendering on page load must not itself trigger content capture.
- No passive recurring harvest, telemetry crawl, or autonomous content scraping.
- Capture operations must be initiated from:
  - context menu click,
  - shortcut/action command,
  - explicit widget action button.

## Sensitive Surface Restrictions Standard
Block capture and metadata extraction on restricted surfaces:
- Browser/system URLs (`chrome://`, `edge://`, `devtools://`, `about:`).
- Sensitive auth/payment/account surfaces based on host/path heuristics.
- Local/private network addresses for metadata extraction.

User-facing behavior:
- Show clear error toast/message when blocked.
- Do not silently fail.

## Store Listing And Internal Disclosure Copy (Template)
Use this wording in release notes or listing text:

- "Dreamlab Capture requests all-sites access to provide an always-on capture widget and user-triggered capture actions on any page."
- "The extension captures and sends content only when you trigger a save/capture action."
- "Sensitive pages and unsupported targets are blocked by safety guardrails."

## Do-Not-Ship Blockers
1. Manifest includes dev localhost host permissions in production package.
2. Any runtime path performs capture/transmission without user action.
3. Metadata extraction allows local/private network targets.
4. Popup/options disclosure text conflicts with real behavior.
5. Remote hosted script execution or eval-like behavior exists.

## Verification Matrix
### Functional Regression
1. Context menu save image/text/page on normal websites.
2. Save-page command with text selection and link fallback.
3. Capture-visible, full-page, smart picker, color picker, area screenshot, area recording.
4. Multi-select image save flow.

### Compliance Regression
1. Widget loads without passive data capture.
2. Sensitive/unsupported pages are blocked with clear errors.
3. Metadata/text extraction applies protocol + local/private + size + timeout guardrails.
4. Production manifest has no localhost entries.

## Packaging Checklist
1. Confirm `manifest.json` production hosts and permissions.
2. Build zip with extension runtime files only.
3. Verify updated disclosure text in popup/options.
4. Verify this file and privacy policy are referenced from project docs.
