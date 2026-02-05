import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toast as SubframeToast } from '../ui/components/Toast';
import { FeatherCheck, FeatherAlertCircle, FeatherInfo, FeatherX } from '@subframe/core';

// Map type to Subframe variant and icon
const variantMap = {
    success: { variant: 'success', icon: <FeatherCheck /> },
    error: { variant: 'error', icon: <FeatherAlertCircle /> },
    info: { variant: 'neutral', icon: <FeatherInfo /> },
    warning: { variant: 'brand', icon: <FeatherAlertCircle /> },
};

export function Toast({ message, type = 'success', onClose }) {
    const [visible, setVisible] = useState(true);
    const config = variantMap[type] || variantMap.info;

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300);
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="fixed bottom-8 right-8 z-50"
                >
                    <SubframeToast
                        variant={config.variant}
                        icon={config.icon}
                        title={message}
                        actions={
                            <button
                                onClick={() => {
                                    setVisible(false);
                                    setTimeout(onClose, 100);
                                }}
                                className="p-1 hover:bg-neutral-100 rounded transition-colors"
                            >
                                <FeatherX className="w-4 h-4 text-neutral-500" />
                            </button>
                        }
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
