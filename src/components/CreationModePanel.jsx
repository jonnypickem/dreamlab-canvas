import React, { useMemo, useState } from 'react';
import { Badge } from '../ui/components/Badge';
import { Button } from '../ui/components/Button';
import { TextArea } from '../ui/components/TextArea';
import { TextField } from '../ui/components/TextField';
import { generateImagesWithGemini } from '../services/geminiImage';
import { getOrCreateGeneratedCollection } from '../lib/storage';
import { saveItemWithTags } from '../utils/saveItemWithTags';

const MODEL_OPTIONS = [
    { id: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image' },
    { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
];

export default function CreationModePanel({
    activeWorkspaceId = null,
    selectedProjectId = null,
    items = [],
    onNotify = null,
}) {
    const [prompt, setPrompt] = useState('');
    const [negativePrompt, setNegativePrompt] = useState('');
    const [model, setModel] = useState(MODEL_OPTIONS[0].id);
    const [count, setCount] = useState(1);
    const [useReferences, setUseReferences] = useState(true);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedImages, setGeneratedImages] = useState([]);
    const [generationNote, setGenerationNote] = useState('');
    const [savingIds, setSavingIds] = useState({});

    const referenceImageUrls = useMemo(() => {
        if (!useReferences) return [];
        return (Array.isArray(items) ? items : [])
            .filter((item) => item.type === 'image')
            .slice(0, 3)
            .map((item) => item.content)
            .filter(Boolean);
    }, [items, useReferences]);

    const notify = (message, type = 'info') => {
        if (typeof onNotify === 'function') {
            onNotify({ message, type });
        }
    };

    const handleGenerate = async () => {
        const basePrompt = prompt.trim();
        if (!basePrompt) return;
        if (!activeWorkspaceId) {
            notify('Select a workspace before generating.', 'error');
            return;
        }

        setIsGenerating(true);
        setGenerationNote('');
        try {
            const result = await generateImagesWithGemini({
                prompt: basePrompt,
                negativePrompt: negativePrompt.trim(),
                referenceImageUrls,
                count: Number(count) || 1,
                model,
            });

            setGeneratedImages(result.images || []);
            setGenerationNote(result.text || '');
            notify(`Generated ${result.images?.length || 0} image(s) with ${result.model}.`, 'success');
        } catch (error) {
            notify(error?.message || 'Generation failed.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const saveGeneratedImage = async (image) => {
        if (!image?.dataUrl || !activeWorkspaceId) return;
        setSavingIds((current) => ({ ...current, [image.id]: true }));

        try {
            const generatedCollection = selectedProjectId
                ? getOrCreateGeneratedCollection(selectedProjectId)
                : null;

            const itemPayload = {
                type: 'image',
                content: image.dataUrl,
                sourceUrl: `gemini://${model}/${image.id}`,
                workspaceId: activeWorkspaceId,
                projectId: selectedProjectId || null,
                collectionId: generatedCollection?.id || null,
                title: `Generated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                tags: ['generated', 'creation-mode'],
                createdAt: Date.now(),
            };

            await saveItemWithTags(itemPayload, selectedProjectId);
            notify('Generated image saved.', 'success');
        } catch (error) {
            notify(error?.message || 'Failed to save generated image.', 'error');
        } finally {
            setSavingIds((current) => ({ ...current, [image.id]: false }));
        }
    };

    const saveAllGenerated = async () => {
        for (const image of generatedImages) {
            // eslint-disable-next-line no-await-in-loop
            await saveGeneratedImage(image);
        }
    };

    return (
        <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between">
                    <span className="text-body-bold font-body-bold text-default-font">Creation Mode</span>
                    <Badge variant="brand">Experimental</Badge>
                </div>

                <div className="mt-4 flex flex-col gap-3">
                    <div>
                        <span className="text-caption font-caption text-subtext-color">Prompt</span>
                        <TextArea className="mt-1 w-full">
                            <TextArea.Input
                                rows={5}
                                placeholder="Describe what to generate..."
                                value={prompt}
                                onChange={(event) => setPrompt(event.target.value)}
                            />
                        </TextArea>
                    </div>

                    <div>
                        <span className="text-caption font-caption text-subtext-color">Negative Prompt</span>
                        <TextField className="mt-1">
                            <TextField.Input
                                placeholder="Avoid artifacts, avoid text overlays..."
                                value={negativePrompt}
                                onChange={(event) => setNegativePrompt(event.target.value)}
                            />
                        </TextField>
                    </div>

                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <label className="flex flex-col gap-1 text-caption text-subtext-color">
                            Model
                            <select
                                value={model}
                                onChange={(event) => setModel(event.target.value)}
                                className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm text-default-font"
                            >
                                {MODEL_OPTIONS.map((option) => (
                                    <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-1 text-caption text-subtext-color">
                            Count
                            <select
                                value={count}
                                onChange={(event) => setCount(Number(event.target.value))}
                                className="h-9 rounded-md border border-neutral-200 bg-white px-2 text-sm text-default-font"
                            >
                                {[1, 2, 3, 4].map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                        <input
                            type="checkbox"
                            checked={useReferences}
                            onChange={(event) => setUseReferences(event.target.checked)}
                        />
                        Use up to 3 visible images as reference context
                    </label>

                    <Button
                        variant="brand-primary"
                        onClick={handleGenerate}
                        loading={isGenerating}
                        disabled={prompt.trim().length === 0 || !activeWorkspaceId}
                    >
                        Generate
                    </Button>
                </div>
            </div>

            <div className="rounded-lg border border-neutral-200 bg-white p-4">
                <div className="flex items-center justify-between">
                    <span className="text-body-bold font-body-bold text-default-font">Generated Results</span>
                    {generatedImages.length > 0 ? (
                        <Button variant="neutral-secondary" size="small" onClick={saveAllGenerated}>
                            Save All
                        </Button>
                    ) : null}
                </div>

                {generationNote ? (
                    <p className="mt-2 rounded-md bg-neutral-50 px-2 py-1 text-xs text-neutral-600 whitespace-pre-wrap">
                        {generationNote}
                    </p>
                ) : null}

                {generatedImages.length === 0 ? (
                    <p className="mt-4 text-sm text-subtext-color">No generated images yet.</p>
                ) : (
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {generatedImages.map((image) => (
                            <div key={image.id} className="overflow-hidden rounded-md border border-neutral-200 bg-neutral-50">
                                <img
                                    src={image.dataUrl}
                                    alt="Generated"
                                    className="h-44 w-full object-cover"
                                />
                                <div className="flex items-center justify-between px-2 py-2">
                                    <span className="text-xs text-neutral-600">{image.mimeType}</span>
                                    <Button
                                        size="small"
                                        variant="neutral-secondary"
                                        onClick={() => saveGeneratedImage(image)}
                                        loading={Boolean(savingIds[image.id])}
                                    >
                                        Save
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

