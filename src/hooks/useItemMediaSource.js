import { useEffect, useMemo } from 'react';
import { useResolvedImageSource } from './useResolvedImageSource';
import { resolveItemMediaSource, hasCompleteMediaVariants } from '../utils/mediaSourcePolicy';
import { queueItemMediaVariantBackfill } from '../services/mediaVariantBackfill';

export function useItemMediaSource(item, options = {}) {
    const sourcePath = useMemo(
        () => resolveItemMediaSource(item, options),
        [item, options?.context, options?.scale, options?.renderedPixels]
    );
    const resolvedSource = useResolvedImageSource(sourcePath || '');

    useEffect(() => {
        if (!item || !item.id) return;
        if (item.type !== 'image' && item.type !== 'link') return;
        if (hasCompleteMediaVariants(item)) return;
        queueItemMediaVariantBackfill(item);
    }, [item]);

    return resolvedSource || '';
}
