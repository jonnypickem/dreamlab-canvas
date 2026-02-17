import React, { useState, useRef, useEffect } from 'react';
import { FileText, Image, Link, Clipboard, Palette } from 'lucide-react';

export default function CreateToolbar({ onCreateNote, onUploadImage, onCreateLink, onPasteClipboard, onCreateColor }) {
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const [colorValue, setColorValue] = useState('#6366f1');
    const toolbarRef = useRef(null);
    const linkInputRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
                setShowLinkInput(false);
                setShowColorPicker(false);
            }
        };
        if (showLinkInput || showColorPicker) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showLinkInput, showColorPicker]);

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
    };

    const handleColorSubmit = () => {
        onCreateColor(colorValue);
        setShowColorPicker(false);
    };

    const handleImageClick = () => {
        fileInputRef.current?.click();
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

    const handleLinkClick = () => {
        setShowColorPicker(false);
        setShowLinkInput(!showLinkInput);
    };

    const handleColorClick = () => {
        setShowLinkInput(false);
        setShowColorPicker(!showColorPicker);
    };

    const btnClass = "flex items-center justify-center w-9 h-9 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors";

    return (
        <div ref={toolbarRef} className="relative flex items-center gap-1">
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
            />

            <button onClick={onCreateNote} className={btnClass} title="Text Note">
                <FileText size={18} />
            </button>
            <button onClick={handleImageClick} className={btnClass} title="Upload Image">
                <Image size={18} />
            </button>
            <button onClick={handleLinkClick} className={`${btnClass} ${showLinkInput ? 'bg-zinc-100 text-zinc-900' : ''}`} title="Add Link">
                <Link size={18} />
            </button>
            <button onClick={onPasteClipboard} className={btnClass} title="Paste Clipboard">
                <Clipboard size={18} />
            </button>
            <button onClick={handleColorClick} className={`${btnClass} ${showColorPicker ? 'bg-zinc-100 text-zinc-900' : ''}`} title="Color Swatch">
                <Palette size={18} />
            </button>

            {showLinkInput && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50">
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
                </div>
            )}

            {showColorPicker && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-50">
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
                </div>
            )}
        </div>
    );
}
