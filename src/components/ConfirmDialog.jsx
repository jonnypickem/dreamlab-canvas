import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/components/Button';
import { FeatherAlertTriangle } from '@subframe/core';

/**
 * A reusable confirmation dialog following Dreamlab design rules.
 * Uses Framer Motion for smooth animations and Subframe components.
 */
export default function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title = 'Are you sure?',
    message = 'This action cannot be undone.',
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    variant = 'destructive' // 'destructive' | 'warning' | 'neutral'
}) {
    if (!isOpen) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    const handleConfirm = () => {
        onConfirm();
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 backdrop-blur-sm"
                    onClick={handleBackdropClick}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="flex w-full max-w-[400px] flex-col rounded-lg bg-white shadow-lg mx-4"
                    >
                        {/* Header */}
                        <div className="flex items-start gap-4 px-6 pt-6 pb-4">
                            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-error-100">
                                <FeatherAlertTriangle className="w-5 h-5 text-error-600" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <span className="text-heading-3 font-heading-3 text-default-font">
                                    {title}
                                </span>
                                <span className="text-body font-body text-subtext-color">
                                    {message}
                                </span>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 border-t border-neutral-200 bg-neutral-50 px-6 py-4 rounded-b-lg">
                            <Button
                                variant="neutral-secondary"
                                onClick={onClose}
                            >
                                {cancelLabel}
                            </Button>
                            <Button
                                variant={variant === 'destructive' ? 'destructive-primary' : 'brand-primary'}
                                onClick={handleConfirm}
                            >
                                {confirmLabel}
                            </Button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
