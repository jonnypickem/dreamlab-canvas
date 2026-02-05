export const STORAGE_KEY = 'dreamlab_items';
export const WORKSPACES_KEY = 'dreamlab_workspaces';
export const PROJECTS_KEY = 'dreamlab_projects';
export const ACTIVE_CONTEXT_KEY = 'dreamlab_active_context';

// Active Context (persists the last selected Workspace/Project)
export const getActiveContext = () => {
    const ctx = localStorage.getItem(ACTIVE_CONTEXT_KEY);
    return ctx ? JSON.parse(ctx) : { workspaceId: null, projectId: null };
};

export const setActiveContext = (workspaceId, projectId) => {
    localStorage.setItem(ACTIVE_CONTEXT_KEY, JSON.stringify({ workspaceId, projectId }));
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

export const getProject = (projectId) => {
    const projects = getProjects();
    return projects.find(p => p.id === projectId) || null;
};

export const getItemsByProject = (projectId) => {
    const items = getItems();
    return items.filter(item => item.projectId === projectId);
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
            item.projectId === projectId ? { ...item, projectId: null } : item
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
    }

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
