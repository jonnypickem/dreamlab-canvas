import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '../ui/components/Button';
import { TextField } from '../ui/components/TextField';
import { TextArea } from '../ui/components/TextArea';
import ConfirmDialog from './ConfirmDialog';
import {
    ENTITY_ICON_OPTIONS,
    ENTITY_COLOR_OPTIONS,
    ENTITY_ICON_NONE_KEY,
    ENTITY_COLOR_NONE_KEY,
    getEntityColorToken,
    getEntityIconComponent,
    resolveEntityColorKey,
    resolveEntityIconKey
} from '../utils/entityStyles';

export default function EntitySettingsModal({
    type = 'collection',
    entity = null,
    onClose,
    onSave,
    onDelete
}) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [iconKey, setIconKey] = useState('');
    const [colorKey, setColorKey] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    useEffect(() => {
        if (!entity) return;
        setName(entity.name || '');
        setDescription(entity.description || '');
        setIconKey(resolveEntityIconKey(entity.iconKey, entity.id, type));
        setColorKey(resolveEntityColorKey(entity.colorKey, entity.id));
    }, [entity, type]);

    const title = type === 'project' ? 'Project Settings' : 'Collection Settings';
    const deleteLabel = type === 'project' ? 'Delete Project' : 'Delete Collection';
    const entityNoun = type === 'project' ? 'project' : 'collection';

    const PreviewIcon = useMemo(
        () => getEntityIconComponent(iconKey, entity?.id, type),
        [iconKey, entity?.id, type]
    );
    const previewColor = useMemo(
        () => getEntityColorToken(colorKey, entity?.id),
        [colorKey, entity?.id]
    );
    const hasPreviewIcon = Boolean(PreviewIcon) && iconKey !== ENTITY_ICON_NONE_KEY;
    const hasPreviewColor = Boolean(previewColor) && colorKey !== ENTITY_COLOR_NONE_KEY;

    if (!entity) return null;

    const handleSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) return;

        setIsSaving(true);
        try {
            const ok = await onSave?.(entity, {
                name: trimmedName,
                description: description.trim(),
                iconKey,
                colorKey,
            });
            if (ok !== false) {
                onClose?.();
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const ok = await onDelete?.(entity);
            if (ok !== false) {
                setShowDeleteConfirm(false);
                onClose?.();
            }
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <motion.div
                className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="flex h-[680px] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                    initial={{ y: 16, opacity: 0, scale: 0.98 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 16, opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    onClick={(event) => event.stopPropagation()}
                >
                    <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-5">
                        <div className="flex items-center gap-3">
                            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${
                                hasPreviewColor ? `${previewColor.bgClass} ${previewColor.borderClass}` : 'bg-neutral-50 border-neutral-200'
                            }`}>
                                {hasPreviewIcon ? (
                                    <PreviewIcon className={`h-5 w-5 ${hasPreviewColor ? previewColor.iconClass : 'text-neutral-600'}`} />
                                ) : hasPreviewColor ? (
                                    <span className={`h-3.5 w-3.5 rounded-[4px] ${previewColor.iconClass.replace('text-', 'bg-')}`} />
                                ) : (
                                    <span className="text-[10px] font-medium uppercase text-neutral-400">None</span>
                                )}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-heading-3 font-heading-3 text-default-font">{title}</span>
                                <span className="text-caption font-caption text-subtext-color">
                                    Customize icon, color, and details for this {entityNoun}.
                                </span>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-full p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-default-font"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                        <TextField className="w-full" label="Name">
                            <TextField.Input
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                placeholder={type === 'project' ? 'Project name' : 'Collection name'}
                            />
                        </TextField>

                        <TextArea className="w-full" label="Description">
                            <TextArea.Input
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                placeholder={`Optional description for this ${entityNoun}`}
                                rows={4}
                            />
                        </TextArea>

                        <div className="space-y-2">
                            <span className="text-caption-bold font-caption-bold text-default-font">Icon</span>
                            <div className="grid grid-cols-8 gap-1">
                                {ENTITY_ICON_OPTIONS.map((option) => {
                                    const OptionIcon = option.Icon;
                                    const isActive = option.key === iconKey;
                                    return (
                                        <button
                                            key={option.key}
                                            type="button"
                                            title={option.label}
                                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                                                isActive
                                                    ? (hasPreviewColor
                                                        ? `${previewColor.bgClass} ${previewColor.borderClass}`
                                                        : 'border-neutral-300 bg-neutral-100')
                                                    : 'border-neutral-200 bg-white hover:bg-neutral-50'
                                            }`}
                                            onClick={() => setIconKey(option.key)}
                                        >
                                            {OptionIcon ? (
                                                <OptionIcon className={`h-4 w-4 ${isActive && hasPreviewColor ? previewColor.iconClass : 'text-neutral-600'}`} />
                                            ) : (
                                                <span className="text-[10px] font-medium uppercase text-neutral-500">None</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <span className="text-caption-bold font-caption-bold text-default-font">Color</span>
                            <div className="grid grid-cols-10 gap-1.5">
                                {ENTITY_COLOR_OPTIONS.map((option) => {
                                    const isActive = option.key === colorKey;
                                    return (
                                        <button
                                            key={option.key}
                                            type="button"
                                            title={option.label}
                                            aria-label={`Select ${option.label} color`}
                                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
                                                isActive
                                                    ? (option.key === ENTITY_COLOR_NONE_KEY
                                                        ? 'border-neutral-300 bg-neutral-100'
                                                        : `${option.bgClass} ${option.borderClass}`)
                                                    : 'border-neutral-200 bg-white hover:bg-neutral-50'
                                            }`}
                                            onClick={() => setColorKey(option.key)}
                                        >
                                            {option.key === ENTITY_COLOR_NONE_KEY ? (
                                                <span className="text-[10px] font-medium uppercase text-neutral-500">None</span>
                                            ) : (
                                                <span className={`h-3.5 w-3.5 rounded-full ${option.iconClass.replace('text-', 'bg-')}`} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-neutral-100 bg-neutral-50 px-6 py-4">
                        <Button
                            variant="destructive-secondary"
                            onClick={() => setShowDeleteConfirm(true)}
                        >
                            {deleteLabel}
                        </Button>
                        <div className="flex items-center gap-2">
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
                                {isSaving ? 'Saving...' : 'Save'}
                            </Button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>

            <AnimatePresence>
                {showDeleteConfirm ? (
                    <ConfirmDialog
                        isOpen={showDeleteConfirm}
                        onClose={() => setShowDeleteConfirm(false)}
                        onConfirm={() => { void handleDelete(); }}
                        title={`Delete ${type === 'project' ? 'Project' : 'Collection'}?`}
                        message={`Delete "${entity.name}"? This action cannot be undone.`}
                        confirmLabel={isDeleting ? 'Deleting...' : 'Delete'}
                        cancelLabel="Cancel"
                    />
                ) : null}
            </AnimatePresence>
        </>
    );
}
