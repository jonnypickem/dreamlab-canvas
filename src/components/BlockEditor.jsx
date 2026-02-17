import React, { useRef, useEffect, useCallback } from 'react';

// --- Serialization helpers ---

let idCounter = 0;
function genId() { return `blk-${++idCounter}`; }

export function parseMarkdownToBlocks(markdown) {
    if (!markdown) return [{ id: genId(), type: 'p', text: '' }];
    const lines = markdown.split('\n');
    return lines.map(line => {
        const h3 = line.match(/^###\s+(.*)/);
        if (h3) return { id: genId(), type: 'h3', text: h3[1] };
        const h2 = line.match(/^##\s+(.*)/);
        if (h2) return { id: genId(), type: 'h2', text: h2[1] };
        const h1 = line.match(/^#\s+(.*)/);
        if (h1) return { id: genId(), type: 'h1', text: h1[1] };
        return { id: genId(), type: 'p', text: line };
    });
}

export function serializeBlocksToMarkdown(blocks) {
    return blocks.map(b => {
        switch (b.type) {
            case 'h1': return `# ${b.text}`;
            case 'h2': return `## ${b.text}`;
            case 'h3': return `### ${b.text}`;
            default: return b.text;
        }
    }).join('\n');
}

// --- Styling ---

const BLOCK_STYLES = {
    h1: 'text-xl font-bold text-[var(--ds-gray-1000)] leading-snug text-left',
    h2: 'text-lg font-semibold text-[var(--ds-gray-1000)] leading-snug text-left',
    h3: 'text-base font-semibold text-[var(--ds-gray-1000)] leading-snug text-left',
    p: 'text-body text-[var(--ds-gray-1000)] leading-relaxed text-left break-words',
};

function tagForType(type) {
    if (type === 'h1' || type === 'h2' || type === 'h3') return type.toUpperCase();
    return 'P';
}

// --- Cursor helpers ---

function getTextOffset(root, targetNode, targetOffset) {
    if (root === targetNode) {
        // If targeting root directly, count text of children up to targetOffset
        if (targetNode.nodeType === Node.TEXT_NODE) return targetOffset;
        let off = 0;
        for (let i = 0; i < targetOffset; i++) {
            off += (root.childNodes[i]?.textContent || '').length;
        }
        return off;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let offset = 0;
    while (walker.nextNode()) {
        if (walker.currentNode === targetNode) return offset + targetOffset;
        offset += walker.currentNode.textContent.length;
    }
    return offset;
}

function getCursorContext(container) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    let node = range.startContainer;
    // Walk up to find the direct child of container
    while (node && node.parentNode !== container) node = node.parentNode;
    if (!node) return null;
    const blockIndex = Array.from(container.children).indexOf(node);
    if (blockIndex < 0) return null;
    const offset = getTextOffset(node, range.startContainer, range.startOffset);
    return { blockIndex, offset };
}

function setCursorPosition(container, blockIndex, offset) {
    const blockEl = container.children[blockIndex];
    if (!blockEl) return;
    const range = document.createRange();
    const sel = window.getSelection();

    const text = blockEl.textContent || '';
    if (!text && blockEl.querySelector('br')) {
        range.setStart(blockEl, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
    }

    // Find text node at offset
    const walker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
    let remaining = Math.min(offset, text.length);
    while (walker.nextNode()) {
        const len = walker.currentNode.textContent.length;
        if (remaining <= len) {
            range.setStart(walker.currentNode, remaining);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
        }
        remaining -= len;
    }
    // Fallback: place at end
    range.selectNodeContents(blockEl);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
}

// --- DOM reconciliation ---

function reconcileDOM(container, blocks) {
    const children = Array.from(container.children);

    blocks.forEach((block, i) => {
        const tag = tagForType(block.type);
        const existing = children[i];

        if (!existing || existing.tagName !== tag || existing.dataset.blockId !== block.id) {
            const el = document.createElement(tag);
            el.dataset.blockId = block.id;
            el.dataset.blockType = block.type;
            el.className = BLOCK_STYLES[block.type] || BLOCK_STYLES.p;
            if (block.text) {
                el.textContent = block.text;
            } else {
                el.innerHTML = '<br>';
            }
            if (existing) {
                container.replaceChild(el, existing);
            } else {
                container.appendChild(el);
            }
        }
        // If same block & tag, don't touch text — browser is editing it
    });

    // Remove excess
    while (container.children.length > blocks.length) {
        container.removeChild(container.lastChild);
    }
}

// --- Read DOM back into blocks ---

function readBlocksFromDOM(container) {
    return Array.from(container.children).map(el => {
        const tag = el.tagName.toLowerCase();
        let type = 'p';
        if (tag === 'h1') type = 'h1';
        else if (tag === 'h2') type = 'h2';
        else if (tag === 'h3') type = 'h3';
        return {
            id: el.dataset.blockId || genId(),
            type,
            text: el.textContent || '',
        };
    });
}

// --- Heading prefix detection ---

function detectHeadingPrefix(text) {
    const m3 = text.match(/^###\s(.*)/);
    if (m3) return { type: 'h3', text: m3[1] };
    const m2 = text.match(/^##\s(.*)/);
    if (m2) return { type: 'h2', text: m2[1] };
    const m1 = text.match(/^#\s(.*)/);
    if (m1) return { type: 'h1', text: m1[1] };
    return null;
}

// --- Component ---

function BlockEditor({
    value = '',
    onChange,
    onBlur,
    onSubmit,
    placeholder = 'Start typing...',
    className = '',
    autoFocus = false,
}) {
    const editorRef = useRef(null);
    const blocksRef = useRef(parseMarkdownToBlocks(value));
    const lastSerializedRef = useRef(value);
    const structuralVersionRef = useRef(0);
    const isInternalChange = useRef(false);

    // Sync external value changes (e.g. navigating to different item)
    useEffect(() => {
        if (isInternalChange.current) {
            isInternalChange.current = false;
            return;
        }
        if (value !== lastSerializedRef.current) {
            const newBlocks = parseMarkdownToBlocks(value);
            blocksRef.current = newBlocks;
            lastSerializedRef.current = value;
            if (editorRef.current) {
                reconcileDOM(editorRef.current, newBlocks);
            }
        }
    }, [value]);

    // Initial render
    useEffect(() => {
        if (editorRef.current) {
            reconcileDOM(editorRef.current, blocksRef.current);
            if (autoFocus) {
                editorRef.current.focus();
                // Place cursor at end of last block
                const blocks = blocksRef.current;
                if (blocks.length > 0) {
                    const lastIdx = blocks.length - 1;
                    setCursorPosition(editorRef.current, lastIdx, blocks[lastIdx].text.length);
                }
            }
        }
    }, []);

    const emitChange = useCallback((blocks) => {
        const md = serializeBlocksToMarkdown(blocks);
        lastSerializedRef.current = md;
        isInternalChange.current = true;
        onChange?.(md);
    }, [onChange]);

    const handleInput = useCallback(() => {
        const container = editorRef.current;
        if (!container) return;

        const cursor = getCursorContext(container);
        let blocks = readBlocksFromDOM(container);
        let needsReconcile = false;

        // Detect heading prefix transforms
        blocks = blocks.map((block, i) => {
            if (block.type !== 'p') return block;
            const heading = detectHeadingPrefix(block.text);
            if (heading && cursor?.blockIndex === i) {
                needsReconcile = true;
                return { ...block, type: heading.type, text: heading.text };
            }
            return block;
        });

        // Ensure at least one block
        if (blocks.length === 0) {
            blocks = [{ id: genId(), type: 'p', text: '' }];
            needsReconcile = true;
        }

        blocksRef.current = blocks;
        emitChange(blocks);

        if (needsReconcile) {
            const cursorOffset = cursor ? Math.max(0, cursor.offset - (blocks[cursor.blockIndex]?.type !== 'p' ? getHeadingPrefixLength(blocks[cursor.blockIndex].type) : 0)) : 0;
            // Calculate actual cursor position: offset in DOM minus prefix length that was removed
            const blockIdx = cursor?.blockIndex ?? 0;
            const block = blocks[blockIdx];
            // The cursor was after "# X" → now just "X", so offset should be block.text.length if at end
            const newOffset = block ? Math.min(block.text.length, Math.max(0, (cursor?.offset || 0) - getPrefixLength(block.type))) : 0;

            reconcileDOM(container, blocks);
            setCursorPosition(container, blockIdx, newOffset);
        }
    }, [emitChange]);

    const handleKeyDown = useCallback((e) => {
        const container = editorRef.current;
        if (!container) return;

        // Cmd+Enter or Escape → submit
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
            e.preventDefault();
            onSubmit?.();
            return;
        }

        // Enter → split block
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const cursor = getCursorContext(container);
            if (!cursor) return;

            const blocks = [...blocksRef.current];
            const block = blocks[cursor.blockIndex];
            if (!block) return;

            const beforeText = block.text.slice(0, cursor.offset);
            const afterText = block.text.slice(cursor.offset);

            // Update current block
            blocks[cursor.blockIndex] = { ...block, text: beforeText };

            // New block is always a paragraph
            const newBlock = { id: genId(), type: 'p', text: afterText };
            blocks.splice(cursor.blockIndex + 1, 0, newBlock);

            blocksRef.current = blocks;
            emitChange(blocks);
            reconcileDOM(container, blocks);
            setCursorPosition(container, cursor.blockIndex + 1, 0);
            return;
        }

        // Backspace at start of block
        if (e.key === 'Backspace') {
            const cursor = getCursorContext(container);
            if (!cursor || cursor.offset !== 0) return;

            const blocks = [...blocksRef.current];
            const block = blocks[cursor.blockIndex];
            if (!block) return;

            // If heading → demote to paragraph
            if (block.type !== 'p') {
                e.preventDefault();
                blocks[cursor.blockIndex] = { ...block, type: 'p' };
                blocksRef.current = blocks;
                emitChange(blocks);
                reconcileDOM(container, blocks);
                setCursorPosition(container, cursor.blockIndex, 0);
                return;
            }

            // If not first block → merge with previous
            if (cursor.blockIndex > 0) {
                e.preventDefault();
                const prevBlock = blocks[cursor.blockIndex - 1];
                const mergeOffset = prevBlock.text.length;
                blocks[cursor.blockIndex - 1] = {
                    ...prevBlock,
                    text: prevBlock.text + block.text,
                };
                blocks.splice(cursor.blockIndex, 1);

                // Ensure at least one block
                if (blocks.length === 0) {
                    blocks.push({ id: genId(), type: 'p', text: '' });
                }

                blocksRef.current = blocks;
                emitChange(blocks);
                reconcileDOM(container, blocks);
                setCursorPosition(container, cursor.blockIndex - 1, mergeOffset);
                return;
            }
        }
    }, [onSubmit, emitChange]);

    const handlePaste = useCallback((e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        if (!text) return;

        const container = editorRef.current;
        if (!container) return;

        const cursor = getCursorContext(container);
        if (!cursor) return;

        const blocks = [...blocksRef.current];
        const block = blocks[cursor.blockIndex];
        if (!block) return;

        const lines = text.split('\n');
        if (lines.length === 1) {
            // Single line paste — insert at cursor
            const newText = block.text.slice(0, cursor.offset) + lines[0] + block.text.slice(cursor.offset);
            blocks[cursor.blockIndex] = { ...block, text: newText };
            blocksRef.current = blocks;
            emitChange(blocks);
            reconcileDOM(container, blocks);
            setCursorPosition(container, cursor.blockIndex, cursor.offset + lines[0].length);
            return;
        }

        // Multi-line paste
        const beforeText = block.text.slice(0, cursor.offset);
        const afterText = block.text.slice(cursor.offset);

        // First line merges with current block before cursor
        const firstLineText = beforeText + lines[0];
        const firstLineParsed = detectHeadingPrefix(firstLineText);
        blocks[cursor.blockIndex] = {
            ...block,
            type: firstLineParsed?.type || block.type,
            text: firstLineParsed?.text ?? firstLineText,
        };

        // Middle lines become new blocks
        const newBlocks = [];
        for (let i = 1; i < lines.length - 1; i++) {
            const parsed = detectHeadingPrefix(lines[i]);
            newBlocks.push({
                id: genId(),
                type: parsed?.type || 'p',
                text: parsed?.text ?? lines[i],
            });
        }

        // Last line gets afterText appended
        const lastLine = lines[lines.length - 1] + afterText;
        const lastParsed = detectHeadingPrefix(lastLine);
        newBlocks.push({
            id: genId(),
            type: lastParsed?.type || 'p',
            text: lastParsed?.text ?? lastLine,
        });

        blocks.splice(cursor.blockIndex + 1, 0, ...newBlocks);
        blocksRef.current = blocks;
        emitChange(blocks);
        reconcileDOM(container, blocks);

        const lastBlockIdx = cursor.blockIndex + newBlocks.length;
        const lastBlock = blocks[lastBlockIdx];
        setCursorPosition(container, lastBlockIdx, lastBlock.text.length - afterText.length);
    }, [emitChange]);

    const handleBlur = useCallback((e) => {
        // Don't fire blur if focus is moving within the editor
        if (editorRef.current?.contains(e.relatedTarget)) return;
        onBlur?.();
    }, [onBlur]);

    const isEmpty = blocksRef.current.length <= 1 && !blocksRef.current[0]?.text;

    return (
        <div className={`relative ${className}`}>
            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onBlur={handleBlur}
                className="outline-none flex flex-col gap-1.5 w-full h-full"
                style={{ minHeight: '1.5em' }}
            />
            {isEmpty && (
                <div className="absolute top-0 left-0 pointer-events-none text-zinc-300 text-body leading-relaxed">
                    {placeholder}
                </div>
            )}
        </div>
    );
}

function getPrefixLength(type) {
    switch (type) {
        case 'h1': return 2; // "# "
        case 'h2': return 3; // "## "
        case 'h3': return 4; // "### "
        default: return 0;
    }
}

// For back-compat, not currently used but mirrors getPrefixLength
function getHeadingPrefixLength(type) {
    return getPrefixLength(type);
}

export default BlockEditor;
