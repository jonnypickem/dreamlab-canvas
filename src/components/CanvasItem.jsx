import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import { Camera, Link as LinkIcon, FileText, Info } from 'lucide-react';

// Helper to ensure size is always a number
const parseSize = (val, fallback) => {
    if (val == null) return fallback;
    if (typeof val === 'number') return val;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? fallback : parsed;
};

const hasFiniteNumber = (value) => {
    if (value == null) return false;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed);
};

const CanvasItem = ({
    item,
    initialPosition = null,
    onUpdate,
    isSelected,
    onSelect,
    onOpenDetails,
    scale,
    isPanMode = false
}) => {
    // Default dimensions based on type
    const defaultWidth = item.type === 'image' ? 300 : 280;
    const defaultHeight = item.type === 'image' ? 200 : 160;

    const [position, setPosition] = useState(() => {
        const fallbackX = parseSize(initialPosition?.x, 120);
        const fallbackY = parseSize(initialPosition?.y, 120);
        const x = parseSize(item.canvas?.x, fallbackX);
        const y = parseSize(item.canvas?.y, fallbackY);
        return { x, y };
    });

    const [size, setSize] = useState(() => {
        const w = parseSize(item.canvas?.w, defaultWidth);
        const h = parseSize(item.canvas?.h, defaultHeight);
        return { width: w, height: h };
    });
    const [mediaAspectRatio, setMediaAspectRatio] = useState(null);
    const hasSavedSize = hasFiniteNumber(item.canvas?.w) && hasFiniteNumber(item.canvas?.h);
    const mediaSource = item.type === 'image' ? item.content : item.thumbnail;
    const hasMediaCard = item.type === 'image' || Boolean(item.thumbnail);
    const hasAutoSizedFromMediaRef = useRef(false);
    const suppressClickRef = useRef(false);
    const dragStateRef = useRef({ startX: 0, startY: 0, moved: false });

    // Debounce save
    const timeoutRef = useRef(null);

    const handleDragStop = (e, d) => {
        const newPos = { x: d.x, y: d.y };
        setPosition(newPos);
        saveChanges(newPos, size);
        if (dragStateRef.current.moved) {
            suppressClickRef.current = true;
            window.setTimeout(() => {
                suppressClickRef.current = false;
            }, 0);
        } else {
            suppressClickRef.current = false;
        }
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

    useEffect(() => {
        hasAutoSizedFromMediaRef.current = false;
    }, [item.id]);

    useEffect(() => {
        if (!mediaSource) {
            setMediaAspectRatio(null);
            return;
        }

        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (cancelled) return;
            const { naturalWidth, naturalHeight } = img;
            if (!naturalWidth || !naturalHeight) return;
            setMediaAspectRatio(naturalWidth / naturalHeight);
        };
        img.onerror = () => {
            if (!cancelled) setMediaAspectRatio(null);
        };
        img.src = mediaSource;

        return () => {
            cancelled = true;
        };
    }, [mediaSource]);

    useEffect(() => {
        if (!hasMediaCard) return;
        if (!mediaAspectRatio) return;
        if (hasSavedSize) return;
        if (hasAutoSizedFromMediaRef.current) return;

        const nextWidth = parseSize(size.width, defaultWidth);
        const nextHeight = Math.max(120, Math.round(nextWidth / mediaAspectRatio));
        if (nextHeight === size.height) {
            hasAutoSizedFromMediaRef.current = true;
            return;
        }

        const nextSize = { width: nextWidth, height: nextHeight };
        setSize(nextSize);
        saveChanges(position, nextSize);
        hasAutoSizedFromMediaRef.current = true;
    }, [hasMediaCard, mediaAspectRatio, hasSavedSize, size.width, size.height, defaultWidth, position]);

    const getTypeIcon = (type) => {
        switch (type) {
            case 'image': return <Camera className="w-4 h-4" />;
            case 'text': return <FileText className="w-4 h-4" />;
            case 'link': return <LinkIcon className="w-4 h-4" />;
            default: return <LinkIcon className="w-4 h-4" />;
        }
    };

    const domainName = (url) => {
        if (!url) return '';
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch (e) {
            return url;
        }
    };

    const lockAspectRatio = useMemo(() => {
        if (!hasMediaCard) return false;
        if (mediaAspectRatio && Number.isFinite(mediaAspectRatio) && mediaAspectRatio > 0) {
            return mediaAspectRatio;
        }
        if (size.width > 0 && size.height > 0) {
            return size.width / size.height;
        }
        return true;
    }, [hasMediaCard, mediaAspectRatio, size.width, size.height]);

    const handleCardClick = (event) => {
        if (suppressClickRef.current) {
            event.stopPropagation();
            return;
        }
        event.stopPropagation();
        onSelect(item.id, event);
    };

    return (
        <Rnd
            size={{ width: size.width, height: size.height }}
            position={{ x: position.x, y: position.y }}
            onDragStart={(e, d) => {
                dragStateRef.current = { startX: d.x, startY: d.y, moved: false };
            }}
            onDrag={(e, d) => {
                const dx = Math.abs(d.x - dragStateRef.current.startX);
                const dy = Math.abs(d.y - dragStateRef.current.startY);
                if (dx > 2 || dy > 2) {
                    dragStateRef.current.moved = true;
                }
            }}
            onDragStop={handleDragStop}
            onResizeStop={handleResizeStop}
            scale={scale}
            style={{ zIndex: isSelected ? 1000 : (item.canvas?.z || 1) }}
            className={`group canvas-item-root ${isSelected ? 'z-50' : ''}`}
            disableDragging={isPanMode}
            cancel=".canvas-item-no-drag, a, button, input, textarea, select"
            enableResizing={!isPanMode && hasMediaCard}
            lockAspectRatio={lockAspectRatio}
            minWidth={200}
            minHeight={100}
        >
            <div
                className={`group relative flex h-full w-full flex-col overflow-hidden rounded-lg bg-white shadow-sm transition-all duration-200
                    ${isSelected
                        ? 'border-2 border-orange-600'
                        : 'border border-[var(--ds-gray-200)] hover:border-orange-600 hover:shadow-md'
                    }
                `}
                onClick={handleCardClick}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    onOpenDetails?.(item);
                }}
            >
                <div className="absolute top-2 left-2 z-20 flex opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <div className="bg-white shadow-sm border border-neutral-100 p-1.5 rounded-md flex items-center justify-center">
                        <div className="text-orange-600">
                            {getTypeIcon(item.type)}
                        </div>
                    </div>
                </div>

                <button
                    onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenDetails?.(item);
                    }}
                    className="canvas-item-no-drag absolute z-20 top-2 right-2 p-1.5 rounded-md bg-white/95 border border-neutral-100 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity hover:text-zinc-900 hover:bg-white"
                    aria-label="Open details"
                    title="Open details"
                >
                    <Info size={14} />
                </button>

                <div className="flex-grow overflow-hidden relative bg-white">
                    {item.type === 'image' && (
                        <img
                            src={item.content}
                            alt={item.title || 'Captured Image'}
                            className="w-full h-full object-contain pointer-events-none bg-white"
                        />
                    )}

                    {item.type === 'link' && (
                        item.thumbnail ? (
                            <img
                                src={item.thumbnail}
                                alt={item.title || 'Link Thumbnail'}
                                className="w-full h-full object-contain pointer-events-none bg-white"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const fallback = e.currentTarget.parentElement?.querySelector('.canvas-link-fallback');
                                    if (fallback) fallback.classList.remove('hidden');
                                }}
                            />
                        ) : null
                    )}

                    {item.type === 'link' && (
                        <div className={`canvas-link-fallback w-full h-full bg-zinc-50 flex flex-col items-center justify-center p-4 ${item.thumbnail ? 'hidden' : 'flex'}`}>
                            <LinkIcon size={42} className="text-zinc-200 mb-2" />
                            <span className="text-xs text-zinc-400 font-mono truncate max-w-full">
                                {domainName(item.sourceUrl)}
                            </span>
                        </div>
                    )}

                    {item.type === 'text' && (
                        <div className="w-full h-full p-4 bg-white flex items-center justify-center">
                            <p className="text-sm text-[var(--ds-gray-1000)] line-clamp-6 text-center leading-relaxed">
                                "{item.content}"
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Rnd>
    );
};

export default CanvasItem;
