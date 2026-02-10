document.addEventListener('DOMContentLoaded', async () => {
    const saveBtn = document.getElementById('save-btn');
    const status = document.getElementById('status');
    const previewContainer = document.getElementById('preview-container');
    const workspaceSelect = document.getElementById('workspace-select');
    const projectSelect = document.getElementById('project-select');

    let workspaces = [];
    let projects = [];
    let activeContext = { workspaceId: null, projectId: null };

    // 1. Initial Load: Get pending capture
    const { pendingCapture } = await chrome.storage.local.get('pendingCapture');
    if (pendingCapture) {
        saveBtn.disabled = false;
        renderPreview(pendingCapture);
    }

    // 2. Fetch Workspaces/Projects and Active Context from Web App
    async function refreshOrganizationData() {
        try {
            const tabs = await chrome.tabs.query({ url: "http://localhost:5173/*" });
            if (tabs.length === 0) {
                status.textContent = 'Open Dreamlab to sync';
                status.className = 'status';
                return;
            }

            const activeTabs = await chrome.tabs.query({
                url: "http://localhost:5173/*",
                active: true,
                currentWindow: true
            });
            const targetTab = activeTabs[0]
                || [...tabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];

            chrome.tabs.sendMessage(targetTab.id, { action: 'GET_ORG_DATA' }, (response) => {
                if (response && response.success) {
                    workspaces = response.workspaces;
                    projects = response.projects;
                    activeContext = response.activeContext || { workspaceId: null, projectId: null };
                    updateDropdowns();
                }
            });
        } catch (err) {
            console.error('Failed to fetch org data:', err);
        }
    }

    function updateDropdowns() {
        // Update Workspaces
        workspaceSelect.innerHTML = '<option value="">Select Workspace</option>';
        workspaces.forEach(ws => {
            const opt = document.createElement('option');
            opt.value = ws.id;
            const iconDisplay = typeof ws.icon === 'string' ? ws.icon : (ws.icon?.value || ws.name[0]);
            opt.textContent = `${iconDisplay} ${ws.name}`;
            workspaceSelect.appendChild(opt);
        });

        // Auto-select workspace from active context
        if (activeContext.workspaceId && workspaces.some(ws => ws.id === activeContext.workspaceId)) {
            workspaceSelect.value = activeContext.workspaceId;
            updateProjectsDropdown(activeContext.workspaceId);
        } else if (workspaces.length > 0) {
            workspaceSelect.value = workspaces[0].id;
            updateProjectsDropdown(workspaces[0].id);
        }
    }

    function updateProjectsDropdown(wsId) {
        projectSelect.innerHTML = '<option value="">Select Project</option>';
        const workspaceProjects = projects.filter(p => p.workspaceId === wsId);
        workspaceProjects.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            projectSelect.appendChild(opt);
        });

        // Auto-select project from active context
        if (activeContext.projectId && workspaceProjects.some(p => p.id === activeContext.projectId)) {
            projectSelect.value = activeContext.projectId;
        } else if (workspaceProjects.length > 0) {
            projectSelect.value = workspaceProjects[0].id;
        }
    }

    workspaceSelect.addEventListener('change', (e) => {
        const wsId = e.target.value;
        updateProjectsDropdown(wsId);
    });

    refreshOrganizationData();

    // 3. Save Action
    // 3. Save Action
    saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        const wsId = workspaceSelect.value || null;
        const pId = projectSelect.value || null;

        status.textContent = `Saving... (WS: ${wsId ? 'Set' : 'Null'}, P: ${pId ? 'Set' : 'Null'})`;
        status.className = 'status';

        try {
            const { pendingCapture } = await chrome.storage.local.get('pendingCapture');
            if (!pendingCapture) throw new Error('No item to save');

            const tagsInput = document.getElementById('tags-input');
            const tags = tagsInput ? tagsInput.value.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];

            const itemToSave = {
                ...pendingCapture,
                workspaceId: wsId,
                projectId: pId,
                tags: tags
            };

            console.log('Dreamlab: Saving item', itemToSave);

            // Send message to background to save
            chrome.runtime.sendMessage({ action: 'saveCapturedItem', item: itemToSave }, (response) => {
                if (response && response.success) {
                    status.textContent = `Saved! (WS: ${wsId ? 'Set' : 'Null'}, P: ${pId ? 'Set' : 'Null'})`;
                    status.className = 'status success';
                    chrome.storage.local.remove('pendingCapture');
                    saveBtn.disabled = true;
                    previewContainer.innerHTML = '<div id="preview-text">Nothing to capture.</div>';
                } else {
                    status.textContent = 'Error: ' + (response?.error || 'Unknown error');
                    status.className = 'status error';
                    saveBtn.disabled = false;
                }
            });
        } catch (err) {
            status.textContent = 'Error: ' + err.message;
            status.className = 'status error';
            saveBtn.disabled = false;
        }
    });

    function renderPreview(item) {
        previewContainer.innerHTML = '';
        if (item.type === 'image') {
            const img = document.createElement('img');
            img.src = item.content;
            previewContainer.appendChild(img);
        } else {
            const p = document.createElement('p');
            p.textContent = item.content;
            previewContainer.appendChild(p);
        }
    }
});
