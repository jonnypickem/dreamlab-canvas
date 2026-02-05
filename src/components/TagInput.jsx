import React, { useState, useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { getAllTags } from '../lib/storage';

export default function TagInput({ tags = [], onChange }) {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const allTags = getAllTags();
        const filtered = allTags.filter(t =>
            t.toLowerCase().includes(inputValue.toLowerCase()) &&
            !tags.includes(t)
        );
        setSuggestions(filtered);
    }, [inputValue, tags]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const addTag = (tag) => {
        const trimmed = tag.trim();
        if (trimmed && !tags.includes(trimmed)) {
            onChange([...tags, trimmed]);
            setInputValue('');
            setShowSuggestions(false);
        }
    };

    const removeTag = (tagToRemove) => {
        onChange(tags.filter(tag => tag !== tagToRemove));
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTag(inputValue);
        } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
        }
    };

    return (
        <div className="w-full" ref={wrapperRef}>
            <div
                className="flex flex-wrap gap-2 p-2 min-h-[42px] relative transition-all"
                style={{
                    backgroundColor: 'var(--ds-background-100)',
                    border: '1px solid var(--ds-gray-200)',
                    borderRadius: 'var(--radius-md)',
                }}
                onClick={() => document.getElementById('tag-input-field').focus()}
            >
                {tags.map(tag => (
                    <span
                        key={tag}
                        className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium transition-colors"
                        style={{
                            backgroundColor: 'var(--ds-gray-100)',
                            color: 'var(--ds-gray-900)',
                            borderRadius: 'var(--radius-sm)',
                        }}
                    >
                        {tag}
                        <button
                            onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                            className="hover:text-red-500 transition-colors"
                        >
                            <X size={12} />
                        </button>
                    </span>
                ))}

                <input
                    id="tag-input-field"
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder={tags.length === 0 ? "Add tags..." : ""}
                    className="flex-grow min-w-[60px] text-sm bg-transparent outline-none placeholder:text-zinc-400"
                    style={{ color: 'var(--ds-gray-1000)' }}
                />
            </div>

            {/* Autocomplete Dropdown */}
            {showSuggestions && inputValue && suggestions.length > 0 && (
                <div
                    className="absolute mt-1 w-full max-w-[300px] z-50 overflow-hidden shadow-lg"
                    style={{
                        backgroundColor: 'var(--ds-background-100)',
                        border: '1px solid var(--ds-gray-200)',
                        borderRadius: 'var(--radius-md)',
                    }}
                >
                    {suggestions.map(tag => (
                        <div
                            key={tag}
                            className="px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50 transition-colors"
                            onClick={() => addTag(tag)}
                        >
                            {tag}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
