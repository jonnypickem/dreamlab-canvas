import React, { useState } from 'react';
import { hasLegacyData, migrateToSupabase, clearLegacyData } from '../utils/migrateToSupabase';

export default function MigrationBanner({ onComplete }) {
    const [state, setState] = useState('idle'); // idle | migrating | done | partial | error
    const [progress, setProgress] = useState(null);
    const [result, setResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');

    if (!hasLegacyData()) return null;
    if (state === 'done') return null;

    const handleMigrate = async () => {
        setState('migrating');
        try {
            const res = await migrateToSupabase({
                onProgress: (p) => setProgress(p),
            });
            console.log('[Migration] Result:', res);
            setResult(res);
            if (res.errors.length === 0) {
                clearLegacyData();
                setState('done');
            } else {
                // Show errors so user can see what went wrong
                setErrorMsg(
                    `Migrated ${res.items} items, ${res.workspaces} workspaces. ` +
                    `${res.errors.length} error(s):\n${res.errors.slice(0, 5).join('\n')}`
                );
                setState('partial');
            }
            if (onComplete) onComplete(res);
        } catch (err) {
            console.error('[Migration] Fatal error:', err);
            setErrorMsg(err.message || 'Migration failed');
            setState('error');
        }
    };

    const handleForceComplete = () => {
        // User acknowledges errors and wants to clear legacy data anyway
        clearLegacyData();
        setState('done');
    };

    const handleDismiss = () => {
        setState('done');
    };

    return (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-full max-w-lg">
            <div className="bg-white border border-neutral-200 rounded-xl shadow-lg p-4">
                {state === 'idle' && (
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-bold text-sm">
                            !
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-neutral-900">Existing data found</p>
                            <p className="text-xs text-neutral-500 mt-0.5">
                                Migrate your local browser data to your Supabase account for cloud storage and sync.
                            </p>
                            <div className="flex items-center gap-2 mt-3">
                                <button
                                    onClick={handleMigrate}
                                    className="px-4 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
                                >
                                    Migrate Now
                                </button>
                                <button
                                    onClick={handleDismiss}
                                    className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
                                >
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {state === 'migrating' && (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-neutral-900">Migrating data...</p>
                        {progress && (
                            <p className="text-xs text-neutral-500">
                                {progress.message || `${progress.phase}: ${progress.current}/${progress.total}`}
                            </p>
                        )}
                        <div className="w-full h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-brand-600 rounded-full transition-all"
                                style={{
                                    width: progress?.total > 0
                                        ? `${Math.round((progress.current / progress.total) * 100)}%`
                                        : '10%'
                                }}
                            />
                        </div>
                    </div>
                )}

                {state === 'partial' && (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-amber-700">Migration completed with errors</p>
                        <p className="text-xs text-amber-600 whitespace-pre-line max-h-32 overflow-y-auto">{errorMsg}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <button
                                onClick={handleForceComplete}
                                className="px-4 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
                            >
                                Clear Local Data Anyway
                            </button>
                            <button
                                onClick={handleMigrate}
                                className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
                            >
                                Retry
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}

                {state === 'error' && (
                    <div className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-red-700">Migration failed</p>
                        <p className="text-xs text-red-600">{errorMsg}</p>
                        <div className="flex items-center gap-2 mt-1">
                            <button
                                onClick={handleMigrate}
                                className="px-4 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-lg hover:bg-neutral-800 transition-colors"
                            >
                                Retry
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-700 transition-colors"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
