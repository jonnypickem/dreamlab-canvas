import React from 'react';
import { Avatar } from '../ui/components/Avatar';
import { IconButton } from '../ui/components/IconButton';
import * as SubframeCore from '@subframe/core';

export default function WorkspaceStrip({ workspaces, activeWorkspaceId, onWorkspaceChange, onAddWorkspace, lockScroll = false }) {
    const handleWheelCapture = (event) => {
        if (!lockScroll) return;
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <div
            className={`fixed left-0 top-0 h-screen z-50 flex flex-col items-center py-4 gap-3 overflow-x-hidden bg-neutral-100 border-r border-neutral-border w-[68px] ${lockScroll ? 'overflow-hidden' : 'overflow-y-auto'}`}
            onWheelCapture={handleWheelCapture}
        >
            {/* Workspaces */}
            <div className="flex flex-col gap-3 w-full items-center px-3">
                {workspaces.map((workspace) => {
                    const isActive = workspace.id === activeWorkspaceId;
                    const isImage = workspace.icon?.type === 'image';
                    // Simple check for emoji or text if not image
                    const iconValue = typeof workspace.icon === 'string' ? workspace.icon : (workspace.icon?.value || workspace.name[0]);

                    // Determine content for Avatar
                    // If it's an image URL object
                    const imageUrl = isImage ? iconValue : undefined;

                    return (
                        <div
                            key={workspace.id}
                            className="group relative flex items-center justify-center"
                        >
                            {/* Selection Indicator (Left Border/Dot) - Optional based on design, trying Ring approach first */}
                            <div
                                onClick={() => onWorkspaceChange(workspace.id)}
                                className={`
                                    relative flex items-center justify-center cursor-pointer transition-all duration-200
                                    rounded-md
                                    ${isActive ? 'ring-2 ring-brand-600 ring-offset-2 ring-offset-neutral-100' : 'hover:opacity-80'}
                                `}
                            >
                                <Avatar
                                    variant="neutral"
                                    size="large"
                                    square={true}
                                    image={imageUrl}
                                >
                                    {!imageUrl && iconValue}
                                </Avatar>
                            </div>

                            {/* Tooltip */}
                            <div
                                className="absolute left-[56px] top-1/2 -translate-y-1/2 px-2 py-1 text-[11px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] bg-neutral-800 text-white rounded shadow-sm"
                            >
                                {workspace.name}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Add button */}
            <IconButton
                onClick={onAddWorkspace}
                variant="neutral-tertiary"
                size="medium"
                icon={<SubframeCore.Icon name="FeatherPlus" />}
                title="Add Workspace"
                className="mb-2"
            />
        </div>
    );
}
