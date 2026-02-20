export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Invalid protocol' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  // For tweet URLs, fetch from fxtwitter.com to get actual media OG tags
  const fetchUrl = rewriteTweetUrl(url);
  const isFxTwitter = fetchUrl !== url;

  try {
    const response = await fetch(fetchUrl, {
      headers: {
        // fxtwitter requires a bot-like UA to return OG tags (redirects to x.com with browser UA)
        'User-Agent': isFxTwitter
          ? 'Dreamlab/1.0 (compatible; bot)'
          : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: isFxTwitter ? 'manual' : 'follow',
      signal: AbortSignal.timeout(8000),
    });

    // fxtwitter returns 200 with OG tags in body, but check for non-ok non-redirect
    if (!response.ok && !(isFxTwitter && response.status >= 300 && response.status < 400)) {
      return res.status(200).json({ title: null, image: null, description: null });
    }

    const html = await response.text();
    const metadata = parseMetadataFromHtml(html, fetchUrl);

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(metadata);
  } catch {
    return res.status(200).json({ title: null, image: null, description: null });
  }
}

function rewriteTweetUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if ((host === 'x.com' || host === 'twitter.com') && /\/status\/\d+/i.test(parsed.pathname)) {
      parsed.hostname = 'fxtwitter.com';
      return parsed.href;
    }
  } catch {}
  return url;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getMetaMatches(html, key) {
  if (!key) return [];
  const regex = new RegExp(
    `<meta[^>]*\\b(?:property|name|itemprop)=["']${escapeRegex(key)}["'][^>]*\\bcontent=["']([^"']+)["'][^>]*>|<meta[^>]*\\bcontent=["']([^"']+)["'][^>]*\\b(?:property|name|itemprop)=["']${escapeRegex(key)}["'][^>]*>`,
    'gi'
  );
  const results = [];
  let match;
  while ((match = regex.exec(html)) !== null) {
    const value = String(match[1] || match[2] || '').trim();
    if (value) results.push(value);
  }
  return results;
}

function getFirstMetaMatch(html, keys = []) {
  for (const key of keys) {
    const values = getMetaMatches(html, key);
    if (values.length > 0) return values[0];
  }
  return null;
}

function isTweetStatusUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'x.com' && host !== 'twitter.com' && host !== 'fxtwitter.com') return false;
    return /\/status\/\d+/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function isLikelyTweetAvatarImage(url) {
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

function toAbsoluteUrl(candidate, baseUrl) {
  const value = String(candidate || '').trim();
  if (!value) return null;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}

function scoreMetadataImageCandidate(url, { isTweetLink = false } = {}) {
  const value = String(url || '').toLowerCase();
  if (!value) return -1;

  let score = 0;
  if (value.startsWith('https://')) score += 20;
  if (value.includes('pbs.twimg.com/media')) score += 3600;
  if (value.includes('ext_tw_video_thumb')) score += 3200;
  if (value.includes('amplify_video_thumb')) score += 3000;
  if (value.includes('tweet_video_thumb')) score += 2800;
  if (value.includes('/card_img/')) score += 1500;
  if (value.includes('twimg.com')) score += 800;

  if (isLikelyTweetAvatarImage(value)) score -= 5000;
  if (isTweetLink && value.includes('x.com')) score -= 800;
  return score;
}

function parseMetadataFromHtml(html, url) {
  if (!html || typeof html !== 'string') {
    return { title: null, image: null, description: null };
  }

  const isTweetLink = isTweetStatusUrl(url);
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = getFirstMetaMatch(html, ['og:title', 'twitter:title', 'title']) || (titleMatch ? titleMatch[1] : null);
  const description = getFirstMetaMatch(html, ['og:description', 'twitter:description', 'description']);

  const imageCandidates = [
    ...getMetaMatches(html, 'og:image:secure_url'),
    ...getMetaMatches(html, 'og:image:url'),
    ...getMetaMatches(html, 'og:image'),
    ...getMetaMatches(html, 'twitter:image:src'),
    ...getMetaMatches(html, 'twitter:image'),
    ...getMetaMatches(html, 'image'),
  ]
    .map((candidate) => toAbsoluteUrl(candidate, url))
    .filter(Boolean);
  const uniqueCandidates = Array.from(new Set(imageCandidates));
  uniqueCandidates.sort((left, right) => (
    scoreMetadataImageCandidate(right, { isTweetLink }) - scoreMetadataImageCandidate(left, { isTweetLink })
  ));
  const bestImage = uniqueCandidates[0] || null;
  const image = isLikelyTweetAvatarImage(bestImage) ? null : bestImage;

  return {
    title: title || null,
    image: image || null,
    description: description || null,
  };
}
