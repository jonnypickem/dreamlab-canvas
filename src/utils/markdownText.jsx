import React from 'react';

/**
 * Lightweight markdown renderer for notes.
 * Supports: # H1, ## H2, ### H3, plain text as paragraphs.
 * No dependencies — just regex parsing.
 */
export function renderMarkdownText(text, { clampLines = 0, className = '' } = {}) {
    if (!text || typeof text !== 'string') return null;

    const lines = text.split('\n');
    const elements = [];
    let paragraphBuffer = [];
    let key = 0;

    const flushParagraph = () => {
        if (paragraphBuffer.length === 0) return;
        const joined = paragraphBuffer.join(' ').trim();
        if (joined) {
            elements.push(
                <p key={key++} className="text-body text-[var(--ds-gray-1000)] leading-relaxed text-left break-words">
                    {joined}
                </p>
            );
        }
        paragraphBuffer = [];
    };

    for (const line of lines) {
        const trimmed = line.trim();

        if (!trimmed) {
            flushParagraph();
            continue;
        }

        const h3Match = trimmed.match(/^###\s+(.+)/);
        if (h3Match) {
            flushParagraph();
            elements.push(
                <h3 key={key++} className="text-base font-semibold text-[var(--ds-gray-1000)] leading-snug text-left">
                    {h3Match[1]}
                </h3>
            );
            continue;
        }

        const h2Match = trimmed.match(/^##\s+(.+)/);
        if (h2Match) {
            flushParagraph();
            elements.push(
                <h2 key={key++} className="text-lg font-semibold text-[var(--ds-gray-1000)] leading-snug text-left">
                    {h2Match[1]}
                </h2>
            );
            continue;
        }

        const h1Match = trimmed.match(/^#\s+(.+)/);
        if (h1Match) {
            flushParagraph();
            elements.push(
                <h1 key={key++} className="text-xl font-bold text-[var(--ds-gray-1000)] leading-snug text-left">
                    {h1Match[1]}
                </h1>
            );
            continue;
        }

        paragraphBuffer.push(trimmed);
    }

    flushParagraph();

    if (elements.length === 0) return null;

    const wrapperClass = [
        'flex flex-col gap-1.5',
        clampLines > 0 ? `overflow-hidden` : '',
        className,
    ].filter(Boolean).join(' ');

    const style = clampLines > 0
        ? { display: '-webkit-box', WebkitLineClamp: clampLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
        : undefined;

    return (
        <div className={wrapperClass} style={style}>
            {elements}
        </div>
    );
}

/**
 * Check if text contains any markdown headings.
 */
export function hasMarkdownHeadings(text) {
    if (!text) return false;
    return /^#{1,3}\s+/m.test(text);
}
