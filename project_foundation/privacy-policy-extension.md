# Dreamlab Canvas Extension Privacy Policy (Internal Draft)

Last updated: 2026-02-25
Public page: `https://dreamlab-canvas.vercel.app/extension-privacy-policy.html`

## Single Purpose

Dreamlab Canvas enables user-initiated capture of web content (page links, text, images, screenshots, and recordings) into a user-owned Dreamlab workspace.

## Data Categories

- Page metadata selected by user actions (URL, title, optional preview metadata).
- User-selected text and image references.
- User-triggered screenshots and area recordings.
- Extension preferences in `chrome.storage.local` (widget visibility, excluded domains, position, hotkeys, destination preferences, area capture preferences).

## Capture Trigger Model

- Capture and transmission are user-triggered only.
- Allowed triggers include context menu actions, explicit widget button clicks, and configured widget hotkeys while keyboard mode is active.
- Rendering the widget on page load does not, by itself, transmit capture payloads.

## Storage and Retention

- Extension settings are stored locally in `chrome.storage.local`.
- Captured content is sent to Dreamlab services only to complete user-requested saves.
- Saved items remain in Dreamlab storage until deleted by the user.

## Sharing and Sale

- Data is transferred only to Dreamlab infrastructure required for save workflows.
- User data is not sold.
- Data is not used for creditworthiness or lending decisions.

## Safety and Access Controls

- Unsupported browser/system URLs are blocked.
- Sensitive auth/payment/account-like pages are blocked from capture routes.
- Local/private/internal network metadata extraction targets are blocked.
- Remote extraction is bounded by timeout and response-size limits.
- Extension runtime logic does not execute remote hosted code.

## User Controls

- Toggle widget visibility.
- Exclude domains from widget rendering.
- Configure widget placement and action hotkeys.
- Manage or delete captured items from the Dreamlab app.
