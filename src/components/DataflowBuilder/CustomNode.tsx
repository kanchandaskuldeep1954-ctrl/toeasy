import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { NODE_CONFIGS, DataflowNodeType } from './dataflowTypes';

const CustomNode = ({ data, selected }: NodeProps) => {
    const { type, name, description, status, config } = data;
    const nodeConfig = NODE_CONFIGS[type as DataflowNodeType];
    const isRunning = status === 'running';
    const isCompleted = status === 'completed';
    const isFailed = status === 'failed';

    return (
        <div
            className={`
                relative w-64 rounded-xl border-2 transition-all duration-300 shadow-xl overflow-hidden
                ${selected ? 'border-indigo-500 shadow-indigo-500/30 scale-105' : 'border-slate-700 bg-slate-900/95'}
                ${isRunning ? 'ring-2 ring-yellow-400/50' : ''}
                ${isFailed ? 'border-red-500/50' : ''}
                ${isCompleted ? 'border-emerald-500/50' : ''}
            `}
        >
            {/* Input Handle */}
            {type !== 'upload' && (
                <Handle
                    type="target"
                    position={Position.Left}
                    className="!w-3 !h-3 !bg-slate-400 !border-2 !border-slate-900 hover:!bg-indigo-500 transition-colors"
                />
            )}

            {/* Header */}
            <div
                className="p-3 flex items-center gap-3 border-b border-white/5"
                style={{
                    background: `linear-gradient(90deg, ${nodeConfig.color}20 0%, transparent 100%)`
                }}
            >
                <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lg shadow-lg"
                    style={{ backgroundColor: nodeConfig.color }}
                >
                    {isRunning ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        nodeConfig.icon
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-white truncate">{name}</h3>
                    <p className="text-[10px] text-slate-400 truncate uppercase tracking-wider font-semibold">
                        {status || 'Pending'}
                    </p>
                </div>
            </div>

            {/* Body */}
            <div className="p-3 bg-slate-900/50">
                <p className="text-xs text-slate-400 line-clamp-2 mb-2">
                    {description}
                </p>

                {/* Visual indicator for config */}
                {Object.keys(config).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(config).slice(0, 2).map(([key, val]) => (
                            <span key={key} className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-300 border border-slate-700">
                                {key}: {String(val)}
                            </span>
                        ))}
                        {Object.keys(config).length > 2 && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-800 text-slate-500">
                                +{Object.keys(config).length - 2}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Output Handle */}
            {type !== 'export' && (
                <Handle
                    type="source"
                    position={Position.Right}
                    className="!w-3 !h-3 !bg-slate-400 !border-2 !border-slate-900 hover:!bg-indigo-500 transition-colors"
                />
            )}
        </div>
    );
};

export default memo(CustomNode);
