import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import CanvasItem from './CanvasItem';
import { MousePointer2, Hand } from 'lucide-react';

const CANVAS_WIDTH = 4000;
const CANVAS_HEIGHT = 4000;
const MIN_SCALE = 0.1;
const MAX_SCALE = 4;
const MIN_SELECTION_DRAG_PX = 4;

const parseCanvasNumber = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
};

const getDefaultItemSize = (item) => ({
    w: (item.type === 'image' || item.type === 'video') ? 300 : 280,
    h: (item.type === 'image' || item.type === 'video') ? 200 : 160,
});

const normalizeOffset = (value, size) => {
    if (!size) return 0;
    const mod = value % size;
    return mod < 0 ? mod + size : mod;
};

const getNormalizedClientRect = (draft) => {
    const left = Math.min(draft.startX, draft.currentX);
    const right = Math.max(draft.startX, draft.currentX);
    const top = Math.min(draft.startY, draft.currentY);
    const bottom = Math.max(draft.startY, draft.currentY);
    return {
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top,
    };
};

const rectanglesIntersect = (a, b) => (
    a.left < b.right
    && a.right > b.left
    && a.top < b.bottom
    && a.bottom > b.top
);

const isTypingTarget = (target) => {
    if (!target || !(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
};

const CanvasView = ({ items, onUpdateItem, onDeleteItem, onOpenItem }) => {
    const containerRef = useRef(null);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [interactionMode, setInteractionMode] = useState('select'); // 'select' | 'pan'
    const [isSpacePressed, setIsSpacePressed] = useState(false);
    const [selectionDraft, setSelectionDraft] = useState(null);
    const [transformSnapshot, setTransformSnapshot] = useState({
        scale: 1,
        positionX: 0,
        positionY: 0,
    });

    const isPanMode = interactionMode === 'pan' || isSpacePressed;

    const autoLayoutPositions = useMemo(() => {
        const overlaps = (a, b, padding = 32) => (
            a.x < b.x + b.w + padding
            && a.x + a.w + padding > b.x
            && a.y < b.y + b.h + padding
            && a.y + a.h + padding > b.y
        );

        const startX = 120;
        const startY = 120;
        const slotW = 360;
        const slotH = 260;
        const maxColumns = 9;

        const occupiedRects = [];
        const autoPositions = new Map();

        items.forEach((item) => {
            const x = parseCanvasNumber(item.canvas?.x);
            const y = parseCanvasNumber(item.canvas?.y);
            if (x === null || y === null) return;
            const size = getDefaultItemSize(item);
            occupiedRects.push({
                x,
                y,
                w: parseCanvasNumber(item.canvas?.w) || size.w,
                h: parseCanvasNumber(item.canvas?.h) || size.h,
            });
        });

        let slotIndex = 0;
        items.forEach((item) => {
            const hasSavedX = parseCanvasNumber(item.canvas?.x) !== null;
            const hasSavedY = parseCanvasNumber(item.canvas?.y) !== null;
            if (hasSavedX && hasSavedY) return;

            const size = getDefaultItemSize(item);
            let attempts = 0;
            let placed = null;

            while (!placed && attempts < 800) {
                const col = slotIndex % maxColumns;
                const row = Math.floor(slotIndex / maxColumns);
                const candidate = {
                    x: startX + (col * slotW),
                    y: startY + (row * slotH),
                    w: size.w,
                    h: size.h,
                };
                const collides = occupiedRects.some((rect) => overlaps(candidate, rect));
                if (!collides) {
                    placed = candidate;
                    break;
                }
                slotIndex += 1;
                attempts += 1;
            }

            if (!placed) {
                const col = slotIndex % maxColumns;
                const row = Math.floor(slotIndex / maxColumns);
                placed = {
                    x: startX + (col * slotW),
                    y: startY + (row * slotH),
                    w: size.w,
                    h: size.h,
                };
            }

            autoPositions.set(item.id, { x: placed.x, y: placed.y });
            occupiedRects.push(placed);
            slotIndex += 1;
        });

        return autoPositions;
    }, [items]);

    const itemCanvasRects = useMemo(() => {
        const rectMap = new Map();
        items.forEach((item) => {
            const fallbackPos = autoLayoutPositions.get(item.id) || { x: 120, y: 120 };
            const fallbackSize = getDefaultItemSize(item);
            rectMap.set(item.id, {
                x: parseCanvasNumber(item.canvas?.x) ?? fallbackPos.x,
                y: parseCanvasNumber(item.canvas?.y) ?? fallbackPos.y,
                w: parseCanvasNumber(item.canvas?.w) ?? fallbackSize.w,
                h: parseCanvasNumber(item.canvas?.h) ?? fallbackSize.h,
            });
        });
        return rectMap;
    }, [items, autoLayoutPositions]);

    const handleTransformed = useCallback((_ref, state) => {
        if (!state) return;
        setTransformSnapshot((prev) => {
            const next = {
                scale: state.scale || 1,
                positionX: state.positionX || 0,
                positionY: state.positionY || 0,
            };
            if (
                prev.scale === next.scale
                && prev.positionX === next.positionX
                && prev.positionY === next.positionY
            ) {
                return prev;
            }
            return next;
        });
    }, []);

    const handleItemSelect = useCallback((itemId, event) => {
        setSelectionDraft(null);
        setSelectedIds((prev) => {
            const additive = Boolean(event?.metaKey || event?.ctrlKey || event?.shiftKey);
            if (!additive) {
                return new Set([itemId]);
            }

            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    }, []);

    const handleBackgroundMouseDown = useCallback((event) => {
        if (event.button !== 0) return;
        if (isPanMode) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.canvas-item-root')) return;
        if (isTypingTarget(target)) return;

        event.preventDefault();
        setSelectionDraft({
            startX: event.clientX,
            startY: event.clientY,
            currentX: event.clientX,
            currentY: event.clientY,
        });
    }, [isPanMode]);

    useEffect(() => {
        if (!selectionDraft) return undefined;

        const handleMouseMove = (event) => {
            setSelectionDraft((prev) => (
                prev
                    ? { ...prev, currentX: event.clientX, currentY: event.clientY }
                    : prev
            ));
        };

        const handleMouseUp = () => {
            const rect = getNormalizedClientRect(selectionDraft);
            if (rect.width < MIN_SELECTION_DRAG_PX && rect.height < MIN_SELECTION_DRAG_PX) {
                setSelectedIds(new Set());
                setSelectionDraft(null);
                return;
            }

            const hitIds = [];
            itemCanvasRects.forEach((itemRect, itemId) => {
                const screenRect = {
                    left: (itemRect.x * transformSnapshot.scale) + transformSnapshot.positionX,
                    top: (itemRect.y * transformSnapshot.scale) + transformSnapshot.positionY,
                    right: ((itemRect.x + itemRect.w) * transformSnapshot.scale) + transformSnapshot.positionX,
                    bottom: ((itemRect.y + itemRect.h) * transformSnapshot.scale) + transformSnapshot.positionY,
                };
                if (rectanglesIntersect(rect, screenRect)) {
                    hitIds.push(itemId);
                }
            });

            setSelectedIds(new Set(hitIds));
            setSelectionDraft(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [selectionDraft, itemCanvasRects, transformSnapshot]);

    useEffect(() => {
        const itemIds = new Set(items.map((item) => item.id));
        setSelectedIds((prev) => {
            const next = new Set([...prev].filter((id) => itemIds.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [items]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (isTypingTarget(event.target)) return;

            if (event.code === 'Space') {
                event.preventDefault();
                if (!event.repeat) setIsSpacePressed(true);
                return;
            }

            if ((event.key === 'Backspace' || event.key === 'Delete') && selectedIds.size > 0) {
                event.preventDefault();
                selectedIds.forEach((id) => onDeleteItem(id));
                setSelectedIds(new Set());
                return;
            }

            if (event.key === 'Escape') {
                setSelectionDraft(null);
                setSelectedIds(new Set());
            }
        };

        const handleKeyUp = (event) => {
            if (event.code === 'Space') {
                setIsSpacePressed(false);
            }
        };

        const handleWindowBlur = () => {
            setIsSpacePressed(false);
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', handleWindowBlur);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', handleWindowBlur);
        };
    }, [selectedIds, onDeleteItem]);

    const selectionOverlayRect = useMemo(() => {
        if (!selectionDraft || !containerRef.current) return null;
        const containerRect = containerRef.current.getBoundingClientRect();
        const rect = getNormalizedClientRect(selectionDraft);
        return {
            left: rect.left - containerRect.left,
            top: rect.top - containerRect.top,
            width: rect.width,
            height: rect.height,
        };
    }, [selectionDraft]);

    return (
        <div
            ref={containerRef}
            className={`w-full h-full bg-[#f4f4f5] overflow-hidden relative canvas-container rounded-2xl border border-zinc-200 ${isPanMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
        >
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 bg-white p-1.5 rounded-lg shadow-lg border border-zinc-200">
                <button
                    onClick={() => setInteractionMode('select')}
                    className={`p-2 rounded-md transition-colors ${interactionMode === 'select' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
                    title="Select / Area Select"
                >
                    <MousePointer2 size={18} />
                </button>
                <button
                    onClick={() => setInteractionMode('pan')}
                    className={`p-2 rounded-md transition-colors ${interactionMode === 'pan' ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
                    title="Pan Canvas"
                >
                    <Hand size={18} />
                </button>
            </div>

            <TransformWrapper
                initialScale={1}
                minScale={MIN_SCALE}
                maxScale={MAX_SCALE}
                disabled={false}
                limitToBounds={false}
                wheel={{ disabled: true }}
                doubleClick={{ disabled: true }}
                zoomAnimation={{ disabled: true }}
                panning={{
                    disabled: false,
                    velocityDisabled: true,
                    allowLeftClickPan: isPanMode,
                    allowMiddleClickPan: isPanMode,
                    allowRightClickPan: false,
                    wheelPanning: false,
                    activationKeys: [],
                }}
                onTransformed={handleTransformed}
            >
                {({ zoomIn, zoomOut, resetTransform, setTransform, state }) => {
                    const scale = state?.scale ?? transformSnapshot.scale;
                    const positionX = state?.positionX ?? transformSnapshot.positionX;
                    const positionY = state?.positionY ?? transformSnapshot.positionY;

                    const gridSpacing = Math.max(8, 20 * scale);
                    const gridOffsetX = normalizeOffset(positionX, gridSpacing);
                    const gridOffsetY = normalizeOffset(positionY, gridSpacing);
                    const dotSize = Math.max(0.8, Math.min(2, scale));

                    const handleCanvasWheel = (event) => {
                        event.preventDefault();
                        event.stopPropagation();

                        const isZoomGesture = event.metaKey || event.ctrlKey;
                        if (isZoomGesture) {
                            const nextScale = Math.max(
                                MIN_SCALE,
                                Math.min(MAX_SCALE, scale * (event.deltaY < 0 ? 1.06 : 0.94))
                            );
                            if (nextScale === scale) return;

                            const containerRect = containerRef.current?.getBoundingClientRect();
                            if (!containerRect) {
                                setTransform(positionX, positionY, nextScale, 0);
                                return;
                            }

                            const pointerX = event.clientX - containerRect.left;
                            const pointerY = event.clientY - containerRect.top;
                            const worldX = (pointerX - positionX) / scale;
                            const worldY = (pointerY - positionY) / scale;

                            const nextPositionX = pointerX - (worldX * nextScale);
                            const nextPositionY = pointerY - (worldY * nextScale);
                            setTransform(nextPositionX, nextPositionY, nextScale, 0);
                            return;
                        }

                        const nextPositionX = positionX - event.deltaX;
                        const nextPositionY = positionY - event.deltaY;
                        setTransform(nextPositionX, nextPositionY, scale, 0);
                    };

                    return (
                        <React.Fragment>
                            <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2">
                                <button onClick={() => zoomIn()} className="p-2 bg-white rounded-md shadow border border-zinc-200 hover:bg-zinc-50 text-zinc-600">+</button>
                                <button onClick={() => zoomOut()} className="p-2 bg-white rounded-md shadow border border-zinc-200 hover:bg-zinc-50 text-zinc-600">-</button>
                                <button onClick={() => resetTransform()} className="p-2 bg-white rounded-md shadow border border-zinc-200 hover:bg-zinc-50 text-zinc-600">100%</button>
                            </div>

                            <div
                                className="absolute inset-0 z-0 pointer-events-none"
                                style={{
                                    backgroundImage: `radial-gradient(circle, rgba(39, 39, 42, 0.24) ${dotSize}px, transparent ${dotSize + 0.2}px)`,
                                    backgroundSize: `${gridSpacing}px ${gridSpacing}px`,
                                    backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`
                                }}
                            />

                            {selectionOverlayRect ? (
                                <div
                                    className="absolute z-40 pointer-events-none border border-orange-500/70 bg-orange-400/12 rounded-md"
                                    style={selectionOverlayRect}
                                />
                            ) : null}

                            <TransformComponent
                                wrapperClass="w-full h-full"
                                contentClass="w-full h-full dreamlab-canvas-content"
                                wrapperProps={{
                                    onMouseDown: handleBackgroundMouseDown,
                                    onWheel: handleCanvasWheel,
                                }}
                                contentStyle={{ width: `${CANVAS_WIDTH}px`, height: `${CANVAS_HEIGHT}px` }}
                            >
                                {items.map((item) => (
                                    <CanvasItem
                                        key={item.id}
                                        item={item}
                                        initialPosition={autoLayoutPositions.get(item.id)}
                                        onUpdate={onUpdateItem}
                                        isSelected={selectedIds.has(item.id)}
                                        onSelect={handleItemSelect}
                                        onOpenDetails={onOpenItem}
                                        scale={scale}
                                        isPanMode={isPanMode}
                                    />
                                ))}
                            </TransformComponent>
                        </React.Fragment>
                    );
                }}
            </TransformWrapper>
        </div>
    );
};

export default CanvasView;
