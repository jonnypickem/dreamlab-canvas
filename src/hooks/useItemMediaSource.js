import { useEffect, useMemo } from 'react';
import { useResolvedImageSource } from './useResolvedImageSource';
import { getItemMediaCandidatePaths, hasCompleteMediaVariants } from '../utils/mediaSourcePolicy';
import { queueItemMediaVariantBackfill } from '../services/mediaVariantBackfill';
import { isSupabaseStoragePath } from '../lib/supabaseStorage';

function isFetchableBackfillSource(value) {
    if (!value || typeof value !== 'string') return false;
    const source = value.trim();
    if (!source) return false;
    if (
        source.startsWith('http://')
        || source.startsWith('https://')
        || source.startsWith('data:')
        || source.startsWith('blob:')
        || source.startsWith('idb://')
    ) {
        return true;
    }
    return isSupabaseStoragePath(source);
}

export function useItemMediaSource(item, options = {}) {
    const sourceCandidates = useMemo(
        () => getItemMediaCandidatePaths(item, options),
        [item, options?.context, options?.scale, options?.renderedPixels]
    );
    const resolvedPrimary = useResolvedImageSource(sourceCandidates[0] || '', {
        retryToken: options?.retryToken,
    });
    const resolvedSecondary = useResolvedImageSource(sourceCandidates[1] || '', {
        retryToken: options?.retryToken,
    });
    const resolvedTertiary = useResolvedImageSource(sourceCandidates[2] || '', {
        retryToken: options?.retryToken,
    });

    useEffect(() => {
        if (!item || !item.id) return;
        if (item.type !== 'image' && item.type !== 'link') return;
        if (hasCompleteMediaVariants(item)) return;
        const backfillSource = item.type === 'image'
            ? String(item.content || item.thumbnail || '').trim()
            : String(item.thumbnail || '').trim();
        if (!isFetchableBackfillSource(backfillSource)) return;
        queueItemMediaVariantBackfill(item);
    }, [item]);

    return resolvedPrimary || resolvedSecondary || resolvedTertiary || '';
}
