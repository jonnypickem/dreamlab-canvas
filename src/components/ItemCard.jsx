import React, { useState, useEffect, useRef } from 'react';
import { Camera, Link as LinkIcon, FileText, Check } from 'lucide-react';
import { getHeroTextForItem, getSupportingTextForItem } from '../utils/textPresentation';
import { useResolvedImageSource } from '../hooks/useResolvedImageSource';

const getLinkTextPayload = (item) => {
    if (item?.type !== 'link') return { ready: false, title: '', byline: '', content: '' };
    const extractedContent = String(item?.textExtract?.content || '').trim();
    const tweetFallback = String(item?.linkEmbed?.tweetText || '').trim();
    const contentFallback = String(item?.content || '').trim();
    const content = extractedContent || tweetFallback || contentFallback;
    return {
        ready: Boolean(content),
        title: String(item?.textExtract?.title || item?.title || '').trim(),
        byline: String(item?.textExtract?.byline || item?.linkEmbed?.authorName || '').trim(),
        content,
    };
};

function ItemCard({ item, onClick, isSelected = false, onSelect }) {
    const [isVisible, setIsVisible] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);
    const cardRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '100px' }
        );

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const getTypeIcon = () => {
        switch (item.type) {
            case 'image': return <Camera size={16} className="text-white" />;
            case 'link': return <LinkIcon size={16} className="text-white" />;
            case 'text': return <FileText size={16} className="text-white" />;
            default: return <LinkIcon size={16} className="text-white" />;
        }
    };
    const heroText = getHeroTextForItem(item);
    const supportingText = getSupportingTextForItem(item);
    const linkTextPayload = getLinkTextPayload(item);
    const showLinkAsText = item.type === 'link' && item.linkViewMode === 'text' && linkTextPayload.ready;
    const resolvedImageSource = useResolvedImageSource(item.type === 'image' ? item.content : '');
    const resolvedLinkThumbnailSource = useResolvedImageSource(item.type === 'link' ? item.thumbnail : '');
    // Only fall back to raw item.thumbnail if it's already a renderable URL (http/data/blob).
    // Supabase storage paths must be resolved via the hook — don't use them as raw <img> src.
    const rawThumbnailIsUrl = item.thumbnail && (item.thumbnail.startsWith('http') || item.thumbnail.startsWith('data:') || item.thumbnail.startsWith('blob:'));
    const linkThumbnailSource = resolvedLinkThumbnailSource || (rawThumbnailIsUrl ? item.thumbnail : '');

    const domainName = (url) => {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch (e) {
            return url;
        }
    };

    const handleClick = (e) => {
        // Check for modifier keys for selection
        const isModifierClick = e.metaKey || e.ctrlKey || e.shiftKey;

        if (onSelect && (isModifierClick || isSelected)) {
            // Selection mode
            onSelect(item.id, {
                shiftKey: e.shiftKey,
                metaKey: e.metaKey || e.ctrlKey
            });
        } else if (!isModifierClick) {
            // Normal click - open modal
            onClick?.();
        }
    };

    return (
        <div
            ref={cardRef}
            onClick={handleClick}
            className={`group relative rounded-lg border bg-white shadow-sm transition-all duration-200 cursor-pointer overflow-hidden
                ${isSelected
                    ? 'border-2 border-orange-600 shadow-lg'
                    : 'border border-[var(--ds-gray-200)] hover:border-orange-600 hover:shadow-md'
                }`}
            style={{ breakInside: 'avoid' }}
        >
            {/* Selection Checkmark - Top Right */}
            {isSelected && (
                <div className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center shadow-md">
                    <Check size={14} className="text-white" strokeWidth={3} />
                </div>
            )}

            {/* Type Indicator - Visible on Hover */}
            <div className="absolute top-2 left-2 z-10 flex opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="bg-white shadow-sm border border-neutral-100 p-1.5 rounded-md flex items-center justify-center">
                    {React.cloneElement(getTypeIcon(), { className: "text-orange-600", size: 14 })}
                </div>
            </div>

            {/* Content Rendering */}
            {item.isLoading ? (
                <div className="w-full min-h-[200px] bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-50 bg-[length:200%_100%] animate-shimmer flex flex-col items-center justify-center gap-3 p-4">
                    <div className="w-10 h-10 border-[3px] border-zinc-200 border-t-orange-500 rounded-full animate-spin" />
                    <span className="text-xs text-zinc-400 font-medium">Loading preview...</span>
                    {item.sourceUrl && (
                        <span className="text-[11px] text-zinc-300 font-mono truncate max-w-full">
                            {domainName(item.sourceUrl)}
                        </span>
                    )}
                </div>
            ) : isVisible ? (
                <>
                    {/* Image Type */}
                    {item.type === 'image' && (
                        <>
                            {!imgLoaded && (
                                <div className="w-full min-h-[200px] bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-50 bg-[length:200%_100%] animate-shimmer" />
                            )}
                            <img
                                src={resolvedImageSource || item.content}
                                alt={item.title || 'Captured Image'}
                                className={`w-full max-h-[600px] object-cover object-top block ${imgLoaded ? '' : 'hidden'}`}
                                onLoad={() => setImgLoaded(true)}
                            />
                        </>
                    )}

                    {/* Link Type */}
                    {item.type === 'link' && (
                        showLinkAsText ? (
                            <div className="w-full bg-white p-4 min-h-[170px] flex flex-col gap-3">
                                {linkTextPayload.title ? (
                                    <h3 className="text-heading-3 font-semibold text-[var(--ds-gray-1000)] leading-snug line-clamp-2 text-left">
                                        {linkTextPayload.title}
                                    </h3>
                                ) : null}
                                {linkTextPayload.byline ? (
                                    <p className="text-caption text-[var(--ds-gray-700)] line-clamp-1 text-left">
                                        {linkTextPayload.byline}
                                    </p>
                                ) : null}
                                <p className="text-body text-[var(--ds-gray-1000)] leading-relaxed line-clamp-5 text-left break-words">
                                    {linkTextPayload.content}
                                </p>
                                <span className="text-caption text-[var(--ds-gray-700)] truncate">
                                    {domainName(item.sourceUrl)}
                                </span>
                            </div>
                        ) : item.linkEmbed?.type === 'tweet' && item.linkEmbed?.status === 'ready' ? (
                            <div className="w-full bg-white p-4 min-h-[170px] flex flex-col gap-3">
                                <div className="flex items-center gap-2 text-xs text-neutral-500">
                                    <span className="font-semibold text-neutral-800">X</span>
                                    <span>{item.linkEmbed?.authorName || domainName(item.sourceUrl)}</span>
                                </div>
                                <p className="text-body text-[var(--ds-gray-1000)] leading-relaxed line-clamp-5 text-left">
                                    {item.linkEmbed?.tweetText || item.title || item.content || 'Tweet'}
                                </p>
                                <span className="text-caption text-[var(--ds-gray-700)] truncate">
                                    {domainName(item.sourceUrl)}
                                </span>
                            </div>
                        ) : linkThumbnailSource && !imgError ? (
                            <>
                                {!imgLoaded && (
                                    <div className="w-full min-h-[200px] bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-50 bg-[length:200%_100%] animate-shimmer" />
                                )}
                                <img
                                    src={linkThumbnailSource}
                                    alt={item.title || 'Link Thumbnail'}
                                    className={`w-full h-auto block ${imgLoaded ? '' : 'hidden'}`}
                                    onLoad={() => setImgLoaded(true)}
                                    onError={() => setImgError(true)}
                                />
                            </>
                        ) : null
                    )}
                    {/* Fallback for Link if no thumbnail or error load */}
                    {item.type === 'link' && (!linkThumbnailSource || imgError || !isVisible) && (
                        <div
                            className={`w-full aspect-video bg-zinc-50 flex flex-col items-center justify-center p-4 ${linkThumbnailSource && !imgError ? 'hidden' : 'flex'}`}
                        >
                            <LinkIcon size={48} className="text-zinc-200 mb-2" />
                            <span className="text-xs text-zinc-400 font-mono truncate max-w-full">
                                {domainName(item.sourceUrl)}
                            </span>
                        </div>
                    )}

                    {/* Text Type */}
                    {item.type === 'text' && (
                        <div className="p-5 bg-white min-h-[150px] flex flex-col items-start justify-start gap-2.5">
                            <p className="text-heading-2 font-medium text-[var(--ds-gray-1000)] line-clamp-3 text-left leading-snug w-full">
                                {heroText}
                            </p>
                            {supportingText ? (
                                <p className="text-body text-[var(--ds-gray-700)] line-clamp-4 text-left leading-relaxed w-full">
                                    {supportingText}
                                </p>
                            ) : null}
                        </div>
                    )}
                </>
            ) : (
                // Loading Placeholder
                <div className="w-full h-48 bg-zinc-50 animate-pulse" />
            )}
        </div>
    );
}

export default ItemCard;
