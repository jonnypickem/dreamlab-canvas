import { getItems, STORAGE_KEY } from '../lib/storage';
import { offloadItemMediaToIndexedDb } from '../lib/mediaStore';

function isLegacyInlineImage(value) {
    return typeof value === 'string' && value.startsWith('data:image/');
}

function hasLegacyInlineMedia(item) {
    if (!item || typeof item !== 'object') return false;
    if (item.type === 'image' && isLegacyInlineImage(item.content)) return true;
    if (item.type === 'link' && isLegacyInlineImage(item.thumbnail)) return true;
    return false;
}

function persistItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('storage-update'));
}

function yieldToMainThread() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

export function countLegacyInlineMediaItems(items = []) {
    return (Array.isArray(items) ? items : []).filter(hasLegacyInlineMedia).length;
}

export async function migrateLegacyMediaToIndexedDb(options = {}) {
    const batchSize = Math.max(1, Number(options.batchSize || 25));
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

    const originalItems = getItems();
    const items = Array.isArray(originalItems) ? [...originalItems] : [];

    let scanned = 0;
    let migrated = 0;
    let failed = 0;
    let dirty = false;
    let inBatch = 0;

    for (let index = 0; index < items.length; index += 1) {
        const current = items[index];
        if (!hasLegacyInlineMedia(current)) continue;

        scanned += 1;
        inBatch += 1;

        try {
            const migratedItem = await offloadItemMediaToIndexedDb(current);
            const changed = migratedItem?.content !== current?.content
                || migratedItem?.thumbnail !== current?.thumbnail
                || migratedItem?.id !== current?.id
                || migratedItem?.contentStorage !== current?.contentStorage
                || migratedItem?.thumbnailStorage !== current?.thumbnailStorage;
            if (changed) {
                items[index] = migratedItem;
                migrated += 1;
                dirty = true;
            }
        } catch {
            failed += 1;
        }

        if (inBatch >= batchSize) {
            if (dirty) {
                persistItems(items);
                dirty = false;
            }
            if (onProgress) {
                onProgress({ scanned, migrated, failed });
            }
            inBatch = 0;
            await yieldToMainThread();
        }
    }

    if (dirty) {
        persistItems(items);
    }
    if (onProgress) {
        onProgress({ scanned, migrated, failed });
    }

    return { scanned, migrated, failed };
}

