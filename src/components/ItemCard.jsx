import React, { useState, useEffect, useRef } from 'react';
import { Camera, Link as LinkIcon, FileText, Video, Check, Palette } from 'lucide-react';
import { getHeroTextForItem, getSupportingTextForItem } from '../utils/textPresentation';
import { useResolvedImageSource } from '../hooks/useResolvedImageSource';
import { renderMarkdownText, hasMarkdownHeadings } from '../utils/markdownText';
import { getTweetDisplayText, isLikelyTweetAvatarImage, isTweetStatusUrl, shouldShowTweetMedia } from '../utils/tweetCard';
import BlockEditor from './BlockEditor';
import TweetEmbed from './TweetEmbed';

const getLinkTextPayload = (item) => {
    if (item?.type !== 'link') return { ready: false, title: '', byline: '', content: '' };
    const extractedContent = String(item?.textExtract?.content || '').trim();
    const tweetFallback = getTweetDisplayText(item);
    const contentFallback = String(item?.content || '').trim();
    const isTweetLink = isTweetStatusUrl(item?.linkEmbed?.url || item?.sourceUrl || item?.content);
    const content = isTweetLink
        ? (extractedContent || tweetFallback)
        : (extractedContent || tweetFallback || contentFallback);
    return {
        ready: Boolean(content),
        title: String(item?.textExtract?.title || item?.title || '').trim(),
        byline: String(item?.textExtract?.byline || item?.linkEmbed?.authorName || '').trim(),
        content,
    };
};

function ItemCard({ item, onClick, isSelected = false, onSelect, isEditing = false, onFinishEditing }) {
    const [isVisible, setIsVisible] = useState(false);
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);
    const [editText, setEditText] = useState(item.content || '');
    const cardRef = useRef(null);

    useEffect(() => {
        if (!isEditing) setEditText(item.content || '');
    }, [item.content, isEditing]);

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
            case 'video': return <Video size={16} className="text-white" />;
            case 'link': return <LinkIcon size={16} className="text-white" />;
            case 'text': return <FileText size={16} className="text-white" />;
            case 'color': return <Palette size={16} className="text-white" />;
            default: return <LinkIcon size={16} className="text-white" />;
        }
    };
    const heroText = getHeroTextForItem(item);
    const supportingText = getSupportingTextForItem(item);
    const linkTextPayload = getLinkTextPayload(item);
    const showLinkAsText = item.type === 'link' && item.linkViewMode === 'text' && linkTextPayload.ready;
    const resolvedImageSource = useResolvedImageSource(item.type === 'image' ? item.content : '');
    const resolvedImageThumb = useResolvedImageSource(item.type === 'image' && item.thumbnail ? item.thumbnail : '');
    const resolvedVideoSource = useResolvedImageSource(item.type === 'video' ? item.content : '');
    const resolvedLinkThumbnailSource = useResolvedImageSource(item.type === 'link' ? item.thumbnail : '');
    // Only fall back to raw item.thumbnail if it's already a renderable URL (http/data/blob).
    // Supabase storage paths must be resolved via the hook — don't use them as raw <img> src.
    const rawThumbnailIsUrl = item.thumbnail && (item.thumbnail.startsWith('http') || item.thumbnail.startsWith('data:') || item.thumbnail.startsWith('blob:'));
    const linkThumbnailSource = resolvedLinkThumbnailSource || (rawThumbnailIsUrl ? item.thumbnail : '');
    const isTweetLink = isTweetStatusUrl(item?.linkEmbed?.url || item?.sourceUrl || item?.content);
    const tweetText = getTweetDisplayText(item) || null;
    const isTweetAvatarImage = isLikelyTweetAvatarImage(linkThumbnailSource);
    const tweetMediaUrl = shouldShowTweetMedia(item, linkThumbnailSource) ? linkThumbnailSource : undefined;

    const domainName = (url) => {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch (e) {
            return url;
        }
    };

    const handleClick = (e) => {
        if (isEditing) return;
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
                                src={resolvedImageThumb || resolvedImageSource || item.content}
                                alt={item.title || 'Captured Image'}
                                className={`w-full max-h-[600px] object-cover object-top block ${imgLoaded ? '' : 'hidden'}`}
                                onLoad={() => setImgLoaded(true)}
                            />
                        </>
                    )}

                    {/* Video Type */}
                    {item.type === 'video' && (
                        <>
                            {!imgLoaded && (
                                <div className="w-full min-h-[200px] bg-gradient-to-r from-zinc-50 via-zinc-100 to-zinc-50 bg-[length:200%_100%] animate-shimmer flex items-center justify-center">
                                    <Video size={32} className="text-zinc-300" />
                                </div>
                            )}
                            <video
                                src={resolvedVideoSource || ''}
                                className={`w-full max-h-[600px] object-cover object-top block ${imgLoaded ? '' : 'hidden'}`}
                                onLoadedData={() => setImgLoaded(true)}
                                muted
                                loop
                                playsInline
                                onMouseEnter={(e) => e.target.play()}
                                onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }}
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
                        ) : isTweetLink ? (
                            <div className="w-full h-full flex items-center justify-center p-0 bg-zinc-50 border-t border-zinc-100">
                                {(() => {
                                    let authorName = item.linkEmbed?.authorName;
                                    let authorHandle = undefined;
                                    if (!authorName && item.title) {
                                        const titleClean = item.title.replace(/ on X$/i, '').trim();
                                        const match = titleClean.match(/(.+?)\s*\((@.+?)\)$/);
                                        if (match) {
                                            authorName = match[1].trim();
                                            authorHandle = match[2].trim();
                                        } else {
                                            authorName = titleClean;
                                        }
                                    }
                                    return (
                                        <TweetEmbed
                                            authorName={authorName}
                                            authorHandle={authorHandle}
                                            authorUrl={item.linkEmbed?.authorUrl}
                                            authorImage={isTweetAvatarImage ? linkThumbnailSource : undefined}
                                            tweetText={tweetText}
                                            url={item.linkEmbed?.url || item.sourceUrl || item.content}
                                            mediaUrl={tweetMediaUrl}
                                            isEnlarged={false}
                                        />
                                    );
                                })()}
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
                    {item.type === 'link' && !isTweetLink && (!linkThumbnailSource || imgError || !isVisible) && (
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
                        isEditing ? (
                            <div className="p-4 bg-white min-h-[200px] flex flex-col" onClick={(e) => e.stopPropagation()}>
                                <BlockEditor
                                    value={editText}
                                    onChange={setEditText}
                                    onBlur={() => onFinishEditing?.(item.id, editText)}
                                    onSubmit={() => onFinishEditing?.(item.id, editText)}
                                    placeholder="Start typing... Use # for headings"
                                    className="w-full min-h-[100px]"
                                    autoFocus
                                />
                            </div>
                        ) : (
                            <div className="p-5 bg-white min-h-[150px] flex flex-col items-start justify-start gap-2.5">
                                {hasMarkdownHeadings(item.content) ? (
                                    renderMarkdownText(item.content, { clampLines: 7 })
                                ) : (
                                    <>
                                        <p className="text-heading-2 font-medium text-[var(--ds-gray-1000)] line-clamp-3 text-left leading-snug w-full">
                                            {heroText}
                                        </p>
                                        {supportingText ? (
                                            <p className="text-body text-[var(--ds-gray-700)] line-clamp-4 text-left leading-relaxed w-full">
                                                {supportingText}
                                            </p>
                                        ) : null}
                                    </>
                                )}
                            </div>
                        )
                    )}

                    {/* Color Swatch Type */}
                    {item.type === 'color' && (
                        <div
                            className="w-full aspect-square min-h-[150px] flex items-end justify-start p-3"
                            style={{ backgroundColor: item.content }}
                        >
                            <span className="text-xs font-mono font-semibold px-2 py-1 rounded-md bg-black/20 text-white backdrop-blur-sm uppercase">
                                {item.content}
                            </span>
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
