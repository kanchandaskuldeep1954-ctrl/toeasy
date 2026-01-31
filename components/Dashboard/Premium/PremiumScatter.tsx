import React, { useMemo } from 'react';
import {
    ScatterChart,
    Scatter,
    XAxis,
    YAxis,
    ZAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { ChartSpec } from '../../../types';

interface PremiumScatterProps {
    chart: ChartSpec;
    data: any[];
    height?: number;
    activeFilter?: string | null;
    onClick?: (data: any) => void;
}

const THEME_PALETTES: any = {
    indigo: ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe'],
    emerald: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
    vibrant: ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#fecdd3'],
    minimal: ['#0f172a', '#1e293b', '#334155', '#475569', '#64748b']
};

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        const item = payload[0].payload;
        return (
            <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 p-4 rounded-2xl shadow-2xl min-w-[180px]">
                <p className="text-slate-400 text-[10px] uppercase tracking-widest font-black mb-2 border-b border-slate-800 pb-2">
                    {item.name || 'Data Point'}
                </p>
                <div className="space-y-2">
                    <div className="flex justify-between items-center gap-4">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">X-Axis</span>
                        <span className="text-sm font-mono text-white">{typeof item.x === 'number' ? item.x.toLocaleString() : item.x}</span>
                    </div>
                    <div className="flex justify-between items-center gap-4">
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Y-Axis</span>
                        <span className="text-sm font-mono text-indigo-400 font-bold">{typeof item.y === 'number' ? item.y.toLocaleString() : item.y}</span>
                    </div>
                    {item.z !== undefined && (
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Weight</span>
                            <span className="text-sm font-mono text-emerald-400">{item.z.toLocaleString()}</span>
                        </div>
                    )}
                </div>
            </div>
        );
    }
    return null;
};

export const PremiumScatter: React.FC<PremiumScatterProps> = ({ chart, data, height = 300, activeFilter, onClick }) => {
    const palette = THEME_PALETTES[chart.colorScheme as any] || THEME_PALETTES.indigo;

    const formattedData = useMemo(() => {
        if (!Array.isArray(data) || data.length === 0) return [];
        return data.map((d, idx) => ({
            name: d.name || d.label || `Point ${idx + 1}`,
            x: d.x ?? d.value,
            y: d.y ?? (d.value * 0.5), // Fallback
            z: d.size ?? d.z ?? 10,
        })).filter(d => !isNaN(Number(d.y)));
    }, [data]);

    const isBubble = chart.type === 'bubble';

    const trendLine = useMemo(() => {
        if (chart.chartConfig?.trendline !== 'ols' || formattedData.length < 2) return null;

        const xValues = formattedData.map(d => Number(d.x));
        const yValues = formattedData.map(d => Number(d.y));
        const n = formattedData.length;

        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        formattedData.forEach(d => {
            sumX += Number(d.x);
            sumY += Number(d.y);
            sumXY += Number(d.x) * Number(d.y);
            sumXX += Number(d.x) * Number(d.x);
        });

        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;

        const minX = Math.min(...xValues);
        const maxX = Math.max(...xValues);
        const futureX = maxX + (maxX - minX) * 0.4;

        return [
            { x: minX, y: slope * minX + intercept },
            { x: maxX, y: slope * maxX + intercept },
            { x: futureX, y: slope * futureX + intercept, isForecast: true }
        ];
    }, [formattedData, chart.chartConfig?.trendline]);

    return (
        <div style={{ width: '100%', height: height }} className="animate-in fade-in slide-in-from-bottom-2 duration-1000">
            <ResponsiveContainer>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <defs>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                        </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.05)" />
                    <XAxis
                        type="number"
                        dataKey="x"
                        name={chart.xAxis || 'X'}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        tickFormatter={(val) => Number(val).toLocaleString()}
                        domain={['auto', 'auto']}
                    />
                    <YAxis
                        type="number"
                        dataKey="y"
                        name={chart.yAxis || 'Y'}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        tickFormatter={(val) =>
                            new Intl.NumberFormat('en', { notation: "compact" }).format(val)
                        }
                        domain={['auto', 'auto']}
                    />
                    <ZAxis type="number" dataKey="z" range={[20, isBubble ? 400 : 100]} />
                    <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#6366f1', strokeOpacity: 0.2 }} content={<CustomTooltip />} />

                    {trendLine && (
                        <>
                            <Scatter
                                data={trendLine.slice(0, 2)}
                                line={{ stroke: '#f43f5e', strokeWidth: 2, strokeDasharray: '5 5' }}
                                shape={() => null}
                                tooltipType="none"
                            />
                            <Scatter
                                data={trendLine.slice(1)}
                                line={{ stroke: '#818cf8', strokeWidth: 3, strokeDasharray: '3 3' }}
                                shape={() => null}
                                tooltipType="none"
                            />
                        </>
                    )}

                    <Scatter
                        name={chart.title}
                        data={formattedData}
                        fill="#6366f1"
                        onClick={(data) => onClick && onClick({ activePayload: [{ payload: data }] })}
                    >
                        {formattedData.map((entry, index) => {
                            const isActive = !activeFilter || String(entry.name) === String(activeFilter);
                            return (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={palette[index % palette.length]}
                                    fillOpacity={isActive ? 0.8 : 0.1}
                                    stroke={isActive ? '#fff' : 'transparent'}
                                    strokeWidth={isActive ? 2 : 0}
                                    style={{ filter: isActive ? 'url(#glow)' : 'none' }}
                                />
                            );
                        })}
                    </Scatter>
                </ScatterChart>
            </ResponsiveContainer>
        </div>
    );
};
