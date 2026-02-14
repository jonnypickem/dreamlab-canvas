import { useEffect, useState } from 'react';
import { getMediaUrl, isSupabaseStoragePath } from '../lib/supabaseStorage';

export function useResolvedImageSource(source) {
    const [resolvedSource, setResolvedSource] = useState(() => {
        // For http/data/blob URLs, use immediately without async resolution
        if (source && (source.startsWith('http') || source.startsWith('data:') || source.startsWith('blob:'))) {
            return source;
        }
        return '';
    });

    useEffect(() => {
        let cancelled = false;

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
                const resolved = await getMediaUrl(source);
                if (!cancelled) {
                    setResolvedSource(resolved || '');
                }
            } catch {
                if (!cancelled) {
                    setResolvedSource('');
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [source]);

    return resolvedSource;
}
