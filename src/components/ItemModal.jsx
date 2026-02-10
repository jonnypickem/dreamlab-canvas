"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { updateItem, getWorkspaces, getProjects, getPrimitiveAnalysisStore } from '../lib/storage';
import { fetchImageViaProxy } from '../utils/imageProxy';
import { getPrimitiveVersionMap } from '../services/analysisSchemaRegistry';
import { getImageAnalysisStatus } from '../utils/analysisStatus';
import { Button } from "../ui/components/Button";
import { TextField } from "../ui/components/TextField";
import { Select } from "../ui/components/Select";
import { Badge } from "../ui/components/Badge";
import { IconButton } from "../ui/components/IconButton";
import * as SubframeUtils from "../ui/utils";
import {
    FeatherChevronDown,
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
    FeatherMaximize,
    FeatherMinimize,
    FeatherChevronLeft,
    FeatherChevronRight
} from "@subframe/core";

export default function ItemModal({ item, onClose, onUpdate, onDelete, onNext, onPrev, hasNext, hasPrev }) {
    const [content, setContent] = useState(item.content);
    const [title, setTitle] = useState(item.title || '');
    const [description, setDescription] = useState(item.description || '');
    const [tags, setTags] = useState(item.tags || []);
    const [tagInput, setTagInput] = useState('');
    const [projectId, setProjectId] = useState(item.projectId || 'unassigned');
    const [currentItem, setCurrentItem] = useState(item);

    // Sync state when item changes (for navigation)
    useEffect(() => {
        setContent(item.content);
        setTitle(item.title || '');
        setDescription(item.description || '');
        setTags(item.tags || []);
        setProjectId(item.projectId || 'unassigned');
        setCurrentItem(item);
    }, [item]);

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
    const [imageFit, setImageFit] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('dreamlab_image_fit') || 'cover';
        }
        return 'cover';
    });
    const [expandedTags, setExpandedTags] = useState(false);
    const [expandedContextTags, setExpandedContextTags] = useState(false);
    const [analysisTick, setAnalysisTick] = useState(0);
    const [selectedPrimitiveBlock, setSelectedPrimitiveBlock] = useState('');

    useEffect(() => {
        const onStorageUpdate = () => setAnalysisTick((t) => t + 1);
        window.addEventListener('storage-update', onStorageUpdate);
        return () => window.removeEventListener('storage-update', onStorageUpdate);
    }, []);

    const analysisSummary = useMemo(() => {
        const primitiveStore = getPrimitiveAnalysisStore();
        const versionMap = getPrimitiveVersionMap();
        return getImageAnalysisStatus(currentItem, primitiveStore, versionMap);
    }, [currentItem, analysisTick]);

    const analysisBadge = useMemo(() => {
        if (currentItem.type !== 'image') {
            return { label: 'N/A', variant: 'neutral' };
        }
        if (analysisSummary.status === 'done') {
            return { label: 'Analysed', variant: 'success' };
        }
        if (analysisSummary.status === 'in_progress') {
            return { label: 'In progress', variant: 'warning' };
        }
        if (analysisSummary.status === 'failed') {
            return { label: 'Failed', variant: 'error' };
        }
        return { label: 'Unanalysed', variant: 'neutral' };
    }, [analysisSummary, currentItem.type]);

    const primitiveDebugRecord = useMemo(() => {
        if (currentItem.type !== 'image' || !currentItem.imageHash) return null;
        const primitiveStore = getPrimitiveAnalysisStore();
        return primitiveStore?.[currentItem.imageHash] || null;
    }, [currentItem.type, currentItem.imageHash, analysisTick]);

    const primitiveDebugBlocks = useMemo(() => {
        const primitives = primitiveDebugRecord?.primitives || {};
        return Object.keys(primitives)
            .sort((a, b) => a.localeCompare(b))
            .map((key) => ({
                key,
                payload: primitives[key],
            }));
    }, [primitiveDebugRecord]);

    useEffect(() => {
        if (primitiveDebugBlocks.length === 0) {
            if (selectedPrimitiveBlock) {
                setSelectedPrimitiveBlock('');
            }
            return;
        }
        const hasSelection = primitiveDebugBlocks.some((block) => block.key === selectedPrimitiveBlock);
        if (!hasSelection) {
            setSelectedPrimitiveBlock(primitiveDebugBlocks[0].key);
        }
    }, [primitiveDebugBlocks, selectedPrimitiveBlock]);

    const selectedPrimitivePayload = useMemo(() => (
        primitiveDebugBlocks.find((block) => block.key === selectedPrimitiveBlock)?.payload || null
    ), [primitiveDebugBlocks, selectedPrimitiveBlock]);

    const selectedPrimitiveJson = useMemo(() => {
        if (!selectedPrimitivePayload) return '';
        return JSON.stringify(selectedPrimitivePayload, null, 2);
    }, [selectedPrimitivePayload]);

    const toggleImageFit = () => {
        const newFit = imageFit === 'cover' ? 'contain' : 'cover';
        setImageFit(newFit);
        localStorage.setItem('dreamlab_image_fit', newFit);
    };

    const workspaces = getWorkspaces();
    const projects = getProjects();
    const currentWorkspace = workspaces.find(w => w.id === item.workspaceId);
    const availableProjects = currentWorkspace
        ? projects.filter(p => p.workspaceId === item.workspaceId)
        : [];

    const handleSave = () => {
        const nextProjectId = projectId === 'unassigned' ? null : projectId;
        const projectChanged = nextProjectId !== (item.projectId || null);
        const updated = updateItem(item.id, {
            content,
            title: title.trim() || null,
            description,
            tags,
            projectId: nextProjectId,
            collectionId: projectChanged ? null : (item.collectionId || null),
        });
        onUpdate(updated);
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
        if (item.type === 'image') {
            try {
                const response = await fetch(item.content);
                const blob = await response.blob();
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
            } catch {
                await navigator.clipboard.writeText(item.sourceUrl || item.content);
            }
        } else {
            await navigator.clipboard.writeText(item.sourceUrl || content);
        }
    };

    const handleDownload = async () => {
        const content = item.content;
        if (!content) return;
        const isDownloadable = item.type === 'image' ||
            (item.type === 'link' && (content.startsWith('data:') || content.startsWith('http')));
        if (!isDownloadable) return;

        let ext = 'jpg';
        if (content.startsWith('data:image/png') || content.includes('.png')) ext = 'png';
        else if (content.startsWith('data:image/webp') || content.includes('.webp')) ext = 'webp';

        const filename = `${item.title || 'image'}-${item.id.slice(0, 8)}.${ext}`;

        try {
            const blob = await fetchImageViaProxy(content);
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(blobUrl);
        } catch (error) {
            window.open(content, '_blank');
        }
    };

    const handleAddTag = (e) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            if (!tags.includes(tagInput.trim())) {
                setTags([...tags, tagInput.trim()]);
            }
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const getTypeIcon = () => {
        switch (item.type) {
            case 'image': return <FeatherImage />;
            case 'link': return <FeatherLink />;
            case 'text': return <FeatherFileText />;
            default: return <FeatherImage />;
        }
    };

    // Tag Limiting Logic
    const TAG_LIMIT = 10;
    const visibleTags = expandedTags ? (currentItem.objectiveTags || tags || []) : (currentItem.objectiveTags || tags || []).slice(0, TAG_LIMIT);
    const hasMoreTags = (currentItem.objectiveTags || tags || []).length > TAG_LIMIT;

    const visibleContextTags = expandedContextTags ? (currentItem.contextTags || []) : (currentItem.contextTags || []).slice(0, TAG_LIMIT);
    const hasMoreContextTags = (currentItem.contextTags || []).length > TAG_LIMIT;

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

                    {/* Image Content */}
                    {item.type === 'image' ? (
                        <img
                            className={SubframeUtils.twClassNames(
                                "w-full h-full transition-all duration-300",
                                imageFit === 'cover' ? "object-cover" : "object-contain p-4"
                            )}
                            src={item.content}
                            alt="Preview"
                        />
                    ) : item.type === 'link' ? (
                        <div className="flex flex-col items-center gap-4 p-8">
                            {item.thumbnail ? (
                                <img
                                    src={item.thumbnail}
                                    className="max-w-full max-h-[400px] rounded-lg shadow-md object-contain"
                                    alt="Thumbnail"
                                />
                            ) : (
                                <div className="w-24 h-24 bg-neutral-200 rounded-lg flex items-center justify-center">
                                    <FeatherLink className="w-10 h-10 text-neutral-400" />
                                </div>
                            )}
                            <p className="text-neutral-500 font-medium">{item.sourceUrl}</p>
                        </div>
                    ) : (
                        <div className="w-full h-full p-12 overflow-y-auto">
                            <p className="text-lg text-neutral-700 whitespace-pre-wrap leading-relaxed max-w-2xl mx-auto">{item.content}</p>
                        </div>
                    )}

                    {/* Bottom Left: Expand/Shrink Toggle (Images only) */}
                    {item.type === 'image' && (
                        <div className="absolute bottom-6 left-6 z-10">
                            <button
                                onClick={toggleImageFit}
                                className="bg-white hover:bg-neutral-50 shadow-sm border border-neutral-100 p-2 rounded-md flex items-center justify-center transition-colors text-neutral-600"
                                title={imageFit === 'cover' ? "Fit image" : "Fill screen"}
                            >
                                {imageFit === 'cover' ? <FeatherMinimize size={16} /> : <FeatherMaximize size={16} />}
                            </button>
                        </div>
                    )}
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

                        {currentItem.type === 'image' && (
                            <div className="flex items-center gap-2">
                                <Badge variant={analysisBadge.variant}>{analysisBadge.label}</Badge>
                                <span className="text-caption font-caption text-subtext-color">
                                    {analysisSummary.completed}/{analysisSummary.total} primitive blocks
                                </span>
                            </div>
                        )}

                        {currentItem.type === 'image' && (
                            <details className="rounded-md border border-neutral-200 bg-neutral-50">
                                <summary className="cursor-pointer select-none px-3 py-2 text-xs font-bold uppercase tracking-wider text-neutral-500">
                                    Primitive Debug
                                </summary>
                                <div className="px-3 pb-3 pt-1 flex flex-col gap-2">
                                    <span className="text-[11px] text-neutral-500 break-all">
                                        imageHash: {currentItem.imageHash || 'missing'}
                                    </span>
                                    {primitiveDebugBlocks.length === 0 ? (
                                        <span className="text-xs text-neutral-500">
                                            No primitive cache found yet for this image.
                                        </span>
                                    ) : (
                                        <>
                                            <label className="text-[11px] font-medium text-neutral-600 uppercase tracking-wide">
                                                Primitive Block
                                            </label>
                                            <select
                                                value={selectedPrimitiveBlock}
                                                onChange={(e) => setSelectedPrimitiveBlock(e.target.value)}
                                                className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm text-neutral-800 focus:outline-none focus:border-brand-500"
                                            >
                                                {primitiveDebugBlocks.map((block) => (
                                                    <option key={block.key} value={block.key}>
                                                        {block.key}
                                                    </option>
                                                ))}
                                            </select>
                                            <pre className="max-h-56 overflow-auto rounded-md border border-neutral-200 bg-white p-2 text-[11px] leading-relaxed text-neutral-700">
                                                {selectedPrimitiveJson}
                                            </pre>
                                        </>
                                    )}
                                </div>
                            </details>
                        )}

                        {/* Content Source */}
                        <div className="flex flex-col gap-2">
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
                        </div>

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

                        {/* Project Select */}
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Project</span>
                            <Select
                                value={projectId}
                                onValueChange={setProjectId}
                            >
                                <Select.Item value="unassigned">No Project</Select.Item>
                                {availableProjects.map(p => (
                                    <Select.Item key={p.id} value={p.id}>{p.name}</Select.Item>
                                ))}
                            </Select>
                        </div>

                        {/* Tags */}
                        <div className="flex flex-col gap-4">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Tags</span>

                            {/* Objective Tags */}
                            <div className="flex flex-wrap gap-2">
                                {visibleTags.map((tag, i) => (
                                    <Badge key={i} variant="neutral" onClick={() => handleRemoveTag(tag)} className="cursor-pointer hover:bg-neutral-200">
                                        {tag} ×
                                    </Badge>
                                ))}
                                {hasMoreTags && (
                                    <button onClick={() => setExpandedTags(!expandedTags)} className="text-xs text-neutral-500 hover:text-neutral-800 font-medium px-1">
                                        {expandedTags ? "Show less" : `+${(currentItem.objectiveTags || tags).length - TAG_LIMIT} more`}
                                    </button>
                                )}
                            </div>

                            {/* Context Tags */}
                            {currentItem.contextTags && currentItem.contextTags.length > 0 && (
                                <div className="flex flex-col gap-2 mt-2">
                                    <div className="flex items-center gap-1.5">
                                        <FeatherSparkles className="w-3 h-3 text-brand-600" />
                                        <span className="text-xs font-medium text-brand-600">AI Context</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {visibleContextTags.map((ct, i) => {
                                            const tagText = typeof ct === 'string' ? ct : ct.tag;
                                            return (
                                                <span
                                                    key={i}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-brand-50 text-brand-700 border border-brand-200 cursor-pointer hover:bg-brand-100 transition-colors"
                                                    onClick={() => {
                                                        const newContextTags = currentItem.contextTags.filter((_, idx) => idx !== i);
                                                        // Optimistic update logic if needed
                                                        updateItem(item.id, { contextTags: newContextTags });
                                                        setCurrentItem({ ...currentItem, contextTags: newContextTags });
                                                    }}
                                                >
                                                    {tagText} ×
                                                </span>
                                            );
                                        })}
                                        {hasMoreContextTags && (
                                            <button onClick={() => setExpandedContextTags(!expandedContextTags)} className="text-xs text-brand-600 hover:text-brand-800 font-medium px-1">
                                                {expandedContextTags ? "Show less" : `+${currentItem.contextTags.length - TAG_LIMIT} more`}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <TextField variant="outline" className="mt-1">
                                <TextField.Input
                                    placeholder="+ Add tag"
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
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
                                className="flex-1" // Use flex-1 for equal width if tailored, or just auto
                                icon={<FeatherCopy />}
                                onClick={handleCopyContent}
                            >
                                Copy
                            </Button>
                            {(item.type === 'image' || item.type === 'link') && (
                                <Button
                                    variant="neutral-secondary"
                                    className="flex-1"
                                    icon={<FeatherDownload />}
                                    onClick={handleDownload}
                                >
                                    Download
                                </Button>
                            )}
                            {item.sourceUrl && (
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
