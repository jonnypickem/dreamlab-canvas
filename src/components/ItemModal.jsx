"use client";

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    updateItem,
    getWorkspaces,
    getCollections,
    getCollectionWorkspaceId
} from '../lib/storage';
import { fetchImageViaProxy } from '../utils/imageProxy';
import saveAs from 'file-saver';
import { Button } from "../ui/components/Button";
import { TextField } from "../ui/components/TextField";
import { Select } from "../ui/components/Select";
import { Badge } from "../ui/components/Badge";
import { IconButton } from "../ui/components/IconButton";

import {
    FeatherCopy,
    FeatherDownload,
    FeatherExternalLink,
    FeatherSave,
    FeatherTrash,
    FeatherX,
    FeatherSparkles,
    FeatherImage,
    FeatherLink,
    FeatherFileText,
    FeatherChevronLeft,
    FeatherChevronRight
} from "@subframe/core";
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Palette } from 'lucide-react';
import { getDomainDefaultLinkMode, isTextFirstDomain } from '../utils/linkDomainPolicy';
import { renderMarkdownText, hasMarkdownHeadings } from '../utils/markdownText';
import BlockEditor from './BlockEditor';
import TweetEmbed from './TweetEmbed';
import { getLinkViewPreference, setLinkViewPreference } from '../utils/linkTextPreference';
import { useResolvedImageSource } from '../hooks/useResolvedImageSource';

const uniqueTags = (tags = []) => [...new Set((tags || []).filter(Boolean))];

function isLightColor(hex) {
    const c = (hex || '#000000').replace('#', '');
    if (c.length !== 6) return false;
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

const getContextTagText = (contextTag) => (
    typeof contextTag === 'string' ? contextTag : contextTag?.tag
);

const MAX_EXTRACTED_TEXT_CHARS = 50000;

const isTweetUrl = (item) => {
    const url = item?.linkEmbed?.url || item?.sourceUrl || item?.content;
    if (!url || typeof url !== 'string') return false;
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        return (host === 'x.com' || host === 'twitter.com') && /\/status\/\d+/i.test(parsed.pathname);
    } catch {
        return false;
    }
};

function getLinkTextPayload(item) {
    if (item?.type !== 'link') {
        return {
            ready: false,
            content: '',
            title: '',
            byline: '',
            site: '',
        };
    }

    const extractedContent = String(item?.textExtract?.content || '').trim();
    const tweetFallback = String(item?.linkEmbed?.tweetText || '').trim();
    const titleFallback = String(item?.title || '').trim();
    const contentFallback = String(item?.content || '').trim();

    const content = extractedContent || tweetFallback || contentFallback;
    return {
        ready: Boolean(content),
        content: content.slice(0, MAX_EXTRACTED_TEXT_CHARS),
        title: String(item?.textExtract?.title || item?.title || '').trim(),
        byline: String(item?.textExtract?.byline || item?.linkEmbed?.authorName || '').trim(),
        site: String(item?.textExtract?.siteName || '').trim(),
    };
}

function getTweetEmbedUrl(item) {
    const embed = item?.linkEmbed;
    const sourceUrl = embed?.url || item?.sourceUrl;
    if (!sourceUrl) return '';
    try {
        const parsed = new URL(sourceUrl);
        const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
        if (host !== 'x.com' && host !== 'twitter.com') return '';
        if (!/\/status\/\d+/i.test(parsed.pathname)) return '';
        return sourceUrl;
    } catch {
        return '';
    }
}

function getPreviewLinkLabel(url) {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');
        const path = parsed.pathname === '/' ? '' : parsed.pathname;
        const short = `${host}${path}`;
        if (short.length <= 90) return short;
        return `${short.slice(0, 87)}...`;
    } catch {
        const asString = String(url);
        if (asString.length <= 90) return asString;
        return `${asString.slice(0, 87)}...`;
    }
}

function cleanTextForDisplay(text) {
    return String(text || '')
        .replace(/\r\n?/g, '\n')
        .replace(/\u00A0/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .trim();
}

function formatTextIntoParagraphs(text) {
    const cleaned = cleanTextForDisplay(text);
    if (!cleaned) return [];

    const hasLineBreaks = /\n/.test(cleaned);
    if (hasLineBreaks) {
        return cleaned
            .split(/\n{2,}/)
            .map((chunk) => chunk.split('\n').map((line) => line.trim()).filter(Boolean).join(' '))
            .map((chunk) => chunk.trim())
            .filter(Boolean);
    }

    const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
    const normalized = sentences.map((sentence) => sentence.trim()).filter(Boolean);
    if (normalized.length <= 2) return [cleaned];

    const paragraphs = [];
    let buffer = '';

    normalized.forEach((sentence) => {
        const candidate = buffer ? `${buffer} ${sentence}` : sentence;
        if (candidate.length > 320 && buffer) {
            paragraphs.push(buffer);
            buffer = sentence;
        } else if (buffer.split('.').length > 3) {
            paragraphs.push(buffer);
            buffer = sentence;
        } else {
            buffer = candidate;
        }
    });

    if (buffer) paragraphs.push(buffer);
    return paragraphs.length > 0 ? paragraphs : [cleaned];
}

function resolveInitialLinkViewMode(item) {
    if (item?.type !== 'link') return 'preview';
    const hasText = getLinkTextPayload(item).ready;
    const isTweetLink = isTweetUrl(item);
    if (isTweetLink) return 'preview';
    const explicitMode = item?.linkViewMode;
    if (explicitMode === 'text' && hasText) return 'text';
    if (explicitMode === 'preview') return 'preview';

    const preferredMode = getLinkViewPreference(item?.sourceUrl);
    if (preferredMode === 'text' && hasText) return 'text';
    if (preferredMode === 'preview') return 'preview';

    const defaultMode = getDomainDefaultLinkMode(item?.sourceUrl);
    if (defaultMode === 'text' && hasText) return 'text';
    return 'preview';
}

export default function ItemModal({ item, onClose, onUpdate, onDelete, onNext, onPrev, hasNext, hasPrev, onToast }) {
    const [content, setContent] = useState(item.content);
    const [title, setTitle] = useState(item.title || '');
    const [description, setDescription] = useState(item.description || '');
    const [tagInput, setTagInput] = useState('');
    const [collectionId, setCollectionId] = useState(item.collectionId || 'unassigned');
    const [objectiveTagsState, setObjectiveTagsState] = useState(() => uniqueTags(item.objectiveTags || item.tags || []));
    const [contextTagsState, setContextTagsState] = useState(() => item.contextTags || []);
    const [searchTagsState, setSearchTagsState] = useState(() => {
        const contextTags = (item.contextTags || []).map(getContextTagText).filter(Boolean);
        return uniqueTags(item.tags || [...(item.objectiveTags || []), ...contextTags]);
    });
    const [linkViewMode, setLinkViewMode] = useState(() => resolveInitialLinkViewMode(item));
    const [colorValue, setColorValue] = useState(item.type === 'color' ? item.content : '#000000');
    const [textContentDirty, setTextContentDirty] = useState(false);
    const [tweetMediaLoaded, setTweetMediaLoaded] = useState(false);
    const [centerLinkText, setCenterLinkText] = useState(true);
    const resolvedImageSource = useResolvedImageSource(item.type === 'image' ? item.content : '');
    const resolvedVideoSource = useResolvedImageSource(item.type === 'video' ? item.content : '');
    const resolvedLinkThumbnailSource = useResolvedImageSource(item.type === 'link' ? item.thumbnail : '');
    const linkThumbnailSource = resolvedLinkThumbnailSource || item.thumbnail;

    const emitToast = (message, type = 'info') => {
        if (onToast) onToast({ message, type });
    };

    // Sync state when item changes (for navigation)
    useEffect(() => {
        setContent(item.content);
        setTitle(item.title || '');
        setDescription(item.description || '');
        setCollectionId(item.collectionId || 'unassigned');
        const objectiveTags = uniqueTags(item.objectiveTags || item.tags || []);
        const contextTags = item.contextTags || [];
        const contextTagValues = contextTags.map(getContextTagText).filter(Boolean);
        const searchTags = uniqueTags(item.tags || [...objectiveTags, ...contextTagValues]);
        setObjectiveTagsState(objectiveTags);
        setContextTagsState(contextTags);
        setSearchTagsState(searchTags);
        setLinkViewMode(resolveInitialLinkViewMode(item));
        setColorValue(item.type === 'color' ? item.content : '#000000');
        setTextContentDirty(false);
    }, [item]);

    // Auto-refresh tweet thumbnails via fxtwitter proxy
    useEffect(() => {
        if (item.type !== 'link') return;
        if (item.linkEmbed?.type !== 'tweet') return;
        const sourceUrl = item.sourceUrl || item.content;
        if (!sourceUrl) return;

        let cancelled = false;
        (async () => {
            try {
                const resp = await fetch(`/api/og?url=${encodeURIComponent(sourceUrl)}`);
                if (cancelled || !resp.ok) return;
                const ogData = await resp.json();
                if (cancelled) return;
                const newImage = ogData?.image;
                if (!newImage) return;
                // Skip if thumbnail already matches
                if (item.thumbnail === newImage) return;
                // Skip generic X branding images (abs.twimg.com hosts branding, pbs.twimg.com hosts real media)
                if (newImage.includes('abs.twimg.com')) return;
                const updated = await updateItem(item.id, { thumbnail: newImage });
                if (!cancelled && updated && onUpdate) onUpdate(updated);
            } catch { }
        })();
        return () => { cancelled = true; };
    }, [item.id]);

    // Keyboard Navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'ArrowRight' && hasNext) {
                onNext();
            } else if (e.key === 'ArrowLeft' && hasPrev) {
                onPrev();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hasNext, hasPrev, onNext, onPrev]);

    // View State
    const [expandedTags, setExpandedTags] = useState(false);
    const [expandedContextTags, setExpandedContextTags] = useState(false);

    const [modalWorkspaces, setModalWorkspaces] = useState([]);
    const [modalCollections, setModalCollections] = useState([]);
    useEffect(() => {
        let cancelled = false;
        Promise.all([getWorkspaces(), getCollections()]).then(([ws, cs]) => {
            if (!cancelled) { setModalWorkspaces(ws); setModalCollections(cs); }
        });
        return () => { cancelled = true; };
    }, [item.id]);
    const currentWorkspace = modalWorkspaces.find(w => w.id === item.workspaceId);
    const availableCollections = currentWorkspace
        ? modalCollections.filter((collection) => getCollectionWorkspaceId(collection) === item.workspaceId)
        : [];
    const linkTextPayload = getLinkTextPayload(item);
    const linkTextReady = linkTextPayload.ready;
    const isTextDefaultDomain = isTextFirstDomain(item?.sourceUrl);
    const extractedText = linkTextPayload.content;
    const extractedTitle = linkTextPayload.title;
    const extractedByline = linkTextPayload.byline;
    const extractedSite = linkTextPayload.site;
    const tweetEmbedUrl = getTweetEmbedUrl(item);
    const previewLinkLabel = getPreviewLinkLabel(item?.sourceUrl);
    const formattedExtractedParagraphs = useMemo(
        () => formatTextIntoParagraphs(extractedText),
        [extractedText]
    );
    const linkTextViewportRef = useRef(null);
    const linkTextContentRef = useRef(null);

    useEffect(() => {
        if (item.type !== 'link' || linkViewMode !== 'text' || !linkTextReady) {
            setCenterLinkText(true);
            return;
        }

        const viewport = linkTextViewportRef.current;
        const contentNode = linkTextContentRef.current;
        if (!viewport || !contentNode) return;

        const measure = () => {
            const shouldCenter = contentNode.scrollHeight <= viewport.clientHeight;
            setCenterLinkText(shouldCenter);
        };

        measure();

        const observer = new ResizeObserver(() => measure());
        observer.observe(viewport);
        observer.observe(contentNode);
        window.addEventListener('resize', measure);

        return () => {
            observer.disconnect();
            window.removeEventListener('resize', measure);
        };
    }, [item.id, item.type, linkViewMode, linkTextReady, extractedText, extractedTitle, extractedByline, extractedSite]);


    const setAndPersistLinkViewMode = async (nextMode) => {
        if (nextMode === 'text' && !linkTextReady) return;
        if (nextMode !== 'text' && nextMode !== 'preview') return;
        setLinkViewMode(nextMode);
        setLinkViewPreference(item?.sourceUrl, nextMode);
        const updated = await updateItem(item.id, { linkViewMode: nextMode });
        if (onUpdate && updated) onUpdate(updated);
    };

    const getExportTitle = () => {
        const explicitTitle = String(title || item?.title || '').trim();
        if (explicitTitle) return explicitTitle;

        if (item?.sourceUrl) {
            try {
                return new URL(item.sourceUrl).hostname.replace(/^www\./, '') || 'image';
            } catch {
                // ignore
            }
        }
        return 'image';
    };

    const toSafeFilename = (value) => String(value || 'export')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 80) || 'export';

    const handleSave = async () => {
        const nextCollectionId = collectionId === 'unassigned' ? null : collectionId;
        const linkViewUpdates = item.type === 'link'
            ? { linkViewMode }
            : {};
        const updated = await updateItem(item.id, {
            content,
            title: title.trim() || null,
            description,
            objectiveTags: objectiveTagsState,
            contextTags: contextTagsState,
            tags: searchTagsState,
            collectionId: nextCollectionId,
            ...linkViewUpdates,
        });
        if (updated) onUpdate(updated);
        setTextContentDirty(false);
        onClose();
    };

    const handleDeleteItem = () => {
        onDelete(item.id);
        onClose();
    };

    const handleCopySourceUrl = async () => {
        if (item.sourceUrl) {
            await navigator.clipboard.writeText(item.sourceUrl);
        }
    };

    const handleCopyContent = async () => {
        try {
            switch (item.type) {
                case 'image': {
                    const imageSource = resolvedImageSource || item.content;
                    const blob = await fetchImageViaProxy(imageSource);
                    let pngBlob = blob;
                    if (blob.type !== 'image/png') {
                        const img = new Image();
                        const url = URL.createObjectURL(blob);
                        pngBlob = await new Promise((resolve) => {
                            img.onload = () => {
                                const canvas = document.createElement('canvas');
                                canvas.width = img.width;
                                canvas.height = img.height;
                                canvas.getContext('2d').drawImage(img, 0, 0);
                                canvas.toBlob(resolve, 'image/png');
                                URL.revokeObjectURL(url);
                            };
                            img.src = url;
                        });
                    }
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': pngBlob })
                    ]);
                    emitToast('Copied image', 'success');
                    break;
                }
                case 'video': {
                    await navigator.clipboard.writeText(item.sourceUrl || resolvedVideoSource || item.content || '');
                    emitToast('Copied video URL', 'success');
                    break;
                }
                case 'link': {
                    const lt = getLinkTextPayload(item);
                    if (lt.ready && lt.content) {
                        await navigator.clipboard.writeText(lt.content);
                        emitToast('Copied article text', 'success');
                    } else {
                        await navigator.clipboard.writeText(item.sourceUrl || item.content || '');
                        emitToast('Copied URL', 'success');
                    }
                    break;
                }
                case 'text': {
                    await navigator.clipboard.writeText(content || '');
                    emitToast('Copied text', 'success');
                    break;
                }
                case 'color': {
                    await navigator.clipboard.writeText(colorValue || item.content || '');
                    emitToast('Copied color code', 'success');
                    break;
                }
                default: {
                    await navigator.clipboard.writeText(item.sourceUrl || content || '');
                    emitToast('Copied', 'success');
                }
            }
        } catch {
            emitToast('Clipboard permission failed', 'error');
        }
    };

    const getCopyLabel = () => {
        switch (item.type) {
            case 'image': return 'Copy Image';
            case 'video': return 'Copy URL';
            case 'link': return getLinkTextPayload(item).ready ? 'Copy Text' : 'Copy URL';
            case 'text': return 'Copy Text';
            case 'color': return 'Copy Hex';
            default: return 'Copy';
        }
    };

    const handleDownload = async () => {
        const source = item.type === 'image'
            ? (resolvedImageSource || item.content)
            : item.type === 'video'
                ? (resolvedVideoSource || '')
                : (item.type === 'link' ? linkThumbnailSource : null);

        if (!source) {
            emitToast(item.type === 'link' ? 'No thumbnail available for download' : 'Download is only available for images and videos', 'info');
            return;
        }

        try {
            const blob = await fetchImageViaProxy(source);
            const inferredType = blob.type || '';
            const ext = inferredType.includes('webm') ? 'webm'
                : inferredType.includes('mp4') ? 'mp4'
                    : inferredType.includes('png') ? 'png'
                        : inferredType.includes('webp') ? 'webp'
                            : inferredType.includes('gif') ? 'gif'
                                : inferredType.includes('jpeg') ? 'jpg'
                                    : (source.includes('.webm') ? 'webm'
                                        : source.includes('.png') ? 'png'
                                            : source.includes('.webp') ? 'webp'
                                                : source.includes('.gif') ? 'gif'
                                                    : 'jpg');
            const baseTitle = toSafeFilename(getExportTitle());
            const filename = `${baseTitle}-${item.id.slice(0, 8)}.${ext}`;
            saveAs(blob, filename);
            emitToast(`Downloaded ${filename}`, 'success');
        } catch {
            emitToast(item.type === 'video' ? 'Failed to download video' : item.type === 'link' ? 'Failed to download thumbnail' : 'Failed to download image', 'error');
        }
    };

    const handleAddTag = async (e) => {
        if (e.key !== 'Enter' || !tagInput.trim()) return;
        e.preventDefault();

        const nextTag = tagInput.trim();
        if (nextTag.includes(',')) {
            return;
        }

        setTagInput('');

        if (objectiveTagsState.includes(nextTag)) {
            return;
        }

        const nextObjectiveTags = [...objectiveTagsState, nextTag];
        const nextSearchTags = uniqueTags([...searchTagsState, nextTag]);
        await persistTagState(nextObjectiveTags, contextTagsState, nextSearchTags);
    };

    const persistTagState = async (nextObjectiveTags, nextContextTags, nextSearchTags) => {
        setObjectiveTagsState(nextObjectiveTags);
        setContextTagsState(nextContextTags);
        setSearchTagsState(nextSearchTags);
        const updated = await updateItem(item.id, {
            objectiveTags: nextObjectiveTags,
            contextTags: nextContextTags,
            tags: nextSearchTags,
        });
        if (onUpdate && updated) onUpdate(updated);
    };

    const handleRemoveObjectiveTag = (tagToRemove) => {
        const nextObjectiveTags = objectiveTagsState.filter((t) => t !== tagToRemove);
        const nextContextTags = contextTagsState.filter((ct) => getContextTagText(ct) !== tagToRemove);
        const nextSearchTags = searchTagsState.filter((t) => t !== tagToRemove);
        persistTagState(nextObjectiveTags, nextContextTags, nextSearchTags);
    };

    const handleRemoveContextTag = (indexToRemove) => {
        const removed = contextTagsState[indexToRemove];
        const removedTagText = getContextTagText(removed);
        const nextContextTags = contextTagsState.filter((_, idx) => idx !== indexToRemove);
        const nextObjectiveTags = removedTagText
            ? objectiveTagsState.filter((t) => t !== removedTagText)
            : objectiveTagsState;
        const nextSearchTags = removedTagText
            ? searchTagsState.filter((t) => t !== removedTagText)
            : searchTagsState;
        persistTagState(nextObjectiveTags, nextContextTags, nextSearchTags);
    };

    const getTypeIcon = () => {
        switch (item.type) {
            case 'image': return <FeatherImage />;
            case 'video': return <FeatherImage />;
            case 'link': return <FeatherLink />;
            case 'text': return <FeatherFileText />;
            case 'color': return <Palette size={16} />;
            default: return <FeatherImage />;
        }
    };

    // Tag Limiting Logic
    const TAG_LIMIT = 10;
    const visibleTags = expandedTags ? objectiveTagsState : objectiveTagsState.slice(0, TAG_LIMIT);
    const hasMoreTags = objectiveTagsState.length > TAG_LIMIT;

    const visibleContextTags = expandedContextTags ? contextTagsState : contextTagsState.slice(0, TAG_LIMIT);
    const hasMoreContextTags = contextTagsState.length > TAG_LIMIT;

    return (
        <div
            className="fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-neutral-950/40 backdrop-blur-sm p-4 mobile:p-0"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="flex w-full max-w-[1200px] h-[85vh] overflow-hidden rounded-lg bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">

                {/* Left Pane: Image/Preview (60%) */}
                <div className="relative flex w-[60%] h-full flex-col items-center justify-center bg-neutral-100 overflow-hidden group">
                    {/* Top Left: Type Icon Badge */}
                    <div className="absolute top-6 left-6 z-10 bg-white shadow-sm border border-neutral-100 p-2 rounded-md flex items-center justify-center">
                        {React.cloneElement(getTypeIcon(), { className: "text-orange-600", size: 16 })}
                    </div>

                    {/* Navigation Arrows */}
                    {hasPrev && (
                        <button
                            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/80 hover:bg-white backdrop-blur-sm shadow-md rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 text-neutral-700 hover:text-neutral-900"
                            onClick={(e) => { e.stopPropagation(); onPrev(); }}
                        >
                            <FeatherChevronLeft size={24} />
                        </button>
                    )}
                    {hasNext && (
                        <button
                            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/80 hover:bg-white backdrop-blur-sm shadow-md rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 text-neutral-700 hover:text-neutral-900"
                            onClick={(e) => { e.stopPropagation(); onNext(); }}
                        >
                            <FeatherChevronRight size={24} />
                        </button>
                    )}

                    {/* Main Preview Content */}
                    {item.type === 'video' ? (
                        <video
                            className="w-full h-full object-contain p-4"
                            src={resolvedVideoSource || ''}
                            controls
                            autoPlay
                            loop
                            muted
                            playsInline
                        />
                    ) : item.type === 'image' ? (
                        <TransformWrapper
                            initialScale={1}
                            minScale={0.5}
                            maxScale={8}
                            centerOnInit
                            wheel={{ step: 0.1 }}
                            doubleClick={{ mode: 'reset' }}
                        >
                            {({ zoomIn, zoomOut, resetTransform }) => (
                                <>
                                    <TransformComponent wrapperClass="!w-full !h-full" contentClass="!w-full !h-full flex items-center justify-center">
                                        <img
                                            className="max-w-full max-h-full object-contain"
                                            src={resolvedImageSource || item.content}
                                            alt="Preview"
                                            draggable={false}
                                        />
                                    </TransformComponent>
                                    <div className="absolute bottom-6 left-6 z-10 flex items-center gap-1 bg-white rounded-lg border border-neutral-200 shadow-sm p-1">
                                        <button
                                            onClick={() => zoomOut()}
                                            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-neutral-100 text-neutral-600 text-lg font-medium"
                                            title="Zoom out"
                                        >
                                            −
                                        </button>
                                        <button
                                            onClick={() => resetTransform()}
                                            className="px-2 h-8 flex items-center justify-center rounded-md hover:bg-neutral-100 text-neutral-600 text-xs font-medium"
                                            title="Reset zoom (or double-click)"
                                        >
                                            Reset
                                        </button>
                                        <button
                                            onClick={() => zoomIn()}
                                            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-neutral-100 text-neutral-600 text-lg font-medium"
                                            title="Zoom in"
                                        >
                                            +
                                        </button>
                                    </div>
                                </>
                            )}
                        </TransformWrapper>
                    ) : item.type === 'link' ? (
                        <div className="absolute inset-x-[72px] top-[80px] bottom-[84px]">
                            {linkViewMode === 'text' && linkTextReady ? (
                                <div ref={linkTextViewportRef} className="h-full w-full overflow-y-auto">
                                    <div className={`min-h-full flex flex-col ${centerLinkText ? 'justify-center' : 'justify-start'}`}>
                                        <div ref={linkTextContentRef} className="w-full max-w-3xl mx-auto py-4 flex flex-col gap-4">
                                            {extractedTitle ? (
                                                <h2 className="text-2xl font-semibold text-neutral-900 leading-tight break-words">
                                                    {extractedTitle}
                                                </h2>
                                            ) : null}
                                            {(extractedByline || extractedSite) ? (
                                                <p className="text-sm text-neutral-500 break-words">
                                                    {[extractedByline, extractedSite].filter(Boolean).join(' • ')}
                                                </p>
                                            ) : null}
                                            {formattedExtractedParagraphs.length > 0 ? (
                                                <div className="flex flex-col gap-4">
                                                    {formattedExtractedParagraphs.map((paragraph, index) => (
                                                        <p
                                                            key={`${index}-${paragraph.slice(0, 24)}`}
                                                            className="text-base text-neutral-700 break-words leading-relaxed"
                                                        >
                                                            {paragraph}
                                                        </p>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-base text-neutral-700 break-words leading-relaxed">
                                                    No extracted text available for this link.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="h-full w-full flex flex-col items-center justify-center gap-4">
                                    {isTweetUrl(item) ? (() => {
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
                                        const text = item.linkEmbed?.tweetText || (item.content?.length > 0 ? item.content : null);
                                        const isProfilePic = linkThumbnailSource?.includes('profile_images');

                                        return (
                                            <div className="w-full max-w-[520px] max-h-full overflow-y-auto pt-6 pb-6 p-4">
                                                <TweetEmbed
                                                    authorName={authorName}
                                                    authorHandle={authorHandle}
                                                    authorUrl={item.linkEmbed?.authorUrl}
                                                    authorImage={isProfilePic ? linkThumbnailSource : undefined}
                                                    tweetText={text}
                                                    url={item.linkEmbed?.url || item.sourceUrl || item.content}
                                                    mediaUrl={!isProfilePic ? linkThumbnailSource : undefined}
                                                    isEnlarged={true}
                                                />
                                            </div>
                                        );
                                    })() : linkThumbnailSource ? (
                                        <img
                                            src={linkThumbnailSource}
                                            className="max-w-full max-h-[72%] rounded-lg shadow-md object-contain"
                                            alt="Thumbnail"
                                        />
                                    ) : (
                                        <div className="w-24 h-24 bg-neutral-200 rounded-lg flex items-center justify-center">
                                            <FeatherLink className="w-10 h-10 text-neutral-400" />
                                        </div>
                                    )}
                                    <p
                                        className="text-neutral-500 font-medium text-center truncate w-full max-w-[640px]"
                                        title={item.sourceUrl || ''}
                                    >
                                        {previewLinkLabel}
                                    </p>
                                    {isTextDefaultDomain && !linkTextReady ? (
                                        <p className="text-xs text-neutral-500 bg-white/90 border border-neutral-200 rounded-full px-3 py-1">
                                            Text view unavailable for this capture. Showing preview.
                                        </p>
                                    ) : null}
                                </div>
                            )}
                        </div>
                    ) : item.type === 'color' ? (
                        <div
                            className="w-full h-full flex items-center justify-center"
                            style={{ backgroundColor: colorValue || item.content }}
                        >
                            <span
                                className="text-3xl font-mono font-bold uppercase tracking-wider px-6 py-3 rounded-xl"
                                style={{
                                    color: isLightColor(colorValue || item.content) ? '#18181b' : '#ffffff',
                                    backgroundColor: isLightColor(colorValue || item.content) ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)',
                                }}
                            >
                                {colorValue || item.content}
                            </span>
                        </div>
                    ) : item.type === 'text' ? (
                        <div className="absolute inset-x-[72px] top-[80px] bottom-[84px]">
                            <div className="h-full w-full overflow-y-auto">
                                <div className="min-h-full flex items-center justify-center">
                                    <div className="max-w-2xl mx-auto py-4 w-full">
                                        <BlockEditor
                                            value={content}
                                            onChange={(val) => { setContent(val); setTextContentDirty(true); }}
                                            placeholder="Write your note... Use # for headings"
                                            className="w-full text-lg min-h-[200px]"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="absolute inset-x-[72px] top-[80px] bottom-[84px]">
                            <div className="h-full w-full overflow-y-auto">
                                <div className="min-h-full flex items-center justify-center">
                                    <div className="max-w-2xl mx-auto py-4">
                                        <p className="text-lg text-neutral-700 whitespace-pre-wrap break-words leading-relaxed">
                                            {item.content}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="absolute bottom-6 left-6 z-10">
                        {item.type === 'link' ? (
                            <div className="inline-flex items-center rounded-full border border-neutral-200 bg-white p-1 shadow-sm">
                                <button
                                    onClick={() => setAndPersistLinkViewMode('preview')}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${linkViewMode === 'preview' ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
                                    title="Show link preview"
                                >
                                    Preview
                                </button>
                                <button
                                    onClick={() => setAndPersistLinkViewMode('text')}
                                    disabled={!linkTextReady}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${linkViewMode === 'text'
                                        ? 'bg-neutral-900 text-white'
                                        : 'text-neutral-600 hover:bg-neutral-100'} ${!linkTextReady ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''}`}
                                    title={linkTextReady ? 'Show extracted text' : 'Text not available for this link yet'}
                                >
                                    Text
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>

                {/* Right Pane: Info & Actions (40%) */}
                <div className="flex w-[40%] h-full flex-col bg-white border-l border-neutral-200">

                    {/* Header */}
                    <div className="flex items-center justify-end px-6 py-4 border-b border-neutral-100">
                        <IconButton icon={<FeatherX />} onClick={onClose} />
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 overflow-y-auto px-8 py-4 flex flex-col gap-6">

                        {/* Editable Title */}
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="text-xl font-semibold text-neutral-900 bg-transparent border-none outline-none w-full placeholder:text-neutral-400 mb-2"
                            placeholder="Add a title..."
                        />

                        {/* Content Source — hidden for text and color types */}
                        {item.type !== 'text' && item.type !== 'color' && <div className="flex flex-col gap-2">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Content Source</span>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-neutral-600 truncate flex-1">
                                    {item.sourceUrl ? (() => {
                                        try {
                                            return new URL(item.sourceUrl).hostname.replace(/^www\./, '');
                                        } catch {
                                            return item.sourceUrl.slice(0, 40) + (item.sourceUrl.length > 40 ? '...' : '');
                                        }
                                    })() : (item.type === 'text' ? 'Text content' : 'No source')}
                                </span>
                                {item.sourceUrl && (
                                    <>
                                        <IconButton
                                            icon={<FeatherCopy />}
                                            size="small"
                                            onClick={handleCopySourceUrl}
                                            title="Copy URL"
                                        />
                                        <IconButton
                                            icon={<FeatherExternalLink />}
                                            size="small"
                                            onClick={() => window.open(item.sourceUrl, '_blank')}
                                            title="Open in new tab"
                                        />
                                    </>
                                )}
                            </div>
                        </div>}

                        {/* Color Picker — for color type only */}
                        {item.type === 'color' && (
                            <div className="flex flex-col gap-2">
                                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Color</span>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={colorValue}
                                        onChange={(e) => {
                                            setColorValue(e.target.value);
                                            setContent(e.target.value);
                                        }}
                                        className="w-10 h-10 rounded-lg border border-neutral-200 cursor-pointer p-0"
                                    />
                                    <input
                                        type="text"
                                        value={colorValue}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                                                setColorValue(v);
                                                if (v.length === 7) setContent(v);
                                            }
                                        }}
                                        className="flex-1 text-sm font-mono bg-neutral-50 border border-neutral-200 rounded-md p-2 outline-none focus:border-brand-500 uppercase"
                                        maxLength={7}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Description Field */}
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Description</span>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full text-sm text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-md p-3 focus:outline-none focus:border-brand-500 resize-none min-h-[80px]"
                                placeholder="Enter description..."
                            />
                        </div>

                        {/* Collection Select */}
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Collection</span>
                            <Select
                                value={collectionId}
                                onValueChange={setCollectionId}
                            >
                                <Select.Item value="unassigned">No Collection</Select.Item>
                                {availableCollections.map((collection) => (
                                    <Select.Item key={collection.id} value={collection.id}>{collection.name}</Select.Item>
                                ))}
                            </Select>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-col gap-4">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Tags</span>

                            {/* Objective Tags */}
                            <div className="flex flex-wrap gap-2">
                                {visibleTags.map((tag, i) => (
                                    <Badge key={i} variant="neutral" onClick={() => handleRemoveObjectiveTag(tag)} className="cursor-pointer hover:bg-neutral-200">
                                        {tag} ×
                                    </Badge>
                                ))}
                                {hasMoreTags && (
                                    <button onClick={() => setExpandedTags(!expandedTags)} className="text-xs text-neutral-500 hover:text-neutral-800 font-medium px-1">
                                        {expandedTags ? "Show less" : `+${objectiveTagsState.length - TAG_LIMIT} more`}
                                    </button>
                                )}
                            </div>

                            {/* Context Tags */}
                            {contextTagsState.length > 0 && (
                                <div className="flex flex-col gap-2 mt-2">
                                    <div className="flex items-center gap-1.5">
                                        <FeatherSparkles className="w-3 h-3 text-brand-600" />
                                        <span className="text-xs font-medium text-brand-600">AI Context</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {visibleContextTags.map((ct, i) => {
                                            const tagText = getContextTagText(ct);
                                            return (
                                                <span
                                                    key={i}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-brand-50 text-brand-700 border border-brand-200 cursor-pointer hover:bg-brand-100 transition-colors"
                                                    onClick={() => handleRemoveContextTag(i)}
                                                >
                                                    {tagText} ×
                                                </span>
                                            );
                                        })}
                                        {hasMoreContextTags && (
                                            <button onClick={() => setExpandedContextTags(!expandedContextTags)} className="text-xs text-brand-600 hover:text-brand-800 font-medium px-1">
                                                {expandedContextTags ? "Show less" : `+${contextTagsState.length - TAG_LIMIT} more`}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <TextField variant="outline" className="mt-1">
                                <TextField.Input
                                    placeholder="+ Add tag"
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value.replace(/,/g, ''))}
                                    onKeyDown={handleAddTag}
                                />
                            </TextField>

                        </div>

                    </div>

                    {/* Footer Actions */}
                    <div className="p-6 border-t border-neutral-100 bg-neutral-50 flex flex-col gap-4">

                        {/* Utility Row */}
                        <div className="flex items-center gap-2 w-full">
                            <Button
                                variant="neutral-secondary"
                                className="flex-1"
                                icon={<FeatherCopy />}
                                onClick={handleCopyContent}
                            >
                                {getCopyLabel()}
                            </Button>
                            {(item.type === 'image' || item.type === 'video' || (item.type === 'link' && linkThumbnailSource)) ? (
                                <Button
                                    variant="neutral-secondary"
                                    className="flex-1"
                                    icon={<FeatherDownload />}
                                    onClick={handleDownload}
                                >
                                    Download
                                </Button>
                            ) : null}
                            {item.sourceUrl && item.type !== 'color' && (
                                <Button
                                    variant="neutral-secondary"
                                    className="flex-1"
                                    icon={<FeatherExternalLink />}
                                    onClick={() => window.open(item.sourceUrl, '_blank')}
                                >
                                    Open
                                </Button>
                            )}
                        </div>

                        {/* Primary Action Row */}
                        <div className="flex items-center justify-between pt-2">
                            <button onClick={handleDeleteItem} className="text-error-600 text-sm font-medium hover:text-error-700 flex items-center gap-1.5 px-2">
                                <FeatherTrash size={14} /> Delete
                            </button>
                            <Button size="large" icon={<FeatherSave />} onClick={handleSave}>
                                Save Changes
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
