const PIPELINE_DEBUG_KEY = 'dreamlab_pipeline_debug';
const MAX_PIPELINE_EVENTS = 150;

function readEvents() {
    try {
        const raw = localStorage.getItem(PIPELINE_DEBUG_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeEvents(events) {
    try {
        localStorage.setItem(PIPELINE_DEBUG_KEY, JSON.stringify(events));
        window.dispatchEvent(new Event('storage-update'));
    } catch {
        // Debug logging should never break runtime behavior.
    }
}

export function pushPipelineDebugEvent(type, message, meta = {}) {
    const nextEvent = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: String(type || 'info'),
        message: String(message || ''),
        meta: meta && typeof meta === 'object' ? meta : {},
        timestamp: new Date().toISOString(),
    };

    const events = readEvents();
    const nextEvents = [nextEvent, ...events].slice(0, MAX_PIPELINE_EVENTS);
    writeEvents(nextEvents);
    return nextEvent;
}

export function getPipelineDebugEvents(limit = 40) {
    const max = Math.max(1, Number(limit) || 40);
    return readEvents().slice(0, max);
}

export function clearPipelineDebugEvents() {
    writeEvents([]);
}

