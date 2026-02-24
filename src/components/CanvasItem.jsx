import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Rnd } from 'react-rnd';
import { Camera, Link as LinkIcon, FileText, Info, Palette } from 'lucide-react';
import { getHeroTextForItem, getSupportingTextForItem } from '../utils/textPresentation';
import { useResolvedImageSource } from '../hooks/useResolvedImageSource';
import { renderMarkdownText, hasMarkdownHeadings } from '../utils/markdownText';
import { getTweetDisplayText, isTweetStatusUrl, shouldShowTweetMedia } from '../utils/tweetCard';
import BlockEditor from './BlockEditor';

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

const getLinkTextPayload = (item) => {
    if (item?.type !== 'link') return { ready: false, title: '', byline: '', content: '' };
    const textExtractContent = String(item?.textExtract?.content || '').trim();
    const tweetFallback = getTweetDisplayText(item);
    const contentFallback = String(item?.content || '').trim();
    const isTweetLink = isTweetStatusUrl(item?.linkEmbed?.url || item?.sourceUrl || item?.content);
    const content = isTweetLink
        ? (textExtractContent || tweetFallback)
        : (textExtractContent || tweetFallback || contentFallback);

    return {
        ready: Boolean(content),
        title: String(item?.textExtract?.title || item?.title || '').trim(),
        byline: String(item?.textExtract?.byline || item?.linkEmbed?.authorName || '').trim(),
        content,
    };
};

const CanvasItem = ({
    item,
    initialPosition = null,
    projectDraft = null,
    onUpdate,
    onProjectDraftUpdate,
    isSelected,
    isDetailFocused = false,
    isEditing = false,
    onFinishEditing,
    onSelect,
    onOpenDetails,
    scale,
    isPanMode = false,
    layoutMode = 'collection',
}) => {
    // Default dimensions based on type
    const defaultWidth = item.type === 'color' ? 160 : (item.type === 'image' || item.type === 'video') ? 300 : 280;
    const defaultHeight = item.type === 'color' ? 160 : (item.type === 'image' || item.type === 'video') ? 200 : 160;

    const [position, setPosition] = useState(() => {
        const fallbackX = parseSize(initialPosition?.x, 120);
        const fallbackY = parseSize(initialPosition?.y, 120);
        const x = layoutMode === 'project'
            ? parseSize(projectDraft?.x, fallbackX)
            : parseSize(item.canvas?.x, fallbackX);
        const y = layoutMode === 'project'
            ? parseSize(projectDraft?.y, fallbackY)
            : parseSize(item.canvas?.y, fallbackY);
        return { x, y };
    });

    const [size, setSize] = useState(() => {
        const w = layoutMode === 'project'
            ? parseSize(projectDraft?.w, parseSize(item.canvas?.w, defaultWidth))
            : parseSize(item.canvas?.w, defaultWidth);
        const h = layoutMode === 'project'
            ? parseSize(projectDraft?.h, parseSize(item.canvas?.h, defaultHeight))
            : parseSize(item.canvas?.h, defaultHeight);
        return { width: w, height: h };
    });
    const [mediaAspectRatio, setMediaAspectRatio] = useState(null);
    const heroText = getHeroTextForItem(item);
    const supportingText = getSupportingTextForItem(item);
    const linkTextPayload = getLinkTextPayload(item);
    const showLinkAsText = item.type === 'link' && item.linkViewMode === 'text' && linkTextPayload.ready;
    const resolvedImageSource = useResolvedImageSource(item.type === 'image' ? item.content : '');
    const resolvedImageThumb = useResolvedImageSource(item.type === 'image' && item.thumbnail ? item.thumbnail : '');
    const resolvedVideoSource = useResolvedImageSource(item.type === 'video' ? item.content : '');
    const resolvedLinkThumbnailSource = useResolvedImageSource(item.type === 'link' ? item.thumbnail : '');
    const linkThumbnailSource = resolvedLinkThumbnailSource || item.thumbnail;
    const isTweetLink = isTweetStatusUrl(item?.linkEmbed?.url || item?.sourceUrl || item?.content);
    const tweetText = getTweetDisplayText(item) || null;
    const linkPreviewThumbnail = isTweetLink
        ? (shouldShowTweetMedia(item, linkThumbnailSource) ? linkThumbnailSource : '')
        : linkThumbnailSource;
    const hasSavedSize = hasFiniteNumber(item.canvas?.w) && hasFiniteNumber(item.canvas?.h);
    const mediaSource = item.type === 'image'
        ? (resolvedImageThumb || resolvedImageSource || item.content)
        : item.type === 'video'
            ? (resolvedVideoSource || '')
            : (showLinkAsText ? null : linkPreviewThumbnail);
    const hasMediaCard = item.type === 'image' || item.type === 'video' || (item.type === 'link' && !showLinkAsText && Boolean(linkPreviewThumbnail));
    const isResizableCard = hasMediaCard || item.type === 'text' || item.type === 'color';
    const hasAutoSizedFromMediaRef = useRef(false);
    const suppressClickRef = useRef(false);
    const dragStateRef = useRef({ startX: 0, startY: 0, moved: false });
    const [editText, setEditText] = useState(item.content || '');

    useEffect(() => {
        if (!isEditing) setEditText(item.content || '');
    }, [item.content, isEditing]);

    useEffect(() => {
        const fallbackX = parseSize(initialPosition?.x, 120);
        const fallbackY = parseSize(initialPosition?.y, 120);
        const nextPosition = {
            x: layoutMode === 'project'
                ? parseSize(projectDraft?.x, fallbackX)
                : parseSize(item.canvas?.x, fallbackX),
            y: layoutMode === 'project'
                ? parseSize(projectDraft?.y, fallbackY)
                : parseSize(item.canvas?.y, fallbackY),
        };
        const nextSize = {
            width: layoutMode === 'project'
                ? parseSize(projectDraft?.w, parseSize(item.canvas?.w, defaultWidth))
                : parseSize(item.canvas?.w, defaultWidth),
            height: layoutMode === 'project'
                ? parseSize(projectDraft?.h, parseSize(item.canvas?.h, defaultHeight))
                : parseSize(item.canvas?.h, defaultHeight),
        };

        setPosition((prev) => (
            prev.x === nextPosition.x && prev.y === nextPosition.y ? prev : nextPosition
        ));
        setSize((prev) => (
            prev.width === nextSize.width && prev.height === nextSize.height ? prev : nextSize
        ));
    }, [
        layoutMode,
        projectDraft?.x,
        projectDraft?.y,
        projectDraft?.w,
        projectDraft?.h,
        initialPosition?.x,
        initialPosition?.y,
        item.canvas?.x,
        item.canvas?.y,
        item.canvas?.w,
        item.canvas?.h,
        defaultWidth,
        defaultHeight,
    ]);

    // Debounce save
    const timeoutRef = useRef(null);

    const handleDragStop = (e, d) => {
        const newPos = { x: d.x, y: d.y };
        setPosition(newPos);
        if (layoutMode === 'project') {
            onProjectDraftUpdate?.(item.id, {
                x: newPos.x,
                y: newPos.y,
                w: parseSize(size.width, defaultWidth),
                h: parseSize(size.height, defaultHeight),
                z: item.canvas?.z || 1,
            });
        } else {
            saveChanges(newPos, size);
        }
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
        if (layoutMode === 'project') {
            onProjectDraftUpdate?.(item.id, {
                x: pos.x,
                y: pos.y,
                w: parseSize(newSize.width, defaultWidth),
                h: parseSize(newSize.height, defaultHeight),
                z: item.canvas?.z || 1,
            });
        } else {
            saveChanges(pos, newSize);
        }
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
        if (layoutMode === 'project') {
            onProjectDraftUpdate?.(item.id, {
                x: position.x,
                y: position.y,
                w: parseSize(nextSize.width, defaultWidth),
                h: parseSize(nextSize.height, defaultHeight),
                z: item.canvas?.z || 1,
            });
        } else {
            saveChanges(position, nextSize);
        }
        hasAutoSizedFromMediaRef.current = true;
    }, [hasMediaCard, mediaAspectRatio, hasSavedSize, size.width, size.height, defaultWidth, position, layoutMode, item.id, item.canvas?.z, onProjectDraftUpdate, defaultHeight]);

    const getTypeIcon = (type) => {
        switch (type) {
            case 'image': return <Camera className="w-4 h-4" />;
            case 'text': return <FileText className="w-4 h-4" />;
            case 'link': return <LinkIcon className="w-4 h-4" />;
            case 'color': return <Palette className="w-4 h-4" />;
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
            style={{ zIndex: isDetailFocused ? 999 : isSelected ? 1000 : (item.canvas?.z || 1) }}
            className={`group canvas-item-root ${isSelected ? 'z-50' : ''}`}
            disableDragging={isPanMode || isEditing}
            cancel=".canvas-item-no-drag, a, button, input, textarea, select"
            enableResizing={!isPanMode && isResizableCard}
            lockAspectRatio={lockAspectRatio}
            minWidth={item.type === 'text' ? 220 : 200}
            minHeight={item.type === 'text' ? 140 : 100}
        >
            <div
                className={`group relative flex h-full w-full flex-col overflow-hidden rounded-lg bg-white shadow-sm transition-all duration-200
                    ${isDetailFocused
                        ? 'border-2 border-orange-500 ring-2 ring-orange-400/40 ring-offset-2 shadow-lg'
                        : isSelected
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
                <div className="absolute bottom-2 left-2 z-20 flex opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
                            src={resolvedImageThumb || resolvedImageSource || item.content}
                            alt={item.title || 'Captured Image'}
                            className="w-full h-full object-contain pointer-events-none bg-white"
                        />
                    )}

                    {item.type === 'video' && (
                        <video
                            src={resolvedVideoSource || ''}
                            className="w-full h-full object-contain pointer-events-none bg-white"
                            muted
                            loop
                            playsInline
                            autoPlay
                        />
                    )}

                    {item.type === 'link' && (
                        showLinkAsText ? (
                            <div className="w-full h-full bg-white p-4 flex flex-col gap-3 overflow-hidden">
                                {linkTextPayload.title ? (
                                    <h3 className="text-heading-3 font-semibold text-[var(--ds-gray-1000)] line-clamp-2 text-left leading-snug">
                                        {linkTextPayload.title}
                                    </h3>
                                ) : null}
                                {linkTextPayload.byline ? (
                                    <p className="text-caption text-[var(--ds-gray-700)] line-clamp-1 text-left">
                                        {linkTextPayload.byline}
                                    </p>
                                ) : null}
                                <p className="text-body text-[var(--ds-gray-1000)] leading-relaxed line-clamp-7 text-left break-words">
                                    {linkTextPayload.content}
                                </p>
                                <span className="mt-auto text-caption text-[var(--ds-gray-700)] truncate">
                                    {domainName(item.sourceUrl)}
                                </span>
                            </div>
                        ) : isTweetLink ? (
                            <div className="w-full h-full bg-white flex flex-col overflow-hidden">
                                <div className="p-3 flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="font-bold text-xs text-neutral-900 truncate">{item.linkEmbed?.authorName || 'Post'}</span>
                                            {item.linkEmbed?.authorUrl && (
                                                <span className="text-[11px] text-neutral-400 truncate">
                                                    {(() => { try { const p = new URL(item.linkEmbed.authorUrl).pathname; const h = p.split('/').filter(Boolean)[0]; return h ? `@${h}` : ''; } catch { return ''; } })()}
                                                </span>
                                            )}
                                        </div>
                                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0 text-neutral-400" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                                    </div>
                                    <p className="text-xs text-neutral-800 leading-relaxed line-clamp-5 text-left">
                                        {tweetText || item.title || 'Tweet'}
                                    </p>
                                </div>
                                {linkPreviewThumbnail && (
                                    <img
                                        src={linkPreviewThumbnail}
                                        alt="Tweet media"
                                        className="w-full flex-1 object-cover"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                )}
                            </div>
                        ) : linkPreviewThumbnail ? (
                            <img
                                src={linkPreviewThumbnail}
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

                    {item.type === 'link' && !isTweetLink && (
                        <div className={`canvas-link-fallback w-full h-full bg-zinc-50 flex flex-col items-center justify-center p-4 ${linkPreviewThumbnail ? 'hidden' : 'flex'}`}>
                            <LinkIcon size={42} className="text-zinc-200 mb-2" />
                            <span className="text-xs text-zinc-400 font-mono truncate max-w-full">
                                {domainName(item.sourceUrl)}
                            </span>
                        </div>
                    )}

                    {item.type === 'text' && (
                        isEditing ? (
                            <div className="w-full h-full p-5 bg-white flex flex-col">
                                <BlockEditor
                                    value={editText}
                                    onChange={setEditText}
                                    onBlur={() => onFinishEditing?.(item.id, editText)}
                                    onSubmit={() => onFinishEditing?.(item.id, editText)}
                                    placeholder="Start typing..."
                                    className="canvas-item-no-drag w-full h-full"
                                    autoFocus
                                />
                            </div>
                        ) : (
                            <div className="w-full h-full p-5 bg-white flex flex-col items-start justify-start gap-2.5 overflow-hidden">
                                {hasMarkdownHeadings(item.content) ? (
                                    renderMarkdownText(item.content, { clampLines: 9 })
                                ) : (
                                    <>
                                        <p className="text-heading-2 font-medium text-[var(--ds-gray-1000)] line-clamp-4 text-left leading-snug w-full">
                                            {heroText}
                                        </p>
                                        {supportingText ? (
                                            <p className="text-body text-[var(--ds-gray-700)] line-clamp-5 text-left leading-relaxed w-full">
                                                {supportingText}
                                            </p>
                                        ) : null}
                                    </>
                                )}
                            </div>
                        )
                    )}

                    {item.type === 'color' && (
                        <div
                            className="w-full h-full flex items-end justify-start p-3"
                            style={{ backgroundColor: item.content }}
                        >
                            <span className="text-xs font-mono font-semibold px-2 py-1 rounded-md bg-black/20 text-white backdrop-blur-sm uppercase">
                                {item.content}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </Rnd>
    );
};

export default CanvasItem;
