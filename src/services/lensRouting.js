import { getLensRegistry, resolveLensSchemaFromRegistryEntry } from './analysisSchemaRegistry';

function getRegistryLensGroups(registry) {
    if (!registry) return [];
    return [
        { type: 'domain', bucket: registry.domain_lenses },
        { type: 'style', bucket: registry.style_lenses },
        { type: 'structural', bucket: registry.structural_lenses },
    ];
}

function flattenRegistryEntries(registry) {
    return getRegistryLensGroups(registry)
        .flatMap(({ type, bucket }) => (
            (bucket?.lenses || []).map((entry) => ({ ...entry, lensType: type }))
        ));
}

/**
 * Stage B scaffold: resolve a focus statement into registered lens configs.
 * Keyword matching only for now.
 */
export function resolveIntentToLenses(focusStatement = '') {
    const text = String(focusStatement || '').toLowerCase();
    const registryWrapper = getLensRegistry();
    const registry = registryWrapper || {};
    const entries = flattenRegistryEntries(registry);

    const matched = entries.filter((entry) => {
        const keywords = Array.isArray(entry.trigger_keywords) ? entry.trigger_keywords : [];
        return keywords.some((keyword) => text.includes(String(keyword).toLowerCase()));
    });

    const fallback = entries.find((entry) => entry.id === 'aesthetic_fingerprint');
    const finalEntries = matched.length > 0 ? matched : (fallback ? [fallback] : []);

    return finalEntries.map((entry) => ({
        id: entry.id,
        lensType: entry.lensType,
        costTier: entry.cost_tier || 'medium',
        summary: entry.summary || '',
        file: entry.file,
        schema: resolveLensSchemaFromRegistryEntry(entry.file),
        requiresTargetContext: Boolean(entry.requires_target_context),
        minimumImages: entry.minimum_images || 1,
        operatesOn: entry.operates_on || 'single_image',
        dependencies: Array.isArray(entry.depends_on) ? entry.depends_on : [],
    }));
}

/**
 * Stage B scaffold: placeholder lens execution function.
 * Actual lens runs will be added in the next migration step.
 */
export async function applyLens(lensConfig, primitiveData = [], imageSubset = [], options = {}) {
    return {
        ok: false,
        status: 'stub_not_implemented',
        lens: lensConfig?.id || null,
        reason: 'Lens execution is scaffolded but not implemented yet.',
        input: {
            primitiveCount: Array.isArray(primitiveData) ? primitiveData.length : 0,
            imageCount: Array.isArray(imageSubset) ? imageSubset.length : 0,
            hasTargetContext: Boolean(options?.targetContext),
        },
    };
}

/**
 * Stage B scaffold: simplistic image subset selector.
 * Placeholder for relevance + diversity selection logic.
 */
export function selectImagesForLensAnalysis(images = [], maxImages = 5) {
    if (!Array.isArray(images) || images.length === 0) return [];
    const limit = Math.max(1, Number(maxImages) || 5);
    return images.slice(0, limit);
}
