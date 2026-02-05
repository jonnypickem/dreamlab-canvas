import React, { useState, useEffect, useRef } from 'react';
import { Camera, Link as LinkIcon, FileText, Check } from 'lucide-react';
import { FeatherSparkles } from '@subframe/core';

function ItemCard({ item, onClick, isSelected = false, onSelect }) {
    const [isVisible, setIsVisible] = useState(false);
    const cardRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '100px' }
        );

        if (cardRef.current) {
            observer.observe(cardRef.current);
        }

        return () => observer.disconnect();
    }, []);

    const getTypeIcon = () => {
        switch (item.type) {
            case 'image': return <Camera size={16} className="text-white" />;
            case 'link': return <LinkIcon size={16} className="text-white" />;
            case 'text': return <FileText size={16} className="text-white" />;
            default: return <LinkIcon size={16} className="text-white" />;
        }
    };

    const domainName = (url) => {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch (e) {
            return url;
        }
    };

    const handleClick = (e) => {
        // Check for modifier keys for selection
        const isModifierClick = e.metaKey || e.ctrlKey || e.shiftKey;

        if (onSelect && (isModifierClick || isSelected)) {
            // Selection mode
            onSelect(item.id, {
                shiftKey: e.shiftKey,
                metaKey: e.metaKey || e.ctrlKey
            });
        } else if (!isModifierClick) {
            // Normal click - open modal
            onClick?.();
        }
    };

    return (
        <div
            ref={cardRef}
            onClick={handleClick}
            className={`group relative rounded-lg border bg-white shadow-sm transition-all duration-200 cursor-pointer overflow-hidden
                ${isSelected
                    ? 'border-2 border-orange-600 shadow-lg'
                    : 'border border-[var(--ds-gray-200)] hover:border-orange-600 hover:shadow-md'
                }`}
            style={{ breakInside: 'avoid' }}
        >
            {/* Selection Checkmark - Top Right */}
            {isSelected && (
                <div className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-orange-600 flex items-center justify-center shadow-md">
                    <Check size={14} className="text-white" strokeWidth={3} />
                </div>
            )}

            {/* Type Indicator - Visible on Hover */}
            <div className="absolute top-2 left-2 z-10 flex opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="bg-white shadow-sm border border-neutral-100 p-1.5 rounded-md flex items-center justify-center">
                    {React.cloneElement(getTypeIcon(), { className: "text-orange-600", size: 14 })}
                </div>
            </div>

            {/* Content Rendering */}
            {isVisible ? (
                <>
                    {/* Image Type */}
                    {item.type === 'image' && (
                        <img
                            src={item.content}
                            alt={item.title || 'Captured Image'}
                            className="w-full h-auto block"
                        />
                    )}

                    {/* Link Type */}
                    {item.type === 'link' && (
                        item.thumbnail ? (
                            <img
                                src={item.thumbnail}
                                alt={item.title || 'Link Thumbnail'}
                                className="w-full h-auto block"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.nextSibling.style.display = 'flex';
                                }}
                            />
                        ) : null
                    )}
                    {/* Fallback for Link if no thumbnail or error load */}
                    {item.type === 'link' && (!item.thumbnail || !isVisible) && (
                        <div
                            className={`w-full aspect-video bg-zinc-50 flex flex-col items-center justify-center p-4 ${item.thumbnail ? 'hidden' : 'flex'}`}
                        >
                            <LinkIcon size={48} className="text-zinc-200 mb-2" />
                            <span className="text-xs text-zinc-400 font-mono truncate max-w-full">
                                {domainName(item.sourceUrl)}
                            </span>
                        </div>
                    )}

                    {/* Text Type */}
                    {item.type === 'text' && (
                        <div className="p-4 bg-white min-h-[120px] flex items-center justify-center">
                            <p className="text-sm text-[var(--ds-gray-1000)] line-clamp-6 text-center leading-relaxed">
                                "{item.content}"
                            </p>
                        </div>
                    )}
                </>
            ) : (
                // Loading Placeholder
                <div className="w-full h-48 bg-zinc-50 animate-pulse" />
            )}
        </div>
    );
}

export default ItemCard;
