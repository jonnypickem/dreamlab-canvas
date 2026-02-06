/**
 * Enhanced Save with Canvas Intelligence
 * Routes tagging based on workspace intelligence tier setting
 */

import { saveItem, getProject, getWorkspaces, updateItem } from '../lib/storage';
import { extractAllMetadataTags } from './metadataExtractor';
import { interpretMetadata } from '../services/geminiText';
import { analyzeImageObjective, analyzeImageWithContext } from '../services/geminiVision';
import { imageToBase64 } from './imageProxy';

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
function getWorkspace(workspaceId) {
    const workspaces = getWorkspaces();
    return workspaces.find(w => w.id === workspaceId);
}

/**
 * Get intelligence level for workspace
 */
function getIntelligenceLevel(workspaceId) {
    const workspace = getWorkspace(workspaceId);
    return workspace?.intelligenceLevel || 'quick';
}

/**
 * Save item with Canvas Intelligence tagging
 * Routes to appropriate tier based on workspace setting
 * 
 * @param {Object} item - Item to save
 * @param {string|Object|null} projectOrId - Project or project ID
 * @returns {Object} Saved item with tags
 */
export async function saveItemWithTags(item, projectOrId = null) {
    // Get project context
    let project = projectOrId;
    if (typeof projectOrId === 'string') {
        project = getProject(projectOrId);
    } else if (item.projectId) {
        project = getProject(item.projectId);
    }

    // Get intelligence tier from workspace
    const intelligenceLevel = getIntelligenceLevel(item.workspaceId);

    // FIX: Auto-detect image URLs that came in as 'link' type
    if (item.type === 'link' && item.content && item.content.match(/\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i)) {
        console.log('🖼️ Auto-detected image URL, converting type to image');
        item.type = 'image';
    }

    // Step 1: Always extract basic metadata (Quick tier - free)
    let tags = [];
    console.log(`🏷️ extracting tags for ${item.type} (tier: ${intelligenceLevel})...`);
    try {
        tags = await extractAllMetadataTags(item);
        console.log(`🏷️ extracted ${tags.length} basic tags:`, tags);
    } catch (e) {
        console.warn('Metadata extraction failed:', e);
    }

    // Step 2: Smart tier - LLM interprets metadata
    if (['smart', 'ultra'].includes(intelligenceLevel) && item.sourceUrl) {
        try {
            const filename = item.sourceUrl.split('/').pop() || '';
            const smartTags = await interpretMetadata(item.sourceUrl, filename);
            tags = [...new Set([...tags, ...smartTags])];
        } catch (e) {
            console.warn('Smart interpretation failed:', e);
        }
    }

    // Step 3: Add project default tags
    const projectDefaultTags = project?.tags || [];
    tags = [...new Set([...tags, ...projectDefaultTags])];

    // Step 4: Create item with tags
    const itemWithTags = {
        ...item,
        objectiveTags: tags,
        contextTags: [],
        tags: tags,
        intelligenceLevel // Track what tier was applied
    };

    // Step 5: Save immediately
    const savedItem = saveItem(itemWithTags, project);

    // Step 6: Deep/Ultra - queue vision analysis (background)
    if (['deep', 'ultra'].includes(intelligenceLevel) && item.type === 'image') {
        queueForVisionAnalysis(savedItem, project);
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
    const intelligenceLevel = getIntelligenceLevel(item.workspaceId);

    // Step 1: always extract basic metadata
    let tags = item.tags || [];
    try {
        const basicTags = await extractAllMetadataTags(item);
        tags = [...new Set([...tags, ...basicTags])];
    } catch (e) {
        console.warn('Metadata extraction failed:', e);
    }

    // Step 2: Smart tier
    if (['smart', 'ultra'].includes(intelligenceLevel) && item.sourceUrl) {
        try {
            const filename = item.sourceUrl.split('/').pop() || '';
            const smartTags = await interpretMetadata(item.sourceUrl, filename);
            tags = [...new Set([...tags, ...smartTags])];
        } catch (e) {
            console.warn('Smart interpretation failed:', e);
        }
    }

    // Step 3: Project defaults (if project exists)
    if (item.projectId) {
        const project = getProject(item.projectId);
        if (project && project.tags) {
            tags = [...new Set([...tags, ...project.tags])];
        }
    }

    // Update the item
    const updates = {
        tags: tags,
        objectiveTags: tags, // Simplified for now, mapped to same
        needsTagging: false, // Clear flag
        intelligenceLevel
    };

    updateItem(item.id, updates);

    // Step 4: Queue vision analysis if needed
    if (['deep', 'ultra'].includes(intelligenceLevel) && item.type === 'image') {
        const project = item.projectId ? getProject(item.projectId) : null;
        // Re-fetch item to ensure we have latest state
        const freshItem = { ...item, ...updates };
        queueForVisionAnalysis(freshItem, project);
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

            updateItem(item.id, {
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
    if (!project && item.projectId) {
        project = getProject(item.projectId);
    }

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
        const updatedItem = updateItem(item.id, {
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
