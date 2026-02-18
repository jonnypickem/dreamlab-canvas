import {
    Folder,
    Layers3,
    Briefcase,
    Palette,
    Tag,
    Image as ImageIcon,
    Link2,
    FileText,
    Bookmark,
    Star,
    Rocket,
    Compass
} from 'lucide-react';

export const ENTITY_ICON_OPTIONS = [
    { key: 'folder', label: 'Folder', Icon: Folder },
    { key: 'layers', label: 'Layers', Icon: Layers3 },
    { key: 'briefcase', label: 'Briefcase', Icon: Briefcase },
    { key: 'palette', label: 'Palette', Icon: Palette },
    { key: 'tag', label: 'Tag', Icon: Tag },
    { key: 'image', label: 'Image', Icon: ImageIcon },
    { key: 'link', label: 'Link', Icon: Link2 },
    { key: 'file', label: 'File', Icon: FileText },
    { key: 'bookmark', label: 'Bookmark', Icon: Bookmark },
    { key: 'star', label: 'Star', Icon: Star },
    { key: 'rocket', label: 'Rocket', Icon: Rocket },
    { key: 'compass', label: 'Compass', Icon: Compass },
];

export const ENTITY_COLOR_OPTIONS = [
    { key: 'slate', label: 'Slate', iconClass: 'text-slate-600', bgClass: 'bg-slate-100', borderClass: 'border-slate-200' },
    { key: 'indigo', label: 'Indigo', iconClass: 'text-indigo-600', bgClass: 'bg-indigo-100', borderClass: 'border-indigo-200' },
    { key: 'violet', label: 'Violet', iconClass: 'text-violet-600', bgClass: 'bg-violet-100', borderClass: 'border-violet-200' },
    { key: 'sky', label: 'Sky', iconClass: 'text-sky-600', bgClass: 'bg-sky-100', borderClass: 'border-sky-200' },
    { key: 'emerald', label: 'Emerald', iconClass: 'text-emerald-600', bgClass: 'bg-emerald-100', borderClass: 'border-emerald-200' },
    { key: 'teal', label: 'Teal', iconClass: 'text-teal-600', bgClass: 'bg-teal-100', borderClass: 'border-teal-200' },
    { key: 'amber', label: 'Amber', iconClass: 'text-amber-600', bgClass: 'bg-amber-100', borderClass: 'border-amber-200' },
    { key: 'orange', label: 'Orange', iconClass: 'text-orange-600', bgClass: 'bg-orange-100', borderClass: 'border-orange-200' },
    { key: 'rose', label: 'Rose', iconClass: 'text-rose-600', bgClass: 'bg-rose-100', borderClass: 'border-rose-200' },
    { key: 'fuchsia', label: 'Fuchsia', iconClass: 'text-fuchsia-600', bgClass: 'bg-fuchsia-100', borderClass: 'border-fuchsia-200' },
];

function hashString(input) {
    const text = String(input || '');
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

function getIconOption(iconKey) {
    return ENTITY_ICON_OPTIONS.find((option) => option.key === iconKey) || null;
}

function getColorOption(colorKey) {
    return ENTITY_COLOR_OPTIONS.find((option) => option.key === colorKey) || null;
}

export function resolveEntityIconKey(iconKey, entityId = '', entityType = 'collection') {
    const explicit = getIconOption(iconKey);
    if (explicit) return explicit.key;

    if (entityType === 'project') {
        return 'folder';
    }

    const fallbackIndex = hashString(entityId) % ENTITY_ICON_OPTIONS.length;
    return ENTITY_ICON_OPTIONS[fallbackIndex].key;
}

export function resolveEntityColorKey(colorKey, entityId = '') {
    const explicit = getColorOption(colorKey);
    if (explicit) return explicit.key;

    const fallbackIndex = hashString(entityId) % ENTITY_COLOR_OPTIONS.length;
    return ENTITY_COLOR_OPTIONS[fallbackIndex].key;
}

export function getEntityIconComponent(iconKey, entityId = '', entityType = 'collection') {
    const resolvedKey = resolveEntityIconKey(iconKey, entityId, entityType);
    const option = getIconOption(resolvedKey) || ENTITY_ICON_OPTIONS[0];
    return option.Icon;
}

export function getEntityColorToken(colorKey, entityId = '') {
    const resolvedKey = resolveEntityColorKey(colorKey, entityId);
    return getColorOption(resolvedKey) || ENTITY_COLOR_OPTIONS[0];
}

