import React from 'react';
import Masonry from 'react-masonry-css';
import '../masonry.css';
import ItemCard from './ItemCard';

function MasonryGrid({
    items,
    onItemClick,
    zoomLevel = 2,
    selectedItems = new Set(),
    onSelectItem
}) {
    // zoomLevel needs to map to column counts.
    // Slider: 0 (Small items) <-> 4 (Large items)
    // 0: +2 cols
    // 1: +1 col
    // 2: Base (default)
    // 3: -1 col
    // 4: -2 cols
    const offset = 2 - zoomLevel;

    const breakpointColumnsObj = {
        default: Math.max(1, 5 + offset),
        1536: Math.max(1, 4 + offset),  // 2xl
        1280: Math.max(1, 3 + offset),  // xl
        1024: Math.max(1, 2 + offset),  // lg
        768: Math.max(1, 1 + Math.floor(offset / 2)) // md: allow 2 cols if really zoomed out (small items)
    };

    return (
        <Masonry
            breakpointCols={breakpointColumnsObj}
            className="masonry-grid"
            columnClassName="masonry-grid-column"
        >
            {items.map(item => (
                <ItemCard
                    key={item.id}
                    item={item}
                    onClick={() => onItemClick(item)}
                    isSelected={selectedItems.has(item.id)}
                    onSelect={onSelectItem}
                />
            ))}
        </Masonry>
    );
}

export default MasonryGrid;
