/**
 * D3 Pie/Donut Chart Component
 * Interactive pie chart with animations, tooltips, and labels
 * Now with Data Guardian Layer for reliability
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import {
    DataPoint,
    CHART_COLORS,
    formatValue,
    createTooltip,
    showTooltip,
    hideTooltip
} from './chartUtils';
import { sanitizeForChart, getQualityBadge } from '../../utils/dataGuardian';

interface PieChartProps {
    data: DataPoint[];
    title?: string;
    donut?: boolean;
    showLabels?: boolean;
    showLegend?: boolean;
    onSliceClick?: (item: DataPoint, index: number) => void;
    selectedItem?: string | null;
    height?: number;
    animate?: boolean;
}

const D3PieChart: React.FC<PieChartProps> = ({
    data,
    title,
    donut = false,
    showLabels = true,
    showLegend = true,
    onSliceClick,
    selectedItem,
    height = 300,
    animate = true,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: height });

    // Data Guardian: Sanitize incoming data
    const { sanitizedData, quality, hasIssues } = useMemo(() => {
        const result = sanitizeForChart(data, 'label', 'value', { removeInvalid: true, maxItems: 20 });
        return {
            sanitizedData: result.data.map(d => ({ label: d.label, value: d.value })) as DataPoint[],
            quality: result.quality,
            hasIssues: result.hasIssues
        };
    }, [data]);

    const drawChart = useCallback(() => {
        if (!svgRef.current || !sanitizedData || sanitizedData.length === 0 || dimensions.width === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const legendWidth = showLegend ? 120 : 0;
        const chartWidth = dimensions.width - legendWidth;
        const radius = Math.min(chartWidth, dimensions.height) / 2 - 20;
        const innerRadius = donut ? radius * 0.55 : 0;

        const g = svg
            .attr('width', dimensions.width)
            .attr('height', dimensions.height)
            .append('g')
            .attr('transform', `translate(${chartWidth / 2},${dimensions.height / 2})`);

        // Tooltip
        const tooltip = createTooltip();

        // Color scale
        const colorScale = d3.scaleOrdinal<string>()
            .domain(sanitizedData.map(d => d.label))
            .range(CHART_COLORS);

        // Pie generator
        const pie = d3.pie<DataPoint>()
            .value(d => d.value)
            .sort(null)
            .padAngle(0.02);

        // Arc generator
        const arc = d3.arc<d3.PieArcDatum<DataPoint>>()
            .innerRadius(innerRadius)
            .outerRadius(radius)
            .cornerRadius(4);

        // Hover arc (slightly larger)
        const arcHover = d3.arc<d3.PieArcDatum<DataPoint>>()
            .innerRadius(innerRadius)
            .outerRadius(radius + 10)
            .cornerRadius(4);

        // Label arc
        const labelArc = d3.arc<d3.PieArcDatum<DataPoint>>()
            .innerRadius(radius * 0.7)
            .outerRadius(radius * 0.7);

        // Draw slices
        const slices = g.selectAll('.slice')
            .data(pie(sanitizedData))
            .enter()
            .append('g')
            .attr('class', 'slice');

        const paths = slices.append('path')
            .attr('fill', d => colorScale(d.data.label))
            .attr('stroke', '#0f172a')
            .attr('stroke-width', 2)
            .attr('opacity', d => selectedItem && selectedItem !== d.data.label ? 0.4 : 1)
            .attr('cursor', onSliceClick ? 'pointer' : 'default')
            .on('mouseover', function (event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('d', arcHover);
                showTooltip(tooltip, event, `
          <div style="font-weight:800; margin-bottom:4px;">${d.data.label}</div>
          <div style="color:${colorScale(d.data.label)}; font-size:16px;">${formatValue(d.data.value)}</div>
          <div style="color:#94a3b8; font-size:11px; margin-top:4px;">
            ${((d.endAngle - d.startAngle) / (2 * Math.PI) * 100).toFixed(1)}% of total
          </div>
        `);
            })
            .on('mouseout', function () {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('d', arc);
                hideTooltip(tooltip);
            })
            .on('click', function (event, d) {
                if (onSliceClick) onSliceClick(d.data, sanitizedData.indexOf(d.data));
            });

        // Animate slices
        if (animate) {
            paths
                .transition()
                .duration(1000)
                .attrTween('d', function (d) {
                    const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
                    return function (t) {
                        return arc(interpolate(t)) || '';
                    };
                });
        } else {
            paths.attr('d', arc);
        }

        // Labels
        if (showLabels && !donut) {
            slices.append('text')
                .attr('transform', d => `translate(${labelArc.centroid(d)})`)
                .attr('text-anchor', 'middle')
                .attr('fill', '#f8fafc')
                .attr('font-size', '10px')
                .attr('font-weight', '700')
                .text(d => {
                    const percent = ((d.endAngle - d.startAngle) / (2 * Math.PI) * 100);
                    return percent > 5 ? `${percent.toFixed(0)}%` : '';
                })
                .attr('opacity', 0)
                .transition()
                .delay(animate ? 1000 : 0)
                .attr('opacity', 1);
        }

        // Center text for donut
        if (donut) {
            const total = sanitizedData.reduce((sum, d) => sum + d.value, 0);
            g.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', '-0.5em')
                .attr('fill', '#94a3b8')
                .attr('font-size', '11px')
                .attr('font-weight', '600')
                .text('TOTAL');

            g.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', '0.8em')
                .attr('fill', '#f8fafc')
                .attr('font-size', '20px')
                .attr('font-weight', '800')
                .text(formatValue(total));
        }

        // Legend
        if (showLegend) {
            const legend = svg.append('g')
                .attr('transform', `translate(${chartWidth + 10}, 30)`);

            const legendItems = legend.selectAll('.legend-item')
                .data(sanitizedData)
                .enter()
                .append('g')
                .attr('class', 'legend-item')
                .attr('transform', (d, i) => `translate(0, ${i * 22})`)
                .attr('cursor', 'pointer')
                .attr('opacity', d => selectedItem && selectedItem !== d.label ? 0.4 : 1)
                .on('click', function (event, d) {
                    if (onSliceClick) onSliceClick(d, sanitizedData.indexOf(d));
                });

            legendItems.append('rect')
                .attr('width', 12)
                .attr('height', 12)
                .attr('rx', 3)
                .attr('fill', d => colorScale(d.label));

            legendItems.append('text')
                .attr('x', 18)
                .attr('y', 10)
                .attr('fill', '#94a3b8')
                .attr('font-size', '10px')
                .text(d => d.label.length > 12 ? d.label.substring(0, 10) + '...' : d.label);
        }

        return () => {
            tooltip.remove();
        };
    }, [data, dimensions, donut, showLabels, showLegend, onSliceClick, selectedItem, animate]);

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

export default D3PieChart;
