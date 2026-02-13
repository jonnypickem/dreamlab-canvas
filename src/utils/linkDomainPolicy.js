const TEXT_FIRST_DOMAINS = new Set([
    'medium.com',
    'substack.com',
    'dev.to',
    'hashnode.com',
    'linkedin.com',
    'notion.site',
]);

const PREVIEW_FIRST_DOMAINS = new Set([
    'x.com',
    'twitter.com',
    'reddit.com',
]);

export function getNormalizedDomain(url) {
    if (!url) return '';
    try {
        const hostname = new URL(url).hostname.toLowerCase();
        return hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

function domainMatches(hostname, domain) {
    return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function getDomainDefaultLinkMode(url) {
    const hostname = getNormalizedDomain(url);
    if (!hostname) return 'preview';

    for (const domain of PREVIEW_FIRST_DOMAINS) {
        if (domainMatches(hostname, domain)) return 'preview';
    }
    for (const domain of TEXT_FIRST_DOMAINS) {
        if (domainMatches(hostname, domain)) return 'text';
    }
    return 'preview';
}

export function isTextFirstDomain(url) {
    return getDomainDefaultLinkMode(url) === 'text';
}

