# Schema Pipeline

## Handoff Brief

This document is a handoff for the next research phase of Dreamlab's analysis architecture.

Primary objective:
Define a scalable, cost-aware schema block system for phased image analysis that can support many user intents, not just a fixed set of vibe categories.

---

## Why This Exists

Current direction is strong, but likely under-scoped. We need to validate and expand the schema system before implementation hardens.

Known constraints:
- Gemini cannot process large image sets in one call.
- Analysis must run in the background as images are added.
- Cost and latency must stay controlled.
- Vibe quality improves when deep analysis is applied selectively.

---

## Research Goals

1. Map all schema blocks needed across real creative scenarios.
2. Separate "always-run core analysis" from "intent-driven deep analysis."
3. Define block composition rules (how multiple blocks combine safely).
4. Define routing logic from user focus statements to schema blocks.
5. Define cost tiers and execution gates per block.

---

## Working Hypothesis

Use a two-stage pipeline:

1. Stage A: Core pass (cheap, mandatory, one-time per image)
- Extract foundational facts for triage and indexing.
- Output should support scoring, filtering, and candidate selection for deeper passes.

2. Stage B: Focused deep pass (modular, selective, intent-based)
- Run only on selected images (relevance + diversity criteria).
- Activate only the schema blocks tied to user goals.

---

## What To Research

Research and propose schema blocks in at least these domains:
- Illustration language
- Packaging systems
- Photography direction
- Composition grammar
- UI layout systems
- Color systems
- Ad structure and conversion hierarchy
- Structure-vs-style transfer
- Brand identity cues
- Typography behavior
- Material/texture semantics
- Motion/sequence cues (if frame sets or ad variants are present)

For each proposed block, capture:
- Block name
- Purpose
- Input requirements
- Output fields
- Typical confidence signals
- Failure/uncertainty conditions
- Relative cost tier (`low`, `medium`, `high`)
- Dependencies on other blocks

---

## Required Deliverables

1. Block Catalog
- Exhaustive list of candidate schema blocks with definitions.

2. Routing Matrix
- Map from user intent statements to required/optional blocks.
- Example: "Focus on illustration style and packaging design" -> `illustration_style` + `packaging_design`.

3. Pipeline Spec v1
- Queue behavior and pacing rules.
- Retry/backoff policy.
- Selection policy for deep analysis candidates.
- Caching and invalidation strategy (by image hash + schema version + context version).

4. Cost Model
- Estimated token/runtime profile per block.
- Suggested guardrails (max images per deep run, max block count per run, cooldown windows).

5. JSON Contract Draft
- Canonical format for:
  - core outputs
  - per-block outputs
  - merged project-level vibe synthesis input

---

## Suggested Acceptance Criteria

- A user can describe a focus in natural language, and the system deterministically resolves the right block set.
- Core pass remains cheap enough to run on every newly added image.
- Deep pass only runs where expected and improves signal quality.
- Adding a new schema block requires no pipeline redesign.
- The merged outputs remain stable enough for downstream prompt generation.

---

## Open Questions To Resolve

1. Should some blocks be mutually exclusive in a single deep run?
2. Which blocks should share intermediate fields to reduce repeated analysis?
3. How should we score "structural similarity" versus "stylistic similarity"?
4. When user intent is broad, should we auto-prioritize blocks or ask for narrowing?
5. What minimum dataset size is required before each deep block becomes reliable?

---

## Next Step

Produce `Schema Blocks Inventory v1` as a follow-up document with:
- full block list
- field-level definitions
- routing rules
- execution/cost tiers
- first implementation priority order
