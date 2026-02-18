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

export const ENTITY_ICON_NONE_KEY = 'none';
export const ENTITY_COLOR_NONE_KEY = 'none';

export const ENTITY_ICON_OPTIONS = [
    { key: ENTITY_ICON_NONE_KEY, label: 'No icon', Icon: null },
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
    { key: ENTITY_COLOR_NONE_KEY, label: 'No color', iconClass: '', bgClass: '', borderClass: '', swatchClass: '' },
    { key: 'slate', label: 'Slate', iconClass: 'text-slate-600', bgClass: 'bg-slate-100', borderClass: 'border-slate-200', swatchClass: 'bg-slate-500' },
    { key: 'indigo', label: 'Indigo', iconClass: 'text-indigo-600', bgClass: 'bg-indigo-100', borderClass: 'border-indigo-200', swatchClass: 'bg-indigo-500' },
    { key: 'violet', label: 'Violet', iconClass: 'text-violet-600', bgClass: 'bg-violet-100', borderClass: 'border-violet-200', swatchClass: 'bg-violet-500' },
    { key: 'sky', label: 'Sky', iconClass: 'text-sky-600', bgClass: 'bg-sky-100', borderClass: 'border-sky-200', swatchClass: 'bg-sky-500' },
    { key: 'emerald', label: 'Emerald', iconClass: 'text-emerald-600', bgClass: 'bg-emerald-100', borderClass: 'border-emerald-200', swatchClass: 'bg-emerald-500' },
    { key: 'teal', label: 'Teal', iconClass: 'text-teal-600', bgClass: 'bg-teal-100', borderClass: 'border-teal-200', swatchClass: 'bg-teal-500' },
    { key: 'amber', label: 'Amber', iconClass: 'text-amber-600', bgClass: 'bg-amber-100', borderClass: 'border-amber-200', swatchClass: 'bg-amber-500' },
    { key: 'orange', label: 'Orange', iconClass: 'text-orange-600', bgClass: 'bg-orange-100', borderClass: 'border-orange-200', swatchClass: 'bg-orange-500' },
    { key: 'rose', label: 'Rose', iconClass: 'text-rose-600', bgClass: 'bg-rose-100', borderClass: 'border-rose-200', swatchClass: 'bg-rose-500' },
    { key: 'fuchsia', label: 'Fuchsia', iconClass: 'text-fuchsia-600', bgClass: 'bg-fuchsia-100', borderClass: 'border-fuchsia-200', swatchClass: 'bg-fuchsia-500' },
];

const ENTITY_ICON_OPTIONS_WITH_MARKER = ENTITY_ICON_OPTIONS.filter((option) => option.key !== ENTITY_ICON_NONE_KEY);
const ENTITY_COLOR_OPTIONS_WITH_MARKER = ENTITY_COLOR_OPTIONS.filter((option) => option.key !== ENTITY_COLOR_NONE_KEY);

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
    if (iconKey === ENTITY_ICON_NONE_KEY) return ENTITY_ICON_NONE_KEY;
    const explicit = getIconOption(iconKey);
    if (explicit) return explicit.key;

    if (entityType === 'project') {
        return 'folder';
    }

    const fallbackIndex = hashString(entityId) % ENTITY_ICON_OPTIONS_WITH_MARKER.length;
    return ENTITY_ICON_OPTIONS_WITH_MARKER[fallbackIndex].key;
}

export function resolveEntityColorKey(colorKey, entityId = '') {
    if (colorKey === ENTITY_COLOR_NONE_KEY) return ENTITY_COLOR_NONE_KEY;
    const explicit = getColorOption(colorKey);
    if (explicit) return explicit.key;

    const fallbackIndex = hashString(entityId) % ENTITY_COLOR_OPTIONS_WITH_MARKER.length;
    return ENTITY_COLOR_OPTIONS_WITH_MARKER[fallbackIndex].key;
}

export function getEntityIconComponent(iconKey, entityId = '', entityType = 'collection') {
    const resolvedKey = resolveEntityIconKey(iconKey, entityId, entityType);
    if (resolvedKey === ENTITY_ICON_NONE_KEY) return null;
    const option = getIconOption(resolvedKey) || ENTITY_ICON_OPTIONS[0];
    if (!option?.Icon) return null;
    return option.Icon;
}

export function getEntityColorToken(colorKey, entityId = '') {
    const resolvedKey = resolveEntityColorKey(colorKey, entityId);
    if (resolvedKey === ENTITY_COLOR_NONE_KEY) return null;
    return getColorOption(resolvedKey) || ENTITY_COLOR_OPTIONS[0];
}
