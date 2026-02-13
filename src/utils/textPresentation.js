const FALLBACK_HERO_TEXT = 'Untitled text';
const MAX_HERO_CHARS = 120;

function normalizeText(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function splitPrimarySentence(value) {
    const normalized = normalizeText(value);
    if (!normalized) return { hero: '', rest: '' };

    const sentenceMatch = normalized.match(/^(.+?[.!?])(\s+|$)/);
    const sentence = sentenceMatch?.[1] || '';

    if (sentence && sentence.length <= MAX_HERO_CHARS) {
        const rest = normalizeText(normalized.slice(sentence.length));
        return { hero: sentence.trim(), rest };
    }

    const shortened = normalized.slice(0, MAX_HERO_CHARS).trim();
    const safeShort = shortened.length < normalized.length ? `${shortened}...` : shortened;
    const rest = normalizeText(normalized.slice(shortened.length));
    return { hero: safeShort, rest };
}

export function getHeroTextForItem(item) {
    const title = normalizeText(item?.title);
    if (title) return title;

    const { hero } = splitPrimarySentence(item?.content);
    if (hero) return hero;

    return FALLBACK_HERO_TEXT;
}

export function getSupportingTextForItem(item) {
    const title = normalizeText(item?.title);
    const content = normalizeText(item?.content);
    if (!content) return '';

    if (title) {
        if (title === content) return '';
        return content;
    }

    const { rest } = splitPrimarySentence(content);
    return rest;
}
