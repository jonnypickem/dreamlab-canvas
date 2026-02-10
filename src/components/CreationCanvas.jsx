import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { Download, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '../ui/components/Button';
import { generateImagesWithGemini } from '../services/geminiImage';
import { getVibeRuns } from '../services/vibePipeline';
import { getOrCreateGeneratedCollection } from '../lib/storage';
import { saveItemWithTags } from '../utils/saveItemWithTags';

const FLOW_KEY_PREFIX = 'dreamlab_creation_flow_';
const BOARD_WIDTH = 2200;
const BOARD_HEIGHT = 1400;
const PORT_TOP_OFFSET = 84;
const PORT_SPACING = 30;

const INTENT_OPTIONS = [
    { id: 'brand_style', label: 'Brand Style' },
    { id: 'product_design', label: 'Product Design' },
    { id: 'packaging', label: 'Packaging' },
    { id: 'illustration', label: 'Illustration' },
    { id: 'advertising', label: 'Advertising' },
    { id: 'ui_layout', label: 'UI Layout' },
];

const PLATFORM_OPTIONS = [
    'Universal',
    'Midjourney',
    'DALL-E',
    'Stable Diffusion',
    'Flux',
];

const MODEL_OPTIONS = [
    'gemini-3-pro-image-preview',
    'gemini-2.5-flash-image',
];

const NODE_LIBRARY = [
    { type: 'prompt_input', label: 'Prompt Input' },
    { type: 'vibe', label: 'Vibe' },
    { type: 'collection_image', label: 'Collection Image' },
    { type: 'image_generation', label: 'Image Generation' },
    { type: 'generation_result', label: 'Generation Result' },
];

const NODE_TEMPLATES = {
    prompt_input: {
        title: 'Prompt Input',
        defaultSize: { w: 360, h: 220 },
        defaultPosition: { x: 320, y: 130 },
        inputs: [],
        outputs: [{ id: 'subject_out', label: 'Subject', dataType: 'text' }],
        makeDefaultData: () => ({
            subjectPrompt: '',
        }),
    },
    vibe: {
        title: 'Vibe',
        defaultSize: { w: 360, h: 220 },
        defaultPosition: { x: 320, y: 410 },
        inputs: [],
        outputs: [{ id: 'vibe_out', label: 'Vibe Out', dataType: 'vibe' }],
        makeDefaultData: ({ vibeRuns }) => {
            const latestRun = Array.isArray(vibeRuns) ? vibeRuns[0] : null;
            return {
                selectedRunId: latestRun?.id || '',
                vibeText: latestRun ? formatVibeRun(latestRun) : '',
            };
        },
    },
    collection_image: {
        title: 'Collection Image',
        defaultSize: { w: 360, h: 240 },
        defaultPosition: { x: 340, y: 700 },
        inputs: [],
        outputs: [{ id: 'image_out', label: 'Image Out', dataType: 'image' }],
        makeDefaultData: ({ imageItems }) => ({
            selectedItemId: imageItems?.[0]?.id || '',
        }),
    },
    image_generation: {
        title: 'Image Generation',
        defaultSize: { w: 500, h: 430 },
        defaultPosition: { x: 900, y: 220 },
        inputs: [
            { id: 'prompt_in', label: 'Prompt', dataType: 'text' },
            { id: 'vibe_in', label: 'Vibe', dataType: 'vibe' },
            { id: 'refs_in', label: 'Refs', dataType: 'image' },
        ],
        outputs: [
            { id: 'prompt_out', label: 'Prompt Out', dataType: 'text' },
            { id: 'images_out', label: 'Images Out', dataType: 'image' },
        ],
        makeDefaultData: () => ({
            intent: 'brand_style',
            platform: 'Universal',
            model: MODEL_OPTIONS[0],
            manualPrompt: '',
            negativePrompt: '',
            generatedPrompt: '',
            generatedImages: [],
            status: 'idle',
            statusMessage: '',
            error: '',
            modelUsed: '',
            lastRunAt: null,
        }),
    },
    generation_result: {
        title: 'Generation Result',
        defaultSize: { w: 340, h: 360 },
        defaultPosition: { x: 1500, y: 240 },
        inputs: [
            { id: 'prompt_in', label: 'Prompt In', dataType: 'text' },
            { id: 'images_in', label: 'Images In', dataType: 'image' },
        ],
        outputs: [],
        makeDefaultData: () => ({
            prompt: '',
            images: [],
            sourceModel: '',
            saveStatus: 'idle',
            saveMessage: '',
        }),
    },
};

function formatVibeRun(run) {
    if (!run) return '';
    const focus = String(run.focusStatement || '').trim();
    const lenses = Array.isArray(run.selectedLensIds) ? run.selectedLensIds.filter(Boolean) : [];
    const status = run.status || 'unknown';
    const lensText = lenses.length > 0 ? lenses.slice(0, 4).join(', ') : 'none';
    return `Focus: ${focus || 'N/A'}.\nLenses: ${lensText}.\nStatus: ${status}.`;
}

function isQuotaExceededError(error) {
    return error?.name === 'QuotaExceededError'
        || error?.code === 22
        || /quota/i.test(error?.message || '');
}

function randomId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getTemplate(type) {
    return NODE_TEMPLATES[type] || null;
}

function makeNode(type, context = {}, position = null) {
    const template = getTemplate(type);
    if (!template) return null;
    return {
        id: randomId(type),
        type,
        x: position?.x ?? template.defaultPosition.x,
        y: position?.y ?? template.defaultPosition.y,
        w: template.defaultSize.w,
        h: template.defaultSize.h,
        data: template.makeDefaultData(context),
    };
}

function makeEdge(fromNodeId, fromPortId, toNodeId, toPortId) {
    return {
        id: randomId('edge'),
        fromNodeId,
        fromPortId,
        toNodeId,
        toPortId,
    };
}

function sanitizeNodeForStorage(node) {
    const base = {
        id: node.id,
        type: node.type,
        x: Number(node.x || 0),
        y: Number(node.y || 0),
        w: Number(node.w || getTemplate(node.type)?.defaultSize?.w || 320),
        h: Number(node.h || getTemplate(node.type)?.defaultSize?.h || 220),
        data: { ...(node.data || {}) },
    };

    if (base.type === 'image_generation') {
        base.data.generatedImages = Array.isArray(base.data.generatedImages)
            ? base.data.generatedImages.map((image) => ({
                id: image?.id || randomId('img'),
                mimeType: image?.mimeType || 'image/png',
            }))
            : [];
    }
    if (base.type === 'generation_result') {
        base.data.images = Array.isArray(base.data.images)
            ? base.data.images.map((image) => ({
                id: image?.id || randomId('img'),
                mimeType: image?.mimeType || 'image/png',
            }))
            : [];
    }
    return base;
}

function getPortIndex(template, direction, portId) {
    const ports = direction === 'in' ? template.inputs : template.outputs;
    return ports.findIndex((port) => port.id === portId);
}

function getPortY(index) {
    const safe = index < 0 ? 0 : index;
    return PORT_TOP_OFFSET + (safe * PORT_SPACING);
}

function getPortAnchor(node, direction, portId) {
    const template = getTemplate(node.type);
    if (!template) return null;
    const index = getPortIndex(template, direction, portId);
    const y = Number(node.y || 0) + getPortY(index);
    if (direction === 'out') {
        return { x: Number(node.x || 0) + Number(node.w || template.defaultSize.w), y };
    }
    return { x: Number(node.x || 0), y };
}

function getPortMeta(nodeType, direction, portId) {
    const template = getTemplate(nodeType);
    if (!template) return null;
    const ports = direction === 'in' ? template.inputs : template.outputs;
    return ports.find((port) => port.id === portId) || null;
}

function toPath(start, end) {
    const delta = Math.max(80, Math.abs(end.x - start.x) * 0.45);
    const c1x = start.x + delta;
    const c2x = end.x - delta;
    return `M ${start.x} ${start.y} C ${c1x} ${start.y}, ${c2x} ${end.y}, ${end.x} ${end.y}`;
}

function hasCompatibleTypes(outType, inType) {
    return outType === inType;
}

function resolveSelectedCollectionImage(node, imageItems) {
    if (!node || node.type !== 'collection_image') return null;
    const selectedId = node?.data?.selectedItemId;
    const selected = imageItems.find((item) => item.id === selectedId);
    return selected || imageItems[0] || null;
}

export default function CreationCanvas({
    projectId = null,
    collectionId = null,
    activeWorkspaceId = null,
    projectItems = [],
    runSignal = 0,
    onRunMessage = null,
}) {
    const [storageTick, setStorageTick] = useState(0);
    const imageItems = useMemo(
        () => (Array.isArray(projectItems) ? projectItems.filter((item) => item.type === 'image') : []),
        [projectItems]
    );
    const vibeRuns = useMemo(
        () => getVibeRuns(activeWorkspaceId || null, projectId || null),
        [activeWorkspaceId, projectId, storageTick]
    );

    const notify = useCallback((message, type = 'info') => {
        if (typeof onRunMessage === 'function') {
            onRunMessage({ message, type });
        }
    }, [onRunMessage]);

    const buildDefaultFlow = useCallback(() => {
        const context = { imageItems, vibeRuns };
        const promptNode = makeNode('prompt_input', context);
        const vibeNode = makeNode('vibe', context);
        const collectionNode = makeNode('collection_image', context);
        const generationNode = makeNode('image_generation', context);
        const resultNode = makeNode('generation_result', context);

        if (!promptNode || !vibeNode || !collectionNode || !generationNode || !resultNode) {
            return { nodes: [], edges: [] };
        }

        const edges = [
            makeEdge(promptNode.id, 'subject_out', generationNode.id, 'prompt_in'),
            makeEdge(vibeNode.id, 'vibe_out', generationNode.id, 'vibe_in'),
            makeEdge(collectionNode.id, 'image_out', generationNode.id, 'refs_in'),
            makeEdge(generationNode.id, 'prompt_out', resultNode.id, 'prompt_in'),
            makeEdge(generationNode.id, 'images_out', resultNode.id, 'images_in'),
        ];

        return {
            nodes: [promptNode, vibeNode, collectionNode, generationNode, resultNode],
            edges,
        };
    }, [imageItems, vibeRuns]);

    const normalizeFlow = useCallback((rawFlow) => {
        if (!rawFlow || !Array.isArray(rawFlow.nodes) || !Array.isArray(rawFlow.edges)) {
            return buildDefaultFlow();
        }

        const context = { imageItems, vibeRuns };
        const nodes = rawFlow.nodes
            .map((rawNode, index) => {
                const template = getTemplate(rawNode?.type);
                if (!template) return null;
                const defaults = template.makeDefaultData(context);
                const node = {
                    id: String(rawNode?.id || randomId(rawNode.type)),
                    type: rawNode.type,
                    x: Number(rawNode?.x ?? (template.defaultPosition.x + (index * 24))),
                    y: Number(rawNode?.y ?? (template.defaultPosition.y + (index * 18))),
                    w: Math.max(260, Number(rawNode?.w || template.defaultSize.w)),
                    h: Math.max(170, Number(rawNode?.h || template.defaultSize.h)),
                    data: {
                        ...defaults,
                        ...(rawNode?.data || {}),
                    },
                };

                if (node.type === 'collection_image') {
                    const selectedExists = imageItems.some((item) => item.id === node.data.selectedItemId);
                    if (!selectedExists) {
                        node.data.selectedItemId = imageItems[0]?.id || '';
                    }
                }
                if (node.type === 'vibe') {
                    const selectedExists = vibeRuns.some((run) => run.id === node.data.selectedRunId);
                    if (!selectedExists) {
                        node.data.selectedRunId = vibeRuns[0]?.id || '';
                        if (!node.data.vibeText) {
                            node.data.vibeText = vibeRuns[0] ? formatVibeRun(vibeRuns[0]) : '';
                        }
                    }
                }
                return node;
            })
            .filter(Boolean);

        const nodeById = new Map(nodes.map((node) => [node.id, node]));
        const edges = rawFlow.edges
            .map((rawEdge) => ({
                id: String(rawEdge?.id || randomId('edge')),
                fromNodeId: String(rawEdge?.fromNodeId || ''),
                fromPortId: String(rawEdge?.fromPortId || ''),
                toNodeId: String(rawEdge?.toNodeId || ''),
                toPortId: String(rawEdge?.toPortId || ''),
            }))
            .filter((edge) => {
                const fromNode = nodeById.get(edge.fromNodeId);
                const toNode = nodeById.get(edge.toNodeId);
                if (!fromNode || !toNode) return false;

                const outPort = getPortMeta(fromNode.type, 'out', edge.fromPortId);
                const inPort = getPortMeta(toNode.type, 'in', edge.toPortId);
                if (!outPort || !inPort) return false;
                return hasCompatibleTypes(outPort.dataType, inPort.dataType);
            });

        if (nodes.length === 0) return buildDefaultFlow();
        return { nodes, edges };
    }, [buildDefaultFlow, imageItems, vibeRuns]);

    const [nodes, setNodes] = useState(() => buildDefaultFlow().nodes);
    const [edges, setEdges] = useState(() => buildDefaultFlow().edges);
    const [pendingConnection, setPendingConnection] = useState(null);

    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);
    const lastRunSignalRef = useRef(runSignal);

    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    useEffect(() => {
        edgesRef.current = edges;
    }, [edges]);

    useEffect(() => {
        const handleStorageUpdate = () => setStorageTick((tick) => tick + 1);
        window.addEventListener('storage-update', handleStorageUpdate);
        window.addEventListener('storage', handleStorageUpdate);
        return () => {
            window.removeEventListener('storage-update', handleStorageUpdate);
            window.removeEventListener('storage', handleStorageUpdate);
        };
    }, []);

    useEffect(() => {
        if (!projectId) {
            setNodes([]);
            setEdges([]);
            return;
        }

        const storageKey = `${FLOW_KEY_PREFIX}${projectId}`;
        let rawFlow = null;
        try {
            rawFlow = JSON.parse(localStorage.getItem(storageKey) || 'null');
        } catch {
            rawFlow = null;
        }
        const normalized = normalizeFlow(rawFlow);
        setNodes(normalized.nodes);
        setEdges(normalized.edges);
        setPendingConnection(null);
    }, [projectId, normalizeFlow]);

    useEffect(() => {
        if (!projectId) return;
        const timer = setTimeout(() => {
            const storageKey = `${FLOW_KEY_PREFIX}${projectId}`;
            const payload = {
                nodes: nodes.map((node) => sanitizeNodeForStorage(node)),
                edges,
            };
            try {
                localStorage.setItem(storageKey, JSON.stringify(payload));
            } catch (error) {
                if (isQuotaExceededError(error)) {
                    notify('Creation flow state is too large for local storage. Heavy outputs are not persisted.', 'error');
                    return;
                }
                throw error;
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [projectId, nodes, edges, notify]);

    useEffect(() => {
        if (nodes.length === 0) return;
        let changed = false;
        const nextNodes = nodes.map((node) => {
            if (node.type === 'collection_image') {
                const selectedExists = imageItems.some((item) => item.id === node?.data?.selectedItemId);
                if (!selectedExists && imageItems[0]) {
                    changed = true;
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            selectedItemId: imageItems[0].id,
                        },
                    };
                }
            }
            if (node.type === 'vibe') {
                const selectedExists = vibeRuns.some((run) => run.id === node?.data?.selectedRunId);
                if (!selectedExists && vibeRuns[0]) {
                    changed = true;
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            selectedRunId: vibeRuns[0].id,
                            vibeText: node?.data?.vibeText || formatVibeRun(vibeRuns[0]),
                        },
                    };
                }
            }
            return node;
        });
        if (changed) {
            setNodes(nextNodes);
        }
    }, [imageItems, nodes, vibeRuns]);

    const updateNodeData = useCallback((nodeId, patch) => {
        setNodes((prevNodes) => prevNodes.map((node) => {
            if (node.id !== nodeId) return node;
            const nextData = typeof patch === 'function'
                ? patch(node.data || {}, node)
                : { ...(node.data || {}), ...patch };
            return { ...node, data: nextData };
        }));
    }, []);

    const removeNode = useCallback((nodeId) => {
        setNodes((prevNodes) => prevNodes.filter((node) => node.id !== nodeId));
        setEdges((prevEdges) => prevEdges.filter((edge) => (
            edge.fromNodeId !== nodeId && edge.toNodeId !== nodeId
        )));
        setPendingConnection((current) => (current?.nodeId === nodeId ? null : current));
    }, []);

    const addNode = useCallback((type) => {
        const context = { imageItems, vibeRuns };
        const existing = nodesRef.current;
        const template = getTemplate(type);
        if (!template) return;
        const offset = existing.length % 6;
        const position = {
            x: template.defaultPosition.x + (offset * 24),
            y: template.defaultPosition.y + (offset * 18),
        };
        const node = makeNode(type, context, position);
        if (!node) return;
        setNodes((prevNodes) => [...prevNodes, node]);
    }, [imageItems, vibeRuns]);

    const onConnectPort = useCallback((nodeId, portId, direction, dataType) => {
        const current = { nodeId, portId, direction, dataType };
        if (!pendingConnection) {
            setPendingConnection(current);
            return;
        }

        if (pendingConnection.nodeId === current.nodeId
            && pendingConnection.portId === current.portId
            && pendingConnection.direction === current.direction) {
            setPendingConnection(null);
            return;
        }

        if (pendingConnection.direction === current.direction) {
            setPendingConnection(current);
            return;
        }

        const out = pendingConnection.direction === 'out' ? pendingConnection : current;
        const input = pendingConnection.direction === 'in' ? pendingConnection : current;

        if (!hasCompatibleTypes(out.dataType, input.dataType)) {
            notify(`Incompatible slot types (${out.dataType} -> ${input.dataType}).`, 'error');
            setPendingConnection(null);
            return;
        }

        if (out.nodeId === input.nodeId && out.portId === input.portId) {
            setPendingConnection(null);
            return;
        }

        setEdges((prevEdges) => {
            const filtered = prevEdges.filter((edge) => !(
                edge.toNodeId === input.nodeId && edge.toPortId === input.portId
            ));
            const existing = filtered.some((edge) => (
                edge.fromNodeId === out.nodeId
                && edge.fromPortId === out.portId
                && edge.toNodeId === input.nodeId
                && edge.toPortId === input.portId
            ));
            if (existing) return filtered;
            return [...filtered, makeEdge(out.nodeId, out.portId, input.nodeId, input.portId)];
        });

        setPendingConnection(null);
    }, [notify, pendingConnection]);

    const removeEdge = useCallback((edgeId) => {
        setEdges((prevEdges) => prevEdges.filter((edge) => edge.id !== edgeId));
    }, []);

    const findIncomingEdges = useCallback((targetNodeId, targetPortId, edgeList) => (
        edgeList.filter((edge) => edge.toNodeId === targetNodeId && edge.toPortId === targetPortId)
    ), []);

    const buildGenerationPayload = useCallback((generationNode, nodeList, edgeList) => {
        const nodeById = new Map(nodeList.map((node) => [node.id, node]));

        const promptEdge = findIncomingEdges(generationNode.id, 'prompt_in', edgeList)[0] || null;
        const vibeEdge = findIncomingEdges(generationNode.id, 'vibe_in', edgeList)[0] || null;
        const refsEdges = findIncomingEdges(generationNode.id, 'refs_in', edgeList);

        let subjectPrompt = '';
        const promptSource = promptEdge ? nodeById.get(promptEdge.fromNodeId) : null;
        if (promptSource?.type === 'prompt_input') {
            subjectPrompt = String(promptSource?.data?.subjectPrompt || '').trim();
        }
        if (!subjectPrompt) {
            subjectPrompt = String(generationNode?.data?.manualPrompt || '').trim();
        }

        let vibeText = '';
        const vibeSource = vibeEdge ? nodeById.get(vibeEdge.fromNodeId) : null;
        if (vibeSource?.type === 'vibe') {
            vibeText = String(vibeSource?.data?.vibeText || '').trim();
        }

        const referenceImageUrls = refsEdges
            .map((edge) => nodeById.get(edge.fromNodeId))
            .map((sourceNode) => {
                if (!sourceNode) return null;
                if (sourceNode.type === 'collection_image') {
                    const selected = resolveSelectedCollectionImage(sourceNode, imageItems);
                    return selected?.content || null;
                }
                if (sourceNode.type === 'generation_result') {
                    return sourceNode?.data?.images?.[0]?.dataUrl || null;
                }
                if (sourceNode.type === 'image_generation') {
                    return sourceNode?.data?.generatedImages?.[0]?.dataUrl || null;
                }
                return null;
            })
            .filter(Boolean)
            .slice(0, 3);

        const intent = generationNode?.data?.intent || 'brand_style';
        const platform = generationNode?.data?.platform || 'Universal';
        const sections = [subjectPrompt];
        if (vibeText) {
            sections.push(`Style direction:\n${vibeText.slice(0, 1400)}`);
        }
        sections.push(`Intent: ${intent}.`);
        sections.push(`Platform: ${platform}.`);
        const prompt = sections.filter(Boolean).join('\n\n').trim();

        return {
            prompt,
            negativePrompt: String(generationNode?.data?.negativePrompt || '').trim(),
            model: generationNode?.data?.model || MODEL_OPTIONS[0],
            referenceImageUrls,
            subjectPrompt,
            vibeText,
            intent,
            platform,
        };
    }, [findIncomingEdges, imageItems]);

    const runGenerationNode = useCallback(async (generationNodeId) => {
        const nodeList = nodesRef.current;
        const edgeList = edgesRef.current;
        const generationNode = nodeList.find((node) => node.id === generationNodeId && node.type === 'image_generation');
        if (!generationNode) {
            notify('Image Generation node not found.', 'error');
            return;
        }

        const payload = buildGenerationPayload(generationNode, nodeList, edgeList);
        if (!payload.subjectPrompt) {
            notify('Add a subject prompt before generating.', 'error');
            updateNodeData(generationNodeId, {
                status: 'failed',
                error: 'Missing subject prompt.',
                statusMessage: 'Provide prompt input first.',
            });
            return;
        }

        updateNodeData(generationNodeId, {
            status: 'running',
            error: '',
            statusMessage: 'Generating with Gemini...',
        });

        try {
            const result = await generateImagesWithGemini({
                prompt: payload.prompt,
                negativePrompt: payload.negativePrompt,
                referenceImageUrls: payload.referenceImageUrls,
                count: 1,
                model: payload.model,
            });

            const images = Array.isArray(result?.images) ? result.images : [];
            if (images.length === 0) {
                throw new Error('Gemini returned no images.');
            }

            const refreshedNodes = nodesRef.current;
            const refreshedEdges = edgesRef.current;
            const freshGenerationNode = refreshedNodes.find((node) => node.id === generationNodeId) || generationNode;

            let resultNode = refreshedNodes.find((node) => (
                node.type === 'generation_result'
                && refreshedEdges.some((edge) => edge.fromNodeId === generationNodeId && edge.toNodeId === node.id)
            )) || null;

            let nextNodes = [...refreshedNodes];
            let nextEdges = [...refreshedEdges];

            if (!resultNode) {
                const created = makeNode('generation_result', { imageItems, vibeRuns }, {
                    x: Number(freshGenerationNode.x || 920) + Number(freshGenerationNode.w || 500) + 80,
                    y: Number(freshGenerationNode.y || 220) + 10,
                });
                if (created) {
                    resultNode = created;
                    nextNodes.push(created);

                    nextEdges = nextEdges.filter((edge) => !(
                        (edge.toNodeId === created.id && edge.toPortId === 'prompt_in')
                        || (edge.toNodeId === created.id && edge.toPortId === 'images_in')
                    ));
                    nextEdges.push(makeEdge(generationNodeId, 'prompt_out', created.id, 'prompt_in'));
                    nextEdges.push(makeEdge(generationNodeId, 'images_out', created.id, 'images_in'));
                }
            }

            nextNodes = nextNodes.map((node) => {
                if (node.id === generationNodeId) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            generatedPrompt: payload.prompt,
                            generatedImages: images,
                            status: 'done',
                            statusMessage: `Generated with ${result.model}.`,
                            modelUsed: result.model,
                            error: '',
                            lastRunAt: Date.now(),
                        },
                    };
                }
                if (resultNode && node.id === resultNode.id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            prompt: payload.prompt,
                            images,
                            sourceModel: result.model,
                            saveStatus: 'idle',
                            saveMessage: '',
                        },
                    };
                }
                return node;
            });

            setEdges(nextEdges);
            setNodes(nextNodes);
            notify(`Generated 1 image with ${result.model}.`, 'success');
        } catch (error) {
            updateNodeData(generationNodeId, {
                status: 'failed',
                error: error?.message || 'Generation failed.',
                statusMessage: 'Generation failed. Run again.',
            });
            notify(error?.message || 'Generation failed.', 'error');
        }
    }, [buildGenerationPayload, imageItems, notify, updateNodeData, vibeRuns]);

    const runPrimaryGeneration = useCallback(() => {
        const generationNode = nodesRef.current.find((node) => node.type === 'image_generation');
        if (!generationNode) {
            notify('Add an Image Generation node first.', 'error');
            return;
        }
        runGenerationNode(generationNode.id);
    }, [notify, runGenerationNode]);

    useEffect(() => {
        if (!runSignal) return;
        if (runSignal === lastRunSignalRef.current) return;
        lastRunSignalRef.current = runSignal;
        runPrimaryGeneration();
    }, [runPrimaryGeneration, runSignal]);

    const downloadResultImage = useCallback((dataUrl, filename = 'dreamlab-generated.png') => {
        if (!dataUrl) return;
        const anchor = document.createElement('a');
        anchor.href = dataUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    }, []);

    const saveResultToCollection = useCallback(async (resultNodeId) => {
        const resultNode = nodesRef.current.find((node) => node.id === resultNodeId && node.type === 'generation_result');
        if (!resultNode) return;

        const primaryImage = resultNode?.data?.images?.[0] || null;
        if (!primaryImage?.dataUrl) {
            notify('No generated image to save yet.', 'error');
            return;
        }
        if (!projectId || !activeWorkspaceId) {
            notify('Select a workspace and project before saving.', 'error');
            return;
        }

        updateNodeData(resultNodeId, { saveStatus: 'saving', saveMessage: 'Saving to collection...' });

        try {
            const generatedCollection = getOrCreateGeneratedCollection(projectId);
            const targetCollectionId = collectionId && collectionId !== '__unsorted__'
                ? collectionId
                : generatedCollection?.id || null;

            await saveItemWithTags({
                type: 'image',
                content: primaryImage.dataUrl,
                sourceUrl: `gemini://${resultNode?.data?.sourceModel || 'image-model'}/${primaryImage.id || randomId('img')}`,
                workspaceId: activeWorkspaceId,
                projectId,
                collectionId: targetCollectionId,
                title: `Generated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                tags: ['generated', 'creation-mode'],
                createdAt: Date.now(),
            }, projectId);

            updateNodeData(resultNodeId, { saveStatus: 'saved', saveMessage: 'Saved to collection.' });
            notify('Generated image added to collection.', 'success');
        } catch (error) {
            updateNodeData(resultNodeId, {
                saveStatus: 'failed',
                saveMessage: error?.message || 'Save failed.',
            });
            notify(error?.message || 'Failed to save generated image.', 'error');
        }
    }, [activeWorkspaceId, collectionId, notify, projectId, updateNodeData]);

    const edgeChips = useMemo(() => {
        const nodeById = new Map(nodes.map((node) => [node.id, node]));
        return edges.map((edge) => {
            const fromNode = nodeById.get(edge.fromNodeId);
            const toNode = nodeById.get(edge.toNodeId);
            const fromPort = fromNode ? getPortMeta(fromNode.type, 'out', edge.fromPortId) : null;
            const toPort = toNode ? getPortMeta(toNode.type, 'in', edge.toPortId) : null;
            return {
                id: edge.id,
                label: `${getTemplate(fromNode?.type)?.title || 'Node'} (${fromPort?.label || edge.fromPortId}) -> ${getTemplate(toNode?.type)?.title || 'Node'} (${toPort?.label || edge.toPortId})`,
            };
        });
    }, [edges, nodes]);

    const edgePaths = useMemo(() => {
        const nodeById = new Map(nodes.map((node) => [node.id, node]));
        return edges
            .map((edge) => {
                const fromNode = nodeById.get(edge.fromNodeId);
                const toNode = nodeById.get(edge.toNodeId);
                if (!fromNode || !toNode) return null;
                const start = getPortAnchor(fromNode, 'out', edge.fromPortId);
                const end = getPortAnchor(toNode, 'in', edge.toPortId);
                if (!start || !end) return null;
                return {
                    id: edge.id,
                    d: toPath(start, end),
                };
            })
            .filter(Boolean);
    }, [edges, nodes]);

    const renderPort = (node, port, direction, index) => {
        const top = getPortY(index);
        const isPending = pendingConnection
            && pendingConnection.nodeId === node.id
            && pendingConnection.portId === port.id
            && pendingConnection.direction === direction;
        const isConnected = edges.some((edge) => (
            direction === 'in'
                ? edge.toNodeId === node.id && edge.toPortId === port.id
                : edge.fromNodeId === node.id && edge.fromPortId === port.id
        ));

        const labelBase = 'absolute whitespace-nowrap text-[10px] text-neutral-500';
        const labelClass = direction === 'in'
            ? `${labelBase} left-3`
            : `${labelBase} right-3`;

        return (
            <button
                key={`${node.id}_${port.id}_${direction}`}
                type="button"
                onClick={(event) => {
                    event.stopPropagation();
                    onConnectPort(node.id, port.id, direction, port.dataType);
                }}
                style={{ top }}
                className={`absolute ${direction === 'in' ? '-left-2' : '-right-2'} h-4 w-4 rounded-full border transition-colors ${isPending ? 'border-brand-600 bg-brand-600' : isConnected ? 'border-amber-500 bg-amber-400' : 'border-neutral-300 bg-white hover:border-brand-500'}`}
                title={`${port.label} (${port.dataType})`}
            >
                <span className={labelClass}>{port.label}</span>
            </button>
        );
    };

    const renderNodeBody = (node) => {
        if (node.type === 'prompt_input') {
            return (
                <div className="px-3 pb-3 pt-2">
                    <label className="text-[11px] uppercase tracking-wide text-neutral-500">Subject Prompt</label>
                    <textarea
                        rows={4}
                        value={node?.data?.subjectPrompt || ''}
                        onChange={(event) => updateNodeData(node.id, { subjectPrompt: event.target.value })}
                        className="mt-1 w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-2 text-sm text-neutral-800 outline-none focus:border-brand-500"
                        placeholder="Describe what you want to generate..."
                    />
                </div>
            );
        }

        if (node.type === 'vibe') {
            return (
                <div className="px-3 pb-3 pt-2">
                    <label className="text-[11px] uppercase tracking-wide text-neutral-500">Select Vibe</label>
                    <select
                        value={node?.data?.selectedRunId || ''}
                        onChange={(event) => {
                            const selectedRunId = event.target.value;
                            const selectedRun = vibeRuns.find((run) => run.id === selectedRunId) || null;
                            updateNodeData(node.id, {
                                selectedRunId,
                                vibeText: selectedRun ? formatVibeRun(selectedRun) : '',
                            });
                        }}
                        className="mt-1 h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
                    >
                        <option value="">No vibe runs yet</option>
                        {vibeRuns.map((run) => (
                            <option key={run.id} value={run.id}>
                                {run.focusStatement ? run.focusStatement.slice(0, 60) : run.id}
                            </option>
                        ))}
                    </select>

                    <label className="mt-3 block text-[11px] uppercase tracking-wide text-neutral-500">Vibe Prompt Output</label>
                    <textarea
                        rows={4}
                        value={node?.data?.vibeText || ''}
                        onChange={(event) => updateNodeData(node.id, { vibeText: event.target.value })}
                        className="mt-1 w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-2 text-xs text-neutral-700 outline-none focus:border-brand-500"
                        placeholder="Vibe direction appears here..."
                    />
                </div>
            );
        }

        if (node.type === 'collection_image') {
            const selected = resolveSelectedCollectionImage(node, imageItems);
            return (
                <div className="px-3 pb-3 pt-2">
                    <label className="text-[11px] uppercase tracking-wide text-neutral-500">Select From Collection</label>
                    <select
                        value={selected?.id || ''}
                        onChange={(event) => updateNodeData(node.id, { selectedItemId: event.target.value })}
                        className="mt-1 h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-sm text-neutral-800"
                    >
                        {imageItems.length === 0 ? (
                            <option value="">No images in this collection</option>
                        ) : (
                            imageItems.map((item, index) => (
                                <option key={item.id} value={item.id}>
                                    {item.title || `Image ${index + 1}`}
                                </option>
                            ))
                        )}
                    </select>

                    <div className="mt-3 h-24 overflow-hidden rounded-md border border-neutral-200 bg-neutral-100">
                        {selected?.content ? (
                            <img src={selected.content} alt="Collection reference" className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                                Add images to this collection first.
                            </div>
                        )}
                    </div>
                </div>
            );
        }

        if (node.type === 'image_generation') {
            const preview = buildGenerationPayload(node, nodes, edges);
            const generatedImages = Array.isArray(node?.data?.generatedImages) ? node.data.generatedImages : [];
            const status = node?.data?.status || 'idle';
            const statusColor = status === 'done'
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : status === 'failed'
                    ? 'text-red-700 bg-red-50 border-red-200'
                    : status === 'running'
                        ? 'text-amber-700 bg-amber-50 border-amber-200'
                        : 'text-neutral-600 bg-neutral-50 border-neutral-200';

            return (
                <div className="px-3 pb-3 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-neutral-500">
                            Intent
                            <select
                                value={node?.data?.intent || 'brand_style'}
                                onChange={(event) => updateNodeData(node.id, { intent: event.target.value })}
                                className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs normal-case text-neutral-800"
                            >
                                {INTENT_OPTIONS.map((option) => (
                                    <option key={option.id} value={option.id}>{option.label}</option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide text-neutral-500">
                            Platform
                            <select
                                value={node?.data?.platform || 'Universal'}
                                onChange={(event) => updateNodeData(node.id, { platform: event.target.value })}
                                className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs normal-case text-neutral-800"
                            >
                                {PLATFORM_OPTIONS.map((platform) => (
                                    <option key={platform} value={platform}>{platform}</option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <label className="mt-2 flex flex-col gap-1 text-[11px] uppercase tracking-wide text-neutral-500">
                        Model
                        <select
                            value={node?.data?.model || MODEL_OPTIONS[0]}
                            onChange={(event) => updateNodeData(node.id, { model: event.target.value })}
                            className="h-8 rounded-md border border-neutral-200 bg-white px-2 text-xs normal-case text-neutral-800"
                        >
                            {MODEL_OPTIONS.map((model) => (
                                <option key={model} value={model}>{model}</option>
                            ))}
                        </select>
                    </label>

                    <label className="mt-2 block text-[11px] uppercase tracking-wide text-neutral-500">Prompt Preview</label>
                    <textarea
                        rows={4}
                        readOnly
                        value={preview.prompt || ''}
                        className="mt-1 w-full resize-none rounded-md border border-neutral-200 bg-neutral-50 px-2 py-2 text-xs text-neutral-700"
                    />

                    <label className="mt-2 block text-[11px] uppercase tracking-wide text-neutral-500">Negative Prompt</label>
                    <textarea
                        rows={2}
                        value={node?.data?.negativePrompt || ''}
                        onChange={(event) => updateNodeData(node.id, { negativePrompt: event.target.value })}
                        className="mt-1 w-full resize-none rounded-md border border-neutral-200 bg-white px-2 py-2 text-xs text-neutral-700 outline-none focus:border-brand-500"
                        placeholder="watermark, blurry, low quality..."
                    />

                    <div className={`mt-2 rounded-md border px-2 py-1 text-[11px] ${statusColor}`}>
                        {node?.data?.statusMessage || 'Ready.'}
                        {node?.data?.error ? ` ${node.data.error}` : ''}
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                        <span className="text-[11px] text-neutral-500">
                            Refs: {preview.referenceImageUrls?.length || 0}
                        </span>
                        <Button
                            size="small"
                            variant="brand-primary"
                            icon={<Sparkles />}
                            onClick={() => runGenerationNode(node.id)}
                            disabled={status === 'running'}
                        >
                            {status === 'running' ? 'Running...' : 'Run'}
                        </Button>
                    </div>

                    {generatedImages.length > 0 ? (
                        <div className="mt-2 grid grid-cols-3 gap-1">
                            {generatedImages.slice(0, 3).map((image) => (
                                <div key={image.id} className="h-16 overflow-hidden rounded border border-neutral-200 bg-neutral-100">
                                    {image?.dataUrl ? (
                                        <img src={image.dataUrl} alt="Generated" className="h-full w-full object-cover" />
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            );
        }

        if (node.type === 'generation_result') {
            const image = node?.data?.images?.[0] || null;
            const saveStatus = node?.data?.saveStatus || 'idle';
            const saveMessage = node?.data?.saveMessage || '';
            const saveColor = saveStatus === 'saved'
                ? 'text-emerald-700'
                : saveStatus === 'failed'
                    ? 'text-red-700'
                    : 'text-neutral-500';

            return (
                <div className="px-3 pb-3 pt-2">
                    <div className="h-44 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
                        {image?.dataUrl ? (
                            <img src={image.dataUrl} alt="Generation result" className="h-full w-full object-cover" />
                        ) : (
                            <div className="flex h-full items-center justify-center text-xs text-neutral-500">
                                No generated image yet.
                            </div>
                        )}
                    </div>
                    <div className="mt-3 flex gap-2">
                        <Button
                            size="small"
                            variant="brand-primary"
                            icon={<Download />}
                            onClick={() => downloadResultImage(image?.dataUrl, `dreamlab-${Date.now()}.png`)}
                            disabled={!image?.dataUrl}
                        >
                            Download
                        </Button>
                        <Button
                            size="small"
                            variant="neutral-secondary"
                            onClick={() => saveResultToCollection(node.id)}
                            disabled={!image?.dataUrl || saveStatus === 'saving'}
                        >
                            {saveStatus === 'saving' ? 'Saving...' : 'Add to Collection'}
                        </Button>
                    </div>
                    <div className={`mt-2 text-[11px] ${saveColor}`}>
                        {saveMessage || 'Result is ready.'}
                    </div>
                </div>
            );
        }

        return null;
    };

    if (!projectId) {
        return (
            <div className="flex h-72 w-full items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 text-neutral-600">
                Select a project to use the creation canvas.
            </div>
        );
    }

    return (
        <div className="relative h-full w-full overflow-auto rounded-xl border border-neutral-200 bg-neutral-50">
            <div
                className="creation-canvas-board relative"
                style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}
                onClick={() => setPendingConnection(null)}
            >
                <div className="absolute left-4 top-4 z-20 w-52 rounded-lg border border-neutral-200 bg-white p-2 shadow-sm">
                    <div className="px-2 pb-2 text-sm font-medium text-neutral-700">Add Node</div>
                    <div className="flex flex-col gap-1">
                        {NODE_LIBRARY.map((entry) => (
                            <button
                                key={entry.type}
                                type="button"
                                className="flex items-center gap-2 rounded-md border border-neutral-200 px-2 py-1.5 text-left text-xs text-neutral-700 hover:border-brand-500 hover:bg-brand-50"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    addNode(entry.type);
                                }}
                            >
                                <Plus size={14} />
                                {entry.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="absolute left-[240px] right-4 top-4 z-20 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600 shadow-sm">
                    <div className="mb-1 flex items-center gap-2">
                        <span className="font-medium text-neutral-700">Use output slots to input slots</span>
                        {pendingConnection ? (
                            <span className="rounded bg-brand-50 px-2 py-0.5 text-[11px] text-brand-700">
                                Connecting {pendingConnection.portId}
                            </span>
                        ) : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {edgeChips.length === 0 ? (
                            <span className="text-[11px] text-neutral-500">No connections yet.</span>
                        ) : (
                            edgeChips.map((chip) => (
                                <button
                                    key={chip.id}
                                    type="button"
                                    className="flex items-center gap-1 rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-[11px] text-neutral-700 hover:bg-neutral-100"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        removeEdge(chip.id);
                                    }}
                                >
                                    {chip.label}
                                    <X size={11} />
                                </button>
                            ))
                        )}
                    </div>
                </div>

                <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full">
                    {edgePaths.map((path) => (
                        <path
                            key={path.id}
                            d={path.d}
                            fill="none"
                            stroke="#f97316"
                            strokeWidth="2"
                            strokeDasharray="6 4"
                            strokeLinecap="round"
                        />
                    ))}
                </svg>

                {nodes.map((node) => {
                    const template = getTemplate(node.type);
                    if (!template) return null;

                    const inputs = template.inputs || [];
                    const outputs = template.outputs || [];

                    return (
                        <Rnd
                            key={node.id}
                            size={{ width: node.w, height: node.h }}
                            position={{ x: node.x, y: node.y }}
                            onDragStop={(event, data) => {
                                setNodes((prevNodes) => prevNodes.map((candidate) => (
                                    candidate.id === node.id ? { ...candidate, x: data.x, y: data.y } : candidate
                                )));
                            }}
                            onResizeStop={(event, direction, ref, delta, position) => {
                                const nextWidth = Math.max(260, Number.parseInt(ref.style.width, 10) || node.w);
                                const nextHeight = Math.max(170, Number.parseInt(ref.style.height, 10) || node.h);
                                setNodes((prevNodes) => prevNodes.map((candidate) => (
                                    candidate.id === node.id
                                        ? {
                                            ...candidate,
                                            x: position.x,
                                            y: position.y,
                                            w: nextWidth,
                                            h: nextHeight,
                                        }
                                        : candidate
                                )));
                            }}
                            bounds=".creation-canvas-board"
                            dragHandleClassName="creation-node-drag"
                            className="z-10"
                            minWidth={260}
                            minHeight={170}
                        >
                            <div
                                className="relative flex h-full w-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className="creation-node-drag flex cursor-move items-center justify-between border-b border-neutral-100 bg-neutral-50 px-3 py-2">
                                    <span className="text-sm font-medium text-neutral-800">{template.title}</span>
                                    <button
                                        type="button"
                                        className="rounded p-1 text-neutral-400 hover:bg-neutral-200 hover:text-red-600"
                                        onClick={() => removeNode(node.id)}
                                        title="Delete node"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                <div className="min-h-0 flex-1 overflow-auto">
                                    {renderNodeBody(node)}
                                </div>

                                {inputs.map((port, index) => renderPort(node, port, 'in', index))}
                                {outputs.map((port, index) => renderPort(node, port, 'out', index))}
                            </div>
                        </Rnd>
                    );
                })}
            </div>
        </div>
    );
}
