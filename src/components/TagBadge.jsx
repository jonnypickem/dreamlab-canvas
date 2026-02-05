import React from 'react';
import { FeatherX } from '@subframe/core';

/**
 * TagBadge - Visual tag component with two styles:
 * - Objective: Gray badge for factual tags
 * - Context: Gradient badge with ✨ for project-specific tags
 */
export default function TagBadge({
    tag,
    type = 'objective', // 'objective' | 'context'
    confidence,
    projectName,
    onRemove,
    size = 'default' // 'small' | 'default'
}) {
    const isContext = type === 'context';
    const isSmall = size === 'small';

    const baseClasses = `
        inline-flex items-center gap-1 rounded-full font-medium transition-all
        ${isSmall ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}
    `;

    const styleClasses = isContext
        ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm'
        : 'bg-neutral-100 text-neutral-700 border border-neutral-200';

    const title = isContext
        ? `Context tag from "${projectName || 'project'}"${confidence ? ` (${Math.round(confidence * 100)}% confidence)` : ''}`
        : 'Objective tag';

    return (
        <span
            className={`${baseClasses} ${styleClasses}`}
            title={title}
        >
            {isContext && (
                <span className="opacity-90">✨</span>
            )}
            <span>{tag}</span>
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove(tag, type);
                    }}
                    className={`
                        ml-0.5 rounded-full p-0.5 transition-colors
                        ${isContext
                            ? 'hover:bg-white/20'
                            : 'hover:bg-neutral-200'
                        }
                    `}
                    aria-label={`Remove ${tag}`}
                >
                    <FeatherX className={isSmall ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
                </button>
            )}
        </span>
    );
}

/**
 * TagList - Display a list of tags with proper wrapping
 */
export function TagList({
    objectiveTags = [],
    contextTags = [],
    projectName,
    onRemove,
    maxDisplay,
    size = 'default'
}) {
    // Flatten context tags to get tag strings
    const contextTagStrings = contextTags.map(ct =>
        typeof ct === 'string' ? ct : ct.tag
    );

    // Combine for display limit
    let displayObjective = objectiveTags;
    let displayContext = contextTagStrings;

    if (maxDisplay) {
        const totalTags = objectiveTags.length + contextTagStrings.length;
        if (totalTags > maxDisplay) {
            // Prioritize showing some of each type
            const objLimit = Math.min(objectiveTags.length, Math.ceil(maxDisplay * 0.6));
            const ctxLimit = maxDisplay - objLimit;
            displayObjective = objectiveTags.slice(0, objLimit);
            displayContext = contextTagStrings.slice(0, ctxLimit);
        }
    }

    const remaining = (objectiveTags.length + contextTagStrings.length) -
        (displayObjective.length + displayContext.length);

    return (
        <div className="flex flex-wrap gap-1.5">
            {displayObjective.map(tag => (
                <TagBadge
                    key={`obj-${tag}`}
                    tag={tag}
                    type="objective"
                    onRemove={onRemove}
                    size={size}
                />
            ))}
            {displayContext.map(tag => {
                const ctxData = contextTags.find(ct =>
                    (typeof ct === 'string' ? ct : ct.tag) === tag
                );
                return (
                    <TagBadge
                        key={`ctx-${tag}`}
                        tag={tag}
                        type="context"
                        confidence={typeof ctxData === 'object' ? ctxData.confidence : undefined}
                        projectName={projectName}
                        onRemove={onRemove}
                        size={size}
                    />
                );
            })}
            {remaining > 0 && (
                <span className={`
                    inline-flex items-center rounded-full bg-neutral-100 text-neutral-500
                    ${size === 'small' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}
                `}>
                    +{remaining} more
                </span>
            )}
        </div>
    );
}
