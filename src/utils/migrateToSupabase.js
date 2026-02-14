/**
 * One-time migration: localStorage + IndexedDB → Supabase
 * Reads all existing workspaces, collections, and items from localStorage,
 * uploads media blobs from IndexedDB to Supabase Storage,
 * and inserts all metadata rows into the Supabase database.
 */

import { supabase, getCurrentUserId } from '../lib/supabase';
import { uploadMedia } from '../lib/supabaseStorage';
import { getMediaBlob, isMediaStoreRef } from '../lib/mediaStore';

const STORAGE_KEYS = {
    items: 'dreamlab_items',
    workspaces: 'dreamlab_workspaces',
    collections: 'dreamlab_collections',
    activeContext: 'dreamlab_active_context',
};

function readJson(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
        return fallback;
    }
}

function dataUrlToBlob(dataUrl) {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}

/**
 * Check whether there is legacy data in localStorage worth migrating.
 */
export function hasLegacyData() {
    const items = readJson(STORAGE_KEYS.items, []);
    const workspaces = readJson(STORAGE_KEYS.workspaces, []);
    return items.length > 0 || workspaces.length > 0;
}

/**
 * Run the full migration.
 * @param {Object} options
 * @param {function} options.onProgress - ({ phase, current, total, message }) => void
 * @returns {Promise<{ workspaces: number, collections: number, items: number, mediaUploaded: number, errors: string[] }>}
 */
export async function migrateToSupabase({ onProgress } = {}) {
    const userId = await getCurrentUserId();
    if (!userId) throw new Error('You must be logged in to migrate data.');

    const errors = [];
    const progress = (phase, current, total, message) => {
        if (onProgress) onProgress({ phase, current, total, message });
    };

    // ── Read legacy data ────────────────────────────────────────────
    const legacyWorkspaces = readJson(STORAGE_KEYS.workspaces, []);
    const legacyCollections = readJson(STORAGE_KEYS.collections, []);
    const legacyItems = readJson(STORAGE_KEYS.items, []);

    const workspaceIdMap = {}; // old ID → new ID
    const collectionIdMap = {}; // old ID → new ID

    // ── 1. Migrate Workspaces ───────────────────────────────────────
    progress('workspaces', 0, legacyWorkspaces.length, 'Migrating workspaces...');
    let wsCount = 0;
    for (const ws of legacyWorkspaces) {
        try {
            const { data, error } = await supabase
                .from('workspaces')
                .insert({
                    user_id: userId,
                    name: ws.name || 'Untitled',
                    icon: ws.icon || { type: 'letter', value: (ws.name || 'D')[0].toUpperCase() },
                    intelligence_level: ws.intelligenceLevel || 'quick',
                })
                .select()
                .single();

            if (error) throw error;
            workspaceIdMap[ws.id] = data.id;
            wsCount++;
        } catch (err) {
            errors.push(`Workspace "${ws.name}": ${err.message}`);
        }
        progress('workspaces', wsCount, legacyWorkspaces.length);
    }

    // ── 2. Migrate Collections ──────────────────────────────────────
    progress('collections', 0, legacyCollections.length, 'Migrating collections...');
    let colCount = 0;
    for (const col of legacyCollections) {
        const newWorkspaceId = workspaceIdMap[col.workspaceId || col.projectId] || null;
        if (!newWorkspaceId) {
            errors.push(`Collection "${col.name}": workspace not found`);
            colCount++;
            continue;
        }
        try {
            const { data, error } = await supabase
                .from('collections')
                .insert({
                    user_id: userId,
                    workspace_id: newWorkspaceId,
                    name: col.name || 'Untitled',
                    kind: col.kind || 'custom',
                })
                .select()
                .single();

            if (error) throw error;
            collectionIdMap[col.id] = data.id;
            colCount++;
        } catch (err) {
            errors.push(`Collection "${col.name}": ${err.message}`);
        }
        progress('collections', colCount, legacyCollections.length);
    }

    // ── 3. Migrate Items ────────────────────────────────────────────
    progress('items', 0, legacyItems.length, 'Migrating items...');
    let itemCount = 0;
    let mediaUploaded = 0;

    for (const item of legacyItems) {
        const newWorkspaceId = workspaceIdMap[item.workspaceId] || Object.values(workspaceIdMap)[0] || null;
        const newCollectionId = item.collectionId ? (collectionIdMap[item.collectionId] || null) : null;

        let contentValue = item.content || '';
        let contentStorage = item.contentStorage || null;
        let thumbnailValue = item.thumbnail || null;
        let thumbnailStorage = item.thumbnailStorage || null;
        const itemId = crypto.randomUUID();

        // Upload image content
        try {
            if (item.type === 'image') {
                let blob = null;
                if (isMediaStoreRef(contentValue)) {
                    blob = await getMediaBlob(contentValue);
                } else if (contentValue.startsWith('data:image/')) {
                    blob = dataUrlToBlob(contentValue);
                }
                if (blob) {
                    const path = await uploadMedia(blob, itemId, 'image');
                    contentValue = path;
                    contentStorage = 'supabase';
                    mediaUploaded++;
                }
            }
        } catch (err) {
            errors.push(`Item media "${(item.sourceUrl || item.id || '').slice(0, 40)}": ${err.message}`);
        }

        // Upload link thumbnail
        try {
            if (item.type === 'link' && thumbnailValue) {
                let blob = null;
                if (isMediaStoreRef(thumbnailValue)) {
                    blob = await getMediaBlob(thumbnailValue);
                } else if (thumbnailValue.startsWith('data:image/')) {
                    blob = dataUrlToBlob(thumbnailValue);
                }
                if (blob) {
                    const path = await uploadMedia(blob, itemId, 'thumbnail');
                    thumbnailValue = path;
                    thumbnailStorage = 'supabase';
                    mediaUploaded++;
                }
            }
        } catch (err) {
            errors.push(`Item thumbnail "${(item.sourceUrl || item.id || '').slice(0, 40)}": ${err.message}`);
        }

        // Insert row
        try {
            const { error } = await supabase
                .from('items')
                .insert({
                    id: itemId,
                    user_id: userId,
                    type: item.type || 'image',
                    content: contentValue,
                    title: item.title || null,
                    description: item.description || null,
                    source_url: item.sourceUrl || '',
                    workspace_id: newWorkspaceId,
                    collection_id: newCollectionId,
                    content_storage: contentStorage,
                    thumbnail: thumbnailValue,
                    thumbnail_storage: thumbnailStorage,
                    objective_tags: item.objectiveTags || item.tags || [],
                    context_tags: item.contextTags || [],
                    tags: item.tags || [],
                    intelligence_level: item.intelligenceLevel || null,
                    needs_tagging: item.needsTagging || false,
                    link_view_mode: item.linkViewMode || null,
                    link_embed: item.linkEmbed || null,
                    text_extract: item.textExtract || null,
                    metadata: item.metadata || null,
                    timestamp: item.timestamp || Date.now(),
                });

            if (error) throw error;
            itemCount++;
        } catch (err) {
            errors.push(`Item "${(item.sourceUrl || item.id || '').slice(0, 40)}": ${err.message}`);
        }

        progress('items', itemCount, legacyItems.length, `Migrating items... ${itemCount}/${legacyItems.length}`);
    }

    progress('done', 0, 0, 'Migration complete!');

    return {
        workspaces: wsCount,
        collections: colCount,
        items: itemCount,
        mediaUploaded,
        errors,
    };
}

/**
 * Clear legacy localStorage data after successful migration.
 */
export function clearLegacyData() {
    Object.values(STORAGE_KEYS).forEach((key) => {
        localStorage.removeItem(key);
    });
    localStorage.removeItem('dreamlab_projects');
}
