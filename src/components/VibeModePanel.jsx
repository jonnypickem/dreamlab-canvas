import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '../ui/components/Badge';
import { Button } from '../ui/components/Button';
import { TextArea } from '../ui/components/TextArea';
import { getLensResult } from '../lib/storage';
import {
    getLatestVibeRun,
    getStageBQueueStatus,
    prepareVibePlan,
    queueVibeAnalysisRun,
} from '../services/vibePipeline';

function formatTimestamp(timestamp) {
    if (!timestamp) return 'n/a';
    try {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
        return 'n/a';
    }
}

export default function VibeModePanel({
    items = [],
    activeWorkspaceId = null,
    selectedProjectId = null,
}) {
    const [messageInput, setMessageInput] = useState('');
    const [messages, setMessages] = useState([
        {
            id: 'intro',
            role: 'assistant',
            text: 'Vibe mode is live. Tell me what you are trying to feel or build, and I will route lenses + queue deep analysis on anchor images.',
            createdAt: Date.now(),
        },
    ]);
    const [isPlanning, setIsPlanning] = useState(false);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const onStorageUpdate = () => setTick((value) => value + 1);
        window.addEventListener('storage-update', onStorageUpdate);
        return () => window.removeEventListener('storage-update', onStorageUpdate);
    }, []);

    const latestRun = useMemo(() => (
        getLatestVibeRun(activeWorkspaceId, selectedProjectId)
    ), [activeWorkspaceId, selectedProjectId, tick]);

    const stageBQueueStatus = useMemo(() => (
        getStageBQueueStatus()
    ), [tick]);

    const runOutputs = useMemo(() => {
        if (!latestRun?.outputs) return [];
        return latestRun.outputs.map((output) => ({
            ...output,
            payload: output.cacheKey ? getLensResult(output.cacheKey) : null,
        }));
    }, [latestRun, tick]);

    const canRun = Boolean(activeWorkspaceId) && !isPlanning;
    const scopedImageCount = Array.isArray(items) ? items.filter((item) => item.type === 'image').length : 0;

    const handleSend = async () => {
        const focusStatement = messageInput.trim();
        if (!focusStatement || !canRun) return;

        const userMessage = {
            id: `user_${Date.now()}`,
            role: 'user',
            text: focusStatement,
            createdAt: Date.now(),
        };
        setMessages((current) => [...current, userMessage]);
        setMessageInput('');
        setIsPlanning(true);

        try {
            const plan = await prepareVibePlan({
                focusStatement,
                items,
                maxLenses: 4,
                maxAnchors: 5,
            });

            const run = queueVibeAnalysisRun({
                workspaceId: activeWorkspaceId,
                projectId: selectedProjectId,
                focusStatement: plan.focusStatement,
                selectedLenses: plan.selectedLenses,
                anchors: plan.anchors,
            });

            const summary = [
                plan.assistantReply || 'Prepared a vibe run.',
                '',
                `Lenses: ${plan.selectedLenses.map((lens) => lens.id).join(', ') || 'none'}`,
                `Anchors: ${plan.anchors.length}`,
                `Run ID: ${run.id}`,
                `Router: ${plan.routerSource}`,
            ].join('\n');

            setMessages((current) => [
                ...current,
                {
                    id: `assistant_${Date.now()}`,
                    role: 'assistant',
                    text: summary,
                    createdAt: Date.now(),
                },
            ]);
        } catch (error) {
            setMessages((current) => [
                ...current,
                {
                    id: `assistant_error_${Date.now()}`,
                    role: 'assistant',
                    text: `Failed to prepare vibe run: ${error?.message || 'unknown error'}`,
                    createdAt: Date.now(),
                },
            ]);
        } finally {
            setIsPlanning(false);
        }
    };

    return (
        <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex min-h-[560px] flex-col rounded-lg border border-neutral-200 bg-white">
                <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
                    <div className="flex flex-col">
                        <span className="text-body-bold font-body-bold text-default-font">Vibe Chat</span>
                        <span className="text-caption font-caption text-subtext-color">
                            {scopedImageCount} image{scopedImageCount === 1 ? '' : 's'} in current scope
                        </span>
                    </div>
                    <Badge variant={isPlanning ? 'warning' : 'neutral'}>
                        {isPlanning ? 'Planning…' : 'Ready'}
                    </Badge>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-3">
                    <div className="flex flex-col gap-3">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`max-w-[92%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                                    message.role === 'user'
                                        ? 'ml-auto bg-brand-600 text-white'
                                        : 'bg-neutral-100 text-neutral-800'
                                }`}
                            >
                                {message.text}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="border-t border-neutral-100 px-4 py-3">
                    <TextArea className="w-full">
                        <TextArea.Input
                            rows={4}
                            placeholder='Describe the vibe focus. Example: "I want premium editorial energy with restrained typography and tactile packaging cues."'
                            value={messageInput}
                            onChange={(event) => setMessageInput(event.target.value)}
                        />
                    </TextArea>
                    <div className="mt-3 flex items-center justify-end">
                        <Button
                            variant="brand-primary"
                            onClick={handleSend}
                            loading={isPlanning}
                            disabled={!canRun || messageInput.trim().length === 0}
                        >
                            Run Vibe Analysis
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex min-h-[560px] flex-col gap-4">
                <div className="rounded-lg border border-neutral-200 bg-white p-4">
                    <span className="text-body-bold font-body-bold text-default-font">Pipeline Status</span>
                    <div className="mt-2 flex flex-col gap-1 text-sm text-neutral-700">
                        <span>Stage B queue: {stageBQueueStatus.pending} pending</span>
                        <span>Stage B processing: {stageBQueueStatus.isProcessing ? 'yes' : 'no'}</span>
                        <span>Next slot: {formatTimestamp(stageBQueueStatus.nextAllowedAt)}</span>
                    </div>
                </div>

                <div className="rounded-lg border border-neutral-200 bg-white p-4">
                    <span className="text-body-bold font-body-bold text-default-font">Latest Vibe Run</span>
                    {!latestRun ? (
                        <p className="mt-2 text-sm text-subtext-color">No run yet.</p>
                    ) : (
                        <div className="mt-2 flex flex-col gap-2 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={
                                    latestRun.status === 'done'
                                        ? 'success'
                                        : latestRun.status === 'failed'
                                            ? 'error'
                                            : latestRun.status === 'partial'
                                                ? 'warning'
                                                : 'neutral'
                                }>
                                    {latestRun.status}
                                </Badge>
                                <span className="text-subtext-color">{latestRun.id}</span>
                            </div>
                            <p className="text-neutral-800 whitespace-pre-wrap">{latestRun.focusStatement}</p>
                            <div className="flex flex-wrap gap-1">
                                {(latestRun.selectedLensIds || []).map((lensId) => (
                                    <Badge key={lensId} variant="neutral">{lensId}</Badge>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {(latestRun.anchors || []).map((anchor) => (
                                    <div key={anchor.itemId} className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5">
                                        <span className="text-xs text-neutral-600">#{anchor.itemId.slice(0, 6)}</span>
                                        <span className="text-xs text-neutral-600">score {anchor.score}</span>
                                        <span className="text-xs text-neutral-600">rel {anchor.relevance}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="rounded-lg border border-neutral-200 bg-white p-4">
                    <span className="text-body-bold font-body-bold text-default-font">Lens Outputs</span>
                    {runOutputs.length === 0 ? (
                        <p className="mt-2 text-sm text-subtext-color">No outputs yet.</p>
                    ) : (
                        <div className="mt-2 flex flex-col gap-2">
                            {runOutputs.map((output) => (
                                <details key={`${output.lensId}_${output.updatedAt || output.cacheKey}`} className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1.5">
                                    <summary className="cursor-pointer text-sm text-neutral-800">
                                        {output.lensId} · {output.status}
                                    </summary>
                                    <pre className="mt-2 max-h-52 overflow-auto rounded bg-white p-2 text-[11px] leading-relaxed text-neutral-700">
                                        {JSON.stringify(output.payload?.output || output, null, 2)}
                                    </pre>
                                </details>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

