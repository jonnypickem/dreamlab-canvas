import React, { useState, useEffect, useRef } from 'react';
import { Rnd } from 'react-rnd';
import { X, ExternalLink, Type, Image as ImageIcon, Link as LinkIcon, Move } from 'lucide-react';

// Helper to ensure size is always a number
const parseSize = (val, fallback) => {
    if (val == null) return fallback;
    if (typeof val === 'number') return val;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? fallback : parsed;
};

const CanvasItem = ({ item, onUpdate, onDelete, isSelected, onSelect, scale }) => {
    // Default dimensions based on type
    const defaultWidth = item.type === 'image' ? 300 : 280;
    const defaultHeight = item.type === 'image' ? 200 : 160;

    const [position, setPosition] = useState(() => {
        const x = parseSize(item.canvas?.x, 100 + Math.random() * 200);
        const y = parseSize(item.canvas?.y, 100 + Math.random() * 200);
        return { x, y };
    });

    const [size, setSize] = useState(() => {
        const w = parseSize(item.canvas?.w, defaultWidth);
        const h = parseSize(item.canvas?.h, defaultHeight);
        return { width: w, height: h };
    });

    const [isDragging, setIsDragging] = useState(false);

    // Debounce save
    const timeoutRef = useRef(null);

    const handleDragStop = (e, d) => {
        setIsDragging(false);
        const newPos = { x: d.x, y: d.y };
        setPosition(newPos);
        saveChanges(newPos, size);
    };

    const handleResizeStop = (e, direction, ref, delta, pos) => {
        const newWidth = parseSize(ref.style.width, size.width);
        const newHeight = parseSize(ref.style.height, size.height);
        const newSize = { width: newWidth, height: newHeight };
        setSize(newSize);
        setPosition(pos);
        saveChanges(pos, newSize);
    };

    const saveChanges = (newPos, newSize) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            onUpdate(item.id, {
                canvas: {
                    x: newPos.x,
                    y: newPos.y,
                    w: parseSize(newSize.width, defaultWidth),
                    h: parseSize(newSize.height, defaultHeight),
                    z: item.canvas?.z || 1
                }
            });
        }, 500);
    };

    const getIcon = (type) => {
        switch (type) {
            case 'image': return <ImageIcon className="w-4 h-4" />;
            case 'text': return <Type className="w-4 h-4" />;
            case 'link': return <LinkIcon className="w-4 h-4" />;
            default: return <LinkIcon className="w-4 h-4" />;
        }
    };

    return (
        <Rnd
            size={{ width: size.width, height: size.height }}
            position={{ x: position.x, y: position.y }}
            onDragStart={() => {
                setIsDragging(true);
                onSelect(item.id);
            }}
            onDragStop={handleDragStop}
            onResizeStop={handleResizeStop}
            bounds=".dreamlab-canvas-content"
            scale={scale}
            style={{ zIndex: isSelected ? 1000 : (item.canvas?.z || 1) }}
            className={`group ${isSelected ? 'z-50' : ''}`}
            dragHandleClassName="drag-handle"
            enableResizing={item.type === 'image' || !!item.thumbnail}
            minWidth={200}
            minHeight={100}
        >
            <div
                className={`flex flex-col h-full bg-white rounded-xl shadow-sm overflow-hidden border transition-shadow duration-200
                    ${isSelected ? 'border-zinc-800 shadow-xl' : 'border-zinc-200 hover:shadow-md'}
                `}
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(item.id);
                }}
            >
                {/* Header / Drag Handle */}
                <div
                    className={`drag-handle flex items-center justify-between px-3 py-2 bg-zinc-50 border-b border-zinc-100 cursor-move
                        ${isSelected ? 'bg-zinc-100' : ''}
                    `}
                >
                    <div className="flex items-center gap-2 text-zinc-500">
                        {getIcon(item.type)}
                        <span className="text-xs font-medium truncate max-w-[150px]">
                            {item.type === 'link' ? new URL(item.sourceUrl).hostname : item.type}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                            className="p-1 hover:bg-zinc-200 rounded text-zinc-400 hover:text-red-500"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-hidden relative bg-white flex flex-col">
                    {(item.type === 'image' || item.type === 'link') && (
                        <div className="w-full h-full relative image-container">
                            {(item.type === 'image' || item.thumbnail) ? (
                                <img
                                    src={item.type === 'image' ? item.content : item.thumbnail}
                                    alt="content"
                                    className="w-full h-full object-cover pointer-events-none"
                                    onError={(e) => {
                                        const container = e.currentTarget.closest('.image-container');
                                        if (container) {
                                            e.currentTarget.style.display = 'none';
                                            const placeholder = container.querySelector('.link-placeholder');
                                            if (placeholder) placeholder.style.display = 'flex';
                                        }
                                        const fallback = e.currentTarget.closest('.flex-col').querySelector('.text-fallback');
                                        if (fallback) fallback.classList.remove('hidden');
                                    }}
                                />
                            ) : null}

                            <div
                                className={`link-placeholder absolute inset-0 flex items-center justify-center bg-zinc-50 ${item.thumbnail || item.type === 'image' ? 'hidden' : ''}`}
                            >
                                <LinkIcon className="w-8 h-8 text-zinc-200" />
                            </div>

                            {item.thumbnail && (
                                <div className="absolute inset-0 p-3 flex flex-col justify-end bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none">
                                    <p className="text-[11px] font-semibold text-white line-clamp-2 leading-tight">
                                        {item.content}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                    {item.type !== 'image' && (
                        <div className={`p-4 text-sm text-zinc-800 font-medium whitespace-pre-wrap ${item.thumbnail || item.type === 'link' ? 'hidden text-fallback' : ''}`}>
                            {item.content}
                        </div>
                    )}
                </div>

                {/* Footer (Source) */}
                {(item.type === 'link' || item.sourceUrl) && (
                    <div className="px-3 py-2 bg-zinc-50 border-t border-zinc-100 flex items-center gap-2">
                        <ExternalLink size={12} className="text-zinc-400" />
                        <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-zinc-500 hover:text-zinc-800 truncate"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {item.sourceUrl}
                        </a>
                    </div>
                )}
            </div>
        </Rnd>
    );
};

export default CanvasItem;
