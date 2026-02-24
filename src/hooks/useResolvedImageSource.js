import { useEffect, useState } from 'react';
import { getMediaUrl, invalidateMediaUrl, isSupabaseStoragePath } from '../lib/supabaseStorage';
import { isMediaStoreRef, releaseRenderableMediaSrc } from '../lib/mediaStore';

export function useResolvedImageSource(source, options = {}) {
    const [resolvedSource, setResolvedSource] = useState(() => {
        // For http/data/blob URLs, use immediately without async resolution
        if (source && (source.startsWith('http') || source.startsWith('data:') || source.startsWith('blob:'))) {
            return source;
        }
        return '';
    });

    useEffect(() => {
        let cancelled = false;
        const sourceRef = source;
        const retryToken = Number(options?.retryToken);
        const shouldForceRefresh = Number.isFinite(retryToken) && retryToken > 0;

        // Nothing to resolve
        if (!source) {
            setResolvedSource('');
            return;
        }

        // Already a renderable URL — use directly
        if (source.startsWith('http') || source.startsWith('data:') || source.startsWith('blob:')) {
            setResolvedSource(source);
            return;
        }

        // Supabase storage path or legacy idb:// ref — resolve async
        const load = async () => {
            try {
                let resolved = await getMediaUrl(source, 3600, {
                    forceRefresh: shouldForceRefresh,
                });
                if (!resolved && isSupabaseStoragePath(source) && !shouldForceRefresh) {
                    invalidateMediaUrl(source);
                    resolved = await getMediaUrl(source, 3600, { forceRefresh: true });
                }
                if (!cancelled) {
                    setResolvedSource(resolved || '');
                }
            } catch {
                if (isSupabaseStoragePath(source) && !shouldForceRefresh) {
                    try {
                        const retried = await getMediaUrl(source, 3600, { forceRefresh: true });
                        if (!cancelled) {
                            setResolvedSource(retried || '');
                        }
                        return;
                    } catch {
                        // Fall through to empty state.
                    }
                }
                if (!cancelled) {
                    setResolvedSource('');
                }
            }
        };

        load();

        return () => {
            cancelled = true;
            if (isMediaStoreRef(sourceRef)) {
                releaseRenderableMediaSrc(sourceRef);
            }
        };
    }, [source, options?.retryToken]);

    return resolvedSource;
}
