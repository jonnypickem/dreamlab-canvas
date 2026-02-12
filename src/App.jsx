import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    getItems,
    clearItems,
    getWorkspaces,
    getProjects,
    getCollections,
    createCollection,
    updateCollection,
    createWorkspace,
    createProject,
    deleteProject,
    updateProject,
    getActiveContext,
    setActiveContext,
    updateItem,
    getProject
} from './lib/storage';
import { Plus, Folder, Layout, Settings, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import WorkspaceStrip from './components/WorkspaceStrip';
import CanvasView from './components/CanvasView';
import { Toast } from './components/Toast';
import { SelectionToolbar } from './components/SelectionToolbar';
import { exportItemsAsZip } from './utils/zipExport';
import { saveItemWithTags, setToastCallback, processItemTags } from './utils/saveItemWithTags';
import { compactImageStorage } from './utils/storageCompaction';
import { getPrimitiveAnalysisStore } from './lib/storage';
import { getPrimitiveVersionMap } from './services/analysisSchemaRegistry';
import { getImageAnalysisStatus } from './utils/analysisStatus';
import { getStageAQueueStatus, queueStageABackfill } from './services/primitiveAnalysis';

import ItemModal from './components/ItemModal';
import SettingsModal from './components/SettingsModal';
import ConfirmDialog from './components/ConfirmDialog';
import ProjectSettingsModal from './components/ProjectSettingsModal';
import MasonryGrid from './components/MasonryGrid';

// Subframe Imports
import { Button } from "./ui/components/Button";
import { TextField } from "./ui/components/TextField";
import { Slider } from "./ui/components/Slider";
import { ToggleGroup } from "./ui/components/ToggleGroup";
import { Badge } from "./ui/components/Badge";
import * as SubframeCore from "@subframe/core";
import { FeatherChevronLeft, FeatherChevronRight, FeatherLayoutGrid, FeatherSquare, FeatherRotateCcw, FeatherSearch, FeatherFilter } from "@subframe/core";

const STAGE_A_AUTO_BACKFILL_ENABLED = true;

function App() {
    const [items, setItems] = useState([]);
    const [workspaces, setWorkspaces] = useState([]);
    const [projects, setProjects] = useState([]);
    const [collections, setCollections] = useState([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
    const [selectedProjectId, setSelectedProjectId] = useState(null);
    const [selectedCollectionId, setSelectedCollectionId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingItem, setEditingItem] = useState(null);
    const [tagFilter, setTagFilter] = useState(null);

    const [showSettings, setShowSettings] = useState(false);
    const [toast, setToast] = useState(null);

    // Connect AI tagging module to toast notifications
    useEffect(() => {
        setToastCallback(setToast);
    }, []);

    // Project Deletion State
    const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, projectId: null, projectName: '' });

    // Project Settings State
    const [editingProject, setEditingProject] = useState(null);

    // View Mode State
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'canvas'

    // Zoom/Grid Size State (0=Small Items, 4=Large Items)
    // Subframe slider returns array, need to handle that
    const [zoomLevel, setZoomLevel] = useState([2]);

    // Selection State
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [lastSelectedItemId, setLastSelectedItemId] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const stageABackfillCooldownRef = useRef(0);

    const activeProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) || null : null;
    const projectCollections = useMemo(() => {
        if (!selectedProjectId) return [];
        return collections
            .filter((collection) => collection.projectId === selectedProjectId)
            .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    }, [collections, selectedProjectId]);
    const activeCollection = useMemo(() => {
        if (!selectedCollectionId) return null;
        if (selectedCollectionId === '__unsorted__') {
            return { id: '__unsorted__', name: 'Unsorted' };
        }
        return projectCollections.find((collection) => collection.id === selectedCollectionId) || null;
    }, [projectCollections, selectedCollectionId]);

    const projectCollectionItemCounts = useMemo(() => {
        const counts = {};
        if (!selectedProjectId) return counts;
        for (const item of items) {
            if (item.projectId !== selectedProjectId) continue;
            const key = item.collectionId || '__unsorted__';
            counts[key] = (counts[key] || 0) + 1;
        }
        return counts;
    }, [items, selectedProjectId]);

    const visibleCollectionCards = useMemo(() => {
        if (!selectedProjectId) return [];
        const normalizedSearch = searchQuery.trim().toLowerCase();
        const regularCollections = projectCollections
            .filter((collection) => (
                !normalizedSearch || collection.name.toLowerCase().includes(normalizedSearch)
            ))
            .map((collection) => ({
                id: collection.id,
                name: collection.name,
                count: projectCollectionItemCounts[collection.id] || 0,
                updatedAt: collection.updatedAt || collection.createdAt || 0,
                isUnsorted: false,
                kind: collection.kind || 'custom',
            }));

        const unsortedCount = projectCollectionItemCounts.__unsorted__ || 0;
        const unsortedMatches = !normalizedSearch || 'unsorted'.includes(normalizedSearch);
        if (unsortedCount > 0 && unsortedMatches) {
            regularCollections.push({
                id: '__unsorted__',
                name: 'Unsorted',
                count: unsortedCount,
                updatedAt: Date.now(),
                isUnsorted: true,
            });
        }

        return regularCollections;
    }, [projectCollections, projectCollectionItemCounts, searchQuery, selectedProjectId]);

    const filteredItems = useMemo(() => items.filter((item) => {
        const matchesProject = !selectedProjectId || item.projectId === selectedProjectId;
        const matchesCollection = !selectedCollectionId
            || (selectedCollectionId === '__unsorted__'
                ? !item.collectionId
                : item.collectionId === selectedCollectionId);
        const matchesSearch = !searchQuery
            || item.content.toLowerCase().includes(searchQuery.toLowerCase())
            || item.sourceUrl.toLowerCase().includes(searchQuery.toLowerCase())
            || (item.tags && item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())));
        const matchesTag = !tagFilter || (item.tags && item.tags.includes(tagFilter));
        return matchesProject && matchesCollection && matchesSearch && matchesTag;
    }), [items, searchQuery, selectedProjectId, selectedCollectionId, tagFilter]);

    const scopedImageItems = useMemo(
        () => filteredItems.filter((item) => item.type === 'image'),
        [filteredItems]
    );

    const analysisBackfillCandidates = useMemo(() => {
        const primitiveStore = getPrimitiveAnalysisStore();
        const versionMap = getPrimitiveVersionMap();
        const staleCutoff = Date.now() - (2 * 60 * 1000);
        const now = Date.now();
        return scopedImageItems.filter((item) => {
            const status = getImageAnalysisStatus(item, primitiveStore, versionMap).status;
            const isStaleInProgress = status === 'in_progress'
                && ['queued', 'processing', 'in_progress'].includes(item.analysisStatus)
                && Number(item.analysisUpdatedAt || 0) < staleCutoff;
            const isRateLimitedAndWaiting = item.analysisStatus === 'rate_limited'
                && Number(item.analysisRetryAt || 0) > now;
            if (isRateLimitedAndWaiting) return false;
            return status === 'unanalysed' || status === 'failed' || isStaleInProgress;
        });
    }, [scopedImageItems, items]);

    useEffect(() => {
        if (!STAGE_A_AUTO_BACKFILL_ENABLED) return;
        if (analysisBackfillCandidates.length === 0) return;
        const now = Date.now();
        if (now - stageABackfillCooldownRef.current < 10000) return;
        const queueStatus = getStageAQueueStatus();
        if (queueStatus.pending >= 20) return;
        const batchSize = Math.max(1, Math.min(15, analysisBackfillCandidates.length));
        stageABackfillCooldownRef.current = now;
        queueStageABackfill(analysisBackfillCandidates, { maxToQueue: batchSize });
    }, [analysisBackfillCandidates]);


    const loadData = () => {
        const ws = getWorkspaces();
        const p = getProjects();
        const c = getCollections();
        const ctx = getActiveContext();

        setItems(getItems());
        setWorkspaces(ws);
        setProjects(p);
        setCollections(c);

        // Set active context from persistence, or fallback to first workspace
        if (ctx.workspaceId && ws.some(w => w.id === ctx.workspaceId)) {
            setActiveWorkspaceId(ctx.workspaceId);
            if (ctx.projectId && p.some(proj => proj.id === ctx.projectId)) {
                setSelectedProjectId(ctx.projectId);
                if (ctx.collectionId) {
                    const collectionIsValid = ctx.collectionId === '__unsorted__'
                        || c.some((collection) => collection.id === ctx.collectionId && collection.projectId === ctx.projectId);
                    setSelectedCollectionId(collectionIsValid ? ctx.collectionId : null);
                } else {
                    setSelectedCollectionId(null);
                }
            } else {
                // If project from context is invalid, clear selected project
                setSelectedProjectId(null);
                setSelectedCollectionId(null);
            }
        } else if (ws.length > 0) { // If no valid context, or context workspace invalid, default to first workspace
            setActiveWorkspaceId(ws[0].id);
            setSelectedProjectId(null); // Clear any old project selection
            setSelectedCollectionId(null);
        } else {
            // No workspaces exist -> Create default "Dreamlab" workspace
            // This will trigger storage-update event, causing loadData to run again
            createWorkspace('Dreamlab');
        }
    };

    // Persist active context whenever it changes
    useEffect(() => {
        if (activeWorkspaceId) {
            setActiveContext(activeWorkspaceId, selectedProjectId, selectedCollectionId);
        }
    }, [activeWorkspaceId, selectedProjectId, selectedCollectionId]);

    useEffect(() => {
        loadData();

        // Listen for local changes
        window.addEventListener('storage-update', loadData);

        // Listen for storage changes
        window.addEventListener('storage', (e) => {
            if (['dreamlab_items', 'dreamlab_workspaces', 'dreamlab_projects', 'dreamlab_collections', 'dreamlab_active_context'].includes(e.key) || e.key === null) {
                loadData();
            }
        });

        return () => {
            window.removeEventListener('storage-update', loadData);
            window.removeEventListener('storage', loadData);
        };
    }, []);

    useEffect(() => {
        if (!selectedProjectId) {
            if (selectedCollectionId) {
                setSelectedCollectionId(null);
            }
            return;
        }
        if (!selectedCollectionId || selectedCollectionId === '__unsorted__') {
            return;
        }
        const stillValid = collections.some(
            (collection) => collection.id === selectedCollectionId && collection.projectId === selectedProjectId
        );
        if (!stillValid) {
            setSelectedCollectionId(null);
        }
    }, [collections, selectedCollectionId, selectedProjectId]);

    // Tagging Processing Effect
    useEffect(() => {
        const pendingItems = items.filter(item => item.needsTagging);

        if (pendingItems.length > 0) {
            console.log(`🏷️ Found ${pendingItems.length} items needing tagging...`);

            // Process sequentially to avoid overwhelming
            const processNext = async () => {
                const item = pendingItems[0];
                try {
                    await processItemTags(item);
                } catch (e) {
                    console.error("Failed to process item tags:", e);
                }
            };

            // Small delay to let UI render first
            const timer = setTimeout(processNext, 1000);
            return () => clearTimeout(timer);
        }
    }, [items]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Ignore if in input/textarea
            const isInInput = ['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable;

            // Cmd+K to Focus Search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                if (!editingItem) {
                    e.preventDefault();
                    document.querySelector('input[placeholder*="Search"]')?.focus();
                }
            }

            // Cmd+A to Select All (only if not in input)
            if ((e.metaKey || e.ctrlKey) && e.key === 'a' && !isInInput && !editingItem) {
                e.preventDefault();
                const allIds = new Set(filteredItems.map(item => item.id));
                setSelectedItems(allIds);
                setToast({ message: `Selected ${allIds.size} items`, type: 'info' });
            }

            // Escape to Close Modal or Clear Selection
            if (e.key === 'Escape') {
                if (editingItem) {
                    setEditingItem(null);
                } else if (selectedItems.size > 0) {
                    setSelectedItems(new Set());
                    setLastSelectedItemId(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [editingItem, filteredItems, selectedItems]);

    // Clipboard Paste Listener
    useEffect(() => {
        const handlePaste = async (e) => {
            // Don't interfere with inputs
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) {
                return;
            }

            e.preventDefault();
            const clipboardData = e.clipboardData;
            await processClipboard(clipboardData);
        };

        const processClipboard = async (clipboardData) => {
            const items = clipboardData.items;
            const files = clipboardData.files;

            // 0. Check direct clipboard files first (local disk copy/paste often lands here)
            if (files && files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    if (file && file.type && file.type.startsWith('image/')) {
                        await saveImageFromBlob(file);
                        return;
                    }
                }
            }

            // 1. Check for direct image types (screenshots, etc.)
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image')) {
                    const blob = items[i].getAsFile();
                    await saveImageFromBlob(blob);
                    return;
                }
            }

            // 2. Check for HTML content with embedded images
            const htmlContent = clipboardData.getData('text/html');
            if (htmlContent) {
                // Detect Figma's proprietary format (can't be decoded in browser)
                if (htmlContent.includes('figmeta') || htmlContent.includes('fig-kiwie')) {
                    setToast({
                        message: 'Figma uses a proprietary format. Use "Copy as PNG" or export the image first.',
                        type: 'info'
                    });
                    return;
                }

                // Try to extract base64 image from HTML
                const base64Match = htmlContent.match(/src=["']?(data:image\/[^"'\s>]+)["']?/i);
                if (base64Match && base64Match[1]) {
                    await saveImageFromBase64(base64Match[1]);
                    return;
                }

                // Try to extract regular image URL from HTML
                const imgMatch = htmlContent.match(/<img[^>]+src=["']?(https?:\/\/[^"'\s>]+)["']?/i);
                if (imgMatch && imgMatch[1]) {
                    await saveLink(imgMatch[1]);
                    return;
                }
            }

            // 3. Check for Text (URL or plain text)
            const text = clipboardData.getData('text/plain');
            if (text) {
                if (isURL(text)) {
                    await saveLink(text);
                } else {
                    await saveText(text);
                }
                return;
            }

            setToast({ message: 'Nothing to paste', type: 'info' });
        };

        const isURL = (text) => {
            try {
                const url = new URL(text);
                return ['http:', 'https:'].includes(url.protocol);
            } catch {
                return false;
            }
        };

        const saveImageFromBlob = async (blob) => {
            if (!activeWorkspaceId) {
                setToast({ message: 'Select a project first', type: 'error' });
                return;
            }

            if (!blob) {
                setToast({ message: 'Could not read pasted image data', type: 'error' });
                return;
            }

            // Basic large image warning
            if (blob.size > 5 * 1024 * 1024) {
                // In a real app we might compress here or show a dialog.
                // For now, let's just warn via toast but attempt save if possible, or skip compression for simplicity if too complex for this turn.
                // The plan included compression logic. Let's add it.
                setToast({ message: 'Compressing image...', type: 'info' });
            }

            const attempts = [
                { maxDimension: 1600, quality: 0.78, mimeType: 'image/jpeg' },
                { maxDimension: 1200, quality: 0.66, mimeType: 'image/jpeg' },
                { maxDimension: 900, quality: 0.56, mimeType: 'image/jpeg' },
                { maxDimension: 700, quality: 0.5, mimeType: 'image/jpeg' },
            ];
            let attemptedCompaction = false;

            for (let i = 0; i < attempts.length; i++) {
                try {
                    const compressedBlob = await compressImage(blob, attempts[i]);
                    const base64 = await blobToDataUrl(compressedBlob);
                    if (!base64 || typeof base64 !== 'string') {
                        throw new Error('Failed to parse pasted image');
                    }

                    const newItem = {
                        type: 'image',
                        content: base64,
                        sourceUrl: 'clipboard',
                        workspaceId: activeWorkspaceId,
                        projectId: selectedProjectId,
                        collectionId: selectedCollectionId === '__unsorted__' ? null : selectedCollectionId,
                        tags: [],
                        createdAt: Date.now()
                    };
                    await saveItemWithTags(newItem, selectedProjectId);
                    setToast({ message: 'Image pasted', type: 'success' });
                    return;
                } catch (error) {
                    const isQuota = isQuotaExceededError(error);
                    const isLastAttempt = i === attempts.length - 1;

                    if (isQuota && !attemptedCompaction) {
                        attemptedCompaction = true;
                        try {
                            const { compactedCount } = await compactImageStorage({
                                targetFreedBytes: 900 * 1024,
                                maxItemsToProcess: 40,
                            });
                            if (compactedCount > 0) {
                                i -= 1;
                                continue;
                            }
                        } catch {
                            // Fall through to regular handling.
                        }
                    }

                    if (isQuota && !isLastAttempt) {
                        continue;
                    }
                    if (isQuota && isLastAttempt) {
                        setToast({
                            message: 'Storage is full. Delete/export older images before pasting more.',
                            type: 'error'
                        });
                        return;
                    }
                    setToast({ message: error?.message || 'Failed to paste image', type: 'error' });
                    return;
                }
            }
        };

        const saveImageFromBase64 = async (base64Data) => {
            if (!activeWorkspaceId) {
                setToast({ message: 'Select a project first', type: 'error' });
                return;
            }
            try {
                const response = await fetch(base64Data);
                const blob = await response.blob();
                await saveImageFromBlob(blob);
            } catch (error) {
                setToast({ message: error?.message || 'Failed to paste image', type: 'error' });
            }
        };

        const blobToDataUrl = async (blob) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => reject(new Error('Failed to read image data'));
                reader.readAsDataURL(blob);
            });
        };

        const isQuotaExceededError = (error) => {
            return error?.name === 'QuotaExceededError'
                || error?.code === 22
                || /quota/i.test(error?.message || '');
        };

        const compressImage = async (blob, options = {}) => {
            const {
                maxDimension = 2000,
                quality = 0.85,
                mimeType = 'image/jpeg',
            } = options;
            // Simple canvas compression
            return new Promise((resolve) => {
                const img = new Image();
                const url = URL.createObjectURL(blob);
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxDimension) {
                            height = height * (maxDimension / width);
                            width = maxDimension;
                        }
                    } else {
                        if (height > maxDimension) {
                            width = width * (maxDimension / height);
                            height = maxDimension;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        URL.revokeObjectURL(url);
                        resolve(blob);
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((b) => {
                        resolve(b || blob);
                        URL.revokeObjectURL(url);
                    }, mimeType, quality);
                };
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    resolve(blob);
                };
                img.src = url;
            });
        };

        const saveLink = async (url) => {
            if (!activeWorkspaceId) {
                setToast({ message: 'Select a project first', type: 'error' });
                return;
            }

            // Initial placeholder item
            const newItem = {
                type: 'link',
                content: url,
                sourceUrl: url,
                workspaceId: activeWorkspaceId,
                projectId: selectedProjectId,
                collectionId: selectedCollectionId === '__unsorted__' ? null : selectedCollectionId,
                createdAt: Date.now()
            };
            saveItemWithTags(newItem, selectedProjectId);
            setToast({ message: 'Link pasted', type: 'success' });

            // Could attempt to fetch OG image from backend here if setup,
            // currently extension handles scraping. Web app has limited CORS ability.
            // We'll save it as a link and let the link card handle display logic (fallback to icon).
        };

        const saveText = async (text) => {
            if (!activeWorkspaceId) {
                setToast({ message: 'Select a project first', type: 'error' });
                return;
            }

            const newItem = {
                type: 'text',
                content: text,
                sourceUrl: 'clipboard',
                workspaceId: activeWorkspaceId,
                projectId: selectedProjectId,
                collectionId: selectedCollectionId === '__unsorted__' ? null : selectedCollectionId,
                createdAt: Date.now()
            };
            saveItemWithTags(newItem, selectedProjectId);
            setToast({ message: 'Text pasted', type: 'success' });
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [activeWorkspaceId, selectedCollectionId, selectedProjectId]);

    const handleClear = () => {
        clearItems();
        localStorage.removeItem('dreamlab_workspaces');
        localStorage.removeItem('dreamlab_projects');
        localStorage.removeItem('dreamlab_collections');
        localStorage.removeItem('dreamlab_active_context');
        loadData();
    };

    const handleDelete = (id) => {
        // Read fresh from localStorage to avoid stale state
        const currentItems = getItems();
        const updated = currentItems.filter(i => i.id !== id);
        localStorage.setItem('dreamlab_items', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage-update'));
    };

    const handleUpdateItem = (id, updates) => {
        updateItem(id, updates);
        // loadData is triggered by event, but we can optimistically update if needed
        // For now, reliance on event listener is fine
    };

    const getProjectName = (id) => {
        const p = projects.find(p => p.id === id);
        return p ? p.name : null;
    };

    const getWorkspaceName = (id) => {
        const ws = workspaces.find(ws => ws.id === id);
        return ws ? ws.name : null;
    };

    const isQuotaExceededError = (error) => (
        error?.name === 'QuotaExceededError'
        || error?.code === 22
        || /quota/i.test(error?.message || '')
    );

    const getDefaultCollectionName = () => {
        const base = 'New Collection';
        const existing = new Set(
            projectCollections
                .map((collection) => String(collection?.name || '').trim().toLowerCase())
                .filter(Boolean)
        );

        if (!existing.has(base.toLowerCase())) return base;
        for (let i = 2; i < 1000; i += 1) {
            const candidate = `${base} ${i}`;
            if (!existing.has(candidate.toLowerCase())) return candidate;
        }
        return `${base} ${Date.now()}`;
    };

    const canGoBack = Boolean(selectedCollectionId || selectedProjectId);
    const isCollectionOverview = Boolean(selectedProjectId) && !selectedCollectionId;

    const headerTitle = !selectedProjectId
        ? 'All Items'
        : selectedCollectionId
            ? (activeCollection?.name || 'Collection')
            : `${activeProject?.name || 'Project'} Collections`;

    const headerSubtitle = !selectedProjectId
        ? `${items.length} items across your workspaces`
        : selectedCollectionId
            ? `Collection in ${activeProject?.name || 'project'}`
            : `${projectCollections.length} collection${projectCollections.length === 1 ? '' : 's'} in ${getWorkspaceName(activeProject?.workspaceId) || 'workspace'}`;

    const handleBackNavigate = () => {
        if (selectedCollectionId) {
            setSelectedCollectionId(null);
            return;
        }
        if (selectedProjectId) {
            setSelectedProjectId(null);
            setSelectedCollectionId(null);
        }
    };

    const handleCreateCollection = async () => {
        if (!selectedProjectId) return;

        const suggestedName = getDefaultCollectionName();
        let requestedName = null;
        try {
            requestedName = prompt('Collection name:', suggestedName);
        } catch {
            requestedName = suggestedName;
        }

        const finalName = String(requestedName || '').trim() || suggestedName;

        const tryCreateCollection = () => createCollection(selectedProjectId, finalName);

        try {
            const created = tryCreateCollection();
            if (!created) throw new Error('Collection was not created.');
            setSelectedCollectionId(created.id);
            setToast({ message: `Created collection "${created.name}"`, type: 'success' });
        } catch (error) {
            if (isQuotaExceededError(error)) {
                try {
                    const { compactedCount } = await compactImageStorage({
                        targetFreedBytes: 700 * 1024,
                        maxItemsToProcess: 30,
                    });

                    if (compactedCount > 0) {
                        const created = tryCreateCollection();
                        if (created) {
                            setSelectedCollectionId(created.id);
                            setToast({ message: `Created collection "${created.name}"`, type: 'success' });
                            return;
                        }
                    }
                } catch {
                    // Fall through to error toast below.
                }
                setToast({ message: 'Storage is full. Export or delete older images, then try again.', type: 'error' });
                return;
            }

            setToast({ message: error?.message || 'Failed to create collection', type: 'error' });
        }
    };

    // Selection Handlers
    const handleSelectItem = useCallback((itemId, modifiers) => {
        setSelectedItems(prevSelected => {
            const newSelected = new Set(prevSelected);

            if (modifiers.shiftKey && lastSelectedItemId) {
                // Range selection
                const itemIds = filteredItems.map(item => item.id);
                const lastIndex = itemIds.indexOf(lastSelectedItemId);
                const currentIndex = itemIds.indexOf(itemId);

                if (lastIndex !== -1 && currentIndex !== -1) {
                    const start = Math.min(lastIndex, currentIndex);
                    const end = Math.max(lastIndex, currentIndex);

                    for (let i = start; i <= end; i++) {
                        newSelected.add(itemIds[i]);
                    }
                }
            } else if (modifiers.metaKey) {
                // Toggle single item
                if (newSelected.has(itemId)) {
                    newSelected.delete(itemId);
                } else {
                    newSelected.add(itemId);
                }
            } else {
                // Regular click on selected item - deselect
                if (newSelected.has(itemId)) {
                    newSelected.delete(itemId);
                } else {
                    // Clear and select only this item
                    newSelected.clear();
                    newSelected.add(itemId);
                }
            }

            return newSelected;
        });

        setLastSelectedItemId(itemId);
    }, [filteredItems, lastSelectedItemId]);

    const clearSelection = useCallback(() => {
        setSelectedItems(new Set());
        setLastSelectedItemId(null);
    }, []);

    const handleBulkDelete = useCallback(() => {
        if (selectedItems.size === 0) return;

        const count = selectedItems.size;
        const currentItems = getItems();
        const updated = currentItems.filter(item => !selectedItems.has(item.id));
        localStorage.setItem('dreamlab_items', JSON.stringify(updated));
        window.dispatchEvent(new Event('storage-update'));
        clearSelection();
        setToast({ message: `Deleted ${count} item${count !== 1 ? 's' : ''}`, type: 'success' });
    }, [selectedItems, clearSelection]);

    const handleCopySelection = useCallback(async () => {
        if (selectedItems.size === 0) return;

        const selectedItemsList = items.filter(item => selectedItems.has(item.id));
        const imageItem = selectedItemsList.find(item =>
            item.type === 'image' || (item.type === 'link' && item.content?.startsWith('data:'))
        );

        if (!imageItem) {
            const textItem = selectedItemsList.find(item => item.type === 'text');
            if (textItem) {
                await navigator.clipboard.writeText(textItem.content);
                setToast({ message: 'Text copied to clipboard', type: 'success' });
            } else {
                setToast({ message: 'Nothing to copy', type: 'error' });
            }
            return;
        }

        try {
            const response = await fetch(imageItem.content);
            const blob = await response.blob();
            let pngBlob = blob;
            if (blob.type !== 'image/png') {
                const img = new Image();
                const url = URL.createObjectURL(blob);
                pngBlob = await new Promise((resolve) => {
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        canvas.getContext('2d').drawImage(img, 0, 0);
                        canvas.toBlob(resolve, 'image/png');
                        URL.revokeObjectURL(url);
                    };
                    img.src = url;
                });
            }
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': pngBlob })
            ]);
            const msg = selectedItemsList.length > 1
                ? 'Copied first image to clipboard'
                : 'Image copied to clipboard';
            setToast({ message: msg, type: 'success' });
        } catch {
            setToast({ message: 'Failed to copy image', type: 'error' });
        }
    }, [items, selectedItems]);

    const handleDownloadSelection = useCallback(async () => {
        if (selectedItems.size === 0) {
            setToast({ message: 'No items selected', type: 'error' });
            return;
        }

        const selectedItemsList = items.filter(item => selectedItems.has(item.id));
        const exportableItems = selectedItemsList.filter(item =>
            item.type === 'image' ||
            (item.type === 'link' && item.content?.startsWith('data:'))
        );

        if (exportableItems.length === 0) {
            setToast({ message: 'No images to download', type: 'error' });
            return;
        }

        // Single item: direct download
        if (exportableItems.length === 1) {
            const item = exportableItems[0];
            const ext = item.content.startsWith('data:image/png') ? 'png'
                : item.content.startsWith('data:image/gif') ? 'gif'
                    : item.content.startsWith('data:image/webp') ? 'webp'
                        : 'jpg';
            const filename = `${item.title || 'image'}-${item.id.slice(0, 8)}.${ext}`;

            // Convert data URL to blob URL so Chrome downloads instead of opening a tab
            const response = await fetch(item.content);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);

            setToast({ message: 'Image downloaded', type: 'success' });
            clearSelection();
            return;
        }

        // Multiple items: ZIP download
        setIsExporting(true);

        try {
            const projectName = selectedProjectId
                ? getProjectName(selectedProjectId)
                : getWorkspaceName(activeWorkspaceId) || 'dreamlab';

            const result = await exportItemsAsZip(
                exportableItems,
                projectName,
                (current, total, message) => {
                    if (message) {
                        setToast({ message, type: 'info' });
                    } else {
                        setToast({ message: `Creating ZIP... (${current}/${total})`, type: 'info' });
                    }
                }
            );

            setToast({
                message: `Downloaded ${result.success} image${result.success !== 1 ? 's' : ''} as ZIP${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
                type: 'success'
            });
            clearSelection();
        } catch (error) {
            console.error('Download failed:', error);
            setToast({ message: error.message || 'Failed to download', type: 'error' });
        } finally {
            setIsExporting(false);
        }
    }, [items, selectedItems, selectedProjectId, activeWorkspaceId, clearSelection]);

    const handleAddTags = useCallback(() => {
        const tag = prompt('Enter tag to add to selected items:');
        if (!tag || tag.trim() === '') return;

        const trimmedTag = tag.trim();
        selectedItems.forEach(itemId => {
            const item = items.find(i => i.id === itemId);
            if (item) {
                const currentTags = item.tags || [];
                if (!currentTags.includes(trimmedTag)) {
                    updateItem(itemId, { tags: [...currentTags, trimmedTag] });
                }
            }
        });

        setToast({ message: `Added tag "${trimmedTag}" to ${selectedItems.size} items`, type: 'success' });
        clearSelection();
    }, [items, selectedItems, clearSelection]);

    useEffect(() => {
        clearSelection();
    }, [selectedProjectId, selectedCollectionId, clearSelection]);

    return (
        <div className="flex h-screen overflow-hidden bg-default-background">
            <WorkspaceStrip
                workspaces={workspaces}
                activeWorkspaceId={activeWorkspaceId}
                onWorkspaceChange={(workspaceId) => {
                    setActiveWorkspaceId(workspaceId);
                    setSelectedProjectId(null);
                    setSelectedCollectionId(null);
                }}
                onAddWorkspace={() => {
                    const name = prompt('Workspace Name:');
                    if (name) createWorkspace(name);
                }}
            />
            {/* Sidebar is hidden on mobile in Subframe example, but we keep it responsive or as is */}
            <Sidebar
                projects={projects.filter(p => p.workspaceId === activeWorkspaceId)}
                collections={collections.filter((collection) => projects.some(
                    (project) => project.id === collection.projectId && project.workspaceId === activeWorkspaceId
                ))}
                selectedProjectId={selectedProjectId}
                selectedCollectionId={selectedCollectionId}
                onProjectSelect={(nextProjectId) => {
                    setSelectedProjectId(nextProjectId);
                    setSelectedCollectionId(null);
                }}
                onCollectionSelect={(projectId, collectionId) => {
                    setSelectedProjectId(projectId);
                    setSelectedCollectionId(collectionId);
                }}
                onCollectionRename={(collection, nextNameInput) => {
                    const nextName = typeof nextNameInput === 'string'
                        ? nextNameInput
                        : prompt('Rename collection:', collection?.name || '');
                    if (!nextName || !nextName.trim()) return;
                    const updated = updateCollection(collection.id, { name: nextName.trim() });
                    if (updated) {
                        setToast({ message: `Renamed to "${updated.name}"`, type: 'success' });
                    }
                }}
                onCreateProject={createProject}
                onDeleteProject={(id, name) => setDeleteConfirm({ isOpen: true, projectId: id, projectName: name })}
                onProjectSettings={(project) => setEditingProject(project)}
                activeWorkspaceId={activeWorkspaceId}
                activeWorkspaceName={getWorkspaceName(activeWorkspaceId)}
                onOpenSettings={() => setShowSettings(true)}
                totalItemCount={items.length}
            />

            <main className="flex grow shrink-0 basis-0 flex-col items-start self-stretch overflow-hidden relative bg-white">
                {/* Replaced Header with Subframe Structure */}
                <div className="flex w-full flex-col items-start gap-4 px-8 pt-8 pb-4">
                    <div className="flex w-full items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="neutral-tertiary"
                                size="small"
                                icon={<FeatherChevronLeft />}
                                onClick={handleBackNavigate}
                                disabled={!canGoBack}
                            />
                            <div className="flex items-center gap-1 text-caption font-caption text-subtext-color">
                                <button
                                    type="button"
                                    className="hover:text-default-font"
                                    onClick={() => {
                                        setSelectedProjectId(null);
                                        setSelectedCollectionId(null);
                                    }}
                                >
                                    {getWorkspaceName(activeWorkspaceId) || 'Workspace'}
                                </button>
                                {selectedProjectId ? <FeatherChevronRight className="text-caption font-caption text-neutral-400" /> : null}
                                {selectedProjectId ? (
                                    <button
                                        type="button"
                                        className="hover:text-default-font"
                                        onClick={() => setSelectedCollectionId(null)}
                                    >
                                        {activeProject?.name || 'Project'}
                                    </button>
                                ) : null}
                                {selectedCollectionId ? <FeatherChevronRight className="text-caption font-caption text-neutral-400" /> : null}
                                {selectedCollectionId ? (
                                    <span className="text-default-font">{activeCollection?.name || 'Collection'}</span>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    <div className="flex w-full items-end justify-between">
                        <div className="flex flex-col items-start gap-1">
                            <span className="text-heading-1 font-heading-1 text-default-font">
                                {headerTitle}
                            </span>
                            <span className="text-caption font-caption text-subtext-color">
                                {headerSubtitle}
                            </span>
                        </div>
                        {isCollectionOverview ? (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="brand-primary"
                                    size="small"
                                    onClick={handleCreateCollection}
                                >
                                    New Collection
                                </Button>
                                <Button
                                    variant="neutral-tertiary"
                                    size="small"
                                    icon={<FeatherRotateCcw />}
                                    onClick={handleClear}
                                >
                                    Reset
                                </Button>
                            </div>
                        ) : null}
                        {!isCollectionOverview && (
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-caption-bold font-caption-bold text-subtext-color">
                                        SIZE
                                    </span>
                                    <Slider
                                        className="w-24 flex-none"
                                        value={zoomLevel}
                                        min={0}
                                        max={4}
                                        step={1}
                                        onValueChange={(val) => setZoomLevel(val)}
                                    />
                                </div>
                                <ToggleGroup value={viewMode} onValueChange={(value) => value && setViewMode(value)}>
                                    <ToggleGroup.Item
                                        icon={<FeatherLayoutGrid />}
                                        value="grid"
                                    />
                                    <ToggleGroup.Item icon={<FeatherSquare />} value="canvas" />
                                </ToggleGroup>
                                <Button
                                    variant="neutral-tertiary"
                                    size="small"
                                    icon={<FeatherRotateCcw />}
                                    onClick={handleClear}
                                >
                                    Reset
                                </Button>
                            </div>
                        )}
                    </div>
                    {/* Tag Filter Chip */}
                    {tagFilter && (
                        <div className="flex items-center gap-2">
                            <Badge variant="neutral" onClick={() => setTagFilter(null)} className="cursor-pointer hover:bg-neutral-200">
                                {tagFilter} <span className="ml-1">×</span>
                            </Badge>
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="flex w-full grow shrink-0 basis-0 flex-col items-start px-8 pb-8 overflow-y-auto">
                    {isCollectionOverview ? (
                        <div className="flex w-full flex-col gap-4">
                            {visibleCollectionCards.length === 0 ? (
                                <div className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-neutral-border bg-neutral-50 px-6 py-16">
                                    <span className="text-body-bold font-body-bold text-default-font">No collections yet</span>
                                    <span className="mt-1 text-caption font-caption text-subtext-color">Create a collection to start organizing this project's datasets.</span>
                                    <Button className="mt-4" variant="brand-primary" size="small" onClick={handleCreateCollection}>
                                        Create Collection
                                    </Button>
                                </div>
                            ) : (
                                <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {visibleCollectionCards.map((collection) => (
                                        <button
                                            key={collection.id}
                                            type="button"
                                            className="flex min-h-[136px] flex-col gap-3 rounded-lg border border-neutral-border bg-default-background px-4 py-4 text-left hover:border-brand-600 hover:bg-brand-50"
                                            onClick={() => setSelectedCollectionId(collection.id)}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate text-body-bold font-body-bold text-default-font">{collection.name}</span>
                                                {collection.isUnsorted ? (
                                                    <Badge variant="warning">Legacy</Badge>
                                                ) : collection.kind === 'generated_outputs' ? (
                                                    <Badge variant="brand">Generated</Badge>
                                                ) : (
                                                    <Badge variant="neutral">{collection.count} items</Badge>
                                                )}
                                            </div>
                                            <span className="text-caption font-caption text-subtext-color">
                                                {collection.isUnsorted
                                                    ? 'Items not yet assigned to a collection'
                                                    : 'Open this dataset and collect visual references'}
                                            </span>
                                            <span className="mt-auto text-caption-bold font-caption-bold text-brand-700">Open Collection</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            {viewMode === 'canvas' ? (
                                <motion.div
                                    key="canvas"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="w-full h-full"
                                >
                                    <CanvasView
                                        items={filteredItems}
                                        onUpdateItem={handleUpdateItem}
                                        onDeleteItem={handleDelete}
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="grid"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="w-full h-full"
                                >
                                    {filteredItems.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center w-full h-64 border border-dashed border-neutral-border rounded-lg bg-neutral-50">
                                            <div className="bg-neutral-100 p-3 rounded-full mb-3">
                                                <FeatherSearch className="text-neutral-400 w-6 h-6" />
                                            </div>
                                            <span className="text-body-bold font-body-bold text-default-font">Nothing here yet</span>
                                            <span className="text-caption font-caption text-subtext-color mt-1">Start capturing inspiration.</span>
                                        </div>
                                    ) : (
                                        <MasonryGrid
                                            items={filteredItems}
                                            onItemClick={setEditingItem}
                                            zoomLevel={zoomLevel[0]}
                                            selectedItems={selectedItems}
                                            onSelectItem={handleSelectItem}
                                        />
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}

                </div>

                {/* Item Modal */}
                <AnimatePresence>
                    {editingItem && (
                        <ItemModal
                            item={editingItem}
                            onClose={() => setEditingItem(null)}
                            onUpdate={(updated) => {
                                handleUpdateItem(updated.id, updated);
                                setEditingItem(updated);
                            }}
                            onDelete={handleDelete}
                            onNext={() => {
                                const currentIndex = filteredItems.findIndex(i => i.id === editingItem.id);
                                if (currentIndex < filteredItems.length - 1) {
                                    setEditingItem(filteredItems[currentIndex + 1]);
                                }
                            }}
                            onPrev={() => {
                                const currentIndex = filteredItems.findIndex(i => i.id === editingItem.id);
                                if (currentIndex > 0) {
                                    setEditingItem(filteredItems[currentIndex - 1]);
                                }
                            }}
                            hasNext={filteredItems.findIndex(i => i.id === editingItem.id) < filteredItems.length - 1}
                            hasPrev={filteredItems.findIndex(i => i.id === editingItem.id) > 0}
                        />
                    )}
                </AnimatePresence>

                {/* Settings Modal */}
                <AnimatePresence>
                    {showSettings && (
                        <SettingsModal
                            onClose={() => setShowSettings(false)}
                            activeWorkspace={workspaces.find(w => w.id === activeWorkspaceId)}
                            onUpdateWorkspace={loadData}
                        />
                    )}
                </AnimatePresence>

                {/* Project Settings Modal */}
                <AnimatePresence>
                    {editingProject && (
                        <ProjectSettingsModal
                            project={editingProject}
                            onClose={() => setEditingProject(null)}
                            onUpdate={(id, updates) => {
                                updateProject(id, updates);
                                setToast({ message: 'Project updated', type: 'success' });
                            }}
                            onDelete={(id, name) => {
                                setEditingProject(null);
                                setDeleteConfirm({ isOpen: true, projectId: id, projectName: name });
                            }}
                        />
                    )}
                </AnimatePresence>

                {/* Delete Project Confirmation Dialog */}
                <ConfirmDialog
                    isOpen={deleteConfirm.isOpen}
                    onClose={() => setDeleteConfirm({ isOpen: false, projectId: null, projectName: '' })}
                    onConfirm={() => {
                        deleteProject(deleteConfirm.projectId);
                        // Clear selection if we just deleted the selected project
                        if (selectedProjectId === deleteConfirm.projectId) {
                            setSelectedProjectId(null);
                            setSelectedCollectionId(null);
                        }
                        setToast({ message: `Project "${deleteConfirm.projectName}" deleted`, type: 'success' });
                    }}
                    title={`Delete "${deleteConfirm.projectName}"?`}
                    message="All items in this project will be moved to 'All Items'. This action cannot be undone."
                    confirmLabel="Delete"
                    cancelLabel="Cancel"
                    variant="destructive"
                />

                {/* Toast Notifications */}
                <AnimatePresence>
                    {toast && (
                        <Toast
                            message={toast.message}
                            type={toast.type}
                            onClose={() => setToast(null)}
                        />
                    )}
                </AnimatePresence>

                {/* Floating Bottom Bar: Search or Selection Toolbar */}
                {selectedItems.size > 0 ? (
                    <SelectionToolbar
                        selectedCount={selectedItems.size}
                        onCopy={handleCopySelection}
                        onDownload={handleDownloadSelection}
                        onDelete={handleBulkDelete}
                        onAddTags={handleAddTags}
                        onClearSelection={clearSelection}
                        isExporting={isExporting}
                    />
                ) : (
                    <div className="flex items-center gap-3 rounded-full border border-solid border-neutral-border bg-white px-4 py-4 fixed bottom-8 left-1/2 z-10 -translate-x-1/2 focus-within:shadow-[0px_0px_32px_-4px_rgba(234,88,12,0.3),0px_0px_8px_-2px_rgba(234,88,12,0.3)]">
                        <div className="flex w-96 flex-none items-center relative">
                            <TextField
                                className="h-auto grow shrink-0 basis-0"
                                variant="outline"
                                icon={<FeatherSearch />}
                            >
                                <TextField.Input
                                    className="pr-8"
                                    placeholder="Search content, URLs, or tags..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </TextField>
                            <div className="flex items-center gap-1 absolute right-[6px] pointer-events-none">
                                <div className="flex items-center gap-0.5 rounded-md border border-solid border-neutral-200 bg-neutral-100 px-1.5 py-0.5">
                                    <span className="text-caption font-caption text-subtext-color">⌘</span>
                                    <span className="text-caption font-caption text-subtext-color">K</span>
                                </div>
                            </div>
                        </div>
                        <Button
                            variant="neutral-secondary"
                            size="medium"
                            icon={<FeatherFilter />}
                            onClick={() => { }}
                        >
                            Filter
                        </Button>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
