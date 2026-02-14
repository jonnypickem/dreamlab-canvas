/**
 * Enhanced Save with Canvas Intelligence
 * Routes tagging based on workspace intelligence tier setting
 */

import { saveItem, getWorkspaces, updateItem } from '../lib/storage';
import { uploadMedia } from '../lib/supabaseStorage';
import { extractAllMetadataTags } from './metadataExtractor';
import { interpretMetadata } from '../services/geminiText';
import { analyzeImageObjective, analyzeImageWithContext } from '../services/geminiVision';
import { queueStageAPrimitiveAnalysis } from '../services/primitiveAnalysis';
import { imageToBase64 } from './imageProxy';

const TEMP_DISABLE_LEGACY_VISION_ANALYSIS = true;
const USE_PRIMITIVE_PIPELINE_ONLY = true;

// Toast callback for notifications
let toastCallback = null;

export function setToastCallback(callback) {
    toastCallback = callback;
}

function showToast(message, type = 'info') {
    if (toastCallback) {
        toastCallback({ message, type });
    }
}

/**
 * Get workspace by ID
 */
async function getWorkspace(workspaceId) {
    const workspaces = await getWorkspaces();
    return workspaces.find(w => w.id === workspaceId);
}

/**
 * Get intelligence level for workspace
 */
async function getIntelligenceLevel(workspaceId) {
    const workspace = await getWorkspace(workspaceId);
    return workspace?.intelligenceLevel || 'quick';
}

/**
 * Convert a data URL or blob URL to a Blob for Supabase upload.
 */
function dataUrlToBlob(dataUrl) {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
}

/**
 * Upload item media (content and/or thumbnail) to Supabase Storage.
 * Replaces the data URL in item.content / item.thumbnail with the storage path.
 */
async function offloadItemMediaToSupabase(item) {
    let current = { ...item };
    if (!current.id) current.id = crypto.randomUUID();

    // Upload image content
    if (current.type === 'image' && typeof current.content === 'string' && current.content.startsWith('data:')) {
        const blob = dataUrlToBlob(current.content);
        const path = await uploadMedia(blob, current.id, 'image');
        current.content = path;
        current.contentStorage = 'supabase';
    }

    // Upload link thumbnail (data URL or HTTP URL)
    if (current.type === 'link' && typeof current.thumbnail === 'string') {
        if (current.thumbnail.startsWith('data:')) {
            const blob = dataUrlToBlob(current.thumbnail);
            const path = await uploadMedia(blob, current.id, 'thumbnail');
            current.thumbnail = path;
            current.thumbnailStorage = 'supabase';
        } else if (current.thumbnail.startsWith('http')) {
            try {
                const response = await fetch(current.thumbnail);
                if (response.ok) {
                    const blob = await response.blob();
                    if (blob.type?.startsWith('image/')) {
                        const path = await uploadMedia(blob, current.id, 'thumbnail');
                        current.thumbnail = path;
                        current.thumbnailStorage = 'supabase';
                    }
                }
            } catch {
                // Keep original URL if download fails
            }
        }
    }

    return current;
}

/**
 * Save item with Canvas Intelligence tagging
 * Routes to appropriate tier based on workspace setting
 *
 * @param {Object} item - Item to save
 * @param {string|Object|null} projectOrId - Project or project ID (legacy, unused)
 * @returns {Object} Saved item with tags
 */
export async function saveItemWithTags(item, projectOrId = null) {
    let preparedItem = { ...item };

    // FIX: Auto-detect image URLs that came in as 'link' type
    if (preparedItem.type === 'link' && preparedItem.content && preparedItem.content.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i)) {
        console.log('🖼️ Auto-detected image URL, converting type to image');
        preparedItem.type = 'image';
    }

    if (
        preparedItem.type === 'image'
        && typeof preparedItem.content === 'string'
        && !preparedItem.content.startsWith('data:')
    ) {
        try {
            preparedItem.content = await imageToBase64(preparedItem.content);
        } catch (error) {
            throw new Error(error?.message || 'Could not fetch image.');
        }
    }

    // Upload media to Supabase Storage
    if (preparedItem.type === 'image' || preparedItem.type === 'link') {
        try {
            preparedItem = await offloadItemMediaToSupabase(preparedItem);
        } catch (error) {
            throw new Error(error?.message || 'Could not upload media to storage.');
        }
    }

    // Get intelligence tier from workspace
    const intelligenceLevel = await getIntelligenceLevel(preparedItem.workspaceId);

    // Step 1: Always extract basic metadata (Quick tier - free)
    let tags = [];
    console.log(`🏷️ extracting tags for ${preparedItem.type} (tier: ${intelligenceLevel})...`);
    try {
        tags = await extractAllMetadataTags(preparedItem);
        console.log(`🏷️ extracted ${tags.length} basic tags:`, tags);
    } catch (e) {
        console.warn('Metadata extraction failed:', e);
    }

    // Step 2: Smart tier - LLM interprets metadata
    if (!USE_PRIMITIVE_PIPELINE_ONLY && ['smart', 'ultra'].includes(intelligenceLevel) && preparedItem.sourceUrl) {
        try {
            const filename = preparedItem.sourceUrl.split('/').pop() || '';
            const smartTags = await interpretMetadata(preparedItem.sourceUrl, filename);
            tags = [...new Set([...tags, ...smartTags])];
        } catch (e) {
            console.warn('Smart interpretation failed:', e);
        }
    }

    // Step 3: Create item with tags
    const itemWithTags = {
        ...preparedItem,
        objectiveTags: tags,
        contextTags: [],
        tags: tags,
        intelligenceLevel
    };

    // Step 4: Save to Supabase
    const savedItem = await saveItem(itemWithTags);

    // Stage A primitives run for every image in background.
    if (savedItem.type === 'image') {
        queueStageAPrimitiveAnalysis(savedItem);
    }

    // Step 5: Deep/Ultra - queue vision analysis (background)
    if (!TEMP_DISABLE_LEGACY_VISION_ANALYSIS && ['deep', 'ultra'].includes(intelligenceLevel) && preparedItem.type === 'image') {
        queueForVisionAnalysis(savedItem, null);
    }

    return savedItem;
}

/**
 * Process tags for an existing item
 * Used for items that were saved via extension/content script and bypassed initial tagging
 *
 * @param {Object} item - Item to process
 * @returns {Promise<Object>} Updated item with tags
 */
export async function processItemTags(item) {
    if (!item || !item.id) return item;

    console.log(`🏷️ Processing pending tags for item ${item.id} (${item.type})`);

    // Get intelligence tier from workspace
    const intelligenceLevel = await getIntelligenceLevel(item.workspaceId);

    // Step 1: always extract basic metadata
    let tags = item.tags || [];
    try {
        const basicTags = await extractAllMetadataTags(item);
        tags = [...new Set([...tags, ...basicTags])];
    } catch (e) {
        console.warn('Metadata extraction failed:', e);
    }

    // Step 2: Smart tier
    if (!USE_PRIMITIVE_PIPELINE_ONLY && ['smart', 'ultra'].includes(intelligenceLevel) && item.sourceUrl) {
        try {
            const filename = item.sourceUrl.split('/').pop() || '';
            const smartTags = await interpretMetadata(item.sourceUrl, filename);
            tags = [...new Set([...tags, ...smartTags])];
        } catch (e) {
            console.warn('Smart interpretation failed:', e);
        }
    }

    // Update the item
    const updates = {
        tags: tags,
        objectiveTags: tags,
        needsTagging: false,
        intelligenceLevel
    };

    await updateItem(item.id, updates);

    // Stage A primitives run for every image in background.
    if (item.type === 'image') {
        queueStageAPrimitiveAnalysis({ ...item, ...updates });
    }

    // Queue vision analysis if needed
    if (!TEMP_DISABLE_LEGACY_VISION_ANALYSIS && ['deep', 'ultra'].includes(intelligenceLevel) && item.type === 'image') {
        const freshItem = { ...item, ...updates };
        queueForVisionAnalysis(freshItem, null);
    }

    return { ...item, ...updates };
}


// Background queue for vision analysis
const visionQueue = [];
let isProcessing = false;

function queueForVisionAnalysis(item, project) {
    visionQueue.push({ item, project });
    if (!isProcessing) {
        processVisionQueue();
    }
}

async function processVisionQueue() {
    if (visionQueue.length === 0) {
        isProcessing = false;
        return;
    }

    isProcessing = true;
    const { item, project } = visionQueue.shift();

    try {
        // Convert image to base64 first
        const imageBase64 = await imageToBase64(item.content);

        // Vision analysis
        const visionTags = await analyzeImageObjective(imageBase64);

        if (visionTags.length > 0) {
            const newTags = [...new Set([...(item.objectiveTags || []), ...visionTags])];

            // Context tags if project has description
            let contextTags = [];
            if (project?.description) {
                const contextAITags = await analyzeImageWithContext(imageBase64, project);
                contextTags = contextAITags.map(tag => ({
                    tag,
                    projectId: project.id,
                    confidence: 0.9,
                    generatedAt: Date.now()
                }));
            }

            await updateItem(item.id, {
                objectiveTags: newTags,
                contextTags,
                tags: [...newTags, ...contextTags.map(ct => ct.tag)]
            });

            showToast(`👁️ +${visionTags.length} visual tags`, 'success');
        }

    } catch (error) {
        console.error('Vision analysis failed:', error);
    }

    setTimeout(processVisionQueue, 500);
}

/**
 * Manually enhance item to Ultra level
 * @param {Object} item - Item to enhance
 * @param {Object} project - Project context
 * @returns {Promise<Object>} Enhanced item
 */
export async function enhanceItemWithAI(item, project = null) {
    showToast('✨ Running Ultra analysis...', 'info');

    try {
        let allTags = [...(item.objectiveTags || [])];

        // Smart tier: Interpret metadata
        if (item.sourceUrl && item.sourceUrl !== 'clipboard') {
            const filename = item.sourceUrl.split('/').pop() || '';
            const smartTags = await interpretMetadata(item.sourceUrl, filename);
            allTags = [...new Set([...allTags, ...smartTags])];
        }

        // Deep tier: Vision analysis - convert image to base64 first
        console.log('🔍 Converting image to base64 for vision analysis...');
        const imageBase64 = await imageToBase64(item.content);
        console.log('🔍 Image converted, calling vision API...');

        const visionTags = await analyzeImageObjective(imageBase64);
        allTags = [...new Set([...allTags, ...visionTags])];

        // Context tags if project has description
        let contextTags = item.contextTags || [];
        if (project?.description) {
            const contextAITags = await analyzeImageWithContext(imageBase64, project);
            contextTags = contextTags.filter(ct => ct.projectId !== project.id);
            contextTags.push(...contextAITags.map(tag => ({
                tag,
                projectId: project.id,
                confidence: 0.9,
                generatedAt: Date.now()
            })));
        }

        // Update item
        const updatedItem = await updateItem(item.id, {
            objectiveTags: allTags,
            contextTags,
            tags: [...allTags, ...contextTags.map(ct => ct.tag)],
            intelligenceLevel: 'ultra'
        });

        const newTagCount = allTags.length - (item.objectiveTags?.length || 0);
        showToast(`✨ Ultra: +${newTagCount} tags`, 'success');

        return updatedItem;

    } catch (error) {
        console.error('Enhancement failed:', error);
        showToast('Enhancement failed', 'error');
        return item;
    }
}

/**
 * Estimate cost for enhancing items
 */
export function estimateEnhancementCost(itemCount, currentLevel = 'quick') {
    const costs = {
        quick: 0,
        smart: 0.0002,
        deep: 0.0015,
        ultra: 0.0017
    };

    const baseCost = costs[currentLevel] || 0;
    const ultraCost = costs.ultra;
    const additionalCost = (ultraCost - baseCost) * itemCount;

    return {
        perItem: ultraCost - baseCost,
        total: additionalCost,
        formatted: additionalCost < 0.01 ? '<$0.01' : `$${additionalCost.toFixed(2)}`
    };
}

/**
 * Get queue status
 */
export function getQueueStatus() {
    return {
        pending: visionQueue.length,
        isProcessing
    };
}
