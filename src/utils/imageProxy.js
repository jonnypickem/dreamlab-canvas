/**
 * Utility to create a proxy URL for fetching external images
 * This bypasses CORS restrictions by routing through our backend
 */
import { getMediaBlob, isMediaStoreRef } from '../lib/mediaStore';
import { getMediaUrl, isSupabaseStoragePath } from '../lib/supabaseStorage';

const PROXY_ENDPOINT = '/api/proxy';

/**
 * Check if a URL is external (not a data URL or local)
 */
export function isExternalUrl(url) {
    if (!url) return false;
    if (url.startsWith('data:')) return false;
    if (url.startsWith('/')) return false;
    if (url.startsWith('blob:')) return false;
    if (isMediaStoreRef(url)) return false;
    if (isSupabaseStoragePath(url)) return false;
    return url.startsWith('http://') || url.startsWith('https://');
}

/**
 * Get the proxy URL for an external image
 * @param {string} url - The external URL to proxy
 * @returns {string} - The proxied URL
 */
export function getProxyUrl(url) {
    if (!isExternalUrl(url)) {
        return url; // Return as-is for data URLs and local paths
    }
    return `${PROXY_ENDPOINT}?url=${encodeURIComponent(url)}`;
}

/**
 * Fetch an image through the proxy, falling back to direct fetch for local/data URLs
 * @param {string} url - The URL to fetch
 * @returns {Promise<Blob>} - The image blob
 */
export async function fetchImageViaProxy(url) {
    if (isMediaStoreRef(url)) {
        const blob = await getMediaBlob(url);
        if (!blob) throw new Error('Stored image blob not found');
        return blob;
    }

    // Resolve Supabase storage paths to signed URLs
    if (isSupabaseStoragePath(url)) {
        const signedUrl = await getMediaUrl(url);
        if (!signedUrl) throw new Error('Could not resolve storage path');
        const response = await fetch(signedUrl);
        if (!response.ok) throw new Error(`Failed to fetch from storage: ${response.status}`);
        return response.blob();
    }

    const fetchUrl = isExternalUrl(url) ? getProxyUrl(url) : url;

    const response = await fetch(fetchUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    return response.blob();
}

/**
 * Convert an image URL to base64 data
 * @param {string} url - Image URL (can be external URL, data URL, or blob URL)
 * @returns {Promise<string>} - Base64 encoded image data with data: prefix
 */
export async function imageToBase64(url) {
    // If already base64, return as-is
    if (url && url.startsWith('data:')) {
        return url;
    }

    try {
        const blob = await fetchImageViaProxy(url);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error('Failed to convert image to base64:', error);
        throw error;
    }
}
