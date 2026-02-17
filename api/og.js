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

  try {
    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
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

function parseMetadataFromHtml(html, url) {
  if (!html || typeof html !== 'string') {
    return { title: null, image: null, description: null };
  }

  const getMetaMatch = (property) => {
    const regex = new RegExp(
      `<meta[^>]*property=["'](?:og:|twitter:)?${property}["'][^>]*content=["']([^"']+)["']|<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:og:|twitter:)?${property}["']`,
      'i'
    );
    const match = html.match(regex);
    return match ? match[1] || match[2] : null;
  };

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = getMetaMatch('title') || (titleMatch ? titleMatch[1] : null);
  let image =
    getMetaMatch('image:secure_url') || getMetaMatch('image:url') || getMetaMatch('image');

  if (image && !image.startsWith('http')) {
    try {
      image = new URL(image, url).href;
    } catch {
      image = null;
    }
  }

  return {
    title: title || null,
    image: image || null,
    description: getMetaMatch('description') || null,
  };
}
