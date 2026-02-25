import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/components/Button';
import { Select } from '../ui/components/Select';

const MODE_OPTIONS = [
    { value: 'move', label: 'Move' },
    { value: 'duplicate', label: 'Duplicate' },
];

export default function CollectionTransferModal({
    isOpen = false,
    selectedCount = 0,
    mode = 'move',
    targetCollectionId = 'unassigned',
    destinationOptions = [],
    isSubmitting = false,
    onModeChange,
    onTargetCollectionChange,
    onClose,
    onConfirm,
}) {
    if (!isOpen) return null;

    const actionLabel = mode === 'duplicate' ? 'Duplicate' : 'Move';

    return (
        <motion.div
            className="fixed inset-0 z-[125] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                initial={{ y: 16, opacity: 0, scale: 0.98 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 16, opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                onClick={(event) => event.stopPropagation()}
            >
                <div className="border-b border-neutral-100 px-6 py-5">
                    <h2 className="text-heading-3 font-heading-3 text-default-font">Move or Duplicate Items</h2>
                    <p className="mt-1 text-caption font-caption text-subtext-color">
                        Choose how to transfer {selectedCount} selected item{selectedCount !== 1 ? 's' : ''}.
                    </p>
                </div>

                <div className="space-y-4 px-6 py-5">
                    <div className="space-y-2">
                        <span className="text-caption-bold font-caption-bold text-default-font">Action</span>
                        <Select value={mode} onValueChange={onModeChange}>
                            {MODE_OPTIONS.map((option) => (
                                <Select.Item key={option.value} value={option.value}>
                                    {option.label}
                                </Select.Item>
                            ))}
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <span className="text-caption-bold font-caption-bold text-default-font">Destination</span>
                        <Select value={targetCollectionId} onValueChange={onTargetCollectionChange}>
                            {destinationOptions.map((option) => (
                                <Select.Item key={option.value} value={option.value}>
                                    {option.label}
                                </Select.Item>
                            ))}
                        </Select>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-6 py-4">
                    <Button
                        variant="neutral-secondary"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="brand-primary"
                        onClick={onConfirm}
                        disabled={isSubmitting || selectedCount <= 0}
                    >
                        {isSubmitting
                            ? `${actionLabel}ing...`
                            : `${actionLabel} ${selectedCount} Item${selectedCount !== 1 ? 's' : ''}`}
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
}
