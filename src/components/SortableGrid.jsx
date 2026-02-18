import React, { useEffect, useRef, useState } from 'react';
import {
    DndContext,
    MouseSensor,
    TouchSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    SortableContext,
    rectSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Masonry from 'react-masonry-css';
import '../masonry.css';
import ItemCard from './ItemCard';

function SortableCard({
    item,
    enableReorder,
    suppressClick,
    onItemClick,
    isSelected,
    onSelectItem,
    inlineEditingId,
    onFinishInlineEdit,
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: item.id,
        disabled: !enableReorder || inlineEditingId === item.id,
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 30 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative ${enableReorder ? 'touch-none cursor-grab active:cursor-grabbing' : ''} ${isDragging ? 'scale-[1.01] opacity-95' : ''}`}
            {...(enableReorder ? { ...attributes, ...listeners } : {})}
        >
            <ItemCard
                item={item}
                onClick={() => {
                    if (suppressClick) return;
                    onItemClick?.(item);
                }}
                isSelected={Boolean(isSelected)}
                onSelect={onSelectItem}
                isEditing={item.id === inlineEditingId}
                onFinishEditing={onFinishInlineEdit}
            />
        </div>
    );
}

function SortableGrid({
    items,
    zoomLevel = 2,
    enableReorder = true,
    onReorderPreview,
    onReorderCommit,
    onItemClick,
    selectedItems = new Set(),
    onSelectItem,
    inlineEditingId = null,
    onFinishInlineEdit,
}) {
    const [suppressClickItemId, setSuppressClickItemId] = useState(null);
    const suppressTimerRef = useRef(null);
    const didPreviewRef = useRef(false);

    useEffect(() => () => {
        if (suppressTimerRef.current) {
            window.clearTimeout(suppressTimerRef.current);
            suppressTimerRef.current = null;
        }
    }, []);

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 160, tolerance: 8 },
        })
    );

    const offset = 2 - zoomLevel;
    const breakpointColumnsObj = {
        default: Math.max(1, 5 + offset),
        1536: Math.max(1, 4 + offset),
        1280: Math.max(1, 3 + offset),
        1024: Math.max(1, 2 + offset),
        768: Math.max(1, 1 + Math.floor(offset / 2)),
    };

    const emitReorder = (event, callback) => {
        const { active, over } = event;
        if (!active?.id || !over?.id) return false;
        if (active.id === over.id) return false;
        callback?.(String(active.id), String(over.id));
        return true;
    };

    const handleDragStart = () => {
        didPreviewRef.current = false;
    };

    const handleDragOver = (event) => {
        const didEmit = emitReorder(event, onReorderPreview);
        if (didEmit) {
            didPreviewRef.current = true;
        }
    };

    const handleDragEnd = (event) => {
        if (!didPreviewRef.current) {
            emitReorder(event, onReorderPreview);
        }
        emitReorder(event, onReorderCommit);
        didPreviewRef.current = false;
        const draggedId = String(event?.active?.id || '');
        if (!draggedId) return;
        setSuppressClickItemId(draggedId);
        if (suppressTimerRef.current) {
            window.clearTimeout(suppressTimerRef.current);
        }
        suppressTimerRef.current = window.setTimeout(() => {
            setSuppressClickItemId(null);
            suppressTimerRef.current = null;
        }, 180);
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={items.map((item) => item.id)}
                strategy={rectSortingStrategy}
            >
                <Masonry
                    breakpointCols={breakpointColumnsObj}
                    className="masonry-grid"
                    columnClassName="masonry-grid-column"
                >
                    {items.map((item) => (
                        <SortableCard
                            key={item.id}
                            item={item}
                            enableReorder={enableReorder}
                            suppressClick={suppressClickItemId === item.id}
                            onItemClick={onItemClick}
                            isSelected={selectedItems.has(item.id)}
                            onSelectItem={onSelectItem}
                            inlineEditingId={inlineEditingId}
                            onFinishInlineEdit={onFinishInlineEdit}
                        />
                    ))}
                </Masonry>
            </SortableContext>
        </DndContext>
    );
}

export default SortableGrid;
