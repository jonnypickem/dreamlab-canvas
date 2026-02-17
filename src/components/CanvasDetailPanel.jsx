import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Maximize2, Copy, Trash2, Save, Palette, Camera, Video, Link as LinkIcon, FileText } from 'lucide-react';
import { updateItem, getCollections, getCollectionWorkspaceId } from '../lib/storage';
import { fetchImageViaProxy } from '../utils/imageProxy';
import { useResolvedImageSource } from '../hooks/useResolvedImageSource';
import { renderMarkdownText, hasMarkdownHeadings } from '../utils/markdownText';

const uniqueTags = (tags = []) => [...new Set((tags || []).filter(Boolean))];

const getContextTagText = (ct) => (typeof ct === 'string' ? ct : ct?.tag);

function isLightColor(hex) {
    const c = (hex || '#000000').replace('#', '');
    if (c.length !== 6) return false;
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

function getLinkTextPayload(item) {
    if (item?.type !== 'link') return { ready: false, content: '' };
    const extracted = String(item?.textExtract?.content || '').trim();
    const tweet = String(item?.linkEmbed?.tweetText || '').trim();
    const fallback = String(item?.content || '').trim();
    const content = extracted || tweet || fallback;
    return { ready: Boolean(content), content };
}

export default function CanvasDetailPanel({ item, onClose, onExpand, onUpdate, onDelete, onToast }) {
    const [title, setTitle] = useState(item.title || '');
    const [description, setDescription] = useState(item.description || '');
    const [content, setContent] = useState(item.content || '');
    const [colorValue, setColorValue] = useState(item.type === 'color' ? item.content : '#000000');
    const [tagInput, setTagInput] = useState('');
    const [collectionId, setCollectionId] = useState(item.collectionId || 'unassigned');
    const [objectiveTags, setObjectiveTags] = useState(() => uniqueTags(item.objectiveTags || item.tags || []));
    const [contextTags, setContextTags] = useState(() => item.contextTags || []);
    const [searchTags, setSearchTags] = useState(() => {
        const ctValues = (item.contextTags || []).map(getContextTagText).filter(Boolean);
        return uniqueTags(item.tags || [...(item.objectiveTags || []), ...ctValues]);
    });
    const [collections, setCollections] = useState([]);

    const resolvedImageSource = useResolvedImageSource(item.type === 'image' ? item.content : '');
    const resolvedImageThumb = useResolvedImageSource(item.type === 'image' && item.thumbnail ? item.thumbnail : '');
    const resolvedVideoSource = useResolvedImageSource(item.type === 'video' ? item.content : '');
    const resolvedLinkThumb = useResolvedImageSource(item.type === 'link' ? item.thumbnail : '');

    const emitToast = (message, type = 'info') => {
        if (onToast) onToast({ message, type });
    };

    // Sync state when item changes
    useEffect(() => {
        setTitle(item.title || '');
        setDescription(item.description || '');
        setContent(item.content || '');
        setColorValue(item.type === 'color' ? item.content : '#000000');
        setCollectionId(item.collectionId || 'unassigned');
        setObjectiveTags(uniqueTags(item.objectiveTags || item.tags || []));
        setContextTags(item.contextTags || []);
        const ctValues = (item.contextTags || []).map(getContextTagText).filter(Boolean);
        setSearchTags(uniqueTags(item.tags || [...(item.objectiveTags || []), ...ctValues]));
    }, [item]);

    useEffect(() => {
        let cancelled = false;
        getCollections().then((cs) => {
            if (!cancelled) setCollections(cs);
        });
        return () => { cancelled = true; };
    }, [item.id]);

    const availableCollections = collections.filter(
        (c) => getCollectionWorkspaceId(c) === item.workspaceId
    );

    const domainName = (url) => {
        if (!url) return '';
        try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
    };

    const handleSave = async () => {
        const nextCollectionId = collectionId === 'unassigned' ? null : collectionId;
        const updated = await updateItem(item.id, {
            content,
            title: title.trim() || null,
            description,
            objectiveTags,
            contextTags,
            tags: searchTags,
            collectionId: nextCollectionId,
        });
        if (updated) onUpdate(updated);
        emitToast('Saved', 'success');
    };

    const handleCopy = async () => {
        try {
            switch (item.type) {
                case 'image': {
                    const src = resolvedImageSource || item.content;
                    const blob = await fetchImageViaProxy(src);
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
                    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
                    emitToast('Copied image', 'success');
                    break;
                }
                case 'video':
                    await navigator.clipboard.writeText(item.sourceUrl || resolvedVideoSource || item.content || '');
                    emitToast('Copied video URL', 'success');
                    break;
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
                case 'text':
                    await navigator.clipboard.writeText(content || '');
                    emitToast('Copied text', 'success');
                    break;
                case 'color':
                    await navigator.clipboard.writeText(colorValue || item.content || '');
                    emitToast('Copied color code', 'success');
                    break;
                default:
                    await navigator.clipboard.writeText(item.sourceUrl || content || '');
                    emitToast('Copied', 'success');
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

    const getTypeIcon = () => {
        switch (item.type) {
            case 'image': return <Camera size={14} />;
            case 'video': return <Video size={14} />;
            case 'link': return <LinkIcon size={14} />;
            case 'text': return <FileText size={14} />;
            case 'color': return <Palette size={14} />;
            default: return <LinkIcon size={14} />;
        }
    };

    const handleAddTag = (e) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            const next = tagInput.trim();
            if (next.includes(',')) return;
            if (!objectiveTags.includes(next)) {
                const nextObj = [...objectiveTags, next];
                setObjectiveTags(nextObj);
                setSearchTags(uniqueTags([...searchTags, next]));
            }
            setTagInput('');
        }
    };

    const handleRemoveTag = async (tagToRemove) => {
        const nextObj = objectiveTags.filter((t) => t !== tagToRemove);
        const nextCtx = contextTags.filter((ct) => getContextTagText(ct) !== tagToRemove);
        const nextSearch = searchTags.filter((t) => t !== tagToRemove);
        setObjectiveTags(nextObj);
        setContextTags(nextCtx);
        setSearchTags(nextSearch);
        const updated = await updateItem(item.id, { objectiveTags: nextObj, contextTags: nextCtx, tags: nextSearch });
        if (onUpdate && updated) onUpdate(updated);
    };

    const handleDeleteItem = () => {
        onDelete(item.id);
        onClose();
    };

    return (
        <motion.div
            className="absolute top-3 right-3 bottom-3 w-[360px] z-[60] flex flex-col bg-white border border-neutral-200 shadow-lg rounded-2xl overflow-hidden"
            initial={{ x: 360, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 360, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                    <span className="text-orange-600">{getTypeIcon()}</span>
                    <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                        {item.type}
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={onExpand}
                        className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors"
                        title="Expand to full view"
                    >
                        <Maximize2 size={14} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors"
                        title="Close"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Preview thumbnail */}
            <div className="flex-shrink-0">
                {item.type === 'image' && (
                    <div className="w-full h-[180px] bg-neutral-100 overflow-hidden">
                        <img
                            src={resolvedImageThumb || resolvedImageSource || item.content}
                            alt={item.title || 'Image'}
                            className="w-full h-full object-contain"
                        />
                    </div>
                )}
                {item.type === 'video' && (
                    <div className="w-full h-[180px] bg-neutral-900 overflow-hidden">
                        <video
                            src={resolvedVideoSource || ''}
                            className="w-full h-full object-contain"
                            muted loop playsInline autoPlay
                        />
                    </div>
                )}
                {item.type === 'color' && (
                    <div
                        className="w-full h-[120px] flex items-center justify-center"
                        style={{ backgroundColor: colorValue || item.content }}
                    >
                        <span
                            className="text-lg font-mono font-bold uppercase tracking-wider px-4 py-2 rounded-lg"
                            style={{
                                color: isLightColor(colorValue) ? '#18181b' : '#ffffff',
                                backgroundColor: isLightColor(colorValue) ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)',
                            }}
                        >
                            {colorValue}
                        </span>
                    </div>
                )}
                {item.type === 'link' && (resolvedLinkThumb || item.thumbnail) && (
                    <div className="w-full h-[140px] bg-neutral-100 overflow-hidden">
                        <img
                            src={resolvedLinkThumb || item.thumbnail}
                            alt={item.title || 'Link'}
                            className="w-full h-full object-cover"
                        />
                    </div>
                )}
                {item.type === 'link' && !resolvedLinkThumb && !item.thumbnail && (
                    <div className="w-full h-[80px] bg-neutral-50 flex items-center justify-center gap-2">
                        <LinkIcon size={20} className="text-neutral-300" />
                        <span className="text-xs text-neutral-400 font-mono truncate max-w-[200px]">
                            {domainName(item.sourceUrl)}
                        </span>
                    </div>
                )}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
                {/* Title */}
                <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-base font-semibold text-neutral-900 bg-transparent border-none outline-none w-full placeholder:text-neutral-400"
                    placeholder="Add a title..."
                />

                {/* Source URL for links/images/videos */}
                {item.sourceUrl && item.type !== 'color' && item.type !== 'text' && (
                    <a
                        href={item.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-neutral-500 hover:text-orange-600 truncate transition-colors"
                    >
                        {domainName(item.sourceUrl)}
                    </a>
                )}

                {/* Color picker for color type */}
                {item.type === 'color' && (
                    <div className="flex items-center gap-2">
                        <input
                            type="color"
                            value={colorValue}
                            onChange={(e) => { setColorValue(e.target.value); setContent(e.target.value); }}
                            className="w-8 h-8 rounded-md border border-neutral-200 cursor-pointer p-0"
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
                            className="flex-1 text-sm font-mono bg-neutral-50 border border-neutral-200 rounded-md px-2 py-1.5 outline-none uppercase"
                            maxLength={7}
                        />
                    </div>
                )}

                {/* Editable text content for notes */}
                {item.type === 'text' && (
                    <div className="flex flex-col gap-2">
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-md p-3 outline-none resize-none min-h-[100px] leading-relaxed"
                            placeholder="Write your note... Use # for headings"
                        />
                        {content.trim() && hasMarkdownHeadings(content) && (
                            <div className="border border-neutral-200 rounded-md p-3 bg-white">
                                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 block">Preview</span>
                                {renderMarkdownText(content)}
                            </div>
                        )}
                    </div>
                )}

                {/* Description */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Description</span>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full text-sm text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-md p-2.5 outline-none resize-none min-h-[60px]"
                        placeholder="Add description..."
                    />
                </div>

                {/* Collection */}
                <div className="flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Collection</span>
                    <select
                        value={collectionId}
                        onChange={(e) => setCollectionId(e.target.value)}
                        className="w-full text-sm text-neutral-900 bg-neutral-50 border border-neutral-200 rounded-md p-2 outline-none"
                    >
                        <option value="unassigned">No Collection</option>
                        {availableCollections.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                {/* Tags */}
                <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Tags</span>
                    <div className="flex flex-wrap gap-1.5">
                        {objectiveTags.map((tag, i) => (
                            <span
                                key={i}
                                onClick={() => handleRemoveTag(tag)}
                                className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-neutral-100 text-neutral-700 cursor-pointer hover:bg-neutral-200 transition-colors"
                            >
                                {tag} ×
                            </span>
                        ))}
                    </div>
                    {contextTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            {contextTags.map((ct, i) => (
                                <span
                                    key={i}
                                    onClick={() => handleRemoveTag(getContextTagText(ct))}
                                    className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-orange-700 border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors"
                                >
                                    {getContextTagText(ct)} ×
                                </span>
                            ))}
                        </div>
                    )}
                    <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value.replace(/,/g, ''))}
                        onKeyDown={handleAddTag}
                        placeholder="+ Add tag"
                        className="w-full text-sm bg-transparent border border-neutral-200 rounded-md px-2.5 py-1.5 outline-none placeholder:text-neutral-400"
                    />
                </div>
            </div>

            {/* Footer actions */}
            <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleCopy}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 transition-colors"
                    >
                        <Copy size={13} />
                        {getCopyLabel()}
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
                    >
                        <Save size={13} />
                        Save
                    </button>
                </div>
                <button
                    onClick={handleDeleteItem}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <Trash2 size={13} />
                    Delete
                </button>
            </div>
        </motion.div>
    );
}
