import React from 'react';
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
import { GripVertical } from 'lucide-react';
import ItemCard from './ItemCard';

function SortableCard({ item }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 30 : 'auto',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`relative touch-none ${isDragging ? 'scale-[1.01] opacity-95' : ''}`}
        >
            <div
                className={`absolute right-2 top-2 z-30 rounded-md border border-neutral-200 bg-white/95 p-1 shadow-sm ${
                    isDragging ? 'text-orange-600' : 'text-neutral-500'
                }`}
                {...attributes}
                {...listeners}
            >
                <GripVertical size={14} />
            </div>
            <ItemCard item={item} />
        </div>
    );
}

function SortableGrid({
    items,
    zoomLevel = 2,
    onReorder,
}) {
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 160, tolerance: 8 },
        })
    );

    const minWidthByZoom = {
        0: 200,
        1: 240,
        2: 290,
        3: 360,
        4: 420,
    };
    const minCardWidth = minWidthByZoom[zoomLevel] || 290;

    const handleReorder = (event) => {
        const { active, over } = event;
        if (!active?.id || !over?.id) return;
        if (active.id === over.id) return;
        onReorder?.(String(active.id), String(over.id));
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragOver={handleReorder}
            onDragEnd={handleReorder}
        >
            <SortableContext
                items={items.map((item) => item.id)}
                strategy={rectSortingStrategy}
            >
                <div
                    className="grid gap-6"
                    style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}px, 1fr))` }}
                >
                    {items.map((item) => (
                        <SortableCard key={item.id} item={item} />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
}

export default SortableGrid;
