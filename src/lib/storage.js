import { supabase, getCurrentUserId } from './supabase';

export const GENERATED_COLLECTION_KIND = 'generated_outputs';

// ── Helper: snake_case ↔ camelCase mapping ──────────────────────────

function itemFromDb(row) {
    if (!row) return null;
    return {
        id: row.id,
        type: row.type,
        content: row.content,
        title: row.title || null,
        description: row.description || null,
        sourceUrl: row.source_url || '',
        workspaceId: row.workspace_id || null,
        projectId: null,
        collectionId: row.collection_id || null,
        contentStorage: row.content_storage || null,
        thumbnail: row.thumbnail || null,
        thumbnailStorage: row.thumbnail_storage || null,
        objectiveTags: row.objective_tags || [],
        contextTags: row.context_tags || [],
        tags: row.tags || [],
        intelligenceLevel: row.intelligence_level || null,
        needsTagging: row.needs_tagging || false,
        linkViewMode: row.link_view_mode || null,
        linkEmbed: row.link_embed || null,
        textExtract: row.text_extract || null,
        metadata: row.metadata || null,
        canvas: row.canvas || null,
        timestamp: Number(row.timestamp) || new Date(row.created_at).getTime(),
        createdAt: new Date(row.created_at).getTime(),
    };
}

function itemToDb(item, userId) {
    const row = { user_id: userId };
    if (item.id !== undefined) row.id = item.id;
    if (item.type !== undefined) row.type = item.type;
    if (item.content !== undefined) row.content = item.content;
    if (item.title !== undefined) row.title = item.title;
    if (item.description !== undefined) row.description = item.description;
    if (item.sourceUrl !== undefined) row.source_url = item.sourceUrl;
    if (item.workspaceId !== undefined) row.workspace_id = item.workspaceId;
    if (item.collectionId !== undefined) row.collection_id = item.collectionId;
    if (item.contentStorage !== undefined) row.content_storage = item.contentStorage;
    if (item.thumbnail !== undefined) row.thumbnail = item.thumbnail;
    if (item.thumbnailStorage !== undefined) row.thumbnail_storage = item.thumbnailStorage;
    if (item.objectiveTags !== undefined) row.objective_tags = item.objectiveTags;
    if (item.contextTags !== undefined) row.context_tags = item.contextTags;
    if (item.tags !== undefined) row.tags = item.tags;
    if (item.intelligenceLevel !== undefined) row.intelligence_level = item.intelligenceLevel;
    if (item.needsTagging !== undefined) row.needs_tagging = item.needsTagging;
    if (item.linkViewMode !== undefined) row.link_view_mode = item.linkViewMode;
    if (item.linkEmbed !== undefined) row.link_embed = item.linkEmbed;
    if (item.textExtract !== undefined) row.text_extract = item.textExtract;
    if (item.metadata !== undefined) row.metadata = item.metadata;
    if (item.canvas !== undefined) row.canvas = item.canvas;
    if (item.timestamp !== undefined) row.timestamp = item.timestamp;
    return row;
}

function workspaceFromDb(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        icon: row.icon || { type: 'letter', value: (row.name || 'D')[0].toUpperCase() },
        intelligenceLevel: row.intelligence_level || 'quick',
        createdAt: new Date(row.created_at).getTime(),
    };
}

function collectionFromDb(row) {
    if (!row) return null;
    return {
        id: row.id,
        workspaceId: row.workspace_id || null,
        projectId: null,
        name: row.name,
        kind: row.kind || 'custom',
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: new Date(row.updated_at).getTime(),
    };
}

// ── Active Context ──────────────────────────────────────────────────

export async function getActiveContext() {
    const userId = await getCurrentUserId();
    if (!userId) return { workspaceId: null, projectId: null, collectionId: null };

    const { data, error } = await supabase
        .from('active_contexts')
        .select('workspace_id, collection_id')
        .eq('user_id', userId)
        .maybeSingle();

    if (error || !data) return { workspaceId: null, projectId: null, collectionId: null };
    return {
        workspaceId: data.workspace_id || null,
        projectId: null,
        collectionId: data.collection_id || null,
    };
}

export async function setActiveContext(workspaceId, collectionId = null) {
    const userId = await getCurrentUserId();
    if (!userId) return;

    await supabase
        .from('active_contexts')
        .upsert({
            user_id: userId,
            workspace_id: workspaceId || null,
            collection_id: collectionId || null,
        }, { onConflict: 'user_id' });
}

// ── Workspaces ──────────────────────────────────────────────────────

export async function getWorkspaces() {
    const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) { console.error('getWorkspaces error:', error); return []; }
    return (data || []).map(workspaceFromDb);
}

export async function createWorkspace(name, icon = null) {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    const { data, error } = await supabase
        .from('workspaces')
        .insert({
            user_id: userId,
            name,
            icon: icon || { type: 'letter', value: (name || 'D')[0].toUpperCase() },
            intelligence_level: 'quick',
        })
        .select()
        .single();

    if (error) { console.error('createWorkspace error:', error); return null; }
    return workspaceFromDb(data);
}

export async function updateWorkspace(id, updates) {
    const row = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.icon !== undefined) row.icon = updates.icon;
    if (updates.intelligenceLevel !== undefined) row.intelligence_level = updates.intelligenceLevel;

    const { data, error } = await supabase
        .from('workspaces')
        .update(row)
        .eq('id', id)
        .select()
        .single();

    if (error) { console.error('updateWorkspace error:', error); return null; }
    return workspaceFromDb(data);
}

// ── Collections ─────────────────────────────────────────────────────

export function getCollectionWorkspaceId(collection) {
    if (!collection || typeof collection !== 'object') return null;
    return collection.workspaceId || null;
}

export async function getCollections() {
    const { data, error } = await supabase
        .from('collections')
        .select('*')
        .order('updated_at', { ascending: false });

    if (error) { console.error('getCollections error:', error); return []; }
    return (data || []).map(collectionFromDb);
}

export async function createCollection(workspaceId, name) {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    const { data, error } = await supabase
        .from('collections')
        .insert({
            user_id: userId,
            workspace_id: workspaceId,
            name,
            kind: 'custom',
        })
        .select()
        .single();

    if (error) { console.error('createCollection error:', error); return null; }
    return collectionFromDb(data);
}

export async function updateCollection(id, updates) {
    const row = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.kind !== undefined) row.kind = updates.kind;

    const { data, error } = await supabase
        .from('collections')
        .update(row)
        .eq('id', id)
        .select()
        .single();

    if (error) { console.error('updateCollection error:', error); return null; }
    return collectionFromDb(data);
}

export async function deleteCollection(collectionId, { moveItemsToUnsorted = true } = {}) {
    // Query items first so the caller can clean up media and local state
    const { data: collectionItems } = await supabase
        .from('items')
        .select('id, content, thumbnail')
        .eq('collection_id', collectionId);

    if (moveItemsToUnsorted) {
        const { error } = await supabase
            .from('items')
            .update({ collection_id: null })
            .eq('collection_id', collectionId);
        if (error) throw error;
    } else {
        const { error } = await supabase
            .from('items')
            .delete()
            .eq('collection_id', collectionId);
        if (error) throw error;
    }

    const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id', collectionId);
    if (error) throw error;

    return { deletedItems: collectionItems || [] };
}

// ── Items ───────────────────────────────────────────────────────────

export async function getItems() {
    const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) { console.error('getItems error:', error); return []; }
    return (data || []).map(itemFromDb);
}

export async function saveItem(item, _project = null) {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    const id = item.id || crypto.randomUUID();
    const row = itemToDb({
        ...item,
        id,
        timestamp: item.timestamp || Date.now(),
        objectiveTags: [...new Set([...(item.tags || []), ...(item.objectiveTags || [])])],
        contextTags: item.contextTags || [],
        tags: [...new Set([...(item.tags || []), ...(item.objectiveTags || [])])],
        ...(item.type === 'link' && !item.linkViewMode ? { linkViewMode: 'preview' } : {}),
    }, userId);

    const { data, error } = await supabase
        .from('items')
        .insert(row)
        .select()
        .single();

    if (error) { console.error('saveItem error:', error); throw error; }
    return itemFromDb(data);
}

export async function updateItem(id, updates) {
    const userId = await getCurrentUserId();
    if (!userId) return null;

    const row = {};
    // Map camelCase updates to snake_case
    if (updates.content !== undefined) row.content = updates.content;
    if (updates.title !== undefined) row.title = updates.title;
    if (updates.description !== undefined) row.description = updates.description;
    if (updates.sourceUrl !== undefined) row.source_url = updates.sourceUrl;
    if (updates.workspaceId !== undefined) row.workspace_id = updates.workspaceId;
    if (updates.collectionId !== undefined) row.collection_id = updates.collectionId;
    if (updates.contentStorage !== undefined) row.content_storage = updates.contentStorage;
    if (updates.thumbnail !== undefined) row.thumbnail = updates.thumbnail;
    if (updates.thumbnailStorage !== undefined) row.thumbnail_storage = updates.thumbnailStorage;
    if (updates.objectiveTags !== undefined) row.objective_tags = updates.objectiveTags;
    if (updates.contextTags !== undefined) row.context_tags = updates.contextTags;
    if (updates.tags !== undefined) row.tags = updates.tags;
    if (updates.intelligenceLevel !== undefined) row.intelligence_level = updates.intelligenceLevel;
    if (updates.needsTagging !== undefined) row.needs_tagging = updates.needsTagging;
    if (updates.linkViewMode !== undefined) row.link_view_mode = updates.linkViewMode;
    if (updates.linkEmbed !== undefined) row.link_embed = updates.linkEmbed;
    if (updates.textExtract !== undefined) row.text_extract = updates.textExtract;
    if (updates.metadata !== undefined) row.metadata = updates.metadata;
    if (updates.canvas !== undefined) row.canvas = updates.canvas;
    if (updates.analysisStatus !== undefined) row.metadata = { ...(updates.metadata || {}), analysisStatus: updates.analysisStatus };
    if (updates.analysisUpdatedAt !== undefined) row.metadata = { ...(row.metadata || {}), analysisUpdatedAt: updates.analysisUpdatedAt };
    if (updates.analysisRetryAt !== undefined) row.metadata = { ...(row.metadata || {}), analysisRetryAt: updates.analysisRetryAt };

    if (Object.keys(row).length === 0) return null;

    const { data, error } = await supabase
        .from('items')
        .update(row)
        .eq('id', id)
        .select()
        .single();

    if (error) { console.error('updateItem error:', error); return null; }
    return itemFromDb(data);
}

export async function deleteItem(id) {
    const { error } = await supabase
        .from('items')
        .delete()
        .eq('id', id);

    if (error) console.error('deleteItem error:', error);
}

export async function clearItems() {
    const userId = await getCurrentUserId();
    if (!userId) return;

    await supabase
        .from('items')
        .delete()
        .eq('user_id', userId);
}

// ── Primitive Analysis Cache ────────────────────────────────────────

let _primitiveCache = {};
let _primitiveCacheLoadedAt = 0;
const PRIMITIVE_CACHE_TTL = 30_000; // 30s

export function getPrimitiveAnalysisStore() {
    // Returns the in-memory cache. Call loadPrimitiveAnalysisStore() to refresh.
    return _primitiveCache;
}

export async function loadPrimitiveAnalysisStore() {
    const now = Date.now();
    if (now - _primitiveCacheLoadedAt < PRIMITIVE_CACHE_TTL) return _primitiveCache;

    const { data, error } = await supabase
        .from('primitive_analysis')
        .select('*');

    if (error) { console.error('loadPrimitiveAnalysisStore error:', error); return _primitiveCache; }

    const store = {};
    (data || []).forEach((row) => {
        store[row.image_hash] = {
            image_id: row.image_id,
            image_hash: row.image_hash,
            primitives: row.primitives || {},
            lenses: row.lenses || {},
            updated_at: row.updated_at,
        };
    });
    _primitiveCache = store;
    _primitiveCacheLoadedAt = now;
    return store;
}

export function getPrimitiveAnalysisForImage(imageHash) {
    if (!imageHash) return null;
    return _primitiveCache[imageHash] || null;
}

export function getPrimitiveResult(imageHash, primitiveName) {
    if (!imageHash || !primitiveName) return null;
    const record = getPrimitiveAnalysisForImage(imageHash);
    return record?.primitives?.[primitiveName] || null;
}

export function hasAllPrimitiveResultsForVersions(imageHash, versionsByPrimitive = {}) {
    const required = Object.entries(versionsByPrimitive);
    if (!imageHash || required.length === 0) return false;
    const record = getPrimitiveAnalysisForImage(imageHash);
    if (!record?.primitives) return false;
    return required.every(([primitiveName, requiredVersion]) => {
        const entry = record.primitives[primitiveName];
        return Boolean(entry && entry.version === requiredVersion && entry.status !== 'failed');
    });
}

export async function savePrimitiveResultsBatch(imageId, imageHash, results = []) {
    if (!imageHash || !Array.isArray(results) || results.length === 0) return null;

    const userId = await getCurrentUserId();
    if (!userId) return null;

    const existing = _primitiveCache[imageHash] || {
        image_id: imageId || null,
        image_hash: imageHash,
        primitives: {},
        lenses: {},
    };

    const nextPrimitives = { ...(existing.primitives || {}) };
    const nowIso = new Date().toISOString();

    results.forEach((result) => {
        if (!result?.primitiveName) return;
        nextPrimitives[result.primitiveName] = {
            version: result.version || '1.0.0',
            data: result.data || null,
            confidence: typeof result.confidence === 'number' ? result.confidence : 0,
            analyzed_at: result.analyzedAt || nowIso,
            status: result.status || 'ready',
            notes: result.notes || null,
            error: result.error || null,
        };
    });

    const { data, error } = await supabase
        .from('primitive_analysis')
        .upsert({
            user_id: userId,
            image_id: imageId || existing.image_id || null,
            image_hash: imageHash,
            primitives: nextPrimitives,
            lenses: existing.lenses || {},
        }, { onConflict: 'user_id, image_hash' })
        .select()
        .single();

    if (error) {
        console.error('savePrimitiveResultsBatch error:', error);
        return null;
    }

    // Update local cache
    _primitiveCache[imageHash] = {
        image_id: data.image_id,
        image_hash: data.image_hash,
        primitives: data.primitives || {},
        lenses: data.lenses || {},
        updated_at: data.updated_at,
    };

    return _primitiveCache[imageHash];
}

export function savePrimitiveResult(imageId, imageHash, primitiveName, version, data, confidence = 0, options = {}) {
    return savePrimitiveResultsBatch(imageId, imageHash, [{
        primitiveName,
        version,
        data,
        confidence,
        analyzedAt: options.analyzedAt,
        status: options.status || 'ready',
        notes: options.notes || null,
        error: options.error || null,
    }]);
}

// ── Lens Analysis Cache (in-memory + Supabase) ─────────────────────

let _lensCache = {};

export function getLensAnalysisStore() {
    return _lensCache;
}

export async function saveLensResult(cacheKey, payload) {
    if (!cacheKey) return null;
    const userId = await getCurrentUserId();
    if (!userId) return null;

    _lensCache[cacheKey] = payload;

    await supabase
        .from('lens_analysis')
        .upsert({
            user_id: userId,
            cache_key: cacheKey,
            payload,
        }, { onConflict: 'user_id, cache_key' });

    return payload;
}

export function getLensResult(cacheKey) {
    if (!cacheKey) return null;
    return _lensCache[cacheKey] || null;
}

// ── Tags ────────────────────────────────────────────────────────────

export async function getAllTags() {
    const { data, error } = await supabase
        .from('items')
        .select('tags');

    if (error) { console.error('getAllTags error:', error); return []; }
    const tagSet = new Set();
    (data || []).forEach((row) => {
        (row.tags || []).forEach((tag) => tagSet.add(tag));
    });
    return [...tagSet].sort();
}

// ── Legacy compat stubs (unused but prevent import errors) ──────────

export function getProjects() { return []; }
export function getProject() { return null; }
export function getItemsByProject() { return []; }
export function getItemsByCollection() { return []; }
