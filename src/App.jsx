import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    getItems,
    clearItems,
    getWorkspaces,
    getProjects,
    getCollections,
    createProject,
    updateProject,
    deleteProject,
    createCollection,
    deleteCollection,
    deleteItem as deleteItemFromDb,
    getCollectionWorkspaceId,
    updateCollection,
    createWorkspace,
    getActiveContext,
    setActiveContext,
    updateItem,
    loadPrimitiveAnalysisStore,
    getPrimitiveAnalysisStore
} from './lib/storage';
import { supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';
import MigrationBanner from './components/MigrationBanner';
import { hasLegacyData } from './utils/migrateToSupabase';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from './components/Sidebar';
import WorkspaceStrip from './components/WorkspaceStrip';
import CanvasView from './components/CanvasView';
import { Toast } from './components/Toast';
import { SelectionToolbar } from './components/SelectionToolbar';
import { exportItemsAsZip } from './utils/zipExport';
import saveAs from 'file-saver';
import { fetchImageViaProxy } from './utils/imageProxy';
import { saveItemWithTags, setToastCallback, processItemTags } from './utils/saveItemWithTags';
import { deleteMedia } from './lib/supabaseStorage';
import { getPrimitiveVersionMap } from './services/analysisSchemaRegistry';
import { getImageAnalysisStatus } from './utils/analysisStatus';
import { getStageAQueueStatus, queueStageABackfill } from './services/primitiveAnalysis';

import ItemModal from './components/ItemModal';
import SettingsModal from './components/SettingsModal';
import MasonryGrid from './components/MasonryGrid';
import CreateToolbar from './components/CreateToolbar';
import CanvasDetailPanel from './components/CanvasDetailPanel';

// Subframe Imports
import { Button } from "./ui/components/Button";
import { TextField } from "./ui/components/TextField";
import { Slider } from "./ui/components/Slider";
import { ToggleGroup } from "./ui/components/ToggleGroup";
import { Badge } from "./ui/components/Badge";
import * as SubframeCore from "@subframe/core";
import { FeatherChevronLeft, FeatherChevronRight, FeatherLayoutGrid, FeatherSquare, FeatherSearch } from "@subframe/core";

const STAGE_A_AUTO_BACKFILL_ENABLED = true;
const COLLECTION_SORT_STEP = 1000;

function getCollectionSortOrder(collection) {
    const order = Number(collection?.sortOrder);
    return Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

function sortCollectionsForOrder(collectionList) {
    return [...collectionList].sort((a, b) => {
        const byOrder = getCollectionSortOrder(a) - getCollectionSortOrder(b);
        if (byOrder !== 0) return byOrder;
        return (a.createdAt || 0) - (b.createdAt || 0);
    });
}

function normalizeProjectId(projectId) {
    return projectId || null;
}

function computeCollectionReorder(allCollections, {
    collectionId,
    targetCollectionId = null,
    targetProjectId = null,
    position = 'before',
}) {
    const moving = allCollections.find((collection) => collection.id === collectionId);
    if (!moving) return { nextCollections: allCollections, changes: [] };
    if (targetCollectionId === moving.id) return { nextCollections: allCollections, changes: [] };

    const sourceProjectId = normalizeProjectId(moving.projectId);
    const destinationProjectId = targetProjectId !== undefined
        ? normalizeProjectId(targetProjectId)
        : sourceProjectId;

    const withoutMoving = allCollections.filter((collection) => collection.id !== moving.id);
    const targetCollection = targetCollectionId
        ? withoutMoving.find((collection) => collection.id === targetCollectionId)
        : null;
    if (targetCollectionId && !targetCollection) {
        return { nextCollections: allCollections, changes: [] };
    }

    const destinationCollections = sortCollectionsForOrder(
        withoutMoving.filter((collection) => normalizeProjectId(collection.projectId) === destinationProjectId)
    );

    let insertIndex = destinationCollections.length;
    if (targetCollection) {
        const targetIndex = destinationCollections.findIndex((collection) => collection.id === targetCollection.id);
        if (targetIndex >= 0) {
            insertIndex = position === 'after' ? targetIndex + 1 : targetIndex;
        }
    }

    destinationCollections.splice(insertIndex, 0, { ...moving, projectId: destinationProjectId });

    const projectsToReindex = new Set([sourceProjectId, destinationProjectId]);
    const nextById = new Map();
    const changes = [];

    projectsToReindex.forEach((projectId) => {
        const orderedCollections = projectId === destinationProjectId
            ? destinationCollections
            : sortCollectionsForOrder(
                withoutMoving.filter((collection) => normalizeProjectId(collection.projectId) === projectId)
            );

        orderedCollections.forEach((collection, index) => {
            const nextSortOrder = (index + 1) * COLLECTION_SORT_STEP;
            const currentSortOrder = Number.isFinite(Number(collection.sortOrder))
                ? Number(collection.sortOrder)
                : null;
            const currentProjectId = normalizeProjectId(collection.projectId);

            if (currentSortOrder !== nextSortOrder || currentProjectId !== projectId) {
                const nextCollection = {
                    ...collection,
                    projectId,
                    sortOrder: nextSortOrder,
                };
                nextById.set(collection.id, nextCollection);
                changes.push({
                    id: collection.id,
                    projectId,
                    sortOrder: nextSortOrder,
                });
            }
        });
    });

    if (changes.length === 0) return { nextCollections: allCollections, changes: [] };

    const nextCollections = allCollections.map((collection) => (
        nextById.get(collection.id) || collection
    ));
    return { nextCollections, changes };
}

function App() {
    const [user, setUser] = useState(undefined); // undefined = loading, null = no auth
    const [items, setItems] = useState([]);
    const [workspaces, setWorkspaces] = useState([]);
    const [projects, setProjects] = useState([]);
    const [collections, setCollections] = useState([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
        try { return localStorage.getItem('dreamlab_nav_workspace') || null; } catch { return null; }
    });
    const [selectedCollectionId, setSelectedCollectionId] = useState(() => {
        try { return localStorage.getItem('dreamlab_nav_collection') || null; } catch { return null; }
    });
    const navRestoredRef = useRef(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchExpanded, setSearchExpanded] = useState(false);
    const searchInputRef = useRef(null);
    const [editingItem, setEditingItem] = useState(null);
    const [detailPanelItem, setDetailPanelItem] = useState(null);
    const [tagFilter, setTagFilter] = useState(null);

    const [showSettings, setShowSettings] = useState(false);
    const [toast, setToast] = useState(null);

    // Connect AI tagging module to toast notifications
    useEffect(() => {
        setToastCallback(setToast);
    }, []);

    // View Mode State
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'canvas'
    const [canvasInlineEditId, setCanvasInlineEditId] = useState(null);
    const [gridInlineEditId, setGridInlineEditId] = useState(null);
    const canvasViewportRef = useRef(null);

    // Zoom/Grid Size State (0=Small Items, 4=Large Items)
    // Subframe slider returns array, need to handle that
    const [zoomLevel, setZoomLevel] = useState([2]);

    // Selection State
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [lastSelectedItemId, setLastSelectedItemId] = useState(null);
    const [isExporting, setIsExporting] = useState(false);
    const stageABackfillCooldownRef = useRef(0);
    const [isCanvasTitleEditing, setIsCanvasTitleEditing] = useState(false);
    const [canvasTitleDraft, setCanvasTitleDraft] = useState('');
    const canvasTitleInputRef = useRef(null);

    const handleCanvasModeWheelCapture = useCallback((event) => {
        if (viewMode !== 'canvas') return;
        event.preventDefault();
    }, [viewMode]);

    const workspaceCollections = useMemo(() => {
        if (!activeWorkspaceId) return [];
        return sortCollectionsForOrder(
            collections.filter((collection) => getCollectionWorkspaceId(collection) === activeWorkspaceId)
        );
    }, [collections, activeWorkspaceId]);

    const workspaceProjects = useMemo(() => {
        if (!activeWorkspaceId) return [];
        return projects
            .filter((project) => project.workspaceId === activeWorkspaceId)
            .sort((a, b) => {
                const aGeneral = String(a?.name || '').trim().toLowerCase() === 'general';
                const bGeneral = String(b?.name || '').trim().toLowerCase() === 'general';
                if (aGeneral !== bGeneral) return aGeneral ? -1 : 1;
                return (a.createdAt || 0) - (b.createdAt || 0);
            });
    }, [projects, activeWorkspaceId]);

    const activeCollection = useMemo(() => {
        if (!selectedCollectionId) return null;
        if (selectedCollectionId === '__unsorted__') {
            return { id: '__unsorted__', name: 'Unsorted' };
        }
        return workspaceCollections.find((collection) => collection.id === selectedCollectionId) || null;
    }, [workspaceCollections, selectedCollectionId]);

    useEffect(() => {
        setCanvasTitleDraft(activeCollection?.name || 'All Items');
        setIsCanvasTitleEditing(false);
    }, [activeCollection?.id, activeCollection?.name, selectedCollectionId]);

    useEffect(() => {
        if (!isCanvasTitleEditing) return;
        canvasTitleInputRef.current?.focus();
        canvasTitleInputRef.current?.select();
    }, [isCanvasTitleEditing]);

    const workspaceItemCount = useMemo(
        () => items.filter((item) => !activeWorkspaceId || item.workspaceId === activeWorkspaceId).length,
        [items, activeWorkspaceId]
    );

    const filteredItems = useMemo(() => items.filter((item) => {
        const matchesWorkspace = !activeWorkspaceId || item.workspaceId === activeWorkspaceId;
        const matchesCollection = !selectedCollectionId
            || (selectedCollectionId === '__unsorted__'
                ? !item.collectionId
                : item.collectionId === selectedCollectionId);
        const matchesSearch = !searchQuery
            || item.content.toLowerCase().includes(searchQuery.toLowerCase())
            || item.sourceUrl.toLowerCase().includes(searchQuery.toLowerCase())
            || (item.tags && item.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase())));
        const matchesTag = !tagFilter || (item.tags && item.tags.includes(tagFilter));
        return matchesWorkspace && matchesCollection && matchesSearch && matchesTag;
    }), [items, searchQuery, activeWorkspaceId, selectedCollectionId, tagFilter]);

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


    const loadData = async () => {
        const isFirstLoad = !navRestoredRef.current;

        const fetches = [
            getWorkspaces(),
            getProjects(),
            getCollections(),
            getItems(),
        ];
        // Only fetch active context on first load; subsequent refreshes keep current nav state
        if (isFirstLoad) fetches.push(getActiveContext());

        const [ws, p, c, fetchedItems, ctx] = await Promise.all(fetches);

        await loadPrimitiveAnalysisStore();

        setItems(fetchedItems);
        setWorkspaces(ws);
        setProjects(p);
        setCollections(c);

        if (isFirstLoad) {
            // Set active context from persistence, or fallback to first workspace
            if (ctx.workspaceId && ws.some(w => w.id === ctx.workspaceId)) {
                setActiveWorkspaceId(ctx.workspaceId);
                if (ctx.collectionId) {
                    const collectionIsValid = ctx.collectionId === '__unsorted__'
                        || c.some((collection) => (
                            collection.id === ctx.collectionId
                            && getCollectionWorkspaceId(collection) === ctx.workspaceId
                        ));
                    setSelectedCollectionId(collectionIsValid ? ctx.collectionId : null);
                } else {
                    setSelectedCollectionId(null);
                }
            } else if (ws.length > 0) {
                setActiveWorkspaceId(ws[0].id);
                setSelectedCollectionId(null);
            } else if (!hasLegacyData()) {
                // No workspaces exist and no legacy data to migrate -> Create default "Dreamlab" workspace
                const created = await createWorkspace('Dreamlab');
                if (created) {
                    setActiveWorkspaceId(created.id);
                    setWorkspaces([created]);
                }
            }

            navRestoredRef.current = true;
        }
    };

    // Auth state listener
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Persist active context whenever it changes
    useEffect(() => {
        if (!activeWorkspaceId || !user) return;
        // Skip the first render to avoid overwriting the DB context before loadData restores it
        if (!navRestoredRef.current) return;
        try {
            localStorage.setItem('dreamlab_nav_workspace', activeWorkspaceId);
            if (selectedCollectionId) {
                localStorage.setItem('dreamlab_nav_collection', selectedCollectionId);
            } else {
                localStorage.removeItem('dreamlab_nav_collection');
            }
        } catch { /* ignore */ }
        setActiveContext(activeWorkspaceId, selectedCollectionId);
    }, [activeWorkspaceId, selectedCollectionId, user]);

    // Load data when user is authenticated
    useEffect(() => {
        if (!user) return;
        loadData();

        // Subscribe to Supabase Realtime for live updates
        const channel = supabase
            .channel('dreamlab-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => loadData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces' }, () => loadData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, () => loadData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, () => loadData())
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    // Extension bridge: listen for postMessage from content.js
    useEffect(() => {
        if (!user) return;

        const handleMessage = async (event) => {
            if (event.source !== window) return;

            if (event.data?.type === 'DREAMLAB_SAVE_ITEM') {
                const { item, responseChannel } = event.data;
                console.log('[ExtBridge] Received DREAMLAB_SAVE_ITEM', { type: item?.type, sourceUrl: item?.sourceUrl?.slice(0, 60), hasContent: !!item?.content });
                try {
                    const saved = await saveItemWithTags({
                        ...item,
                        workspaceId: item.workspaceId || activeWorkspaceId,
                        collectionId: item.collectionId || (selectedCollectionId === '__unsorted__' ? null : selectedCollectionId),
                    }, null);
                    console.log('[ExtBridge] Save succeeded', saved?.id);
                    if (saved) {
                        setItems((prev) => [saved, ...prev]);
                    }
                    window.postMessage({ type: responseChannel, payload: { success: true, itemId: saved.id } }, '*');
                } catch (error) {
                    console.error('[ExtBridge] Save failed', error);
                    window.postMessage({ type: responseChannel, payload: { success: false, error: error?.message || 'Save failed' } }, '*');
                }
            }

            if (event.data?.type === 'DREAMLAB_GET_ORG_DATA') {
                const { responseChannel } = event.data;
                window.postMessage({
                    type: responseChannel,
                    payload: {
                        success: true,
                        workspaces,
                        projects,
                        collections,
                        activeContext: {
                            workspaceId: activeWorkspaceId,
                            collectionId: selectedCollectionId,
                        },
                    },
                }, '*');
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [user, activeWorkspaceId, selectedCollectionId, workspaces, projects, collections]);

    useEffect(() => {
        if (!selectedCollectionId || selectedCollectionId === '__unsorted__') {
            return;
        }
        const stillValid = collections.some(
            (collection) => collection.id === selectedCollectionId
                && getCollectionWorkspaceId(collection) === activeWorkspaceId
        );
        if (!stillValid) {
            setSelectedCollectionId(null);
        }
    }, [collections, selectedCollectionId, activeWorkspaceId]);


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
                    setSearchExpanded(true);
                    setTimeout(() => searchInputRef.current?.focus(), 0);
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

    // Image utility helpers — used by paste and drag-and-drop
    const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read image data'));
        reader.readAsDataURL(blob);
    });

    const compressImage = (blob, options = {}) => {
        const { maxDimension = 2000, quality = 0.85, mimeType = 'image/jpeg' } = options;
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxDimension) { height = height * (maxDimension / width); width = maxDimension; }
                } else {
                    if (height > maxDimension) { width = width * (maxDimension / height); height = maxDimension; }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { URL.revokeObjectURL(url); resolve(blob); return; }
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((b) => { resolve(b || blob); URL.revokeObjectURL(url); }, mimeType, quality);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
            img.src = url;
        });
    };

    const getCanvasPlacement = useCallback((itemType) => {
        const defaultSizes = {
            text: { w: 280, h: 160 },
            color: { w: 160, h: 160 },
            image: { w: 300, h: 200 },
            video: { w: 300, h: 200 },
            link: { w: 280, h: 160 },
        };
        const size = defaultSizes[itemType] || defaultSizes.text;
        const vp = canvasViewportRef.current;
        if (!vp || !vp.containerWidth) {
            return { x: 120, y: 120, ...size, z: 1 };
        }
        const centerX = (vp.containerWidth / 2 - vp.positionX) / vp.scale;
        const centerY = (vp.containerHeight / 2 - vp.positionY) / vp.scale;
        const startX = Math.round(centerX - size.w / 2);
        const startY = Math.round(centerY - size.h / 2);

        const occupiedRects = items
            .filter((it) => it.canvas?.x != null && it.canvas?.y != null)
            .map((it) => ({
                x: it.canvas.x,
                y: it.canvas.y,
                w: it.canvas.w || (defaultSizes[it.type] || defaultSizes.text).w,
                h: it.canvas.h || (defaultSizes[it.type] || defaultSizes.text).h,
            }));

        const overlaps = (ax, ay, aw, ah) =>
            occupiedRects.some((r) =>
                ax < r.x + r.w + 20 && ax + aw + 20 > r.x &&
                ay < r.y + r.h + 20 && ay + ah + 20 > r.y
            );

        if (!overlaps(startX, startY, size.w, size.h)) {
            return { x: startX, y: startY, ...size, z: 1 };
        }

        // Spiral outward to find a free spot
        const step = 40;
        for (let ring = 1; ring <= 20; ring++) {
            for (let dx = -ring; dx <= ring; dx++) {
                for (let dy = -ring; dy <= ring; dy++) {
                    if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
                    const cx = startX + dx * step;
                    const cy = startY + dy * step;
                    if (!overlaps(cx, cy, size.w, size.h)) {
                        return { x: cx, y: cy, ...size, z: 1 };
                    }
                }
            }
        }

        return { x: startX + 40, y: startY + 40, ...size, z: 1 };
    }, [items]);

    const createCanvasNote = useCallback(async () => {
        if (!activeWorkspaceId) {
            setToast({ message: 'Select a workspace first', type: 'error' });
            return;
        }
        const canvas = getCanvasPlacement('text');
        const newItem = {
            type: 'text',
            content: '',
            sourceUrl: 'note',
            workspaceId: activeWorkspaceId,
            projectId: null,
            collectionId: selectedCollectionId === '__unsorted__' ? null : selectedCollectionId,
            createdAt: Date.now(),
            canvas,
        };
        try {
            const saved = await saveItemWithTags(newItem, null);
            if (saved) {
                setItems((prev) => [saved, ...prev]);
                setCanvasInlineEditId(saved.id);
            }
        } catch (error) {
            setToast({ message: error?.message || 'Failed to create note', type: 'error' });
        }
    }, [activeWorkspaceId, selectedCollectionId, getCanvasPlacement]);

    const createGridNote = useCallback(async () => {
        if (!activeWorkspaceId) {
            setToast({ message: 'Select a workspace first', type: 'error' });
            return;
        }
        const newItem = {
            type: 'text',
            content: '',
            sourceUrl: 'note',
            workspaceId: activeWorkspaceId,
            projectId: null,
            collectionId: selectedCollectionId === '__unsorted__' ? null : selectedCollectionId,
            createdAt: Date.now(),
        };
        try {
            const saved = await saveItemWithTags(newItem, null);
            if (saved) {
                setItems((prev) => [saved, ...prev]);
                setGridInlineEditId(saved.id);
            }
        } catch (error) {
            setToast({ message: error?.message || 'Failed to create note', type: 'error' });
        }
    }, [activeWorkspaceId, selectedCollectionId]);

    // Shared image save helper — used by both paste and drag-and-drop
    const saveImageFromBlob = useCallback(async (blob) => {
        if (!activeWorkspaceId) {
            setToast({ message: 'Select a workspace first', type: 'error' });
            return;
        }

        if (!blob) {
            setToast({ message: 'Could not read image data', type: 'error' });
            return;
        }

        const tempId = crypto.randomUUID();
        const blobUrl = URL.createObjectURL(blob);
        const placeholderItem = {
            id: tempId,
            type: 'image',
            content: blobUrl,
            sourceUrl: blob.name || 'clipboard',
            workspaceId: activeWorkspaceId,
            projectId: null,
            collectionId: selectedCollectionId === '__unsorted__' ? null : selectedCollectionId,
            tags: [],
            createdAt: Date.now(),
            isLoading: true,
        };
        setItems((prev) => [placeholderItem, ...prev]);

        try {
            const compressedBlob = blob.size > 2 * 1024 * 1024
                ? await compressImage(blob, { maxDimension: 1600, quality: 0.78, mimeType: 'image/jpeg' })
                : blob;

            const base64 = await blobToDataUrl(compressedBlob);
            if (!base64 || typeof base64 !== 'string') {
                throw new Error('Failed to parse image');
            }

            const newItem = {
                id: tempId,
                type: 'image',
                content: base64,
                sourceUrl: blob.name || 'clipboard',
                workspaceId: activeWorkspaceId,
                projectId: null,
                collectionId: selectedCollectionId === '__unsorted__' ? null : selectedCollectionId,
                tags: [],
                createdAt: Date.now(),
                ...(viewMode === 'canvas' ? { canvas: getCanvasPlacement('image') } : {}),
            };
            const saved = await saveItemWithTags(newItem, null);
            if (saved) {
                setItems((prev) => prev.map((item) => item.id === tempId ? saved : item));
            } else {
                setItems((prev) => prev.filter((item) => item.id !== tempId));
            }
            setToast({ message: 'Image saved', type: 'success' });
        } catch (error) {
            setItems((prev) => prev.filter((item) => item.id !== tempId));
            setToast({ message: error?.message || 'Failed to save image', type: 'error' });
        } finally {
            URL.revokeObjectURL(blobUrl);
        }
    }, [activeWorkspaceId, selectedCollectionId, viewMode, getCanvasPlacement]);

    // Drag-and-drop file handler
    const [isDragging, setIsDragging] = useState(false);

    const handleFileDrop = useCallback(async (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                await saveImageFromBlob(file);
            }
        }
    }, [saveImageFromBlob]);

    const saveLink = useCallback(async (url) => {
        if (!activeWorkspaceId) {
            setToast({ message: 'Select a workspace first', type: 'error' });
            return;
        }

        const tempId = crypto.randomUUID();
        const placeholderItem = {
            id: tempId,
            type: 'link',
            content: url,
            sourceUrl: url,
            linkViewMode: 'preview',
            workspaceId: activeWorkspaceId,
            projectId: null,
            collectionId: selectedCollectionId === '__unsorted__' ? null : selectedCollectionId,
            createdAt: Date.now(),
            isLoading: true,
        };
        setItems((prev) => [placeholderItem, ...prev]);

        try {
            let ogMeta = { title: null, image: null, description: null };
            try {
                const res = await fetch(`/api/og?url=${encodeURIComponent(url)}`);
                if (res.ok) ogMeta = await res.json();
            } catch (ogErr) {
                console.warn('OG fetch failed:', ogErr);
            }

            const newItem = {
                id: tempId,
                type: 'link',
                content: url,
                sourceUrl: url,
                title: ogMeta.title || null,
                description: ogMeta.description || null,
                thumbnail: ogMeta.image || null,
                linkViewMode: 'preview',
                workspaceId: activeWorkspaceId,
                projectId: null,
                collectionId: selectedCollectionId === '__unsorted__' ? null : selectedCollectionId,
                createdAt: Date.now(),
                ...(viewMode === 'canvas' ? { canvas: getCanvasPlacement('link') } : {}),
            };

            const saved = await saveItemWithTags(newItem, null);
            if (saved) {
                setItems((prev) => prev.map((item) => item.id === tempId ? saved : item));
            } else {
                setItems((prev) => prev.filter((item) => item.id !== tempId));
            }
            setToast({ message: 'Link saved', type: 'success' });
        } catch (error) {
            console.error('Save failed:', error);
            setItems((prev) => prev.filter((item) => item.id !== tempId));
            setToast({ message: error?.message || 'Failed to save link', type: 'error' });
        }
    }, [activeWorkspaceId, selectedCollectionId, viewMode, getCanvasPlacement]);

    const saveText = useCallback(async (text, source = 'clipboard') => {
        if (!activeWorkspaceId) {
            setToast({ message: 'Select a workspace first', type: 'error' });
            return;
        }

        const newItem = {
            type: 'text',
            content: text,
            sourceUrl: source,
            workspaceId: activeWorkspaceId,
            projectId: null,
            collectionId: selectedCollectionId === '__unsorted__' ? null : selectedCollectionId,
            createdAt: Date.now(),
            ...(viewMode === 'canvas' ? { canvas: getCanvasPlacement('text') } : {}),
        };
        try {
            const saved = await saveItemWithTags(newItem, null);
            if (saved) setItems((prev) => [saved, ...prev]);
            setToast({ message: source === 'note' ? 'Note created' : 'Text saved', type: 'success' });
        } catch (error) {
            setToast({ message: error?.message || 'Failed to save text', type: 'error' });
        }
    }, [activeWorkspaceId, selectedCollectionId, viewMode, getCanvasPlacement]);

    const saveColor = useCallback(async (hexColor) => {
        if (!activeWorkspaceId) {
            setToast({ message: 'Select a workspace first', type: 'error' });
            return;
        }

        const newItem = {
            type: 'color',
            content: hexColor,
            sourceUrl: 'color-picker',
            workspaceId: activeWorkspaceId,
            projectId: null,
            collectionId: selectedCollectionId === '__unsorted__' ? null : selectedCollectionId,
            createdAt: Date.now(),
            ...(viewMode === 'canvas' ? { canvas: getCanvasPlacement('color') } : {}),
        };
        try {
            const saved = await saveItemWithTags(newItem, null);
            if (saved) setItems((prev) => [saved, ...prev]);
            setToast({ message: 'Color saved', type: 'success' });
        } catch (error) {
            setToast({ message: error?.message || 'Failed to save color', type: 'error' });
        }
    }, [activeWorkspaceId, selectedCollectionId, viewMode, getCanvasPlacement]);

    const handlePasteClipboard = useCallback(async () => {
        try {
            const clipboardItems = await navigator.clipboard.read();
            for (const clipItem of clipboardItems) {
                // Check for images first
                const imageType = clipItem.types.find(t => t.startsWith('image/'));
                if (imageType) {
                    const blob = await clipItem.getType(imageType);
                    await saveImageFromBlob(blob);
                    return;
                }
                // Fall back to text
                if (clipItem.types.includes('text/plain')) {
                    const blob = await clipItem.getType('text/plain');
                    const text = await blob.text();
                    const trimmed = text.trim();
                    if (!trimmed) continue;
                    try {
                        const url = new URL(trimmed);
                        if (['http:', 'https:'].includes(url.protocol)) {
                            await saveLink(trimmed);
                            return;
                        }
                    } catch {}
                    await saveText(trimmed);
                    return;
                }
            }
            setToast({ message: 'Nothing to paste', type: 'info' });
        } catch (err) {
            // Clipboard API may require user gesture or permission
            setToast({ message: 'Could not read clipboard', type: 'error' });
        }
    }, [saveImageFromBlob, saveLink, saveText]);

    // Clipboard Paste Listener
    useEffect(() => {
        const isURL = (text) => {
            try {
                const url = new URL(text);
                return ['http:', 'https:'].includes(url.protocol);
            } catch {
                return false;
            }
        };

        const saveImageFromBase64 = async (base64Data) => {
            try {
                const response = await fetch(base64Data);
                const blob = await response.blob();
                await saveImageFromBlob(blob);
            } catch (error) {
                setToast({ message: error?.message || 'Failed to paste image', type: 'error' });
            }
        };

        const processClipboard = async (clipboardData) => {
            const items = clipboardData.items;
            const files = clipboardData.files;

            if (files && files.length > 0) {
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    if (file && file.type && file.type.startsWith('image/')) {
                        await saveImageFromBlob(file);
                        return;
                    }
                }
            }

            for (let i = 0; i < items.length; i++) {
                if (items[i].type.startsWith('image')) {
                    const blob = items[i].getAsFile();
                    await saveImageFromBlob(blob);
                    return;
                }
            }

            const htmlContent = clipboardData.getData('text/html');
            if (htmlContent) {
                if (htmlContent.includes('figmeta') || htmlContent.includes('fig-kiwie')) {
                    setToast({
                        message: 'Figma uses a proprietary format. Use "Copy as PNG" or export the image first.',
                        type: 'info'
                    });
                    return;
                }

                const base64Match = htmlContent.match(/src=["']?(data:image\/[^"'\s>]+)["']?/i);
                if (base64Match && base64Match[1]) {
                    await saveImageFromBase64(base64Match[1]);
                    return;
                }

                const imgMatch = htmlContent.match(/<img[^>]+src=["']?(https?:\/\/[^"'\s>]+)["']?/i);
                if (imgMatch && imgMatch[1]) {
                    await saveLink(imgMatch[1]);
                    return;
                }
            }

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

        const handlePaste = async (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName) || e.target.isContentEditable) {
                return;
            }
            e.preventDefault();
            await processClipboard(e.clipboardData);
        };

        document.addEventListener('paste', handlePaste);
        return () => document.removeEventListener('paste', handlePaste);
    }, [activeWorkspaceId, saveImageFromBlob, saveLink, saveText]);

    const handleClear = async () => {
        try {
            await clearItems();
        } catch (err) {
            console.error('clearItems failed:', err);
        }
        await loadData();
    };

    const handleDelete = async (id) => {
        const removedItem = items.find((item) => item.id === id);
        try {
            await deleteItemFromDb(id);
            setItems((prev) => prev.filter((item) => item.id !== id));
            // Clean up storage media if it was a Supabase path
            if (removedItem?.content && !removedItem.content.startsWith('data:') && !removedItem.content.startsWith('http')) {
                void deleteMedia(removedItem.content).catch(() => {});
            }
            if (removedItem?.thumbnail && !removedItem.thumbnail.startsWith('data:') && !removedItem.thumbnail.startsWith('http')) {
                void deleteMedia(removedItem.thumbnail).catch(() => {});
            }
        } catch (err) {
            console.error('handleDelete failed:', err);
        }
    };

    const handleUpdateItem = async (id, updates) => {
        try {
            const updated = await updateItem(id, updates);
            if (updated) {
                setItems((prev) => prev.map((item) => item.id === id ? updated : item));
            }
        } catch (err) {
            console.error('handleUpdateItem failed:', err);
        }
    };

    const getWorkspaceName = (id) => {
        const ws = workspaces.find(ws => ws.id === id);
        return ws ? ws.name : null;
    };

    const getDefaultProjectName = () => {
        const base = 'New Folder';
        const existing = new Set(
            workspaceProjects
                .map((project) => String(project?.name || '').trim().toLowerCase())
                .filter(Boolean)
        );

        if (!existing.has(base.toLowerCase())) return base;
        for (let i = 2; i < 1000; i += 1) {
            const candidate = `${base} ${i}`;
            if (!existing.has(candidate.toLowerCase())) return candidate;
        }
        return `${base} ${Date.now()}`;
    };

    const getDefaultCollectionName = (projectId = null) => {
        const base = 'New Collection';
        const scopedCollections = projectId
            ? workspaceCollections.filter((collection) => collection.projectId === projectId)
            : workspaceCollections;
        const existing = new Set(
            scopedCollections
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

    const handleCreateProject = async (requestedNameInput = null) => {
        if (!activeWorkspaceId) return;
        if (requestedNameInput !== null && !String(requestedNameInput || '').trim()) return;

        const suggestedName = getDefaultProjectName();
        let requestedName = requestedNameInput;
        if (requestedNameInput === null) {
            try {
                requestedName = prompt('Folder name:', suggestedName);
            } catch {
                requestedName = suggestedName;
            }
        }

        const finalName = String(requestedName || '').trim() || suggestedName;

        try {
            const created = await createProject(activeWorkspaceId, finalName);
            if (!created) throw new Error('Project folder was not created.');
            setProjects((prev) => [created, ...prev.filter((project) => project.id !== created.id)]);
            setToast({ message: `Created folder "${created.name}"`, type: 'success' });
        } catch (error) {
            setToast({ message: error?.message || 'Failed to create folder', type: 'error' });
        }
    };

    const handleRenameProject = async (project, nextNameInput) => {
        const nextName = typeof nextNameInput === 'string'
            ? nextNameInput
            : prompt('Rename folder:', project?.name || '');
        if (!nextName || !nextName.trim()) return;
        const updated = await updateProject(project.id, { name: nextName.trim() });
        if (updated) {
            setProjects((prev) => prev.map((candidate) => (
                candidate.id === updated.id ? updated : candidate
            )));
            setToast({ message: `Renamed folder to "${updated.name}"`, type: 'success' });
        }
    };

    const handleDeleteProject = async (project) => {
        if (!project?.id) return;
        const hasCollections = workspaceCollections.some((collection) => collection.projectId === project.id);
        if (hasCollections) {
            setToast({ message: 'Folder must be empty before deletion', type: 'error' });
            return;
        }

        const confirmed = window.confirm(`Delete folder "${project.name}"?`);
        if (!confirmed) return;

        const deleted = await deleteProject(project.id);
        if (!deleted) {
            setToast({ message: 'Failed to delete folder', type: 'error' });
            return;
        }

        setProjects((prev) => prev.filter((candidate) => candidate.id !== project.id));
        setToast({ message: `Deleted folder "${project.name}"`, type: 'success' });
    };

    const handleCollectionReorder = async ({
        collectionId,
        targetCollectionId = null,
        targetProjectId = null,
        position = 'before',
    }) => {
        const { nextCollections, changes } = computeCollectionReorder(collections, {
            collectionId,
            targetCollectionId,
            targetProjectId,
            position,
        });
        if (!changes.length) return;
        setCollections(nextCollections);

        try {
            const persisted = await Promise.all(
                changes.map((change) => (
                    updateCollection(change.id, {
                        projectId: change.projectId,
                        sortOrder: change.sortOrder,
                    })
                ))
            );
            const persistedById = new Map(
                persisted
                    .filter(Boolean)
                    .map((collection) => [collection.id, collection])
            );
            if (persistedById.size > 0) {
                setCollections((prev) => prev.map((collection) => (
                    persistedById.get(collection.id) || collection
                )));
            }
        } catch (error) {
            setToast({ message: error?.message || 'Failed to reorder collections', type: 'error' });
            await loadData();
        }
    };

    const handleMoveCollectionToProject = async (collection, nextProjectId) => {
        if (!collection?.id || !nextProjectId) return;
        if (collection.projectId === nextProjectId) return;
        const targetProject = workspaceProjects.find((project) => project.id === nextProjectId);
        if (!targetProject) {
            setToast({ message: 'Target folder not found', type: 'error' });
            return;
        }

        await handleCollectionReorder({
            collectionId: collection.id,
            targetProjectId: nextProjectId,
            targetCollectionId: null,
            position: 'after',
        });
        setToast({ message: `Moved "${collection.name}" to "${targetProject.name}"`, type: 'success' });
    };

    const canGoBack = Boolean(selectedCollectionId);

    const headerTitle = selectedCollectionId
        ? (activeCollection?.name || 'Collection')
        : 'All Items';

    const headerSubtitle = selectedCollectionId
        ? `Collection in ${getWorkspaceName(activeWorkspaceId) || 'workspace'}`
        : `${workspaceItemCount} items in ${getWorkspaceName(activeWorkspaceId) || 'workspace'}`;

    const handleBackNavigate = () => {
        if (selectedCollectionId) {
            setSelectedCollectionId(null);
        }
    };

    const handleFinishGridEdit = useCallback(async (itemId, newContent) => {
        setGridInlineEditId(null);
        if (newContent !== undefined) {
            const trimmed = String(newContent).trim();
            if (!trimmed) {
                // Empty note — delete it
                try {
                    await deleteItemFromDb(itemId);
                    setItems((prev) => prev.filter((i) => i.id !== itemId));
                } catch {}
                return;
            }
            await updateItem(itemId, { content: trimmed });
            setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, content: trimmed } : i));
        }
    }, []);

    const handleOpenItemDetails = useCallback((itemOrId) => {
        const itemId = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
        if (!itemId) return;
        const liveItem = items.find((candidate) => candidate.id === itemId);
        if (!liveItem) return;
        if (viewMode === 'canvas') {
            setDetailPanelItem(liveItem);
        } else {
            setEditingItem(liveItem);
        }
    }, [items, viewMode]);

    const handleCanvasTitleSave = useCallback(async () => {
        if (!activeCollection || !activeCollection.id || activeCollection.id === '__unsorted__') {
            setIsCanvasTitleEditing(false);
            return;
        }
        const nextName = canvasTitleDraft.trim();
        if (!nextName || nextName === activeCollection.name) {
            setCanvasTitleDraft(activeCollection.name);
            setIsCanvasTitleEditing(false);
            return;
        }
        const updated = await updateCollection(activeCollection.id, { name: nextName });
        if (updated) {
            setCollections((prev) => prev.map((collection) => (
                collection.id === updated.id ? updated : collection
            )));
            setToast({ message: `Renamed to "${updated.name}"`, type: 'success' });
        }
        setIsCanvasTitleEditing(false);
    }, [activeCollection, canvasTitleDraft]);

    const handleCanvasTitleCancel = useCallback(() => {
        setCanvasTitleDraft(activeCollection?.name || 'All Items');
        setIsCanvasTitleEditing(false);
    }, [activeCollection?.name]);

    const handleCreateCollection = async (projectId, requestedNameInput = null) => {
        if (!activeWorkspaceId) return;
        if (!projectId) {
            setToast({ message: 'Choose a folder first', type: 'error' });
            return;
        }
        const targetProject = workspaceProjects.find((project) => project.id === projectId);
        if (!targetProject) {
            setToast({ message: 'Folder not found in this workspace', type: 'error' });
            return;
        }
        if (requestedNameInput !== null && !String(requestedNameInput || '').trim()) return;

        const suggestedName = getDefaultCollectionName(projectId);
        let requestedName = requestedNameInput;
        if (requestedNameInput === null) {
            try {
                requestedName = prompt('Collection name:', suggestedName);
            } catch {
                requestedName = suggestedName;
            }
        }

        const finalName = String(requestedName || '').trim() || suggestedName;

        try {
            const maxSortOrder = workspaceCollections
                .filter((collection) => collection.projectId === projectId)
                .reduce((max, collection) => (
                    Math.max(max, Number.isFinite(Number(collection.sortOrder)) ? Number(collection.sortOrder) : 0)
                ), 0);
            const created = await createCollection(
                activeWorkspaceId,
                projectId,
                finalName,
                maxSortOrder + COLLECTION_SORT_STEP
            );
            if (!created) throw new Error('Collection was not created.');
            setCollections((prev) => [created, ...prev.filter((collection) => collection.id !== created.id)]);
            setSelectedCollectionId(created.id);
            setToast({ message: `Created collection "${created.name}"`, type: 'success' });
        } catch (error) {
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

    const safeExportFilename = useCallback((value) => String(value || 'selection')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80) || 'selection', []);

    const getExportTitleForItem = useCallback((item) => {
        const explicitTitle = String(item?.title || '').trim();
        if (explicitTitle) return explicitTitle;
        if (item?.sourceUrl) {
            try {
                return new URL(item.sourceUrl).hostname.replace(/^www\./, '') || 'image';
            } catch {
                return 'image';
            }
        }
        return 'image';
    }, []);

    const selectedItemsData = useMemo(
        () => items.filter((item) => selectedItems.has(item.id)),
        [items, selectedItems]
    );

    const hasDownloadableSelection = useMemo(
        () => selectedItemsData.some((item) => item.type === 'image' || (item.type === 'link' && Boolean(item.thumbnail))),
        [selectedItemsData]
    );

    const handleBulkDelete = useCallback(async () => {
        if (selectedItems.size === 0) return;

        const count = selectedItems.size;
        const removedItems = items.filter(item => selectedItems.has(item.id));

        try {
            await Promise.all(removedItems.map(async (item) => {
                await deleteItemFromDb(item.id);
                if (item.content && !item.content.startsWith('data:') && !item.content.startsWith('http')) {
                    void deleteMedia(item.content).catch(() => {});
                }
                if (item.thumbnail && !item.thumbnail.startsWith('data:') && !item.thumbnail.startsWith('http')) {
                    void deleteMedia(item.thumbnail).catch(() => {});
                }
            }));
            setItems((prev) => prev.filter((item) => !selectedItems.has(item.id)));
        } catch (err) {
            console.error('handleBulkDelete failed:', err);
        }

        clearSelection();
        setToast({ message: `Deleted ${count} item${count !== 1 ? 's' : ''}`, type: 'success' });
    }, [items, selectedItems, clearSelection]);

    const handleCopySelection = useCallback(async () => {
        if (selectedItems.size === 0) return;

        const selectedItemsList = items.filter(item => selectedItems.has(item.id));
        const imageItem = selectedItemsList.find(item => item.type === 'image');

        if (!imageItem) {
            const textLikeItem = selectedItemsList.find(item => item.type === 'text' || item.type === 'link');
            if (textLikeItem) {
                await navigator.clipboard.writeText(textLikeItem.content || textLikeItem.sourceUrl || '');
                setToast({ message: 'Text copied to clipboard', type: 'success' });
            } else {
                setToast({ message: 'Nothing to copy', type: 'error' });
            }
            return;
        }

        try {
            const blob = await fetchImageViaProxy(imageItem.content);
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
        const exportableItems = selectedItemsList.filter(
            item => item.type === 'image' || (item.type === 'link' && Boolean(item.thumbnail))
        );

        if (exportableItems.length === 0) {
            setToast({ message: 'No images or thumbnails to download', type: 'error' });
            return;
        }

        // Single item: direct download
        if (exportableItems.length === 1) {
            const item = exportableItems[0];
            const source = item.type === 'image' ? item.content : item.thumbnail;

            if (!source) {
                setToast({ message: 'No image source found', type: 'error' });
                return;
            }

            const blob = await fetchImageViaProxy(source);
            const inferredType = blob.type || '';
            const ext = inferredType.includes('png') ? 'png'
                : inferredType.includes('gif') ? 'gif'
                    : inferredType.includes('webp') ? 'webp'
                        : inferredType.includes('jpeg') ? 'jpg'
                            : (source.includes('.png') ? 'png'
                                : source.includes('.gif') ? 'gif'
                                    : source.includes('.webp') ? 'webp'
                                        : 'jpg');
            const filename = `${safeExportFilename(getExportTitleForItem(item))}-${item.id.slice(0, 8)}.${ext}`;
            saveAs(blob, filename);

            setToast({ message: 'Downloaded image', type: 'success' });
            clearSelection();
            return;
        }

        // Multiple items: ZIP download
        setIsExporting(true);

        try {
            const exportName = selectedCollectionId
                ? (activeCollection?.name || getWorkspaceName(activeWorkspaceId) || 'dreamlab')
                : (getWorkspaceName(activeWorkspaceId) || 'dreamlab');

            const result = await exportItemsAsZip(
                exportableItems,
                exportName,
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
    }, [items, selectedItems, activeWorkspaceId, clearSelection, safeExportFilename, getExportTitleForItem]);

    const handleAddTags = useCallback(async () => {
        const tag = prompt('Enter tag to add to selected items:');
        if (!tag || tag.trim() === '') return;

        const trimmedTag = tag.trim();
        if (trimmedTag.includes(',')) {
            setToast({ message: 'Commas are not allowed in tags', type: 'error' });
            return;
        }

        await Promise.all([...selectedItems].map(async (itemId) => {
            const item = items.find(i => i.id === itemId);
            if (item) {
                const currentTags = item.tags || [];
                if (!currentTags.includes(trimmedTag)) {
                    await updateItem(itemId, { tags: [...currentTags, trimmedTag] });
                }
            }
        }));

        setToast({ message: `Added tag "${trimmedTag}" to ${selectedItems.size} items`, type: 'success' });
        clearSelection();
    }, [items, selectedItems, clearSelection]);

    useEffect(() => {
        clearSelection();
    }, [selectedCollectionId, clearSelection]);

    // Auth gating: loading state
    if (user === undefined) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-default-background">
                <span className="text-subtext-color">Loading...</span>
            </div>
        );
    }

    // Auth gating: not logged in
    if (!user) {
        return <AuthScreen />;
    }

    return (
        <div
            className="flex h-screen w-screen overflow-hidden bg-default-background pl-[68px]"
            onWheelCapture={handleCanvasModeWheelCapture}
        >
            <MigrationBanner onComplete={async (res) => {
                await loadData();
                // After migration, switch to a workspace that has items
                if (res && res.workspaces > 0) {
                    const allWs = await getWorkspaces();
                    const allItems = await getItems();
                    const wsWithItems = allWs.find(ws =>
                        allItems.some(item => item.workspaceId === ws.id)
                    );
                    if (wsWithItems) {
                        setActiveWorkspaceId(wsWithItems.id);
                        setSelectedCollectionId(null);
                    }
                }
            }} />
            <WorkspaceStrip
                workspaces={workspaces}
                activeWorkspaceId={activeWorkspaceId}
                onWorkspaceChange={(workspaceId) => {
                    setActiveWorkspaceId(workspaceId);
                    setSelectedCollectionId(null);
                }}
                onAddWorkspace={async () => {
                    const name = prompt('Workspace Name:');
                    if (name) await createWorkspace(name);
                }}
                lockScroll={viewMode === 'canvas'}
            />
            {/* Sidebar is hidden on mobile in Subframe example, but we keep it responsive or as is */}
            <Sidebar
                projects={workspaceProjects}
                collections={workspaceCollections}
                selectedCollectionId={selectedCollectionId}
                onAllItems={() => {
                    setSelectedCollectionId(null);
                }}
                onProjectCreate={(projectName) => {
                    void handleCreateProject(projectName);
                }}
                onProjectRename={(project, nextName) => {
                    void handleRenameProject(project, nextName);
                }}
                onProjectDelete={(project) => {
                    void handleDeleteProject(project);
                }}
                onCollectionSelect={(collectionId) => {
                    setSelectedCollectionId(collectionId);
                }}
                onCollectionRename={async (collection, nextNameInput) => {
                    const nextName = typeof nextNameInput === 'string'
                        ? nextNameInput
                        : prompt('Rename collection:', collection?.name || '');
                    if (!nextName || !nextName.trim()) return;
                    const updated = await updateCollection(collection.id, { name: nextName.trim() });
                    if (updated) {
                        setCollections((prev) => prev.map((candidate) => (
                            candidate.id === updated.id ? updated : candidate
                        )));
                        setToast({ message: `Renamed to "${updated.name}"`, type: 'success' });
                    }
                }}
                onCollectionDelete={async (collection) => {
                    if (!collection?.id) return;
                    const confirmed = window.confirm(
                        `Delete "${collection.name}" and all items inside it? This cannot be undone.`
                    );
                    if (!confirmed) return;

                    try {
                        const { deletedItems } = await deleteCollection(collection.id, { moveItemsToUnsorted: false });

                        // Clean up media files in storage
                        for (const item of deletedItems) {
                            if (item.content && !item.content.startsWith('data:') && !item.content.startsWith('http')) {
                                void deleteMedia(item.content).catch(() => {});
                            }
                            if (item.thumbnail && !item.thumbnail.startsWith('data:') && !item.thumbnail.startsWith('http')) {
                                void deleteMedia(item.thumbnail).catch(() => {});
                            }
                        }

                        // Update local state immediately
                        const deletedIds = new Set(deletedItems.map((i) => i.id));
                        setItems((prev) => prev.filter((item) => !deletedIds.has(item.id)));
                        setCollections((prev) => prev.filter((candidate) => candidate.id !== collection.id));

                        if (selectedCollectionId === collection.id) {
                            setSelectedCollectionId(null);
                        }
                        setToast({ message: `Deleted "${collection.name}" and its items`, type: 'success' });
                    } catch (error) {
                        setToast({ message: error?.message || 'Failed to delete collection', type: 'error' });
                    }
                }}
                onCreateCollection={(projectId, collectionName) => {
                    void handleCreateCollection(projectId, collectionName);
                }}
                onCollectionMove={(collection, nextProjectId) => {
                    void handleMoveCollectionToProject(collection, nextProjectId);
                }}
                onCollectionReorder={(payload) => {
                    void handleCollectionReorder(payload);
                }}
                activeWorkspaceId={activeWorkspaceId}
                activeWorkspaceName={getWorkspaceName(activeWorkspaceId)}
                onOpenSettings={() => setShowSettings(true)}
                totalItemCount={workspaceItemCount}
                lockScroll={viewMode === 'canvas'}
            />

            <main
                className="flex grow shrink basis-0 min-w-0 flex-col items-start self-stretch overflow-hidden relative bg-white"
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDragging(false); }}
                onDrop={handleFileDrop}
            >
                {isDragging && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-50/80 border-2 border-dashed border-blue-400 rounded-lg pointer-events-none">
                        <p className="text-blue-600 text-lg font-medium">Drop image to add to collection</p>
                    </div>
                )}
                {viewMode !== 'canvas' && (
                    <div className="flex w-full flex-col items-start gap-4 px-8 pt-8 pb-4">
                        {selectedCollectionId ? (
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
                                                setSelectedCollectionId(null);
                                            }}
                                        >
                                            {getWorkspaceName(activeWorkspaceId) || 'Workspace'}
                                        </button>
                                        <FeatherChevronRight className="text-caption font-caption text-neutral-400" />
                                        <span className="text-default-font">{activeCollection?.name || 'Collection'}</span>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                        <div className="flex w-full items-end justify-between">
                            <div className="flex flex-col items-start gap-1">
                                <span className="text-heading-1 font-heading-1 text-default-font">
                                    {headerTitle}
                                </span>
                                <span className="text-caption font-caption text-subtext-color">
                                    {headerSubtitle}
                                </span>
                            </div>
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
                            </div>
                        </div>
                        {tagFilter && (
                            <div className="flex items-center gap-2">
                                <Badge variant="neutral" onClick={() => setTagFilter(null)} className="cursor-pointer hover:bg-neutral-200">
                                    {tagFilter} <span className="ml-1">×</span>
                                </Badge>
                            </div>
                        )}
                    </div>
                )}

                {/* Content Area */}
                <div className={`relative flex w-full grow shrink-0 basis-0 flex-col items-start ${viewMode === 'canvas' ? 'overflow-hidden p-8' : 'overflow-y-auto px-8 pb-8'}`}>
                    <AnimatePresence mode="wait">
                        {viewMode === 'canvas' ? (
                            <motion.div
                                key="canvas"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="relative w-full h-full"
                            >
                                <div className="absolute left-4 top-4 z-20">
                                    <div
                                        className="flex min-w-[220px] max-w-[340px] items-center rounded-full border border-neutral-200 bg-white px-[30px] py-[16px] text-default-font shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {isCanvasTitleEditing ? (
                                            <input
                                                ref={canvasTitleInputRef}
                                                type="text"
                                                value={canvasTitleDraft}
                                                onChange={(e) => setCanvasTitleDraft(e.target.value)}
                                                onBlur={handleCanvasTitleSave}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleCanvasTitleSave();
                                                    } else if (e.key === 'Escape') {
                                                        e.preventDefault();
                                                        handleCanvasTitleCancel();
                                                    }
                                                }}
                                                className="w-full bg-transparent text-heading-2 font-semibold text-default-font outline-none"
                                            />
                                        ) : (
                                            <button
                                                type="button"
                                                className="w-full truncate text-left text-heading-2 font-semibold text-default-font"
                                                onClick={() => {
                                                    if (!activeCollection || activeCollection.id === '__unsorted__') return;
                                                    setIsCanvasTitleEditing(true);
                                                }}
                                                title={activeCollection?.name || 'All Items'}
                                            >
                                                {activeCollection?.name || 'All Items'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <CanvasView
                                    items={filteredItems}
                                    onUpdateItem={handleUpdateItem}
                                    onDeleteItem={handleDelete}
                                    onOpenItem={handleOpenItemDetails}
                                    detailPanelItemId={detailPanelItem?.id || null}
                                    viewportRef={canvasViewportRef}
                                    inlineEditingId={canvasInlineEditId}
                                    onFinishInlineEdit={() => setCanvasInlineEditId(null)}
                                />
                                <AnimatePresence>
                                    {detailPanelItem && (
                                        <CanvasDetailPanel
                                            item={detailPanelItem}
                                            onClose={() => setDetailPanelItem(null)}
                                            onExpand={() => {
                                                setEditingItem(detailPanelItem);
                                                setDetailPanelItem(null);
                                            }}
                                            onUpdate={(updated) => {
                                                handleUpdateItem(updated.id, updated);
                                                setDetailPanelItem(updated);
                                            }}
                                            onDelete={handleDelete}
                                            onToast={setToast}
                                        />
                                    )}
                                </AnimatePresence>
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
                                        onItemClick={handleOpenItemDetails}
                                        zoomLevel={zoomLevel[0]}
                                        selectedItems={selectedItems}
                                        onSelectItem={handleSelectItem}
                                        inlineEditingId={gridInlineEditId}
                                        onFinishInlineEdit={handleFinishGridEdit}
                                    />
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                </div>

                {/* Item Modal */}
                <AnimatePresence>
                    {editingItem && (
                        <ItemModal
                            item={editingItem}
                            onClose={() => setEditingItem(null)}
                            onToast={setToast}
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
                            onResetAllData={handleClear}
                            user={user}
                        />
                    )}
                </AnimatePresence>


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
                        showDownload={hasDownloadableSelection}
                    />
                ) : (
                    <div className="flex items-center gap-2 rounded-full border border-solid border-neutral-border bg-white px-3 py-2.5 absolute bottom-[46px] left-1/2 z-10 -translate-x-1/2 shadow-sm">
                        {searchExpanded ? (
                            <div className="flex items-center relative">
                                <TextField
                                    className="h-auto w-72"
                                    variant="outline"
                                    icon={<FeatherSearch />}
                                >
                                    <TextField.Input
                                        ref={searchInputRef}
                                        className="pr-8"
                                        placeholder="Search content, URLs, or tags..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Escape') {
                                                if (!searchQuery) setSearchExpanded(false);
                                                else setSearchQuery('');
                                            }
                                        }}
                                        onBlur={() => {
                                            if (!searchQuery) setSearchExpanded(false);
                                        }}
                                    />
                                </TextField>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setSearchExpanded(true); setTimeout(() => searchInputRef.current?.focus(), 0); }}
                                className="flex items-center gap-2 h-9 px-3 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
                                title="Search (⌘K)"
                            >
                                <FeatherSearch className="w-[18px] h-[18px]" />
                                <div className="flex items-center gap-0.5 rounded-md border border-solid border-neutral-200 bg-neutral-100 px-1.5 py-0.5">
                                    <span className="text-caption font-caption text-subtext-color">⌘</span>
                                    <span className="text-caption font-caption text-subtext-color">K</span>
                                </div>
                            </button>
                        )}
                        <div className="w-px h-6 bg-neutral-200" />
                        <CreateToolbar
                            onCreateNote={() => viewMode === 'canvas' ? createCanvasNote() : createGridNote()}
                            onUploadImage={(file) => saveImageFromBlob(file)}
                            onCreateLink={(url) => saveLink(url)}
                            onPasteClipboard={handlePasteClipboard}
                            onCreateColor={(hex) => saveColor(hex)}
                        />
                        <div className="w-px h-6 bg-neutral-200" />
                        <ToggleGroup value={viewMode} onValueChange={(value) => value && setViewMode(value)}>
                            <ToggleGroup.Item
                                icon={<FeatherLayoutGrid />}
                                value="grid"
                            />
                            <ToggleGroup.Item icon={<FeatherSquare />} value="canvas" />
                        </ToggleGroup>
                    </div>
                )}
            </main>
        </div>
    );
}

export default App;
