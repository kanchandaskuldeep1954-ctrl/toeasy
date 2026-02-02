/**
 * D3 Line Chart Component
 * Interactive line/area chart with animations, tooltips, and zoom
 * Now with Data Guardian Layer for reliability
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import {
    DataPoint,
    CHART_COLORS,
    computeDimensions,
    formatValue,
    createTooltip,
    showTooltip,
    hideTooltip,
    createGradient
} from './chartUtils';
import { EmptyChartState } from './EmptyChartState';
import { sanitizeForChart, getQualityBadge } from '../../utils/dataGuardian';

interface LineChartProps {
    data: DataPoint[];
    title?: string;
    xLabel?: string;
    yLabel?: string;
    color?: string;
    showArea?: boolean;
    showDots?: boolean;
    curved?: boolean;
    onPointClick?: (item: DataPoint, index: number) => void;
    height?: number;
    animate?: boolean;
}

const D3LineChart: React.FC<LineChartProps> = ({
    data,
    title,
    xLabel,
    yLabel,
    color = CHART_COLORS[0],
    showArea = true,
    showDots = true,
    curved = true,
    onPointClick,
    height = 300,
    animate = true,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: height });

    // Data Guardian: Sanitize incoming data
    const { sanitizedData, quality, hasIssues } = useMemo(() => {
        const result = sanitizeForChart(data, 'label', 'value', { removeInvalid: true, maxItems: 100 });
        return {
            sanitizedData: result.data.map(d => ({ label: d.label, value: d.value, type: d.originalRow?.type })) as DataPoint[],
            quality: result.quality,
            hasIssues: result.hasIssues
        };
    }, [data]);

    if (!sanitizedData || sanitizedData.length === 0) {
        return <EmptyChartState height={height} message="No valid data for Line Chart" />;
    }

    const drawChart = useCallback(() => {
        if (!svgRef.current || dimensions.width === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const margin = { top: 20, right: 30, bottom: 50, left: 50 };
        const dim = computeDimensions(dimensions.width, dimensions.height, margin);

        // Create gradient for area
        createGradient(svg, 'areaGradient', color, color, 'vertical');
        svg.select('#areaGradient stop:first-child').attr('stop-opacity', 0.4);
        svg.select('#areaGradient stop:last-child').attr('stop-opacity', 0.05);

        const g = svg
            .attr('width', dim.width)
            .attr('height', dim.height)
            .append('g')
            .attr('transform', `translate(${dim.marginLeft},${dim.marginTop})`);

        // Tooltip
        const tooltip = createTooltip();

        // Scales
        const x = d3.scalePoint()
            .domain(sanitizedData.map((d: DataPoint) => d.label))
            .range([0, dim.innerWidth])
            .padding(0.5);

        const y = d3.scaleLinear()
            .domain([0, d3.max(sanitizedData, (d: DataPoint) => d.value) || 0])
            .nice()
            .range([dim.innerHeight, 0]);

        // Grid lines
        g.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(y).tickSize(-dim.innerWidth).tickFormat(() => ''))
            .selectAll('line')
            .attr('stroke', '#334155')
            .attr('stroke-opacity', 0.3);

        // X axis
        g.append('g')
            .attr('transform', `translate(0,${dim.innerHeight})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .attr('fill', '#94a3b8')
            .attr('font-size', '10px')
            .attr('transform', 'rotate(-35)')
            .attr('text-anchor', 'end');

        // Y axis
        g.append('g')
            .call(d3.axisLeft(y).ticks(5).tickFormat(d => formatValue(d as number)))
            .selectAll('text')
            .attr('fill', '#94a3b8')
            .attr('font-size', '10px');

        // Logic to split data into "Solid" (Historical) and "Dashed" (Forecast)
        // We find the transition point where type changes to 'forecast'
        const forecastIndex = sanitizedData.findIndex(d => d.type === 'forecast');

        let solidData = sanitizedData;
        let dashedData: DataPoint[] = [];

        if (forecastIndex > 0) {
            // Include the point *before* the forecast starts to ensure connection
            solidData = sanitizedData.slice(0, forecastIndex + 1); // Historical + 1 overlap
            dashedData = sanitizedData.slice(forecastIndex - 1);   // Overlap + Forecast
        }

        // Line generator
        const lineGenerator = d3.line<DataPoint>()
            .x((d: DataPoint) => x(d.label) || 0)
            .y((d: DataPoint) => y(d.value));

        if (curved) {
            lineGenerator.curve(d3.curveMonotoneX);
        }

        // Area generator (Only for solid part usually, or full if desired. Let's do full for now but lighter)
        const areaGenerator = d3.area<DataPoint>()
            .x((d: DataPoint) => x(d.label) || 0)
            .y0(dim.innerHeight)
            .y1((d: DataPoint) => y(d.value));

        if (curved) {
            areaGenerator.curve(d3.curveMonotoneX);
        }

        // Draw area (Full data for continuity)
        if (showArea) {
            const area = g.append('path')
                .datum(sanitizedData)
                .attr('fill', 'url(#areaGradient)')
                .attr('d', areaGenerator);

            if (animate) {
                area
                    .attr('opacity', 0)
                    .transition()
                    .duration(1000)
                    .attr('opacity', 1);
            }
        }

        // Help draw a path with animation
        const drawPath = (pathData: DataPoint[], isDashed: boolean) => {
            const path = g.append('path')
                .datum(pathData)
                .attr('fill', 'none')
                .attr('stroke', isDashed ? '#94a3b8' : color) // Slate-400 for forecast, Main color for history
                .attr('stroke-width', 3)
                .attr('stroke-linecap', 'round')
                .attr('stroke-linejoin', 'round')
                .attr('stroke-dasharray', isDashed ? '6, 6' : 'none')
                .attr('d', lineGenerator);

            if (animate) {
                const totalLength = path.node()?.getTotalLength() || 0;

                if (isDashed) {
                    // For dashed, simple fade in is often better than draw animation which messes up dashes
                    path.attr('opacity', 0)
                        .transition()
                        .delay(1000) // Wait for main line
                        .duration(800)
                        .attr('opacity', 1);
                } else {
                    path
                        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
                        .attr('stroke-dashoffset', totalLength)
                        .transition()
                        .duration(1500)
                        .ease(d3.easeQuadOut)
                        .attr('stroke-dashoffset', 0);
                }
            }
        };

        if (forecastIndex > 0) {
            drawPath(solidData, false);
            drawPath(dashedData, true);
        } else {
            drawPath(sanitizedData, false);
        }

        // Draw dots
        if (showDots) {
            const dots = g.selectAll('.dot')
                .data(sanitizedData)
                .enter()
                .append('circle')
                .attr('class', 'dot')
                .attr('cx', (d: any) => x(d.label) || 0) // Cast to any or DataPoint to avoid unknown
                .attr('cy', (d: any) => y(d.value))
                .attr('r', 0)
                .attr('fill', '#0f172a')
                .attr('stroke', color)
                .attr('stroke-width', 3)
                .attr('cursor', onPointClick ? 'pointer' : 'default')
                .on('mouseover', function (event, d: any) { // Type d as any or DataPoint
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr('r', 8)
                        .attr('fill', color);
                    showTooltip(tooltip, event, `
            <div style="font-weight:800; margin-bottom:4px;">${d.label}</div>
            <div style="color:#6366f1; font-size:16px;">${formatValue(d.value)}</div>
          `);
                })
                .on('mouseout', function () {
                    d3.select(this)
                        .transition()
                        .duration(200)
                        .attr('r', 5)
                        .attr('fill', '#0f172a');
                    hideTooltip(tooltip);
                })
                .on('click', function (event, d: any) {
                    if (onPointClick) onPointClick(d, sanitizedData.indexOf(d));
                });

            // Animate dots
            if (animate) {
                dots
                    .transition()
                    .duration(400)
                    .delay((d: any, i: number) => 1200 + i * 50)
                    .attr('r', 5);
            } else {
                dots.attr('r', 5);
            }
        }

        return () => {
            tooltip.remove();
        };
    }, [data, dimensions, color, showArea, showDots, curved, onPointClick, animate]);

    // Resize observer
    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver(entries => {
            const { width } = entries[0].contentRect;
            setDimensions(prev => ({ ...prev, width }));
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    useEffect(() => {
        drawChart();
    }, [drawChart]);

    return (
        <div ref={containerRef} className="w-full h-full relative">
            {title && (
                <div className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                    {title}
                    {hasIssues && (
                        <span
                            className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 cursor-help"
                            title={`Data Quality: ${quality.qualityScore}% - ${quality.warnings.join(', ')}`}
                        >
                            {getQualityBadge(quality.qualityLevel).emoji} {quality.qualityScore}%
                        </span>
                    )}
                </div>
            )}
            <svg ref={svgRef} className="w-full" style={{ height }} />
        </div>
    );
};

export default D3LineChart;
