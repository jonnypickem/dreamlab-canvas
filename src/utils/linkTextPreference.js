import { getNormalizedDomain } from './linkDomainPolicy';

const PREFS_KEY = 'dreamlab_link_view_prefs';

function readPrefs() {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writePrefs(next) {
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
        // Ignore storage write failures.
    }
}

export function getLinkViewPreference(url) {
    const domain = getNormalizedDomain(url);
    if (!domain) return null;
    const prefs = readPrefs();
    const value = prefs[domain];
    return value === 'text' || value === 'preview' ? value : null;
}

export function setLinkViewPreference(url, mode) {
    const domain = getNormalizedDomain(url);
    if (!domain) return;
    if (mode !== 'text' && mode !== 'preview') return;
    const prefs = readPrefs();
    writePrefs({ ...prefs, [domain]: mode });
}

