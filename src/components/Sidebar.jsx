import React, { useState } from 'react';
import { ChatChannelsMenu } from '../ui/components/ChatChannelsMenu';
import { DropdownMenu } from '../ui/components/DropdownMenu';
import { IconButton } from '../ui/components/IconButton';
import { Avatar } from '../ui/components/Avatar';
import { Badge } from '../ui/components/Badge';
import { TextField } from '../ui/components/TextField';
import * as SubframeCore from "@subframe/core";
import { FeatherChevronDown, FeatherSearch, FeatherLayoutGrid, FeatherFolder, FeatherSettings, FeatherLogOut, FeatherPlus, FeatherTrash2, FeatherMoreHorizontal } from "@subframe/core";

export default function Sidebar({
    projects,
    selectedProjectId,
    onProjectSelect,
    onCreateProject,
    onDeleteProject,
    onProjectSettings,
    activeWorkspaceId,
    activeWorkspaceName,
    onOpenSettings,
    totalItemCount = 0
}) {
    const [isAddingProject, setIsAddingProject] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');

    const handleCreateProject = (e) => {
        if (e.key === 'Enter') {
            if (newProjectName.trim() && activeWorkspaceId) {
                onCreateProject(activeWorkspaceId, newProjectName.trim());
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

    // Get workspace initials for avatar
    const workspaceInitials = activeWorkspaceName ? activeWorkspaceName.substring(0, 2).toUpperCase() : 'DL';

    return (
        <aside className="flex w-72 flex-none flex-col items-start gap-2 self-stretch bg-neutral-50 px-4 py-4 mobile:hidden ml-[68px]">
            {/* Header with Workspace Dropdown and Search */}
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
                                                {projects.length} projects
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
                        // Focus search input in main area
                        document.querySelector('input[placeholder*="Search"]')?.focus();
                    }}
                />
            </div>

            {/* ChatChannelsMenu */}
            <ChatChannelsMenu className="w-full grow shrink-0 basis-0">
                {/* All Items */}
                <ChatChannelsMenu.Item
                    icon={<FeatherLayoutGrid />}
                    selected={!selectedProjectId}
                    onClick={() => onProjectSelect(null)}
                    rightSlot={<Badge variant="neutral">{totalItemCount}</Badge>}
                >
                    All Items
                </ChatChannelsMenu.Item>

                {/* Projects Folder */}
                <ChatChannelsMenu.Folder
                    label="Projects"
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
                    {/* Add Project Input */}
                    {isAddingProject && (
                        <div className="px-3 py-1">
                            <TextField className="w-full">
                                <TextField.Input
                                    autoFocus
                                    type="text"
                                    placeholder="Project name..."
                                    value={newProjectName}
                                    onChange={(e) => setNewProjectName(e.target.value)}
                                    onKeyDown={handleCreateProject}
                                    onBlur={() => {
                                        setIsAddingProject(false);
                                        setNewProjectName('');
                                    }}
                                />
                            </TextField>
                        </div>
                    )}

                    {/* Project List */}
                    {projects.length === 0 && !isAddingProject ? (
                        <div className="px-3 py-4 text-center">
                            <p className="text-caption font-caption text-subtext-color">
                                No projects yet
                            </p>
                        </div>
                    ) : (
                        projects.map(p => (
                            <div key={p.id} className="group relative flex items-center w-full">
                                <ChatChannelsMenu.Item
                                    icon={<FeatherFolder />}
                                    selected={selectedProjectId === p.id}
                                    onClick={() => onProjectSelect(p.id)}
                                    className="flex-1"
                                >
                                    {p.name}
                                </ChatChannelsMenu.Item>

                                {/* Project Actions Menu */}
                                <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <SubframeCore.DropdownMenu.Root>
                                        <SubframeCore.DropdownMenu.Trigger asChild={true}>
                                            <IconButton
                                                icon={<FeatherMoreHorizontal className="w-4 h-4" />}
                                                size="small"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </SubframeCore.DropdownMenu.Trigger>
                                        <SubframeCore.DropdownMenu.Portal>
                                            <SubframeCore.DropdownMenu.Content
                                                side="right"
                                                align="start"
                                                sideOffset={4}
                                                asChild={true}
                                            >
                                                <DropdownMenu>
                                                    <DropdownMenu.DropdownItem
                                                        icon={<FeatherSettings />}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onProjectSettings(p);
                                                        }}
                                                    >
                                                        Settings
                                                    </DropdownMenu.DropdownItem>
                                                    <DropdownMenu.DropdownItem
                                                        icon={<FeatherTrash2 className="text-error-600" />}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onDeleteProject(p.id, p.name);
                                                        }}
                                                    >
                                                        <span className="text-error-600">Delete Project</span>
                                                    </DropdownMenu.DropdownItem>
                                                </DropdownMenu>
                                            </SubframeCore.DropdownMenu.Content>
                                        </SubframeCore.DropdownMenu.Portal>
                                    </SubframeCore.DropdownMenu.Root>
                                </div>
                            </div>
                        ))
                    )}
                </ChatChannelsMenu.Folder>
            </ChatChannelsMenu>
        </aside>
    );
}
