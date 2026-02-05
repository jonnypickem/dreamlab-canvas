import React, { useState, useRef, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import CanvasItem from './CanvasItem';
import { MousePointer2, Hand } from 'lucide-react';

const CanvasView = ({ items, onUpdateItem, onDeleteItem }) => {
    const [selectedId, setSelectedId] = useState(null);
    const [panningEnabled, setPanningEnabled] = useState(true);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.key === 'Backspace' || e.key === 'Delete') && selectedId) {
                onDeleteItem(selectedId);
                setSelectedId(null);
            }
            if (e.key === 'Escape') {
                setSelectedId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedId, onDeleteItem]);

    return (
        <div className="w-full h-full bg-[#f4f4f5] overflow-hidden relative canvas-container">
            {/* Toolbar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex gap-1 bg-white p-1.5 rounded-lg shadow-lg border border-zinc-200">
                <button
                    onClick={() => setPanningEnabled(false)}
                    className={`p-2 rounded-md transition-colors ${!panningEnabled ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
                    title="Select/Move Items"
                >
                    <MousePointer2 size={18} />
                </button>
                <button
                    onClick={() => setPanningEnabled(true)}
                    className={`p-2 rounded-md transition-colors ${panningEnabled ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:bg-zinc-100'}`}
                    title="Pan Canvas (Space)"
                >
                    <Hand size={18} />
                </button>
            </div>

            <TransformWrapper
                initialScale={1}
                minScale={0.1}
                maxScale={4}
                disabled={!panningEnabled}
                limitToBounds={false}
                zoomAnimation={{ disabled: true }} // Smoother without animation for now
                panning={{ velocityDisabled: true }}
            >
                {({ zoomIn, zoomOut, resetTransform, ...rest }) => (
                    <React.Fragment>
                        <div className="absolute bottom-4 right-4 z-50 flex flex-col gap-2">
                            <button onClick={() => zoomIn()} className="p-2 bg-white rounded-md shadow border border-zinc-200 hover:bg-zinc-50 text-zinc-600">+</button>
                            <button onClick={() => zoomOut()} className="p-2 bg-white rounded-md shadow border border-zinc-200 hover:bg-zinc-50 text-zinc-600">-</button>
                            <button onClick={() => resetTransform()} className="p-2 bg-white rounded-md shadow border border-zinc-200 hover:bg-zinc-50 text-zinc-600">100%</button>
                        </div>

                        <TransformComponent
                            wrapperClass="w-full h-full"
                            contentClass="w-full h-full dreamlab-canvas-content"
                            contentStyle={{ width: '4000px', height: '4000px' }} // Big canvas space
                        >
                            {/* Dot Grid Background */}
                            <div
                                className="absolute inset-0 w-full h-full pointer-events-none opacity-20"
                                style={{
                                    backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
                                    backgroundSize: '20px 20px'
                                }}
                            />

                            {/* Items */}
                            {items.map(item => (
                                <CanvasItem
                                    key={item.id}
                                    item={item}
                                    onUpdate={onUpdateItem}
                                    onDelete={onDeleteItem}
                                    isSelected={selectedId === item.id}
                                    onSelect={setSelectedId}
                                    scale={rest.state ? rest.state.scale : 1}
                                />
                            ))}
                        </TransformComponent>
                    </React.Fragment>
                )}
            </TransformWrapper>
        </div>
    );
};

export default CanvasView;
