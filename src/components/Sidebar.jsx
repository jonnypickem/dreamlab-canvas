import React, { useEffect, useMemo, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { ChatChannelsMenu } from '../ui/components/ChatChannelsMenu';
import { DropdownMenu } from '../ui/components/DropdownMenu';
import { IconButton } from '../ui/components/IconButton';
import { Avatar } from '../ui/components/Avatar';
import { Badge } from '../ui/components/Badge';
import { TextField } from '../ui/components/TextField';
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

export default function Sidebar({
    projects = [],
    collections = [],
    selectedCollectionId = null,
    onAllItems,
    onProjectCreate,
    onProjectRename,
    onProjectDelete,
    onCollectionSelect,
    onCollectionRename,
    onCollectionDelete,
    onCreateCollection,
    onCollectionMove,
    onCollectionReorder,
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
    const [isUngroupedCollapsed, setIsUngroupedCollapsed] = useState(false);
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

    const handleCreateCollectionKeyDown = (e, projectId) => {
        if (e.key === 'Enter') {
            if (newCollectionName.trim() && activeWorkspaceId) {
                if (onCreateCollection) {
                    onCreateCollection(projectId, newCollectionName.trim());
                }
                setAddingCollectionProjectId(null);
                setNewCollectionName('');
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
                    selected={!selectedCollectionId}
                    onClick={() => onAllItems && onAllItems()}
                    rightSlot={<Badge variant="neutral">{totalItemCount}</Badge>}
                    className="rounded-full"
                >
                    All Items
                </ChatChannelsMenu.Item>

                <ChatChannelsMenu.Folder
                    label="Project Folders"
                    action={
                        <IconButton
                            icon={<FeatherPlus />}
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsAddingProject(true);
                            }}
                        />
                    }
                >
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

                    {projects.length === 0 && !isAddingProject ? (
                        <div className="px-3 py-4 text-center">
                            <p className="text-caption font-caption text-subtext-color">
                                No folders yet
                            </p>
                        </div>
                    ) : (
                        projects.map((project) => {
                            const projectCollections = groupedCollections.map.get(project.id) || [];
                            const isCollapsed = Boolean(collapsedProjects[project.id]);
                            const canDeleteProject = projectCollections.length === 0;
                            const moveTargets = projects.filter((candidate) => candidate.id !== project.id);

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
                                                    className="h-10 w-full rounded-full border border-transparent px-3.5 pr-16 text-left text-body font-body text-subtext-color transition-colors hover:bg-neutral-100 hover:text-default-font"
                                                    onClick={() => {
                                                        setCollapsedProjects((prev) => ({
                                                            ...prev,
                                                            [project.id]: !prev[project.id]
                                                        }));
                                                    }}
                                                    title={project.name}
                                                >
                                                    <span className="truncate flex items-center gap-2">
                                                        {isCollapsed ? (
                                                            <FeatherChevronRight className="h-3 w-3 shrink-0 text-neutral-400" />
                                                        ) : (
                                                            <FeatherChevronDown className="h-3 w-3 shrink-0 text-neutral-400" />
                                                        )}
                                                        <FeatherFolder className="h-4 w-4 shrink-0" />
                                                        <span className="truncate">{project.name}</span>
                                                        <span className="text-[11px] text-neutral-400">{projectCollections.length}</span>
                                                    </span>
                                                </button>
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100">
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
                                                                        onClick={() => startProjectRename(project)}
                                                                    >
                                                                        Rename Folder
                                                                    </DropdownMenu.DropdownItem>
                                                                    <DropdownMenu.DropdownDivider />
                                                                    <DropdownMenu.DropdownItem
                                                                        icon={<FeatherTrash />}
                                                                        onClick={() => onProjectDelete && onProjectDelete(project)}
                                                                        className={!canDeleteProject ? 'opacity-50' : ''}
                                                                    >
                                                                        {canDeleteProject ? 'Delete Folder' : 'Delete Folder (Empty Only)'}
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

                                    {!isCollapsed && (
                                        <>
                                            {projectCollections.length === 0 && addingCollectionProjectId !== project.id ? (
                                                <div className="px-3 py-2 pl-8">
                                                    <p className="text-[12px] text-neutral-400">No collections</p>
                                                </div>
                                            ) : (
                                                projectCollections.map((collection) => {
                                                    const isDropBefore = dropTarget?.collectionId === collection.id
                                                        && dropTarget?.projectId === project.id
                                                        && dropTarget?.position === 'before';
                                                    const isDropAfter = dropTarget?.collectionId === collection.id
                                                        && dropTarget?.projectId === project.id
                                                        && dropTarget?.position === 'after';

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
                                                                    onDoubleClick={() => startCollectionRename(collection)}
                                                                    title={collection.name}
                                                                >
                                                                    <span className="truncate flex items-center gap-2">
                                                                        <FeatherFolder className="h-4 w-4 shrink-0" />
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
                                                                                    onClick={() => startCollectionRename(collection)}
                                                                                >
                                                                                    Rename
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
                                                                                <DropdownMenu.DropdownDivider />
                                                                                <DropdownMenu.DropdownItem
                                                                                    icon={<FeatherTrash />}
                                                                                    onClick={() => onCollectionDelete && onCollectionDelete(collection)}
                                                                                >
                                                                                    Delete Collection
                                                                                </DropdownMenu.DropdownItem>
                                                                            </DropdownMenu>
                                                                        </SubframeCore.DropdownMenu.Content>
                                                                    </SubframeCore.DropdownMenu.Portal>
                                                                </SubframeCore.DropdownMenu.Root>
                                                            </>
                                                        )}
                                                    </div>
                                                    );
                                                })
                                            )}
                                        </>
                                    )}
                                </div>
                            );
                        })
                    )}

                    {groupedCollections.ungrouped.length > 0 && (
                        <div
                            className={`flex w-full flex-col gap-1 pt-1 rounded-xl ${draggingCollectionId && projectDropTarget === null ? 'bg-orange-50/70' : ''}`}
                            onDragOver={(event) => handleProjectDragOver(event, null)}
                            onDrop={(event) => handleProjectDrop(event, null)}
                        >
                            <button
                                type="button"
                                className="h-10 w-full rounded-full border border-transparent px-3.5 text-left text-body font-body text-subtext-color transition-colors hover:bg-neutral-100 hover:text-default-font"
                                onClick={() => setIsUngroupedCollapsed((prev) => !prev)}
                            >
                                <span className="truncate flex items-center gap-2">
                                    {isUngroupedCollapsed ? (
                                        <FeatherChevronRight className="h-3 w-3 shrink-0 text-neutral-400" />
                                    ) : (
                                        <FeatherChevronDown className="h-3 w-3 shrink-0 text-neutral-400" />
                                    )}
                                    <FeatherFolder className="h-4 w-4 shrink-0" />
                                    <span className="truncate">Ungrouped</span>
                                    <span className="text-[11px] text-neutral-400">{groupedCollections.ungrouped.length}</span>
                                </span>
                            </button>
                            {!isUngroupedCollapsed && groupedCollections.ungrouped.map((collection) => {
                                const isDropBefore = dropTarget?.collectionId === collection.id
                                    && dropTarget?.projectId === null
                                    && dropTarget?.position === 'before';
                                const isDropAfter = dropTarget?.collectionId === collection.id
                                    && dropTarget?.projectId === null
                                    && dropTarget?.position === 'after';

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
                                                onDoubleClick={() => startCollectionRename(collection)}
                                                title={collection.name}
                                            >
                                                <span className="truncate flex items-center gap-2">
                                                    <FeatherFolder className="h-4 w-4 shrink-0" />
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
                                                                onClick={() => startCollectionRename(collection)}
                                                            >
                                                                Rename
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
                                                            <DropdownMenu.DropdownDivider />
                                                            <DropdownMenu.DropdownItem
                                                                icon={<FeatherTrash />}
                                                                onClick={() => onCollectionDelete && onCollectionDelete(collection)}
                                                            >
                                                                Delete Collection
                                                            </DropdownMenu.DropdownItem>
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
                    )}
                </ChatChannelsMenu.Folder>
            </ChatChannelsMenu>
        </aside>
    );
}
