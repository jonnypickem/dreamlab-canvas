export const STORAGE_KEY = 'dreamlab_items';
export const WORKSPACES_KEY = 'dreamlab_workspaces';
export const PROJECTS_KEY = 'dreamlab_projects';
export const COLLECTIONS_KEY = 'dreamlab_collections';
export const GENERATED_COLLECTION_KIND = 'generated_outputs';
export const ACTIVE_CONTEXT_KEY = 'dreamlab_active_context';
export const PRIMITIVE_ANALYSIS_KEY = 'dreamlab_primitive_analysis';
export const LENS_ANALYSIS_KEY = 'dreamlab_lens_analysis';
export const PROJECT_SYNTHESIS_KEY = 'dreamlab_project_synthesis';

function isQuotaExceededError(error) {
    return error?.name === 'QuotaExceededError'
        || error?.code === 22
        || /quota/i.test(error?.message || '');
}

// Active Context (persists the last selected Workspace/Project)
export const getActiveContext = () => {
    const ctx = localStorage.getItem(ACTIVE_CONTEXT_KEY);
    const parsed = ctx ? JSON.parse(ctx) : {};
    return {
        workspaceId: parsed.workspaceId || null,
        projectId: parsed.projectId || null,
        collectionId: parsed.collectionId || null,
    };
};

export const setActiveContext = (workspaceId, projectId, collectionId = null) => {
    localStorage.setItem(ACTIVE_CONTEXT_KEY, JSON.stringify({ workspaceId, projectId, collectionId }));
    window.dispatchEvent(new Event('storage-update'));
};

export const getItems = () => {
    const items = localStorage.getItem(STORAGE_KEY);
    return items ? JSON.parse(items) : [];
};

export const getWorkspaces = () => {
    const ws = localStorage.getItem(WORKSPACES_KEY);
    return ws ? JSON.parse(ws) : [];
};

export const getProjects = () => {
    const p = localStorage.getItem(PROJECTS_KEY);
    return p ? JSON.parse(p) : [];
};

export const getCollections = (projectId = null) => {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    if (!projectId) return parsed;
    return parsed.filter((collection) => collection.projectId === projectId);
};

export const createWorkspace = (name, icon = null) => {
    const workspaces = getWorkspaces();
    const newWorkspace = {
        id: crypto.randomUUID(),
        name,
        icon: icon || { type: 'letter', value: name[0].toUpperCase() },
        intelligenceLevel: 'quick', // Canvas Intelligence: 'quick' | 'smart' | 'deep' | 'ultra'
        createdAt: Date.now()
    };
    localStorage.setItem(WORKSPACES_KEY, JSON.stringify([...workspaces, newWorkspace]));
    window.dispatchEvent(new Event('storage-update'));
    return newWorkspace;
};

export const updateWorkspace = (id, updates) => {
    const workspaces = getWorkspaces();
    const updatedWorkspaces = workspaces.map(w =>
        w.id === id ? { ...w, ...updates } : w
    );
    localStorage.setItem(WORKSPACES_KEY, JSON.stringify(updatedWorkspaces));
    window.dispatchEvent(new Event('storage-update'));
    return updatedWorkspaces.find(w => w.id === id);
};

export const createProject = (workspaceId, name) => {
    const projects = getProjects();
    const newProject = {
        id: crypto.randomUUID(),
        workspaceId,
        name,
        description: '',      // LLM context for AI categorization
        category: 'general',  // Category preset for style suggestions
        tags: [],             // Default tags for new items
        style: [],            // Visual style keywords
        aiPrompt: '',         // Custom AI instructions
        createdAt: Date.now()
    };
    localStorage.setItem(PROJECTS_KEY, JSON.stringify([...projects, newProject]));
    window.dispatchEvent(new Event('storage-update'));
    return newProject;
};

export const createCollection = (projectId, name) => {
    const collections = getCollections();
    const newCollection = {
        id: crypto.randomUUID(),
        projectId,
        name,
        kind: 'custom',
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify([newCollection, ...collections]));
    window.dispatchEvent(new Event('storage-update'));
    return newCollection;
};

export const getOrCreateGeneratedCollection = (projectId, name = 'Generated Outputs') => {
    const collections = getCollections(projectId);
    const existing = collections.find((collection) => collection.kind === GENERATED_COLLECTION_KIND);
    if (existing) return existing;

    const allCollections = getCollections();
    const generatedCollection = {
        id: crypto.randomUUID(),
        projectId,
        name,
        kind: GENERATED_COLLECTION_KIND,
        createdAt: Date.now(),
        updatedAt: Date.now(),
    };
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify([generatedCollection, ...allCollections]));
    window.dispatchEvent(new Event('storage-update'));
    return generatedCollection;
};

export const updateCollection = (id, updates) => {
    const collections = getCollections();
    const updatedCollections = collections.map((collection) => (
        collection.id === id
            ? { ...collection, ...updates, updatedAt: Date.now() }
            : collection
    ));
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updatedCollections));
    window.dispatchEvent(new Event('storage-update'));
    return updatedCollections.find((collection) => collection.id === id) || null;
};

export const deleteCollection = (collectionId, { moveItemsToUnsorted = true } = {}) => {
    const collections = getCollections();
    const updatedCollections = collections.filter((collection) => collection.id !== collectionId);
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updatedCollections));

    const items = getItems();
    const updatedItems = items
        .filter((item) => (moveItemsToUnsorted ? true : item.collectionId !== collectionId))
        .map((item) => (item.collectionId === collectionId ? { ...item, collectionId: null } : item));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));

    window.dispatchEvent(new Event('storage-update'));
};

export const getProject = (projectId) => {
    const projects = getProjects();
    return projects.find(p => p.id === projectId) || null;
};

export const getItemsByProject = (projectId) => {
    const items = getItems();
    return items.filter(item => item.projectId === projectId);
};

export const getItemsByCollection = (collectionId) => {
    const items = getItems();
    return items.filter((item) => item.collectionId === collectionId);
};

export const deleteProject = (projectId, deleteItems = false) => {
    // Remove the project
    const projects = getProjects();
    const updatedProjects = projects.filter(p => p.id !== projectId);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updatedProjects));

    if (deleteItems) {
        // Also delete all items in this project
        const items = getItems();
        const updatedItems = items.filter(item => item.projectId !== projectId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
    } else {
        // Move items to "no project" (set projectId to null)
        const items = getItems();
        const updatedItems = items.map(item =>
            item.projectId === projectId ? { ...item, projectId: null, collectionId: null } : item
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
    }

    const collections = getCollections();
    const updatedCollections = collections.filter((collection) => collection.projectId !== projectId);
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updatedCollections));

    window.dispatchEvent(new Event('storage-update'));
};

export const updateProject = (id, updates) => {
    const projects = getProjects();
    const updatedProjects = projects.map(p =>
        p.id === id ? { ...p, ...updates } : p
    );
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updatedProjects));
    window.dispatchEvent(new Event('storage-update'));
    return updatedProjects.find(p => p.id === id);
};

export const saveItem = (item, project = null) => {
    const items = getItems();

    // Initialize tag arrays
    const projectDefaultTags = project?.tags || [];

    const newItem = {
        ...item,
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        createdAt: Date.now(),
        workspaceId: item.workspaceId || null,
        projectId: item.projectId || null,
        collectionId: item.collectionId || null,
        // New tag structure for AI tagging
        objectiveTags: [...new Set([...(item.tags || []), ...projectDefaultTags])],
        contextTags: [],
        tags: [...new Set([...(item.tags || []), ...projectDefaultTags])] // Combined for search
    };

    const updatedItems = [newItem, ...items];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));

    // Trigger a custom event so the App can listen for changes within the same tab
    window.dispatchEvent(new Event('storage-update'));

    return newItem;
};

export const updateItem = (id, updates) => {
    const items = getItems();
    const updatedItems = items.map(item =>
        item.id === id ? { ...item, ...updates } : item
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
    window.dispatchEvent(new Event('storage-update'));
    return updatedItems.find(item => item.id === id);
};

export const getAllTags = () => {
    const items = getItems();
    const tags = new Set();
    items.forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => tags.add(tag));
        }
    });
    return Array.from(tags).sort();
};

export const clearItems = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event('storage-update'));
};

// --- Primitives + Lenses Storage ---

export const getPrimitiveAnalysisStore = () => {
    const raw = localStorage.getItem(PRIMITIVE_ANALYSIS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
};

export const getPrimitiveAnalysisForImage = (imageHash) => {
    if (!imageHash) return null;
    const store = getPrimitiveAnalysisStore();
    return store[imageHash] || null;
};

export const getPrimitiveResult = (imageHash, primitiveName) => {
    if (!imageHash || !primitiveName) return null;
    const record = getPrimitiveAnalysisForImage(imageHash);
    return record?.primitives?.[primitiveName] || null;
};

export const hasAllPrimitiveResultsForVersions = (imageHash, versionsByPrimitive = {}) => {
    const required = Object.entries(versionsByPrimitive);
    if (!imageHash || required.length === 0) return false;

    const record = getPrimitiveAnalysisForImage(imageHash);
    if (!record?.primitives) return false;

    return required.every(([primitiveName, requiredVersion]) => {
        const entry = record.primitives[primitiveName];
        return Boolean(entry && entry.version === requiredVersion && entry.status !== 'failed');
    });
};

export const savePrimitiveResultsBatch = (imageId, imageHash, results = []) => {
    if (!imageHash || !Array.isArray(results) || results.length === 0) return null;

    const store = getPrimitiveAnalysisStore();
    const existing = store[imageHash] || {
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

    const nextRecord = {
        ...existing,
        image_id: imageId || existing.image_id || null,
        image_hash: imageHash,
        primitives: nextPrimitives,
        updated_at: nowIso,
    };

    store[imageHash] = nextRecord;
    try {
        localStorage.setItem(PRIMITIVE_ANALYSIS_KEY, JSON.stringify(store));
        window.dispatchEvent(new Event('storage-update'));
    } catch (error) {
        if (isQuotaExceededError(error)) {
            console.warn('Primitive analysis cache skipped due to storage quota.');
            return null;
        }
        throw error;
    }

    return nextRecord;
};

export const savePrimitiveResult = (imageId, imageHash, primitiveName, version, data, confidence = 0, options = {}) => (
    savePrimitiveResultsBatch(imageId, imageHash, [{
        primitiveName,
        version,
        data,
        confidence,
        analyzedAt: options.analyzedAt,
        status: options.status || 'ready',
        notes: options.notes || null,
        error: options.error || null,
    }])
);

export const getLensAnalysisStore = () => {
    const raw = localStorage.getItem(LENS_ANALYSIS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
};

export const saveLensResult = (cacheKey, payload) => {
    if (!cacheKey) return null;
    const store = getLensAnalysisStore();
    store[cacheKey] = payload;
    try {
        localStorage.setItem(LENS_ANALYSIS_KEY, JSON.stringify(store));
        window.dispatchEvent(new Event('storage-update'));
    } catch (error) {
        if (isQuotaExceededError(error)) {
            console.warn('Lens analysis cache skipped due to storage quota.');
            return null;
        }
        throw error;
    }
    return store[cacheKey];
};

export const getLensResult = (cacheKey) => {
    if (!cacheKey) return null;
    const store = getLensAnalysisStore();
    return store[cacheKey] || null;
};
