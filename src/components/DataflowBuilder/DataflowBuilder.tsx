/**
 * DataflowBuilder Component
 * Visual drag-and-drop pipeline builder for automating data analyst workflows
 */

import React, { useState, useCallback } from 'react';
import {
    Dataflow,
    DataflowNode,
    DataflowNodeType,
    NODE_CONFIGS,
    DATAFLOW_TEMPLATES
} from './dataflowTypes';

interface DataflowBuilderProps {
    workspaceId: string;
    datasetId?: string;
    onRun?: (dataflow: Dataflow) => void;
    onSave?: (dataflow: Dataflow) => void;
}

const DataflowBuilder: React.FC<DataflowBuilderProps> = ({
    workspaceId,
    datasetId,
    onRun,
    onSave,
}) => {
    const [dataflow, setDataflow] = useState<Dataflow>({
        name: 'New Dataflow',
        description: '',
        nodes: [],
        connections: [],
        isTemplate: false,
        isActive: true,
    });

    const [selectedNode, setSelectedNode] = useState<string | null>(null);
    const [showTemplates, setShowTemplates] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [runProgress, setRunProgress] = useState(0);

    // Add a node to the canvas
    const addNode = useCallback((type: DataflowNodeType) => {
        const config = NODE_CONFIGS[type];
        const newNode: DataflowNode = {
            id: `node-${Date.now()}`,
            type,
            name: config.name,
            description: config.description,
            config: {},
            position: { x: 100 + dataflow.nodes.length * 120, y: 150 },
            status: 'pending',
        };

        // Auto-connect to last node
        const connections = [...dataflow.connections];
        if (dataflow.nodes.length > 0) {
            const lastNode = dataflow.nodes[dataflow.nodes.length - 1];
            connections.push({
                id: `conn-${Date.now()}`,
                sourceId: lastNode.id,
                targetId: newNode.id,
            });
        }

        setDataflow(prev => ({
            ...prev,
            nodes: [...prev.nodes, newNode],
            connections,
        }));
        setShowTemplates(false);
    }, [dataflow.nodes, dataflow.connections]);

    // Load a template
    const loadTemplate = useCallback((templateId: string) => {
        const template = DATAFLOW_TEMPLATES.find(t => t.id === templateId);
        if (template) {
            setDataflow({
                ...template.dataflow,
                name: template.name,
                description: template.description,
            });
            setShowTemplates(false);
        }
    }, []);

    // Remove a node
    const removeNode = useCallback((nodeId: string) => {
        setDataflow(prev => ({
            ...prev,
            nodes: prev.nodes.filter(n => n.id !== nodeId),
            connections: prev.connections.filter(c => c.sourceId !== nodeId && c.targetId !== nodeId),
        }));
        if (selectedNode === nodeId) setSelectedNode(null);
    }, [selectedNode]);

    // Clear all nodes
    const clearCanvas = useCallback(() => {
        setDataflow(prev => ({
            ...prev,
            nodes: [],
            connections: [],
        }));
        setSelectedNode(null);
        setShowTemplates(true);
    }, []);

    // Simulate running the dataflow
    const runDataflow = useCallback(async () => {
        if (dataflow.nodes.length === 0) return;

        setIsRunning(true);
        setRunProgress(0);

        // Simulate step-by-step execution
        for (let i = 0; i < dataflow.nodes.length; i++) {
            const node = dataflow.nodes[i];

            // Update node status to running
            setDataflow(prev => ({
                ...prev,
                nodes: prev.nodes.map(n =>
                    n.id === node.id ? { ...n, status: 'running' } : n
                ),
            }));

            // Simulate processing time
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));

            // Update node status to completed
            setDataflow(prev => ({
                ...prev,
                nodes: prev.nodes.map(n =>
                    n.id === node.id ? { ...n, status: 'completed' } : n
                ),
            }));

            setRunProgress(((i + 1) / dataflow.nodes.length) * 100);
        }

        setIsRunning(false);
        if (onRun) onRun(dataflow);
    }, [dataflow, onRun]);

    // Get status color
    const getStatusColor = (status: DataflowNode['status']) => {
        switch (status) {
            case 'running': return 'ring-2 ring-yellow-400 animate-pulse';
            case 'completed': return 'ring-2 ring-emerald-400';
            case 'failed': return 'ring-2 ring-red-400';
            default: return '';
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-950">
            {/* Header */}
            <div className="flex-shrink-0 p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xl">
                        🔄
                    </div>
                    <div>
                        <input
                            type="text"
                            value={dataflow.name}
                            onChange={e => setDataflow(prev => ({ ...prev, name: e.target.value }))}
                            className="text-lg font-bold text-white bg-transparent border-none outline-none"
                            placeholder="Dataflow Name"
                        />
                        <p className="text-xs text-slate-500">{dataflow.nodes.length} steps</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={clearCanvas}
                        className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => onSave && onSave(dataflow)}
                        className="px-4 py-2 text-xs font-bold text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                        Save
                    </button>
                    <button
                        onClick={runDataflow}
                        disabled={isRunning || dataflow.nodes.length === 0}
                        className="px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                    >
                        {isRunning ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Running ({Math.round(runProgress)}%)
                            </>
                        ) : (
                            <>▶ Run Pipeline</>
                        )}
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Node Palette */}
                <div className="w-64 flex-shrink-0 border-r border-slate-800 p-4 overflow-y-auto">
                    <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-3">
                        Add Step
                    </h3>
                    <div className="space-y-2">
                        {Object.entries(NODE_CONFIGS).map(([type, config]) => (
                            <button
                                key={type}
                                onClick={() => addNode(type as DataflowNodeType)}
                                className="w-full p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-indigo-500/50 hover:bg-slate-800/50 transition-all flex items-center gap-3 group"
                            >
                                <div
                                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                                    style={{ backgroundColor: config.color + '20' }}
                                >
                                    {config.icon}
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">
                                        {config.name}
                                    </p>
                                    <p className="text-[10px] text-slate-500 line-clamp-1">
                                        {config.description}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 relative overflow-auto bg-[radial-gradient(circle_at_center,_#1e293b_1px,_transparent_1px)] bg-[length:20px_20px]">
                    {/* Templates overlay */}
                    {showTemplates && dataflow.nodes.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm z-10">
                            <div className="max-w-2xl p-8">
                                <h2 className="text-2xl font-black text-white text-center mb-2">
                                    Start with a Template
                                </h2>
                                <p className="text-slate-400 text-center mb-8">
                                    Choose a pre-built workflow or start from scratch
                                </p>

                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    {DATAFLOW_TEMPLATES.map(template => (
                                        <button
                                            key={template.id}
                                            onClick={() => loadTemplate(template.id)}
                                            className="p-6 rounded-2xl border border-slate-700 bg-slate-900/80 hover:border-indigo-500 hover:bg-slate-800/80 transition-all text-left group"
                                        >
                                            <div className="text-3xl mb-3">{template.icon}</div>
                                            <h3 className="font-bold text-white group-hover:text-indigo-400 transition-colors">
                                                {template.name}
                                            </h3>
                                            <p className="text-xs text-slate-500 mt-1">
                                                {template.description}
                                            </p>
                                        </button>
                                    ))}
                                </div>

                                <div className="text-center">
                                    <button
                                        onClick={() => setShowTemplates(false)}
                                        className="text-sm text-slate-500 hover:text-white transition-colors"
                                    >
                                        or add steps manually →
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Nodes */}
                    <div className="p-8 min-h-full">
                        {dataflow.nodes.length === 0 && !showTemplates && (
                            <div className="flex items-center justify-center h-64 text-slate-500">
                                <p>Click a step from the left panel to add it to your pipeline</p>
                            </div>
                        )}

                        <div className="flex items-center gap-2">
                            {dataflow.nodes.map((node, index) => {
                                const config = NODE_CONFIGS[node.type];
                                return (
                                    <React.Fragment key={node.id}>
                                        {/* Node */}
                                        <div
                                            onClick={() => setSelectedNode(node.id === selectedNode ? null : node.id)}
                                            className={`
                        relative p-4 rounded-2xl border border-slate-700 bg-slate-900/90 backdrop-blur-sm
                        hover:border-indigo-500/50 cursor-pointer transition-all min-w-[140px]
                        ${selectedNode === node.id ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : ''}
                        ${getStatusColor(node.status)}
                      `}
                                        >
                                            {/* Delete button */}
                                            <button
                                                onClick={e => { e.stopPropagation(); removeNode(node.id); }}
                                                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-red-400 hover:border-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                                style={{ opacity: selectedNode === node.id ? 1 : undefined }}
                                            >
                                                ×
                                            </button>

                                            <div
                                                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3 mx-auto"
                                                style={{ backgroundColor: config.color + '20' }}
                                            >
                                                {node.status === 'running' ? (
                                                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : node.status === 'completed' ? (
                                                    '✓'
                                                ) : (
                                                    config.icon
                                                )}
                                            </div>
                                            <p className="text-sm font-bold text-white text-center">{node.name}</p>
                                            <p className="text-[10px] text-slate-500 text-center mt-0.5">
                                                {node.status === 'completed' ? 'Done' : node.status === 'running' ? 'Processing...' : `Step ${index + 1}`}
                                            </p>
                                        </div>

                                        {/* Connector arrow */}
                                        {index < dataflow.nodes.length - 1 && (
                                            <div className="flex-shrink-0 flex items-center text-slate-600">
                                                <div className="w-8 h-0.5 bg-slate-700" />
                                                <div className="w-0 h-0 border-t-[5px] border-b-[5px] border-l-[8px] border-transparent border-l-slate-700" />
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Config Panel */}
                {selectedNode && (
                    <div className="w-72 flex-shrink-0 border-l border-slate-800 p-4 overflow-y-auto">
                        {(() => {
                            const node = dataflow.nodes.find(n => n.id === selectedNode);
                            if (!node) return null;
                            const config = NODE_CONFIGS[node.type];

                            return (
                                <>
                                    <div className="flex items-center gap-3 mb-4">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                                            style={{ backgroundColor: config.color + '20' }}
                                        >
                                            {config.icon}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white">{node.name}</h3>
                                            <p className="text-xs text-slate-500">Configure this step</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        {config.configFields.map(field => (
                                            <div key={field.key}>
                                                <label className="block text-[10px] font-bold uppercase text-slate-500 tracking-wide mb-1.5">
                                                    {field.label}
                                                </label>
                                                {field.type === 'select' ? (
                                                    <select
                                                        value={node.config[field.key] || ''}
                                                        onChange={e => setDataflow(prev => ({
                                                            ...prev,
                                                            nodes: prev.nodes.map(n =>
                                                                n.id === node.id
                                                                    ? { ...n, config: { ...n.config, [field.key]: e.target.value } }
                                                                    : n
                                                            ),
                                                        }))}
                                                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:border-indigo-500 outline-none"
                                                    >
                                                        <option value="">Select...</option>
                                                        {field.options?.map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                ) : field.type === 'boolean' ? (
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!node.config[field.key]}
                                                            onChange={e => setDataflow(prev => ({
                                                                ...prev,
                                                                nodes: prev.nodes.map(n =>
                                                                    n.id === node.id
                                                                        ? { ...n, config: { ...n.config, [field.key]: e.target.checked } }
                                                                        : n
                                                                ),
                                                            }))}
                                                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <span className="text-sm text-slate-400">Enabled</span>
                                                    </label>
                                                ) : (
                                                    <input
                                                        type={field.type}
                                                        value={node.config[field.key] || ''}
                                                        onChange={e => setDataflow(prev => ({
                                                            ...prev,
                                                            nodes: prev.nodes.map(n =>
                                                                n.id === node.id
                                                                    ? { ...n, config: { ...n.config, [field.key]: e.target.value } }
                                                                    : n
                                                            ),
                                                        }))}
                                                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:border-indigo-500 outline-none"
                                                        placeholder={`Enter ${field.label.toLowerCase()}`}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataflowBuilder;
