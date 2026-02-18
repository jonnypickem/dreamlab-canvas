import React, { useEffect, useMemo, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { ChatChannelsMenu } from '../ui/components/ChatChannelsMenu';
import { DropdownMenu } from '../ui/components/DropdownMenu';
import { IconButton } from '../ui/components/IconButton';
import { Avatar } from '../ui/components/Avatar';
import { Badge } from '../ui/components/Badge';
import { TextField } from '../ui/components/TextField';
import { getEntityColorToken, getEntityIconComponent } from '../utils/entityStyles';
import * as SubframeCore from "@subframe/core";
import {
    FeatherChevronDown,
    FeatherChevronRight,
    FeatherSearch,
    FeatherLayoutGrid,
    FeatherFolder,
    FeatherSettings,
    FeatherTrash,
    FeatherLogOut,
    FeatherPlus
} from "@subframe/core";

const UNGROUPED_COLLECTION_COMPOSER_ID = '__ungrouped__';

function formatShortcutPart(part) {
    const normalized = String(part || '').trim();
    const lower = normalized.toLowerCase();
    if (lower === 'command' || lower === 'cmd') return '⌘';
    if (lower === 'ctrl' || lower === 'control') return 'Ctrl';
    if (lower === 'alt' || lower === 'option') return '⌥';
    if (lower === 'shift') return '⇧';
    if (lower === 'up') return '↑';
    if (lower === 'down') return '↓';
    if (lower === 'left') return '←';
    if (lower === 'right') return '→';
    return normalized.length === 1 ? normalized.toUpperCase() : normalized;
}

function splitShortcutParts(shortcut) {
    const raw = String(shortcut || '').trim();
    if (!raw) return [];
    return raw.split('+').map(formatShortcutPart).filter(Boolean);
}

export default function Sidebar({
    projects = [],
    collections = [],
    extensionShortcuts = [],
    selectedCollectionId = null,
    selectedProjectId = null,
    onAllItems,
    onProjectSelect,
    onProjectCreate,
    onProjectRename,
    onProjectDelete,
    onCollectionSelect,
    onCollectionRename,
    onCollectionDelete,
    onCreateCollection,
    onCreateUngroupedCollection,
    onCollectionMove,
    onCollectionReorder,
    onOpenProjectSettings,
    onOpenCollectionSettings,
    projectIdToOpenCollectionComposer,
    onCollectionComposerOpened,
    activeWorkspaceId,
    activeWorkspaceName,
    onOpenSettings,
    totalItemCount = 0,
    lockScroll = false
}) {
    const [isAddingProject, setIsAddingProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const [addingCollectionProjectId, setAddingCollectionProjectId] = useState(null);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [editingProjectId, setEditingProjectId] = useState(null);
    const [editingProjectName, setEditingProjectName] = useState('');
    const [editingCollectionId, setEditingCollectionId] = useState(null);
    const [editingCollectionName, setEditingCollectionName] = useState('');
    const [collapsedProjects, setCollapsedProjects] = useState({});
    const [draggingCollectionId, setDraggingCollectionId] = useState(null);
    const [dropTarget, setDropTarget] = useState(null);
    const [projectDropTarget, setProjectDropTarget] = useState(null);

    useEffect(() => {
        setCollapsedProjects((prev) => {
            const next = {};
            projects.forEach((project) => {
                next[project.id] = Object.prototype.hasOwnProperty.call(prev, project.id)
                    ? prev[project.id]
                    : false;
            });
            return next;
        });
    }, [projects]);

    useEffect(() => {
        if (projectIdToOpenCollectionComposer === undefined) return;

        if (projectIdToOpenCollectionComposer === UNGROUPED_COLLECTION_COMPOSER_ID) {
            setAddingCollectionProjectId(UNGROUPED_COLLECTION_COMPOSER_ID);
            setNewCollectionName('');
            onCollectionComposerOpened?.(projectIdToOpenCollectionComposer);
            return;
        }

        const targetExists = projects.some((project) => project.id === projectIdToOpenCollectionComposer);
        if (targetExists) {
            setAddingCollectionProjectId(projectIdToOpenCollectionComposer);
            setCollapsedProjects((prev) => ({ ...prev, [projectIdToOpenCollectionComposer]: false }));
            setNewCollectionName('');
        }

        onCollectionComposerOpened?.(projectIdToOpenCollectionComposer);
    }, [projectIdToOpenCollectionComposer, projects, onCollectionComposerOpened]);

    const groupedCollections = useMemo(() => {
        const sortCollections = (list) => list.sort((a, b) => {
            const aOrder = Number.isFinite(Number(a?.sortOrder)) ? Number(a.sortOrder) : Number.MAX_SAFE_INTEGER;
            const bOrder = Number.isFinite(Number(b?.sortOrder)) ? Number(b.sortOrder) : Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return (a.createdAt || 0) - (b.createdAt || 0);
        });
        const map = new Map();
        projects.forEach((project) => map.set(project.id, []));
        const ungrouped = [];

        collections.forEach((collection) => {
            if (collection.projectId && map.has(collection.projectId)) {
                map.get(collection.projectId).push(collection);
            } else {
                ungrouped.push(collection);
            }
        });

        for (const [, entries] of map) {
            sortCollections(entries);
        }
        sortCollections(ungrouped);

        return { map, ungrouped };
    }, [projects, collections]);

    const workspaceInitials = activeWorkspaceName ? activeWorkspaceName.substring(0, 2).toUpperCase() : 'DL';

    const startProjectRename = (project) => {
        setEditingProjectId(project.id);
        setEditingProjectName(project.name || '');
    };

    const cancelProjectRename = () => {
        setEditingProjectId(null);
        setEditingProjectName('');
    };

    const submitProjectRename = (project) => {
        const nextName = editingProjectName.trim();
        if (!nextName || nextName === project.name) {
            cancelProjectRename();
            return;
        }
        if (onProjectRename) {
            onProjectRename(project, nextName);
        }
        cancelProjectRename();
    };

    const startCollectionRename = (collection) => {
        setEditingCollectionId(collection.id);
        setEditingCollectionName(collection.name || '');
    };

    const cancelCollectionRename = () => {
        setEditingCollectionId(null);
        setEditingCollectionName('');
    };

    const submitCollectionRename = (collection) => {
        const nextName = editingCollectionName.trim();
        if (!nextName || nextName === collection.name) {
            cancelCollectionRename();
            return;
        }
        if (onCollectionRename) {
            onCollectionRename(collection, nextName);
        }
        cancelCollectionRename();
    };

    const handleCreateProjectKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (newProjectName.trim() && activeWorkspaceId) {
                if (onProjectCreate) {
                    onProjectCreate(newProjectName.trim());
                }
                setNewProjectName('');
                setIsAddingProject(false);
            } else if (!activeWorkspaceId) {
                alert('Please select or create a workspace first.');
            }
        } else if (e.key === 'Escape') {
            setIsAddingProject(false);
            setNewProjectName('');
        }
    };

    const submitCollectionCreate = (projectId) => {
        const nextName = newCollectionName.trim();
        if (!nextName || !activeWorkspaceId) return;

        if (projectId === UNGROUPED_COLLECTION_COMPOSER_ID) {
            if (onCreateUngroupedCollection) {
                onCreateUngroupedCollection(nextName);
            } else if (onCreateCollection) {
                onCreateCollection(null, nextName);
            }
        } else if (onCreateCollection) {
            onCreateCollection(projectId, nextName);
        }

        setAddingCollectionProjectId(null);
        setNewCollectionName('');
    };

    const handleCreateCollectionKeyDown = (e, projectId) => {
        if (e.key === 'Enter') {
            if (newCollectionName.trim() && activeWorkspaceId) {
                submitCollectionCreate(projectId);
            } else if (!activeWorkspaceId) {
                alert('Please select or create a workspace first.');
            }
        } else if (e.key === 'Escape') {
            setAddingCollectionProjectId(null);
            setNewCollectionName('');
        }
    };

    const handleWheelCapture = (event) => {
        if (!lockScroll) return;
        event.preventDefault();
        event.stopPropagation();
    };

    const clearDragState = () => {
        setDraggingCollectionId(null);
        setDropTarget(null);
        setProjectDropTarget(null);
    };

    const handleCollectionDragStart = (event, collection) => {
        setDraggingCollectionId(collection.id);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', collection.id);
    };

    const handleCollectionDragEnd = () => {
        clearDragState();
    };

    const handleCollectionDragOver = (event, collection, projectId) => {
        if (!draggingCollectionId || draggingCollectionId === collection.id) return;
        event.preventDefault();
        event.stopPropagation();
        const rect = event.currentTarget.getBoundingClientRect();
        const position = event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
        setDropTarget({
            collectionId: collection.id,
            projectId: projectId || null,
            position,
        });
        setProjectDropTarget(null);
        event.dataTransfer.dropEffect = 'move';
    };

    const handleCollectionDrop = (event, collection, projectId) => {
        event.preventDefault();
        event.stopPropagation();
        const sourceCollectionId = draggingCollectionId || event.dataTransfer.getData('text/plain');
        if (!sourceCollectionId || sourceCollectionId === collection.id) {
            clearDragState();
            return;
        }

        const rect = event.currentTarget.getBoundingClientRect();
        const position = event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';

        if (onCollectionReorder) {
            onCollectionReorder({
                collectionId: sourceCollectionId,
                targetCollectionId: collection.id,
                targetProjectId: projectId || null,
                position,
            });
        }

        clearDragState();
    };

    const handleProjectDragOver = (event, projectId) => {
        if (!draggingCollectionId) return;
        event.preventDefault();
        setProjectDropTarget(projectId);
        setDropTarget(null);
        event.dataTransfer.dropEffect = 'move';
    };

    const handleProjectDrop = (event, projectId) => {
        if (!draggingCollectionId) return;
        event.preventDefault();
        const sourceCollectionId = draggingCollectionId || event.dataTransfer.getData('text/plain');
        if (!sourceCollectionId) {
            clearDragState();
            return;
        }

        if (onCollectionReorder) {
            onCollectionReorder({
                collectionId: sourceCollectionId,
                targetCollectionId: null,
                targetProjectId: projectId,
                position: 'after',
            });
        }

        clearDragState();
    };

    const renderEntityMarker = (IconComponent, colorToken) => {
        if (!IconComponent && !colorToken) {
            return null;
        }

        if (IconComponent && colorToken) {
            return (
                <span className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${colorToken.bgClass} ${colorToken.borderClass}`}>
                    <IconComponent className={`h-3.5 w-3.5 ${colorToken.iconClass}`} />
                </span>
            );
        }

        if (IconComponent) {
            return (
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white">
                    <IconComponent className="h-3.5 w-3.5 text-neutral-600" />
                </span>
            );
        }

        return (
            <span className={`inline-block h-3.5 w-3.5 shrink-0 rounded-full border ${colorToken.bgClass} ${colorToken.borderClass}`} />
        );
    };

    const shortcutRows = useMemo(
        () => (Array.isArray(extensionShortcuts) ? extensionShortcuts : []),
        [extensionShortcuts]
    );

    return (
        <aside
            className={`flex w-72 flex-none flex-col items-start gap-2 self-stretch bg-neutral-50 px-4 py-4 mobile:hidden ${lockScroll ? 'overflow-hidden' : ''}`}
            onWheelCapture={handleWheelCapture}
        >
            <div className="flex w-full items-center gap-4">
                <div className="flex grow shrink-0 basis-0 items-center gap-2 px-4 py-4">
                    <SubframeCore.DropdownMenu.Root>
                        <SubframeCore.DropdownMenu.Trigger asChild={true}>
                            <div className="flex items-center gap-2 cursor-pointer">
                                <span className="text-heading-3 font-heading-3 text-default-font">
                                    {activeWorkspaceName || 'Dreamlab'}
                                </span>
                                <FeatherChevronDown className="text-caption font-caption text-default-font" />
                            </div>
                        </SubframeCore.DropdownMenu.Trigger>
                        <SubframeCore.DropdownMenu.Portal>
                            <SubframeCore.DropdownMenu.Content
                                side="bottom"
                                align="start"
                                sideOffset={4}
                                asChild={true}
                            >
                                <DropdownMenu>
                                    <div className="flex w-full items-center gap-2 border-b border-solid border-neutral-border px-3 pt-3 pb-4">
                                        <Avatar
                                            variant="neutral"
                                            size="large"
                                            square={true}
                                        >
                                            {workspaceInitials}
                                        </Avatar>
                                        <div className="flex grow shrink-0 basis-0 flex-col items-start">
                                            <span className="line-clamp-1 w-full text-body-bold font-body-bold text-default-font">
                                                {activeWorkspaceName || 'Dreamlab'}
                                            </span>
                                            <span className="line-clamp-1 w-full text-caption font-caption text-subtext-color">
                                                {collections.length} collections
                                            </span>
                                        </div>
                                    </div>
                                    <DropdownMenu.DropdownItem
                                        icon={<FeatherSettings />}
                                        onClick={onOpenSettings}
                                    >
                                        Settings
                                    </DropdownMenu.DropdownItem>
                                    <DropdownMenu.DropdownItem
                                        icon={<FeatherLogOut />}
                                        onClick={async () => {
                                            const { supabase } = await import('../lib/supabase');
                                            await supabase.auth.signOut();
                                        }}
                                    >
                                        Sign out
                                    </DropdownMenu.DropdownItem>
                                </DropdownMenu>
                            </SubframeCore.DropdownMenu.Content>
                        </SubframeCore.DropdownMenu.Portal>
                    </SubframeCore.DropdownMenu.Root>
                </div>
                <IconButton
                    icon={<FeatherSearch />}
                    onClick={() => {
                        document.querySelector('input[placeholder*="Search"]')?.focus();
                    }}
                />
            </div>

            <ChatChannelsMenu className="w-full grow shrink-0 basis-0">
                <ChatChannelsMenu.Item
                    icon={<FeatherLayoutGrid />}
                    selected={!selectedCollectionId && !selectedProjectId}
                    onClick={() => onAllItems && onAllItems()}
                    rightSlot={<Badge variant="neutral">{totalItemCount}</Badge>}
                    className="rounded-full"
                >
                    All Items
                </ChatChannelsMenu.Item>

                <div className="mt-3 flex w-full flex-col gap-1">
                    <div className="flex h-8 w-full items-center justify-between px-3.5">
                        <span className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">Projects</span>
                        <IconButton
                            icon={<FeatherPlus />}
                            size="small"
                            className="h-7 w-7"
                            onClick={() => {
                                setIsAddingProject(true);
                            }}
                        />
                    </div>

                    {isAddingProject && (
                        <div className="px-3 py-1">
                            <TextField className="w-full">
                                <TextField.Input
                                    autoFocus
                                    type="text"
                                    placeholder="Folder name..."
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    onKeyDown={handleCreateProjectKeyDown}
                                    onBlur={() => {
                                        setIsAddingProject(false);
                                        setNewProjectName('');
                                    }}
                                />
                            </TextField>
                        </div>
                    )}

                    {projects.map((project) => {
                        const projectCollections = groupedCollections.map.get(project.id) || [];
                        const isCollapsed = Boolean(collapsedProjects[project.id]);
                        const moveTargets = projects.filter((candidate) => candidate.id !== project.id);
                        const isProjectSelected = selectedProjectId === project.id && !selectedCollectionId;
                        const ProjectIcon = getEntityIconComponent(project.iconKey, project.id, 'project');
                        const projectColor = getEntityColorToken(project.colorKey, project.id);

                        return (
                            <div
                                key={project.id}
                                className={`flex w-full flex-col gap-1 rounded-xl ${draggingCollectionId && projectDropTarget === project.id ? 'bg-orange-50/70' : ''}`}
                                onDragOver={(event) => handleProjectDragOver(event, project.id)}
                                onDrop={(event) => handleProjectDrop(event, project.id)}
                            >
                                <div className="group relative flex h-10 w-full items-center">
                                    {editingProjectId === project.id ? (
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editingProjectName}
                                            onChange={(e) => setEditingProjectName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    submitProjectRename(project);
                                                } else if (e.key === 'Escape') {
                                                    e.preventDefault();
                                                    cancelProjectRename();
                                                }
                                            }}
                                            onBlur={() => submitProjectRename(project)}
                                            className="h-10 w-full rounded-full border border-brand-300 bg-white px-3.5 text-body font-body text-default-font outline-none focus:border-brand-600"
                                        />
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                className={`h-10 w-full rounded-full border px-3.5 pr-28 text-left text-body font-body transition-colors ${
                                                    isProjectSelected
                                                        ? 'border-[#EA580C] bg-[rgba(234,88,12,0.01)] text-[#D94808]'
                                                        : 'border-transparent text-subtext-color hover:bg-neutral-100 hover:text-default-font'
                                                }`}
                                                onClick={() => onProjectSelect && onProjectSelect(project.id)}
                                                title={project.name}
                                            >
                                                <span className="truncate flex items-center gap-2">
                                                    {renderEntityMarker(ProjectIcon, projectColor)}
                                                    <span className="truncate">{project.name}</span>
                                                    <span className="text-[11px] text-neutral-400">{projectCollections.length}</span>
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="absolute right-2 top-1/2 z-10 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-neutral-400 hover:bg-neutral-100"
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    setCollapsedProjects((prev) => ({
                                                        ...prev,
                                                        [project.id]: !prev[project.id]
                                                    }));
                                                }}
                                                aria-label={isCollapsed ? 'Expand folder' : 'Collapse folder'}
                                            >
                                                {isCollapsed ? (
                                                    <FeatherChevronRight className="h-3 w-3 shrink-0 text-neutral-400" />
                                                ) : (
                                                    <FeatherChevronDown className="h-3 w-3 shrink-0 text-neutral-400" />
                                                )}
                                            </button>
                                            <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                                <IconButton
                                                    icon={<FeatherPlus />}
                                                    size="small"
                                                    className="h-7 w-7"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAddingCollectionProjectId(project.id);
                                                        setNewCollectionName('');
                                                        setCollapsedProjects((prev) => ({ ...prev, [project.id]: false }));
                                                    }}
                                                />
                                                <SubframeCore.DropdownMenu.Root>
                                                    <SubframeCore.DropdownMenu.Trigger asChild={true}>
                                                        <div>
                                                            <IconButton
                                                                icon={<MoreHorizontal className="w-3.5 h-3.5" />}
                                                                size="small"
                                                                className="h-7 w-7"
                                                            />
                                                        </div>
                                                    </SubframeCore.DropdownMenu.Trigger>
                                                    <SubframeCore.DropdownMenu.Portal>
                                                        <SubframeCore.DropdownMenu.Content
                                                            side="right"
                                                            align="start"
                                                            sideOffset={6}
                                                            asChild={true}
                                                        >
                                                            <DropdownMenu>
                                                                <DropdownMenu.DropdownItem
                                                                    icon={<FeatherSettings />}
                                                                    onClick={() => onOpenProjectSettings && onOpenProjectSettings(project)}
                                                                >
                                                                    Project Settings
                                                                </DropdownMenu.DropdownItem>
                                                            </DropdownMenu>
                                                        </SubframeCore.DropdownMenu.Content>
                                                    </SubframeCore.DropdownMenu.Portal>
                                                </SubframeCore.DropdownMenu.Root>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {addingCollectionProjectId === project.id && (
                                    <div className="px-3 py-1 pl-8">
                                        <TextField className="w-full">
                                            <TextField.Input
                                                autoFocus
                                                type="text"
                                                placeholder="Collection name..."
                                                value={newCollectionName}
                                                onChange={(e) => setNewCollectionName(e.target.value)}
                                                onKeyDown={(e) => handleCreateCollectionKeyDown(e, project.id)}
                                                onBlur={() => {
                                                    setAddingCollectionProjectId(null);
                                                    setNewCollectionName('');
                                                }}
                                            />
                                        </TextField>
                                    </div>
                                )}

                                {!isCollapsed && projectCollections.map((collection) => {
                                    const isDropBefore = dropTarget?.collectionId === collection.id
                                        && dropTarget?.projectId === project.id
                                        && dropTarget?.position === 'before';
                                    const isDropAfter = dropTarget?.collectionId === collection.id
                                        && dropTarget?.projectId === project.id
                                        && dropTarget?.position === 'after';
                                    const CollectionIcon = getEntityIconComponent(collection.iconKey, collection.id, 'collection');
                                    const collectionColor = getEntityColorToken(collection.colorKey, collection.id);

                                    return (
                                        <div
                                            key={collection.id}
                                            className="group relative flex h-10 w-full items-center pl-6"
                                            draggable={editingCollectionId !== collection.id}
                                            onDragStart={(event) => handleCollectionDragStart(event, collection)}
                                            onDragEnd={handleCollectionDragEnd}
                                            onDragOver={(event) => handleCollectionDragOver(event, collection, project.id)}
                                            onDrop={(event) => handleCollectionDrop(event, collection, project.id)}
                                            style={isDropBefore
                                                ? { boxShadow: 'inset 0 2px 0 #EA580C' }
                                                : isDropAfter
                                                    ? { boxShadow: 'inset 0 -2px 0 #EA580C' }
                                                    : undefined}
                                        >
                                            {editingCollectionId === collection.id ? (
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    value={editingCollectionName}
                                                    onChange={(e) => setEditingCollectionName(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            submitCollectionRename(collection);
                                                        } else if (e.key === 'Escape') {
                                                            e.preventDefault();
                                                            cancelCollectionRename();
                                                        }
                                                    }}
                                                    onBlur={() => submitCollectionRename(collection)}
                                                    className="h-10 w-full rounded-full border border-brand-300 bg-white px-3.5 text-body font-body text-default-font outline-none focus:border-brand-600"
                                                />
                                            ) : (
                                                <>
                                                    <button
                                                        type="button"
                                                        className={`h-10 w-full rounded-full border px-3.5 pr-11 text-left text-body font-body transition-colors ${selectedCollectionId === collection.id
                                                            ? 'border-[#EA580C] bg-[rgba(234,88,12,0.01)] text-[#D94808]'
                                                            : 'border-transparent text-subtext-color hover:bg-neutral-100 hover:text-default-font'
                                                        }`}
                                                        onClick={() => onCollectionSelect && onCollectionSelect(collection.id)}
                                                        title={collection.name}
                                                    >
                                                        <span className="truncate flex items-center gap-2">
                                                            {renderEntityMarker(CollectionIcon, collectionColor)}
                                                            <span className="truncate">{collection.name}</span>
                                                        </span>
                                                    </button>
                                                    <SubframeCore.DropdownMenu.Root>
                                                        <SubframeCore.DropdownMenu.Trigger asChild={true}>
                                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100">
                                                                <IconButton
                                                                    icon={<MoreHorizontal className="w-3.5 h-3.5" />}
                                                                    size="small"
                                                                    className="h-7 w-7"
                                                                />
                                                            </div>
                                                        </SubframeCore.DropdownMenu.Trigger>
                                                        <SubframeCore.DropdownMenu.Portal>
                                                            <SubframeCore.DropdownMenu.Content
                                                                side="right"
                                                                align="start"
                                                                sideOffset={6}
                                                                asChild={true}
                                                            >
                                                                <DropdownMenu>
                                                                    <DropdownMenu.DropdownItem
                                                                        icon={<FeatherSettings />}
                                                                        onClick={() => onOpenCollectionSettings && onOpenCollectionSettings(collection)}
                                                                    >
                                                                        Collection Settings
                                                                    </DropdownMenu.DropdownItem>
                                                                    {moveTargets.length > 0 && (
                                                                        <>
                                                                            <DropdownMenu.DropdownDivider />
                                                                            {moveTargets.map((target) => (
                                                                                <DropdownMenu.DropdownItem
                                                                                    key={`${collection.id}-${target.id}`}
                                                                                    icon={<FeatherFolder />}
                                                                                    onClick={() => onCollectionMove && onCollectionMove(collection, target.id)}
                                                                                >
                                                                                    Move to {target.name}
                                                                                </DropdownMenu.DropdownItem>
                                                                            ))}
                                                                        </>
                                                                    )}
                                                                </DropdownMenu>
                                                            </SubframeCore.DropdownMenu.Content>
                                                        </SubframeCore.DropdownMenu.Portal>
                                                    </SubframeCore.DropdownMenu.Root>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>

                <div className="mt-3 w-full border-t border-neutral-200/80 pt-3">
                    <div
                        className={`flex w-full flex-col gap-1 ${draggingCollectionId && projectDropTarget === null ? 'rounded-xl bg-orange-50/70' : ''}`}
                        onDragOver={(event) => handleProjectDragOver(event, null)}
                        onDrop={(event) => handleProjectDrop(event, null)}
                    >
                        <div className="flex h-8 w-full items-center justify-between px-3.5">
                            <span className="text-[12px] font-semibold uppercase tracking-wide text-neutral-400">Collections</span>
                            <IconButton
                                icon={<FeatherPlus />}
                                size="small"
                                className="h-7 w-7"
                                onClick={() => {
                                    setAddingCollectionProjectId(UNGROUPED_COLLECTION_COMPOSER_ID);
                                    setNewCollectionName('');
                                }}
                            />
                        </div>

                        {addingCollectionProjectId === UNGROUPED_COLLECTION_COMPOSER_ID && (
                            <div className="px-3 py-1 pl-8">
                                <TextField className="w-full">
                                    <TextField.Input
                                        autoFocus
                                        type="text"
                                        placeholder="Collection name..."
                                        value={newCollectionName}
                                        onChange={(e) => setNewCollectionName(e.target.value)}
                                        onKeyDown={(e) => handleCreateCollectionKeyDown(e, UNGROUPED_COLLECTION_COMPOSER_ID)}
                                        onBlur={() => {
                                            setAddingCollectionProjectId(null);
                                            setNewCollectionName('');
                                        }}
                                    />
                                </TextField>
                            </div>
                        )}

                        {groupedCollections.ungrouped.map((collection) => {
                            const isDropBefore = dropTarget?.collectionId === collection.id
                                && dropTarget?.projectId === null
                                && dropTarget?.position === 'before';
                            const isDropAfter = dropTarget?.collectionId === collection.id
                                && dropTarget?.projectId === null
                                && dropTarget?.position === 'after';
                            const CollectionIcon = getEntityIconComponent(collection.iconKey, collection.id, 'collection');
                            const collectionColor = getEntityColorToken(collection.colorKey, collection.id);

                            return (
                                <div
                                    key={collection.id}
                                    className="group relative flex h-10 w-full items-center pl-6"
                                    draggable={editingCollectionId !== collection.id}
                                    onDragStart={(event) => handleCollectionDragStart(event, collection)}
                                    onDragEnd={handleCollectionDragEnd}
                                    onDragOver={(event) => handleCollectionDragOver(event, collection, null)}
                                    onDrop={(event) => handleCollectionDrop(event, collection, null)}
                                    style={isDropBefore
                                        ? { boxShadow: 'inset 0 2px 0 #EA580C' }
                                        : isDropAfter
                                            ? { boxShadow: 'inset 0 -2px 0 #EA580C' }
                                            : undefined}
                                >
                                    {editingCollectionId === collection.id ? (
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editingCollectionName}
                                            onChange={(e) => setEditingCollectionName(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    submitCollectionRename(collection);
                                                } else if (e.key === 'Escape') {
                                                    e.preventDefault();
                                                    cancelCollectionRename();
                                                }
                                            }}
                                            onBlur={() => submitCollectionRename(collection)}
                                            className="h-10 w-full rounded-full border border-brand-300 bg-white px-3.5 text-body font-body text-default-font outline-none focus:border-brand-600"
                                        />
                                    ) : (
                                        <>
                                            <button
                                                type="button"
                                                className={`h-10 w-full rounded-full border px-3.5 pr-11 text-left text-body font-body transition-colors ${selectedCollectionId === collection.id
                                                    ? 'border-[#EA580C] bg-[rgba(234,88,12,0.01)] text-[#D94808]'
                                                    : 'border-transparent text-subtext-color hover:bg-neutral-100 hover:text-default-font'
                                                }`}
                                                onClick={() => onCollectionSelect && onCollectionSelect(collection.id)}
                                                title={collection.name}
                                            >
                                                <span className="truncate flex items-center gap-2">
                                                    {renderEntityMarker(CollectionIcon, collectionColor)}
                                                    <span className="truncate">{collection.name}</span>
                                                </span>
                                            </button>
                                            <SubframeCore.DropdownMenu.Root>
                                                <SubframeCore.DropdownMenu.Trigger asChild={true}>
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100">
                                                        <IconButton
                                                            icon={<MoreHorizontal className="w-3.5 h-3.5" />}
                                                            size="small"
                                                            className="h-7 w-7"
                                                        />
                                                    </div>
                                                </SubframeCore.DropdownMenu.Trigger>
                                                <SubframeCore.DropdownMenu.Portal>
                                                    <SubframeCore.DropdownMenu.Content
                                                        side="right"
                                                        align="start"
                                                        sideOffset={6}
                                                        asChild={true}
                                                    >
                                                        <DropdownMenu>
                                                            <DropdownMenu.DropdownItem
                                                                icon={<FeatherSettings />}
                                                                onClick={() => onOpenCollectionSettings && onOpenCollectionSettings(collection)}
                                                            >
                                                                Collection Settings
                                                            </DropdownMenu.DropdownItem>
                                                            {projects.length > 0 && (
                                                                <>
                                                                    <DropdownMenu.DropdownDivider />
                                                                    {projects.map((target) => (
                                                                        <DropdownMenu.DropdownItem
                                                                            key={`${collection.id}-${target.id}`}
                                                                            icon={<FeatherFolder />}
                                                                            onClick={() => onCollectionMove && onCollectionMove(collection, target.id)}
                                                                        >
                                                                            Move to {target.name}
                                                                        </DropdownMenu.DropdownItem>
                                                                    ))}
                                                                </>
                                                            )}
                                                        </DropdownMenu>
                                                    </SubframeCore.DropdownMenu.Content>
                                                </SubframeCore.DropdownMenu.Portal>
                                            </SubframeCore.DropdownMenu.Root>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </ChatChannelsMenu>
            <div className="w-full border-t border-neutral-200/80 pt-3">
                <div className="px-3.5 pb-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Shortcuts</span>
                </div>
                <div className="flex w-full flex-col gap-1 px-2">
                    {shortcutRows.length === 0 ? (
                        <div className="px-2 py-1 text-[11px] text-neutral-400">Extension shortcuts unavailable</div>
                    ) : shortcutRows.map((entry) => {
                        const parts = splitShortcutParts(entry.shortcut);
                        return (
                            <div key={entry.actionId || entry.command} className="flex items-center justify-between rounded-lg px-2 py-1 hover:bg-neutral-100">
                                <span className="truncate pr-2 text-[11px] font-medium text-neutral-600">{entry.label}</span>
                                <div className="flex items-center gap-1">
                                    {parts.length > 0 ? parts.map((part, index) => (
                                        <kbd
                                            key={`${entry.actionId || entry.command}-${part}-${index}`}
                                            className="inline-flex min-w-[18px] items-center justify-center rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-500"
                                        >
                                            {part}
                                        </kbd>
                                    )) : (
                                        <kbd className="inline-flex min-w-[18px] items-center justify-center rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-neutral-400">
                                            Unassigned
                                        </kbd>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </aside>
    );
}
