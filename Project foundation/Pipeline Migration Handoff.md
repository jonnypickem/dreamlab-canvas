# Pipeline Migration Handoff

## Status: AWAITING GO FROM JONNY — Do not execute until confirmed.

---

## What This Is

This document instructs Codex to remove the old fixed-category vibe analysis pipeline and replace it with the new **Primitives + Lenses** architecture. The new system extracts nine universal visual primitives per image (Stage A), then applies composable interpretive lenses driven by user intent (Stage B).

---

## Context

Dreamlab Canvas analyzes images that designers collect as inspiration. The old pipeline used a fixed set of vibe categories. The new pipeline decouples **extraction** (what's in the image) from **interpretation** (what it means for a given project), making the system extensible to any design domain without pipeline changes.

### Architecture Summary

**Stage A — Primitives (always run, per image, cheap)**
Nine universal schema blocks that extract foundational visual data from every image:

1. `color_system` — palette, harmony, temperature, contrast, saturation strategy
2. `spatial_structure` — grid, density, whitespace, focal zones, depth, edge behavior
3. `typography_behavior` — hierarchy, scale, weight, spacing, pairing, voice
4. `surface_material` — texture, finish, depth cues, material references, production signals
5. `shape_language` — form vocabulary, edge quality, corners, complexity, containment
6. `rhythm_pattern` — tempo, repetition, modularity, pacing, pattern behavior
7. `hierarchy_flow` — entry point, eye path, emphasis system, information density
8. `imagery_mode` — photography/illustration/render type, treatments, realism spectrum
9. `stylistic_lineage` — movements, era signals, cultural references, hybridization

**Stage B — Lenses (selective, intent-driven, modular)**
Three lens categories that reinterpret primitive data:

- **Domain lenses** — packaging, UI, branding, editorial, advertising, etc.
- **Style lenses** — artistic character, taste fingerprinting, mood/emotion
- **Structural lenses** — pure compositional and formal analysis

Lenses do not re-extract. They read primitive outputs and reinterpret through their specific vocabulary. Some lenses may have small supplemental extraction needs (e.g. logo isolation for brand lens).

### Schema Files

The nine primitive JSON schemas are located at:
```
primitives/
├── 01_color_system.json
├── 02_spatial_structure.json
├── 03_typography_behavior.json
├── 04_surface_material.json
├── 05_shape_language.json
├── 06_rhythm_pattern.json
├── 07_hierarchy_flow.json
├── 08_imagery_mode.json
└── 09_stylistic_lineage.json
```

Each schema contains:
- `gemini_instructions` — role, task, and rules to send to Gemini Vision
- `output_schema` — the exact JSON structure Gemini should return
- `failure_conditions` — when the block cannot produce reliable output
- `confidence` — every block returns a confidence score with notes

---

## Step 1: Identify and Remove Old Pipeline

Find and audit all code related to the current vibe/analysis pipeline. This includes:

- [ ] Fixed vibe category definitions and enums
- [ ] Any hardcoded analysis schemas tied to specific design domains
- [ ] Gemini Vision call wrappers that use the old schema format
- [ ] Analysis result storage and caching tied to old output shapes
- [ ] Any UI or API surfaces that consume old vibe category outputs
- [ ] Queue/job logic specific to the old analysis flow

**Do not delete yet.** First map all touchpoints and confirm the full dependency graph. Flag anything downstream that consumes old outputs so we know what needs adapter work.

### Removal Rules

- Remove old schema definitions entirely — they are not being refactored, they are being replaced.
- Preserve any generic infrastructure that is reusable: queue mechanics, Gemini API client wrappers, image hash utilities, caching infrastructure (the cache strategy changes but the cache layer itself may be reusable).
- Keep the existing cost control slider and workspace-level settings — these will wire into the new pipeline's cost tier system.

---

## Step 2: Implement Stage A — Primitive Extraction

### Per-image analysis flow

When an image is added to a workspace:

1. Compute image hash (for cache key).
2. Check cache: key = `{image_hash}:{schema_version}` — if all nine primitives are cached and schema version matches, skip.
3. If not cached, queue a Stage A analysis job.
4. The job sends the image to Gemini Vision **once** with a combined prompt that requests all nine primitive outputs in a single call.
5. Parse the response, validate against each primitive's `output_schema`.
6. Store each primitive's output separately, keyed by `{image_hash}:{primitive_name}:{schema_version}`.
7. Flag any primitives that returned below-threshold confidence for potential re-analysis.

### Important implementation details

- **Single Gemini call per image for all nine primitives.** Do not make nine separate API calls. Combine the instructions and request a single JSON response with nine top-level keys matching the schema block names.
- **Background processing.** Stage A runs asynchronously as images are added. The UI should not block on analysis completion.
- **Cost tier: LOW.** Stage A should stay within the low-cost budget. If the combined prompt is too large for a single call, split into two batches maximum (e.g. primitives 1-5 and 6-9), not nine individual calls.
- **Retry policy:** On failure, retry once with backoff. On second failure, store partial results and flag for manual re-run.
- **Schema version:** Embed the schema version in cache keys. When we update a primitive schema, only that primitive's cache invalidates — not all nine.

### Combined prompt structure

```
You are analyzing a visual image for a design intelligence platform.
Extract the following nine analysis blocks and return them as a single JSON object.

{gemini_instructions from each primitive schema, concatenated}

Return format:
{
  "color_system": { ... },
  "spatial_structure": { ... },
  "typography_behavior": { ... },
  "surface_material": { ... },
  "shape_language": { ... },
  "rhythm_pattern": { ... },
  "hierarchy_flow": { ... },
  "imagery_mode": { ... },
  "stylistic_lineage": { ... }
}
```

---

## Step 3: Implement Stage B — Lens System (Scaffold Only)

Stage B lens schemas are not yet defined. For now, implement only the scaffold:

- [ ] A lens registry that can load lens definitions from JSON files (same pattern as primitives).
- [ ] A routing function stub: `resolveIntentToLenses(focusStatement: string) → LensConfig[]` — this will eventually use NLP or a simple keyword matcher to map user focus statements to lens activations.
- [ ] A lens execution function stub: `applyLens(lens: LensConfig, primitiveData: PrimitiveOutput[], imageSubset: Image[]) → LensOutput` — this will send primitive data + lens instructions to Gemini for reinterpretation.
- [ ] Selection logic stub for choosing which images get deep analysis: based on relevance scoring from primitive data + diversity criteria to avoid redundant analysis.

**Do not implement actual lenses yet.** Just wire up the infrastructure so adding a lens later is: drop a JSON schema file → register it → it's available.

---

## Step 4: Wire Up Storage and Caching

### Cache strategy

| Data | Cache Key | Invalidation |
|------|-----------|--------------|
| Primitive output | `{image_hash}:{primitive_name}:{schema_version}` | Schema version change OR image re-upload |
| Lens output | `{image_hash}:{lens_name}:{lens_version}:{project_context_hash}` | Lens version change OR project context change OR primitive data change |
| Project synthesis | `{workspace_id}:{synthesis_version}:{content_hash}` | Any input change |

### Storage shape

Each image should have a document/record structured as:

```json
{
  "image_id": "string",
  "image_hash": "string",
  "primitives": {
    "color_system": { "version": "1.0.0", "data": { ... }, "confidence": 0.85, "analyzed_at": "ISO timestamp" },
    "spatial_structure": { "version": "1.0.0", "data": { ... }, "confidence": 0.90, "analyzed_at": "ISO timestamp" }
  },
  "lenses": {
  }
}
```

---

## Step 5: Connect to Cost Control

The existing workspace cost control slider (7 levels) should map to the new pipeline:

- **Levels 1-3:** Stage A only. No deep analysis. Primitives extracted on all images.
- **Levels 4-5:** Stage A + Stage B on a subset of images (top N by relevance, capped by budget).
- **Levels 6-7:** Stage A + Stage B with broader image selection and more lens activations allowed.

The exact thresholds (how many images, how many lenses) are configurable per level. Implement as a config object, not hardcoded.

---

## Step 6: Validation

Before marking migration complete:

- [ ] Upload 5 diverse test images (photo, illustration, UI screenshot, packaging, abstract art).
- [ ] Confirm all nine primitives return valid JSON matching their schemas.
- [ ] Confirm confidence scores are present and reasonable.
- [ ] Confirm caching works — re-analyzing the same image returns cached results.
- [ ] Confirm schema version invalidation works — bumping one primitive's version triggers re-analysis for only that primitive.
- [ ] Confirm the lens scaffold is in place and a dummy lens can be registered without code changes.
- [ ] Confirm the old pipeline code is fully removed and no dead references remain.
- [ ] Confirm cost control slider still functions and maps to new tier logic.

---

## What NOT To Do

- Do not implement actual lens schemas — only the scaffold/registry.
- Do not build the intent routing NLP — just the stub function.
- Do not change the image upload flow or UI — only the analysis backend.
- Do not optimize for batch processing yet — get single-image flow correct first.
- Do not remove the cost control slider or workspace settings — rewire them.

---

## Questions for Jonny Before Starting

1. Where does the current analysis pipeline code live? (Confirm file paths / modules.)
2. What database/storage is used for analysis results currently?
3. Are there any downstream consumers of the old vibe outputs that need adapter layers during migration?
4. Should we keep the old pipeline behind a feature flag during transition, or hard-cut?
5. What's the Gemini model version we're targeting? (Gemini 1.5 Pro / Flash / etc.)

---

## Priority Order

1. Audit and map old pipeline → document all touchpoints
2. Implement Stage A primitive extraction (single-image flow)
3. Wire up caching with schema-versioned keys
4. Connect cost control slider to new tier logic
5. Scaffold Stage B lens system
6. Remove old pipeline code
7. Validation pass

---

*This document was produced alongside the nine primitive schema files. Both are required for implementation.*
