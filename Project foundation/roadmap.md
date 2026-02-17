# Dreamlab Canvas Roadmap

## Currently Shipped
- **Capture**: save page, visible screenshot, full-page screenshot, smart picker, area screenshot, area video recording
- **Organization**: workspaces, collections, bulk select/delete/download
- **Views**: grid (masonry) + canvas (pan/zoom/drag/resize)
- **Canvas**: inline notes, viewport-aware placement, creation toolbar, floating detail panel
- **AI**: Gemini-powered tagging (quick/smart/deep tiers)
- **Auth**: Supabase auth, invite code gating for closed alpha
- **Storage**: Supabase (PostgreSQL + Storage), signed URL caching, thumbnail generation
- **Extension**: Arc/Dia compatible shortcuts, content-script bridge, multi-select capture

---

## Tier 1 — Alpha Blockers
- [ ] Extension install link surfaced in web app (signup → install → first capture flow)
- [ ] Error recovery / retry on failed Supabase writes (toast-on-failure, retry pattern for critical saves)

## Tier 2 — Bring Back the AI/Creative Layer
Previously built (0.19.0–0.19.41), stripped in 0.19.38 for the collection branch. Need re-introduction into the current canvas-first architecture:
- [ ] **Vibe Analysis Pipeline** — extract visual DNA from collection images, aggregate into project vibe (mood, color, style, composition)
- [ ] **Vibe UI** — vibe cards with style archetypes, color palettes, keywords, deep synthesis
- [ ] **Creation Canvas** — node-based generation workflow (prompt + vibe + refs → Gemini image generation)
- [ ] **Contract-based prompt compiler** — structured prompts for Midjourney/DALL-E/Flux
- [ ] **Prompt Generation Modal** — intent/subject/platform → optimized prompt output
- [ ] **AI tagging improvements** — smarter categorization, auto-collections, duplicate detection

## Tier 3 — UX Gaps That Testers Will Hit
- [ ] Grid virtualization (200+ items — `react-virtuoso` or pagination)
- [ ] Sort controls (date, type, name)
- [ ] Full-text search (titles, tags, descriptions, extracted text)
- [ ] Bulk move items between collections
- [ ] Trash / recently deleted

## Tier 4 — Canvas Polish
- [ ] Snap-to-grid / alignment guides
- [ ] Zoom-to-fit button
- [ ] Minimap
- [ ] Item grouping / locking
- [ ] Canvas background options (dot grid, color)
- [ ] Export canvas as image/PDF

## Tier 5 — Sharing & Collaboration
- [ ] Public share link (read-only collection or canvas)
- [ ] Embeddable canvas view
- [ ] Multi-user presence (later)

## Tier 6 — Quality of Life
- [ ] Dark mode
- [ ] Undo/redo (at least for delete)
- [ ] Nested collections / folders
- [ ] Favorites / pinning
- [ ] Right-click in extension → save to specific collection
- [ ] Responsive layout for tablet/smaller windows

## Tier 7 — Integrations
- [ ] Figma plugin (push items to Figma)
- [ ] Collection export as ZIP
- [ ] Notion/Slack sharing
