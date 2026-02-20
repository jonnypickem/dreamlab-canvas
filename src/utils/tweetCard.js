const TWEET_STATUS_PATTERN = /\/status\/(\d+)/i;

function normalizeHost(url) {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return '';
    }
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
        if (host !== 'x.com' && host !== 'twitter.com' && host !== 'fxtwitter.com') return null;

        const match = parsed.pathname.match(TWEET_STATUS_PATTERN);
        if (!match?.[1]) return null;

        return {
            tweetId: match[1],
            canonicalUrl: `https://x.com${parsed.pathname}`,
        };
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
