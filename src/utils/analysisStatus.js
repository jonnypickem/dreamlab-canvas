export function getImageAnalysisStatus(item, primitiveStore = {}, versionMap = {}) {
    if (!item || item.type !== 'image') {
        return {
            status: 'unanalysed',
            completed: 0,
            total: 0,
            failed: 0,
            ratio: 0,
        };
    }

    const primitiveKeys = Object.keys(versionMap || {});
    const schemaTotal = primitiveKeys.length;
    const itemProgress = item?.analysisProgress || {};
    const itemTotal = Number.isFinite(itemProgress.total) ? Number(itemProgress.total) : 0;
    const itemCompleted = Number.isFinite(itemProgress.completed) ? Number(itemProgress.completed) : 0;
    const itemFailed = Number.isFinite(itemProgress.failed) ? Number(itemProgress.failed) : 0;

    const total = itemTotal > 0 ? itemTotal : schemaTotal;
    if (total === 0) {
        return {
            status: 'unanalysed',
            completed: 0,
            total: 0,
            failed: 0,
            ratio: 0,
        };
    }

    const hash = item.imageHash || null;
    const record = hash ? primitiveStore?.[hash] : null;
    const primitives = record?.primitives || {};

    let completed = 0;
    let failed = 0;

    if (itemTotal > 0) {
        completed = Math.max(0, itemCompleted);
        failed = Math.max(0, itemFailed);
    } else {
        primitiveKeys.forEach((key) => {
            const requiredVersion = versionMap[key];
            const entry = primitives[key];
            if (!entry || entry.version !== requiredVersion) return;
            if (entry.status === 'ready') completed += 1;
            if (entry.status === 'failed') failed += 1;
        });
    }

    const hasInProgressHint = ['queued', 'processing', 'in_progress'].includes(item.analysisStatus);
    const ratio = total > 0 ? completed / total : 0;

    let status = 'unanalysed';
    if (item.analysisStatus === 'done' || completed >= total) {
        status = 'done';
    } else if (hasInProgressHint || completed > 0) {
        status = 'in_progress';
    }

    if (failed > 0 && completed === 0 && !hasInProgressHint) {
        status = 'failed';
    }

    return {
        status,
        completed,
        total,
        failed,
        ratio,
    };
}
