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
                relative w-72 rounded-2xl border-2 transition-all duration-300 shadow-2xl overflow-hidden
                ${selected ? 'border-indigo-500 shadow-indigo-500/40 scale-[1.02]' : 'border-slate-800 bg-slate-900/95 backdrop-blur-md'}
                ${isRunning ? 'ring-4 ring-indigo-500/20' : ''}
                ${isFailed ? 'border-red-500/50' : ''}
                ${isCompleted ? 'border-emerald-500/50' : ''}
            `}
        >
            {/* Input Handles */}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 flex flex-col gap-4 pointer-events-none">
                {nodeConfig.inputs.map((input, idx) => (
                    <div key={input.id} className="relative flex items-center group">
                        <Handle
                            type="target"
                            id={input.id}
                            position={Position.Left}
                            className="!w-4 !h-4 !bg-slate-700 !border-2 !border-slate-900 hover:!bg-indigo-500 !static !translate-y-0 !cursor-crosshair pointer-events-auto"
                        />
                        <span className="absolute left-6 text-[9px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            {input.label}
                        </span>
                    </div>
                ))}
            </div>

            {/* Header */}
            <div
                className="p-4 flex items-center gap-4 border-b border-white/5"
                style={{
                    background: `linear-gradient(90deg, ${nodeConfig.color}15 0%, transparent 100%)`
                }}
            >
                <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-xl shrink-0"
                    style={{ backgroundColor: nodeConfig.color }}
                >
                    {isRunning ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <span>{nodeConfig.icon}</span>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-black text-white truncate tracking-tight">{name}</h3>
                    <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600" style={{ backgroundColor: isRunning ? '#6366f1' : isCompleted ? '#10b981' : isFailed ? '#ef4444' : '#475569' }}></span>
                        <p className="text-[9px] text-slate-500 truncate uppercase tracking-widest font-black">
                            {status || 'Standby'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="p-4 bg-slate-950/40 min-h-[60px]">
                <p className="text-[11px] font-medium text-slate-400 leading-relaxed line-clamp-2">
                    {description}
                </p>

                {/* Status Indicator for results */}
                {isCompleted && (
                    <div className="mt-3 flex items-center gap-2 px-2 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-tighter">Payload Ready</span>
                    </div>
                )}
            </div>

            {/* Output Handles */}
            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-4 pointer-events-none items-end">
                {nodeConfig.outputs.map((output, idx) => (
                    <div key={output.id} className="relative flex items-center group">
                        <span className="absolute right-6 text-[9px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                            {output.label}
                        </span>
                        <Handle
                            type="source"
                            id={output.id}
                            position={Position.Right}
                            className="!w-4 !h-4 !bg-slate-700 !border-2 !border-slate-900 hover:!bg-indigo-500 !static !translate-y-0 !cursor-crosshair pointer-events-auto"
                        />
                    </div>
                ))}
            </div>

            {/* Node Footer / ID */}
            <div className="px-4 py-2 flex justify-between items-center text-[8px] font-mono text-white/5 uppercase tracking-widest bg-black/20">
                <span>{type}</span>
                <span>#{data.id?.split('-').pop()}</span>
            </div>
        </div>
    );
};

export default memo(CustomNode);
