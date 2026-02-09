// =============================================================================
// DreamLab — Gemini Extraction Prompt Builder
// =============================================================================
//
// Generates the prompt sent to Gemini for each image.
// The prompt is NOT static — it's shaped by the Project Context.
//
// Same image + different project = different extraction emphasis.
//
// Usage:
//   const prompt = buildExtractionPrompt(projectContext);
//   // Send to Gemini along with the image
//
// =============================================================================

// -----------------------------------------------------------------------------
// Prompt Builder
// -----------------------------------------------------------------------------

export function buildExtractionPrompt(context) {
    const parts = [];

    // --- System framing ---
    parts.push(SYSTEM_FRAME);

    // --- Project context injection ---
    parts.push(buildContextBlock(context));

    // --- Extraction instructions ---
    parts.push(EXTRACTION_INSTRUCTIONS);

    // --- Output format ---
    parts.push(OUTPUT_FORMAT);

    return parts.join("\n\n");
}


// -----------------------------------------------------------------------------
// System Frame
// -----------------------------------------------------------------------------

const SYSTEM_FRAME = `You are a visual analysis system for a design tool called DreamLab. 
Your job is to analyze a single image and extract structured visual attributes.

You are helping a designer build a collection of visual inspiration. From many images, 
the system will derive an overall "vibe" — the shared aesthetic patterns across the collection.

Your extraction for THIS image is one data point. Be accurate. Be specific. 
If something isn't clearly detectable, omit it rather than guess.`;


// -----------------------------------------------------------------------------
// Context Block (dynamic, from Project Settings)
// -----------------------------------------------------------------------------

function buildContextBlock(context) {
    const lines = [];

    lines.push("--- PROJECT CONTEXT ---");
    lines.push(`Project: "${context.name}"`);

    if (context.category && context.category !== "general") {
        lines.push(`Category: ${context.category.replace(/_/g, " ")}`);
    }

    if (context.description) {
        lines.push(`Brief: ${context.description}`);
    }

    if (context.styleKeywords && context.styleKeywords.length > 0) {
        lines.push(
            `Style direction: The designer is looking for images that feel ${context.styleKeywords.join(", ")}. ` +
            `Pay extra attention to visual elements that relate to these keywords.`
        );
    }

    if (context.defaultTags && context.defaultTags.length > 0) {
        lines.push(`Domain tags: ${context.defaultTags.join(", ")}`);
    }

    if (context.customInstructions) {
        lines.push(`Custom instructions from designer: ${context.customInstructions}`);
    }

    lines.push("--- END PROJECT CONTEXT ---");

    return lines.join("\n");
}


// -----------------------------------------------------------------------------
// Extraction Instructions
// -----------------------------------------------------------------------------

const EXTRACTION_INSTRUCTIONS = `Analyze the image and extract the following attributes.

RULES:
- Only include fields you can clearly identify. Omit uncertain fields entirely.
- For "medium": determine if this is a photograph, illustration, 3D render, etc.
- For "mood": describe the emotional tone a viewer would feel.
- For colors: use descriptive names ("burnt orange", "deep teal") not hex codes.
- For "relevance": score 0.0-1.0 how relevant this image is to the PROJECT CONTEXT above.
  A random screenshot in a product design project = low relevance (0.1-0.3).
  An image that directly relates to the project brief = high relevance (0.7-1.0).
- For "matchedStyleKeywords": list which of the project's style keywords (if any) 
  are reflected in this image. Only include keywords that genuinely apply.

IMPORTANT: Do NOT hallucinate. If the lighting direction isn't clear, don't include it. 
If you can't identify an art movement, skip that field. Accuracy over completeness.`;


// -----------------------------------------------------------------------------
// Output Format (JSON schema for Gemini to follow)
// -----------------------------------------------------------------------------

const OUTPUT_FORMAT = `Respond with ONLY valid JSON matching this structure. No markdown, no explanation, just JSON.

{
  "relevance": <number 0.0-1.0>,
  "matchedStyleKeywords": [<strings from project style keywords that match>],
  
  "subject": {
    "primary": "<main subject in 2-5 words>",
    "secondary": ["<other notable elements>"],
    "hasPeople": <boolean>,
    "hasText": <boolean>
  },
  
  "style": {
    "medium": "<photography | digital_art | illustration | 3d_render | oil_painting | watercolor | concept_art | sketch | vector_art | collage | film_still | product_shot | graphic_design | mixed_media | other>",
    "rendering": "<photorealistic | hyperrealistic | stylized | painterly | flat | cel_shaded | textured | minimal | abstract | other>",
    "artMovement": "<only if clearly identifiable, otherwise omit>"
  },
  
  "mood": {
    "primary": "<dominant emotional tone in 1-2 words>",
    "energy": "<low | medium | high>",
    "atmosphere": "<1-2 words describing the feel>",
    "aesthetic": "<named aesthetic if obvious, e.g. 'dark academia', 'cottagecore', otherwise omit>",
    "keywords": ["<2-4 additional mood descriptors>"]
  },
  
  "composition": {
    "shotType": "<extreme_close_up | close_up | medium_close_up | medium_shot | medium_wide | wide_shot | extreme_wide | full_body | establishing | other>",
    "cameraAngle": "<eye_level | low_angle | high_angle | birds_eye | worms_eye | dutch_angle | overhead | frontal | profile | three_quarter | other>",
    "framing": ["<rule of thirds | symmetrical | leading lines | negative space | frame within frame | diagonal | centered>"],
    "aspectRatioGuess": "<portrait | landscape | square>"
  },
  
  "lighting": {
    "type": "<natural | studio | dramatic | ambient | rim | backlit | side | mixed>",
    "quality": "<soft | hard | mixed>",
    "direction": "<front | side | back | top | bottom | 45_degree | ambient>",
    "colorTemperature": "<warm | cool | neutral | mixed>",
    "moodLighting": "<chiaroscuro | high_key | low_key | volumetric | neon_glow | candlelit | golden_hour | blue_hour | omit if not distinctive>"
  },
  
  "color": {
    "dominantColors": ["<2-4 descriptive color names>"],
    "palette": "<vibrant | muted | pastel | saturated | desaturated | monochromatic | complementary | analogous | triadic | neutral | other>",
    "accentColors": ["<pop/highlight colors if present>"],
    "colorGrade": "<describe the color grading if notable, otherwise omit>"
  },
  
  "texture": {
    "detailLevel": "<minimal | moderate | high | ultra>",
    "surfaceQuality": "<glossy | matte | organic | weathered | pristine | metallic | textured | omit if not notable>",
    "textureEffects": ["<film grain | noise | bokeh | halftone | canvas texture | omit if none>"]
  },
  
  "technical": {
    "estimatedLens": "<wide_angle | normal | telephoto | macro | omit if not photography>",
    "depthOfField": "<shallow | medium | deep>",
    "isPhotography": <boolean>
  }
}`;


// -----------------------------------------------------------------------------
// Quick extraction prompt (fewer fields, faster, cheaper)
// Used for initial processing, upgraded to full later if needed
// -----------------------------------------------------------------------------

export function buildQuickExtractionPrompt(context) {
    const contextBlock = buildContextBlock(context);

    return `You are a visual analysis system. Quickly analyze this image for a design project.

${contextBlock}

Extract ONLY these core fields. Respond with valid JSON only, no markdown.

{
  "relevance": <number 0.0-1.0 — how relevant to the project context>,
  "matchedStyleKeywords": [<strings>],
  "subject": {
    "primary": "<main subject in 2-5 words>",
    "hasPeople": <boolean>,
    "hasText": <boolean>
  },
  "style": {
    "medium": "<photography | illustration | 3d_render | graphic_design | other>",
    "rendering": "<photorealistic | stylized | flat | abstract | other>"
  },
  "mood": {
    "primary": "<dominant emotional tone>",
    "energy": "<low | medium | high>"
  },
  "composition": {
    "shotType": "<close_up | medium_shot | wide_shot | other>",
    "cameraAngle": "<eye_level | low_angle | high_angle | overhead | other>"
  },
  "color": {
    "dominantColors": ["<2-3 descriptive color names>"],
    "palette": "<vibrant | muted | pastel | monochromatic | neutral | other>"
  }
}`;
}


// -----------------------------------------------------------------------------
// Gemini API Call Helper
// -----------------------------------------------------------------------------
// Wraps the prompt + image into a Gemini API request body.

export function buildGeminiRequestBody(
    imageBase64,
    mimeType,
    prompt
) {
    return {
        contents: [
            {
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: imageBase64,
                        },
                    },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.1,       // Low temp = more consistent, less creative
            maxOutputTokens: 2048,
        },
    };
}


// -----------------------------------------------------------------------------
// Response Parser
// -----------------------------------------------------------------------------
// Parses Gemini's response and merges with item metadata to create
// a full ImageExtraction object.

export function parseExtractionResponse(
    responseText,
    itemId,
    model,
    level
) {
    try {
        // Strip markdown code fences if present
        let clean = responseText.trim();
        if (clean.startsWith("```")) {
            clean = clean.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
        }

        const parsed = JSON.parse(clean);

        return {
            itemId,
            extractedAt: Date.now(),
            model,
            level,
            relevance: parsed.relevance ?? 0.5,
            matchedStyleKeywords: parsed.matchedStyleKeywords ?? [],
            subject: {
                primary: parsed.subject?.primary ?? "unknown",
                secondary: parsed.subject?.secondary,
                hasPeople: parsed.subject?.hasPeople ?? false,
                hasText: parsed.subject?.hasText ?? false,
            },
            style: {
                medium: parsed.style?.medium ?? "other",
                rendering: parsed.style?.rendering ?? "other",
                artMovement: parsed.style?.artMovement,
            },
            mood: {
                primary: parsed.mood?.primary ?? "neutral",
                energy: parsed.mood?.energy ?? "medium",
                atmosphere: parsed.mood?.atmosphere,
                aesthetic: parsed.mood?.aesthetic,
                keywords: parsed.mood?.keywords,
            },
            composition: {
                shotType: parsed.composition?.shotType ?? "other",
                cameraAngle: parsed.composition?.cameraAngle ?? "other",
                framing: parsed.composition?.framing,
                aspectRatioGuess: parsed.composition?.aspectRatioGuess,
            },
            lighting: {
                type: parsed.lighting?.type ?? "ambient",
                quality: parsed.lighting?.quality ?? "mixed",
                direction: parsed.lighting?.direction,
                colorTemperature: parsed.lighting?.colorTemperature ?? "neutral",
                moodLighting: parsed.lighting?.moodLighting,
            },
            color: {
                dominantColors: parsed.color?.dominantColors ?? [],
                palette: parsed.color?.palette ?? "other",
                accentColors: parsed.color?.accentColors,
                colorGrade: parsed.color?.colorGrade,
            },
            texture: {
                detailLevel: parsed.texture?.detailLevel ?? "moderate",
                surfaceQuality: parsed.texture?.surfaceQuality,
                textureEffects: parsed.texture?.textureEffects,
            },
            technical: parsed.technical
                ? {
                    estimatedLens: parsed.technical.estimatedLens,
                    depthOfField: parsed.technical.depthOfField,
                    isPhotography: parsed.technical.isPhotography ?? false,
                }
                : undefined,
        };
    } catch (e) {
        console.error("Failed to parse Gemini extraction response:", e);
        return null;
    }
}
