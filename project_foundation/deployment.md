# Dreamlab Canvas — Deployment Instructions

## Project Overview

React/Vite/Tailwind web app + Chrome Extension (MV3). Backend is Supabase (Auth, PostgreSQL, Storage). Hosted on Vercel.

## Branches

| Branch | Purpose |
|--------|---------|
| `master` | Production — Vercel auto-deploys on push |
| `codex/*` | Feature/experiment branches (e.g. `codex/collection-and-plugin`) |
| `claude/*` | Claude Code working branches |

**Do NOT force-push to `master`.** Always merge feature branches in.

## Git Workflow

1. Work on a feature branch (`codex/*` or `claude/*`)
2. Commit and push to your branch
3. Merge into `master`: `git checkout master && git merge <branch>`
4. Push master: `git push origin master` — this triggers Vercel deployment
5. If merge conflicts arise, resolve them keeping Tailwind classes over inline styles

## Local Development

```bash
npm install
npm run dev          # Vite dev server (web app only)
npm run dev:all      # Web app + local server (concurrently)
npm run build        # Production build
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description | Source |
|----------|-------------|--------|
| `VITE_GEMINI_API_KEY` | Gemini API for AI image tagging | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `VITE_SUPABASE_URL` | Supabase project URL | Supabase Dashboard → Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Supabase Dashboard → Settings → API |

These must also be set in Vercel project settings for production.

## Supabase Setup

- Run `supabase-schema.sql` in the Supabase SQL Editor
- Create a storage bucket named `dreamlab-media`
- RLS policies are required on all tables AND `storage.objects` — see schema file for details
- After navigation-context updates, re-run latest idempotent schema so `active_contexts.updated_at` and trigger coverage are present.

## Vercel Configuration

- Framework: Vite
- Build command: `vite build`
- Output directory: `dist`
- Serverless functions in `api/` directory:
  - `api/proxy.js` — image proxy for CORS bypass (required in production)
  - `api/og.js` — Open Graph handler

## Chrome Extension

The extension is built separately (not part of the Vite build). Key files at project root:
- `manifest.json`, `background.js`, `content.js`, `picker.js`, `area-select.js`
- `offscreen.html` / `offscreen.js` — video recording support

After changing extension files: reload the extension in `chrome://extensions` AND hard-refresh any open Dreamlab Canvas tabs.

### Extension Production Compliance Checklist

Before packaging a production zip:

1. Confirm `manifest.json` includes `"<all_urls>"` only where intentionally required, and does not include localhost/dev host entries.
2. Confirm extension permissions are justified in release notes:
   - `contextMenus`, `storage`, `activeTab`, `tabs`, `scripting`, `host_permissions: <all_urls>`.
3. Confirm popup/options disclosure text matches runtime behavior:
   - all-sites access is enabled,
   - capture/transmission only happen on user-triggered actions.
4. Confirm safety guardrails:
   - unsupported/sensitive pages blocked,
   - local/private/internal metadata targets blocked,
   - extraction requests have timeout and response-size limits.
5. Confirm no remote hosted code execution (`eval`, dynamic remote script execution) exists in extension runtime.
6. Confirm packaging includes only required extension runtime assets.
7. Confirm compliance docs are present and referenced:
   - `project_foundation/extension-compliance-prerequisites.md`
   - `project_foundation/privacy-policy-extension.md`
   - `project_foundation/chrome-web-store-submission-fields.md`
8. Confirm public policy URLs are live and accessible without login:
   - `https://dreamlab-canvas.vercel.app/extension-privacy-policy.html`
   - `https://dreamlab-canvas.vercel.app/extension-data-compliance.html`

## Common Pitfalls

- All `storage.js` functions are async — every caller must `await`
- Supabase RLS: `.insert().select().single()` needs both INSERT and SELECT policies
- Reload-restore behavior depends on both local nav payload (`dreamlab_nav_context_v2`) and `active_contexts.updated_at`; stale schema can mask restore fixes
- Bottom toolbar positioning: use `absolute bottom-[46px]` (Tailwind), never `fixed` or inline styles
- The `content.js` bridge uses `postMessage` — it does NOT write to localStorage directly
- After reinstalling the extension, ALL open tabs need a hard refresh
