import React, { useState, useRef, useEffect } from 'react';
import { Plus, FileText, Image, Link, Clipboard, Palette, X } from 'lucide-react';

export default function CreateToolbar({ onCreateNote, onUploadImage, onCreateLink, onPasteClipboard, onCreateColor }) {
    const [open, setOpen] = useState(false);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [colorValue, setColorValue] = useState('#6366f1');
    const menuRef = useRef(null);
    const linkInputRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpen(false);
                setShowLinkInput(false);
                setShowColorPicker(false);
            }
        };
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    useEffect(() => {
        if (showLinkInput && linkInputRef.current) linkInputRef.current.focus();
    }, [showLinkInput]);

    const handleLinkSubmit = (e) => {
        e.preventDefault();
        const trimmed = linkUrl.trim();
        if (!trimmed) return;
        let url = trimmed;
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        onCreateLink(url);
        setLinkUrl('');
        setShowLinkInput(false);
        setOpen(false);
    };

    const handleColorSubmit = () => {
        onCreateColor(colorValue);
        setShowColorPicker(false);
        setOpen(false);
    };

    const handleImageClick = () => {
        fileInputRef.current?.click();
        setOpen(false);
    };

    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
            if (file.type.startsWith('image/')) {
                onUploadImage(file);
            }
        }
        e.target.value = '';
    };

    const tools = [
        { id: 'note', icon: FileText, label: 'Text Note', action: () => { onCreateNote(); setOpen(false); } },
        { id: 'image', icon: Image, label: 'Upload Image', action: handleImageClick },
        { id: 'link', icon: Link, label: 'Add Link', action: () => setShowLinkInput(true) },
        { id: 'clipboard', icon: Clipboard, label: 'Paste', action: () => { onPasteClipboard(); setOpen(false); } },
        { id: 'color', icon: Palette, label: 'Color Swatch', action: () => setShowColorPicker(true) },
    ];

    return (
        <div ref={menuRef} className="relative">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
            />

            <button
                onClick={() => { setOpen(!open); setShowLinkInput(false); setShowColorPicker(false); }}
                className={`flex items-center justify-center w-10 h-10 rounded-full transition-all ${
                    open
                        ? 'bg-zinc-900 text-white rotate-45'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
            >
                <Plus size={20} />
            </button>

            {open && (
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-50">
                    {showLinkInput ? (
                        <form
                            onSubmit={handleLinkSubmit}
                            className="flex items-center gap-2 bg-white rounded-xl border border-zinc-200 shadow-xl px-3 py-2 min-w-[320px]"
                        >
                            <Link size={16} className="text-zinc-400 flex-shrink-0" />
                            <input
                                ref={linkInputRef}
                                type="text"
                                value={linkUrl}
                                onChange={(e) => setLinkUrl(e.target.value)}
                                placeholder="Paste a URL..."
                                className="flex-1 text-sm outline-none bg-transparent text-zinc-900 placeholder:text-zinc-400"
                                onKeyDown={(e) => { if (e.key === 'Escape') { setShowLinkInput(false); } }}
                            />
                            <button
                                type="submit"
                                disabled={!linkUrl.trim()}
                                className="text-xs font-semibold text-white bg-zinc-900 rounded-lg px-3 py-1.5 disabled:opacity-30 hover:bg-zinc-800 transition-colors"
                            >
                                Add
                            </button>
                        </form>
                    ) : showColorPicker ? (
                        <div className="flex items-center gap-3 bg-white rounded-xl border border-zinc-200 shadow-xl px-4 py-3 min-w-[280px]">
                            <input
                                type="color"
                                value={colorValue}
                                onChange={(e) => setColorValue(e.target.value)}
                                className="w-10 h-10 rounded-lg border border-zinc-200 cursor-pointer p-0"
                            />
                            <input
                                type="text"
                                value={colorValue}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setColorValue(v);
                                }}
                                className="flex-1 text-sm font-mono outline-none bg-transparent text-zinc-900 uppercase"
                                maxLength={7}
                            />
                            <button
                                onClick={handleColorSubmit}
                                className="text-xs font-semibold text-white bg-zinc-900 rounded-lg px-3 py-1.5 hover:bg-zinc-800 transition-colors"
                            >
                                Add
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 bg-white rounded-xl border border-zinc-200 shadow-xl px-2 py-2">
                            {tools.map((tool) => (
                                <button
                                    key={tool.id}
                                    onClick={tool.action}
                                    className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors group"
                                    title={tool.label}
                                >
                                    <tool.icon size={18} className="text-zinc-500 group-hover:text-zinc-900 transition-colors" />
                                    <span className="text-[10px] font-medium text-zinc-400 group-hover:text-zinc-700 transition-colors whitespace-nowrap">
                                        {tool.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
