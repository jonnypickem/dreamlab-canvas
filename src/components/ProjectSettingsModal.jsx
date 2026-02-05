import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/components/Button';
import { TextField } from '../ui/components/TextField';
import { TextArea } from '../ui/components/TextArea';
import { Select } from '../ui/components/Select';
import { IconButton } from '../ui/components/IconButton';
import { Badge } from '../ui/components/Badge';
import { FeatherX, FeatherTrash2, FeatherPlus } from '@subframe/core';

// Project category presets with suggested styles
const PROJECT_CATEGORIES = {
    general: { label: 'General', styles: [] },
    tech: {
        label: 'Tech & Product',
        styles: ['minimalist', 'modern', 'clean', 'professional', 'sleek']
    },
    fashion: {
        label: 'Fashion & Lifestyle',
        styles: ['editorial', 'trendy', 'bold', 'sophisticated', 'artistic']
    },
    food: {
        label: 'Food & Beverage',
        styles: ['appetizing', 'rustic', 'gourmet', 'fresh', 'vibrant']
    },
    travel: {
        label: 'Travel & Nature',
        styles: ['scenic', 'adventurous', 'serene', 'dramatic', 'authentic']
    },
    architecture: {
        label: 'Architecture & Interior',
        styles: ['contemporary', 'industrial', 'elegant', 'spacious', 'geometric']
    },
    branding: {
        label: 'Branding & Identity',
        styles: ['cohesive', 'premium', 'distinctive', 'memorable', 'consistent']
    },
    art: {
        label: 'Art & Creative',
        styles: ['expressive', 'abstract', 'conceptual', 'evocative', 'unique']
    }
};

/**
 * Project Settings Modal - Full project configuration for AI tagging
 */
export default function ProjectSettingsModal({
    project,
    onClose,
    onUpdate,
    onDelete
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('general');
    const [tags, setTags] = useState([]);
    const [style, setStyle] = useState([]);
    const [aiPrompt, setAiPrompt] = useState('');
    const [newTag, setNewTag] = useState('');
    const [newStyle, setNewStyle] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (project) {
            setName(project.name || '');
            setDescription(project.description || '');
            setCategory(project.category || 'general');
            setTags(project.tags || []);
            setStyle(project.style || []);
            setAiPrompt(project.aiPrompt || '');
        }
    }, [project]);

    const handleSave = async () => {
        if (!name.trim()) return;

        setIsSaving(true);
        try {
            await onUpdate(project.id, {
                name: name.trim(),
                description: description.trim(),
                category,
                tags,
                style,
                aiPrompt: aiPrompt.trim()
            });
            onClose();
        } finally {
            setIsSaving(false);
        }
    };

    const addTag = () => {
        if (newTag.trim() && !tags.includes(newTag.trim().toLowerCase())) {
            setTags([...tags, newTag.trim().toLowerCase()]);
            setNewTag('');
        }
    };

    const removeTag = (tagToRemove) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const addStyle = (styleToAdd) => {
        if (styleToAdd && !style.includes(styleToAdd)) {
            setStyle([...style, styleToAdd]);
        }
        setNewStyle('');
    };

    const removeStyle = (styleToRemove) => {
        setStyle(style.filter(s => s !== styleToRemove));
    };

    const handleCategoryChange = (newCategory) => {
        setCategory(newCategory);
        // Suggest styles from category preset
        const categoryStyles = PROJECT_CATEGORIES[newCategory]?.styles || [];
        // Add suggested styles that aren't already present
        const newStyles = categoryStyles.filter(s => !style.includes(s));
        if (newStyles.length > 0 && style.length === 0) {
            setStyle(newStyles.slice(0, 3)); // Add first 3 suggestions
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!project) return null;

    const suggestedStyles = PROJECT_CATEGORIES[category]?.styles || [];
    const unselectedStyles = suggestedStyles.filter(s => !style.includes(s));

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
            onKeyDown={handleKeyDown}
        >
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex w-full max-w-[560px] max-h-[85vh] flex-col rounded-lg bg-white shadow-lg mx-4 overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4 flex-shrink-0">
                    <span className="text-heading-3 font-heading-3 text-default-font">
                        Project Settings
                    </span>
                    <IconButton
                        icon={<FeatherX />}
                        onClick={onClose}
                    />
                </div>

                {/* Content - Scrollable */}
                <div className="flex flex-col gap-5 px-6 py-6 overflow-y-auto">
                    {/* Project Name */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-caption-bold font-caption-bold text-default-font">
                            Project Name
                        </label>
                        <TextField className="w-full">
                            <TextField.Input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Enter project name..."
                                autoFocus
                            />
                        </TextField>
                    </div>

                    {/* Category */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-caption-bold font-caption-bold text-default-font">
                            Category
                        </label>
                        <span className="text-caption font-caption text-subtext-color">
                            Helps AI understand the project type and suggest relevant styles.
                        </span>
                        <select
                            value={category}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                            className="flex h-8 w-full items-center rounded-md border border-solid border-neutral-border bg-white px-3 text-body font-body text-default-font focus:border-brand-primary focus:outline-none"
                        >
                            {Object.entries(PROJECT_CATEGORIES).map(([key, { label }]) => (
                                <option key={key} value={key}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Description */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-caption-bold font-caption-bold text-default-font">
                            Description
                        </label>
                        <span className="text-caption font-caption text-subtext-color">
                            Describe goals, target audience, or brand positioning. AI uses this for context-aware tagging.
                        </span>
                        <TextArea className="w-full">
                            <TextArea.Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Example: iPhone 16 Pro launch campaign targeting tech enthusiasts. Focus on titanium design, camera innovations, and premium aesthetics."
                            />
                        </TextArea>
                    </div>

                    {/* Style Keywords */}
                    <div className="flex flex-col gap-2">
                        <label className="text-caption-bold font-caption-bold text-default-font">
                            Style Keywords
                        </label>
                        <span className="text-caption font-caption text-subtext-color">
                            Visual styles to emphasize when analyzing images.
                        </span>

                        {/* Current styles */}
                        {style.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {style.map(s => (
                                    <Badge key={s} variant="neutral">
                                        {s}
                                        <button
                                            onClick={() => removeStyle(s)}
                                            className="ml-1 hover:text-error-600"
                                        >
                                            ×
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}

                        {/* Suggested styles */}
                        {unselectedStyles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                <span className="text-caption text-subtext-color mr-1">Suggested:</span>
                                {unselectedStyles.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => addStyle(s)}
                                        className="px-2 py-0.5 text-xs rounded-full border border-dashed border-neutral-300 text-neutral-500 hover:border-brand-500 hover:text-brand-600 transition-colors"
                                    >
                                        + {s}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Add custom style */}
                        <div className="flex gap-2">
                            <TextField className="flex-1">
                                <TextField.Input
                                    value={newStyle}
                                    onChange={(e) => setNewStyle(e.target.value)}
                                    placeholder="Add custom style..."
                                    onKeyDown={(e) => e.key === 'Enter' && addStyle(newStyle)}
                                />
                            </TextField>
                            <Button
                                variant="neutral-secondary"
                                icon={<FeatherPlus />}
                                onClick={() => addStyle(newStyle)}
                                disabled={!newStyle.trim()}
                            >
                                Add
                            </Button>
                        </div>
                    </div>

                    {/* Default Tags */}
                    <div className="flex flex-col gap-2">
                        <label className="text-caption-bold font-caption-bold text-default-font">
                            Default Tags
                        </label>
                        <span className="text-caption font-caption text-subtext-color">
                            Automatically applied to all new items in this project.
                        </span>

                        {/* Current tags */}
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {tags.map(t => (
                                    <Badge key={t} variant="neutral">
                                        {t}
                                        <button
                                            onClick={() => removeTag(t)}
                                            className="ml-1 hover:text-error-600"
                                        >
                                            ×
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        )}

                        {/* Add tag */}
                        <div className="flex gap-2">
                            <TextField className="flex-1">
                                <TextField.Input
                                    value={newTag}
                                    onChange={(e) => setNewTag(e.target.value)}
                                    placeholder="Add default tag..."
                                    onKeyDown={(e) => e.key === 'Enter' && addTag()}
                                />
                            </TextField>
                            <Button
                                variant="neutral-secondary"
                                icon={<FeatherPlus />}
                                onClick={addTag}
                                disabled={!newTag.trim()}
                            >
                                Add
                            </Button>
                        </div>
                    </div>

                    {/* Custom AI Prompt */}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-caption-bold font-caption-bold text-default-font">
                            Custom AI Instructions
                        </label>
                        <span className="text-caption font-caption text-subtext-color">
                            Special instructions for AI tagging (optional, advanced).
                        </span>
                        <TextArea className="w-full">
                            <TextArea.Input
                                value={aiPrompt}
                                onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder="Example: Focus on device angles and lighting techniques. Identify Pro vs standard models."
                            />
                        </TextArea>
                    </div>

                    {/* Danger Zone */}
                    <div className="flex flex-col gap-3 pt-4 border-t border-neutral-200">
                        <span className="text-caption-bold font-caption-bold text-error-600">
                            Danger Zone
                        </span>
                        <Button
                            variant="destructive-tertiary"
                            icon={<FeatherTrash2 />}
                            onClick={() => onDelete(project.id, project.name)}
                            className="self-start"
                        >
                            Delete Project
                        </Button>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 border-t border-neutral-200 bg-neutral-50 px-6 py-4 flex-shrink-0">
                    <Button
                        variant="neutral-secondary"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="brand-primary"
                        onClick={handleSave}
                        disabled={!name.trim() || isSaving}
                    >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
}
