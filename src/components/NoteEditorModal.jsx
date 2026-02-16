import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';

export default function NoteEditorModal({ onSave, onClose }) {
    const [text, setText] = useState('');
    const textareaRef = useRef(null);

    useEffect(() => {
        textareaRef.current?.focus();
    }, []);

    const handleSave = () => {
        const trimmed = text.trim();
        if (!trimmed) return;
        onSave(trimmed);
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSave();
    };

    return (
        <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
        >
            <motion.div
                className="w-full max-w-lg bg-white rounded-2xl border border-zinc-200 shadow-2xl overflow-hidden"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
                    <h3 className="text-sm font-semibold text-zinc-900">New Note</h3>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-zinc-100 transition-colors">
                        <X size={16} className="text-zinc-400" />
                    </button>
                </div>

                <div className="p-5">
                    <textarea
                        ref={textareaRef}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Write a note..."
                        className="w-full h-40 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none resize-none bg-transparent leading-relaxed"
                    />
                </div>

                <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 bg-zinc-50">
                    <span className="text-xs text-zinc-400">
                        {navigator.platform?.includes('Mac') ? '⌘' : 'Ctrl'}+Enter to save
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-1.5 text-sm font-medium text-zinc-600 rounded-lg hover:bg-zinc-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!text.trim()}
                            className="px-4 py-1.5 text-sm font-semibold text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-30"
                        >
                            Save Note
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
