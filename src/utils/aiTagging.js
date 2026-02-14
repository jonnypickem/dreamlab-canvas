/**
 * AI Tagging Utilities
 * Batch processing, sampling, and tag management
 */

import { analyzeImageObjective, analyzeImageWithContext, estimateCost } from '../services/geminiVision';
import { extractAllMetadataTags } from './metadataExtractor';
import { updateItem, getItems } from '../lib/storage';
import { imageToBase64 } from './imageProxy';

// Enhancement queue for background processing
const enhancementQueue = [];
let isProcessing = false;
let onToast = null; // Toast callback (set by app)

/**
 * Set toast notification callback
 * @param {Function} callback - Toast function (message, type)
 */
export function setToastCallback(callback) {
    onToast = callback;
}

function showToast(message, type = 'info') {
    if (onToast) {
        onToast({ message, type });
    }
}

/**
 * Get auto-tagging settings from localStorage
 * @returns {Object} Settings object
 */
export function getTaggingSettings() {
    const defaults = {
        extractFromUrl: true,
        extractColors: true,
        aiMode: 'all', // 'all' | 'batch' | 'manual'
        contextRegenerationMode: 'ask',
        moveRegenerationMode: 'ask',
        batchSamplePercentage: 20,
        batchMaxSamples: 20,
        commonTagThreshold: 0.5,
        metadataOverlapMin: 2,
        showCostEstimates: true,
        geminiApiKey: ''
    };

    try {
        const stored = JSON.parse(localStorage.getItem('autoTaggingSettings') || '{}');
        return { ...defaults, ...stored };
    } catch (e) {
        return defaults;
    }
}

/**
 * Save auto-tagging settings
 * @param {Object} settings - Settings to save
 */
export function saveTaggingSettings(settings) {
    localStorage.setItem('autoTaggingSettings', JSON.stringify(settings));
}

/**
 * Select samples for batch analysis
 * Picks highest-resolution images (20% or max 20)
 * @param {Array} items - Array of items
 * @param {number} percentage - Percentage to sample (0-1)
 * @param {number} maxSamples - Maximum samples
 * @returns {Array} Selected sample items
 */
export function selectSamplesForBatch(items, percentage = 0.2, maxSamples = 20) {
    // Filter to images only
    const imageItems = items.filter(item => item.type === 'image');

    if (imageItems.length === 0) return [];

    // Calculate sample size
    const sampleSize = Math.min(
        Math.ceil(imageItems.length * percentage),
        maxSamples
    );

    // Sort by resolution if metadata available, otherwise random
    const sorted = [...imageItems].sort((a, b) => {
        const resA = (a.metadata?.width || 0) * (a.metadata?.height || 0);
        const resB = (b.metadata?.width || 0) * (b.metadata?.height || 0);
        return resB - resA; // Highest resolution first
    });

    return sorted.slice(0, sampleSize);
}

/**
 * Find common tags that appear in threshold% of results
 * @param {Array<string[]>} resultsArray - Array of tag arrays
 * @param {number} threshold - Minimum occurrence percentage (0-1)
 * @returns {string[]} Common tags
 */
export function findCommonTags(resultsArray, threshold = 0.5) {
    if (resultsArray.length === 0) return [];

    const tagCounts = {};

    // Count occurrences
    resultsArray.forEach(tags => {
        tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });

    // Filter by threshold
    const minCount = Math.ceil(resultsArray.length * threshold);

    return Object.entries(tagCounts)
        .filter(([, count]) => count >= minCount)
        .map(([tag]) => tag);
}

/**
 * Check if item has enough metadata overlap to apply common tags
 * @param {string[]} itemTags - Item's existing objective tags
 * @param {string[]} commonTags - Common tags from batch
 * @param {number} minOverlap - Minimum matching tags
 * @returns {boolean}
 */
export function hasMetadataOverlap(itemTags, commonTags, minOverlap = 2) {
    if (!itemTags || !commonTags) return false;

    let matches = 0;

    for (const tag of itemTags) {
        for (const common of commonTags) {
            // Exact match or partial match
            if (tag === common || tag.includes(common) || common.includes(tag)) {
                matches++;
                if (matches >= minOverlap) return true;
            }
        }
    }

    return matches >= minOverlap;
}

/**
 * Enhance single image with AI tags
 * @param {Object} item - Item to enhance
 * @param {Object} project - Project context (optional)
 * @returns {Promise<Object>} Updated item
 */
export async function enhanceSingleImage(item, project = null) {
    showToast('Analyzing with AI...', 'info');

    try {
        // Initialize tag arrays if needed
        item.objectiveTags = item.objectiveTags || [];
        item.contextTags = item.contextTags || [];

        // Get metadata tags first (instant)
        const metadataTags = await extractAllMetadataTags(item);
        item.objectiveTags = [...new Set([...item.objectiveTags, ...metadataTags])];

        // Get objective AI tags
        const imageBase64 = await imageToBase64(item.content);
        const objectiveAITags = await analyzeImageObjective(imageBase64);
        item.objectiveTags = [...new Set([...item.objectiveTags, ...objectiveAITags])];

        // Get context AI tags if project has description
        let contextCount = 0;
        if (project?.description) {
            const contextTags = await analyzeImageWithContext(imageBase64, project);

            item.contextTags = contextTags.map(tag => ({
                tag,
                projectId: project.id,
                confidence: 0.9,
                generatedAt: Date.now()
            }));

            contextCount = contextTags.length;
        }

        // Update combined tags for search
        item.tags = [
            ...item.objectiveTags,
            ...item.contextTags.map(ct => ct.tag)
        ];

        // Save updated item
        updateItem(item);

        showToast(
            `✓ Added ${objectiveAITags.length} objective + ${contextCount} context tags`,
            'success'
        );

        return item;

    } catch (error) {
        console.error('Enhancement failed:', error);
        showToast('AI enhancement failed', 'error');
        return item;
    }
}

/**
 * Batch enhance images with smart sampling
 * @param {Array} items - Items to enhance
 * @param {Object} project - Project context
 * @returns {Promise<void>}
 */
export async function enhanceBatchImages(items, project = null) {
    const imageItems = items.filter(i => i.type === 'image');

    if (imageItems.length === 0) return;

    showToast(`Analyzing ${imageItems.length} images...`, 'info');

    try {
        // Select samples
        const samples = selectSamplesForBatch(imageItems);

        // Analyze samples for objective tags in parallel
        const objectiveResults = await Promise.all(
            samples.map(async (sample) => {
                const imageBase64 = await imageToBase64(sample.content);
                return analyzeImageObjective(imageBase64);
            })
        );

        // Find common objective tags
        const commonObjectiveTags = findCommonTags(objectiveResults, 0.5);

        // Apply common tags to all items with overlap
        let enhancedCount = 0;
        for (const item of imageItems) {
            // Get metadata for this item
            const metadataTags = await extractAllMetadataTags(item);
            item.objectiveTags = [...new Set([...metadataTags])];

            // Check if this item is similar enough to apply common tags
            if (hasMetadataOverlap(metadataTags, commonObjectiveTags)) {
                item.objectiveTags = [...new Set([
                    ...item.objectiveTags,
                    ...commonObjectiveTags
                ])];
                enhancedCount++;
            }

            // Update combined tags
            item.tags = [
                ...item.objectiveTags,
                ...(item.contextTags || []).map(ct => ct.tag)
            ];

            updateItem(item);
        }

        // Context tags if project has description
        if (project?.description) {
            const contextResults = await Promise.all(
                samples.map(async (sample) => {
                    const imageBase64 = await imageToBase64(sample.content);
                    return analyzeImageWithContext(imageBase64, project);
                })
            );

            const commonContextTags = findCommonTags(contextResults, 0.5);

            for (const item of imageItems) {
                if (hasMetadataOverlap(item.objectiveTags, commonContextTags)) {
                    item.contextTags = (item.contextTags || []).filter(
                        ct => ct.projectId !== project.id
                    );

                    item.contextTags.push(
                        ...commonContextTags.map(tag => ({
                            tag,
                            projectId: project.id,
                            confidence: 0.85,
                            generatedAt: Date.now()
                        }))
                    );

                    item.tags = [
                        ...item.objectiveTags,
                        ...item.contextTags.map(ct => ct.tag)
                    ];

                    updateItem(item);
                }
            }
        }

        showToast(
            `✓ Enhanced ${enhancedCount} images (analyzed ${samples.length})`,
            'success'
        );

    } catch (error) {
        console.error('Batch enhancement failed:', error);
        showToast('Batch enhancement failed', 'error');
    }
}

/**
 * Queue item for background enhancement
 * @param {Object} item - Item to enhance
 * @param {Object} project - Project context
 */
export function queueForEnhancement(item, project = null) {
    enhancementQueue.push({ item, project });

    if (!isProcessing) {
        processEnhancementQueue();
    }
}

/**
 * Process enhancement queue in background
 */
async function processEnhancementQueue() {
    if (enhancementQueue.length === 0) {
        isProcessing = false;
        return;
    }

    isProcessing = true;
    const { item, project } = enhancementQueue.shift();

    try {
        await enhanceSingleImage(item, project);
    } catch (error) {
        console.error('Queue processing failed:', error);
    }

    // Process next item
    setTimeout(processEnhancementQueue, 100);
}

/**
 * Get queue status
 * @returns {{pending: number, isProcessing: boolean}}
 */
export function getQueueStatus() {
    return {
        pending: enhancementQueue.length,
        isProcessing
    };
}
