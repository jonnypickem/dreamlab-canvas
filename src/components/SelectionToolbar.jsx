import React from 'react';
import { Button } from '../ui/components/Button';
import { FeatherCopy, FeatherDownload, FeatherTrash, FeatherTag } from '@subframe/core';

export function SelectionToolbar({
    selectedCount,
    onCopy,
    onDownload,
    onDelete,
    onAddTags,
    onClearSelection,
    isExporting = false
}) {
    return (
        <div className="flex items-center justify-between rounded-full border border-solid border-neutral-border bg-white px-6 py-4 shadow-lg fixed bottom-8 left-[calc(50%+144px)] -translate-x-1/2 z-10">
            <span className="text-body-bold font-body-bold text-default-font">
                {selectedCount} item{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-3">
                <Button
                    variant="neutral-secondary"
                    size="medium"
                    icon={<FeatherCopy />}
                    onClick={onCopy}
                >
                    Copy
                </Button>
                <Button
                    variant="neutral-secondary"
                    size="medium"
                    icon={<FeatherDownload />}
                    onClick={onDownload}
                    disabled={isExporting}
                >
                    {isExporting ? 'Exporting...' : 'Download'}
                </Button>
                <Button
                    variant="neutral-secondary"
                    size="medium"
                    icon={<FeatherTag />}
                    onClick={onAddTags}
                >
                    Add Tags
                </Button>
                <Button
                    variant="destructive-secondary"
                    size="medium"
                    icon={<FeatherTrash />}
                    onClick={onDelete}
                >
                    Delete
                </Button>
                <div className="flex h-6 w-px flex-none flex-col items-start bg-neutral-border" />
                <Button
                    variant="neutral-tertiary"
                    size="medium"
                    icon={null}
                    onClick={onClearSelection}
                >
                    Deselect
                </Button>
            </div>
        </div>
    );
}
