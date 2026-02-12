import React, { useState } from 'react';
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
    FeatherSearch,
    FeatherLayoutGrid,
    FeatherFolder,
    FeatherSettings,
    FeatherTrash,
    FeatherLogOut,
    FeatherPlus
} from "@subframe/core";

export default function Sidebar({
    collections = [],
    selectedCollectionId = null,
    onAllItems,
    onCollectionSelect,
    onCollectionRename,
    onCollectionDelete,
    onCreateCollection,
    activeWorkspaceId,
    activeWorkspaceName,
    onOpenSettings,
    totalItemCount = 0,
    lockScroll = false
}) {
    const [isAddingCollection, setIsAddingCollection] = useState(false);
    const [newCollectionName, setNewCollectionName] = useState('');
    const [editingCollectionId, setEditingCollectionId] = useState(null);
    const [editingCollectionName, setEditingCollectionName] = useState('');

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

    const handleCreateCollection = (e) => {
        if (e.key === 'Enter') {
            if (newCollectionName.trim() && activeWorkspaceId) {
                if (onCreateCollection) {
                    onCreateCollection(newCollectionName.trim());
                }
                setNewCollectionName('');
                setIsAddingCollection(false);
            } else if (!activeWorkspaceId) {
                alert('Please select or create a workspace first.');
            }
        } else if (e.key === 'Escape') {
            setIsAddingCollection(false);
            setNewCollectionName('');
        }
    };

    const workspaceInitials = activeWorkspaceName ? activeWorkspaceName.substring(0, 2).toUpperCase() : 'DL';
    const handleWheelCapture = (event) => {
        if (!lockScroll) return;
        event.preventDefault();
        event.stopPropagation();
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
                                    <DropdownMenu.DropdownItem icon={<FeatherLogOut />}>
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
                    label="Collections"
                    action={
                        <IconButton
                            icon={<FeatherPlus />}
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsAddingCollection(true);
                            }}
                        />
                    }
                >
                    {isAddingCollection && (
                        <div className="px-3 py-1">
                            <TextField className="w-full">
                                <TextField.Input
                                    autoFocus
                                    type="text"
                                    placeholder="Collection name..."
                                    value={newCollectionName}
                                    onChange={(e) => setNewCollectionName(e.target.value)}
                                    onKeyDown={handleCreateCollection}
                                    onBlur={() => {
                                        setIsAddingCollection(false);
                                        setNewCollectionName('');
                                    }}
                                />
                            </TextField>
                        </div>
                    )}

                    {collections.length === 0 && !isAddingCollection ? (
                        <div className="px-3 py-4 text-center">
                            <p className="text-caption font-caption text-subtext-color">
                                No collections yet
                            </p>
                        </div>
                    ) : (
                        collections.map((collection) => (
                            <div key={collection.id} className="flex w-full flex-col">
                                <div className="group relative flex h-10 w-full items-center">
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
                            </div>
                        ))
                    )}
                </ChatChannelsMenu.Folder>
            </ChatChannelsMenu>
        </aside>
    );
}
