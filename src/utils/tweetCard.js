const TWEET_STATUS_PATTERN = /\/status\/(\d+)/i;
const TWEET_USERNAME_STATUS_PATTERN = /^\/([A-Za-z0-9_]{1,20})\/status\/(\d+)/i;
const TWEET_HOSTS = new Set(['x.com', 'twitter.com', 'fxtwitter.com', 'mobile.twitter.com', 'm.twitter.com']);

function normalizeHost(url) {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return '';
    }
}

function decodeCandidate(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}

function buildCanonicalTweetUrl(pathname, tweetId) {
    const usernameMatch = String(pathname || '').match(TWEET_USERNAME_STATUS_PATTERN);
    if (usernameMatch?.[1] && usernameMatch?.[2]) {
        return `https://x.com/${usernameMatch[1]}/status/${usernameMatch[2]}`;
    }
    return `https://x.com/i/web/status/${tweetId}`;
}

function getTweetInfoFromPath(pathname) {
    const path = String(pathname || '');
    const match = path.match(TWEET_STATUS_PATTERN);
    if (!match?.[1]) return null;
    return {
        tweetId: match[1],
        canonicalUrl: buildCanonicalTweetUrl(path, match[1]),
    };
}

function getTweetInfoFromCandidate(candidate) {
    const value = String(candidate || '').trim();
    if (!value) return null;

    const decoded = decodeCandidate(value);
    const variants = decoded === value ? [value] : [value, decoded];

    for (const variant of variants) {
        if (!variant) continue;

        try {
            const parsed = new URL(variant);
            const info = getTweetInfoFromPath(parsed.pathname);
            if (info) return info;
        } catch {
            // Continue with path-pattern fallback below.
        }

        const pathLikeMatch = variant.match(/\/(?:[A-Za-z0-9_]{1,20}\/status\/\d+|i\/web\/status\/\d+|status\/\d+)/i);
        if (pathLikeMatch) {
            const info = getTweetInfoFromPath(pathLikeMatch[0]);
            if (info) return info;
        }
    }

    return null;
}

function isLikelyUrlOnlyText(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed || /\s/.test(trimmed)) return false;
    if (/^https?:\/\/\S+$/i.test(trimmed)) return true;
    if (/^(www\.)?\S+\.\S+\/\S+$/i.test(trimmed)) return true;
    return false;
}

export function getTweetInfo(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        const parsed = new URL(url);
        const host = normalizeHost(url);
        if (!TWEET_HOSTS.has(host)) return null;

        const fromPath = getTweetInfoFromPath(parsed.pathname);
        if (fromPath) return fromPath;

        const queryCandidates = [
            ...parsed.searchParams.values(),
            parsed.hash ? parsed.hash.slice(1) : '',
        ];

        for (const candidate of queryCandidates) {
            const info = getTweetInfoFromCandidate(candidate);
            if (info) return info;
        }

        return null;
    } catch {
        return null;
    }
}

export function isTweetStatusUrl(url) {
    return Boolean(getTweetInfo(url));
}

export function isLikelyTweetAvatarImage(url) {
    const value = String(url || '').trim().toLowerCase();
    if (!value) return false;

    return (
        value.includes('/profile_images/')
        || value.includes('/profile_banners/')
        || value.includes('default_profile')
        || value.includes('abs.twimg.com')
        || value.includes('twitter_card')
    );
}

export function getTweetDisplayText(item) {
    const sourceUrl = item?.linkEmbed?.url || item?.sourceUrl || item?.content || '';
    const candidates = [
        item?.linkEmbed?.tweetText,
        item?.textExtract?.excerpt,
        item?.textExtract?.content,
    ];

    for (const candidate of candidates) {
        const value = String(candidate || '').trim();
        if (!value) continue;
        if (isTweetStatusUrl(sourceUrl) && isLikelyUrlOnlyText(value)) continue;
        return value;
    }
    return '';
}

export function shouldShowTweetMedia(item, mediaUrl = '') {
    if (!isTweetStatusUrl(item?.linkEmbed?.url || item?.sourceUrl || item?.content)) {
        return Boolean(mediaUrl);
    }
    if (!mediaUrl) return false;
    return !isLikelyTweetAvatarImage(mediaUrl);
}
