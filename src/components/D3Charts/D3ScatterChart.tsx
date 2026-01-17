/**
 * D3 Scatter Plot Component
 * Interactive scatter/bubble chart with zoom, tooltips, and brushing
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import {
    CHART_COLORS,
    formatValue,
    createTooltip,
    showTooltip,
    hideTooltip
} from './chartUtils';

interface ScatterDataPoint {
    x: number;
    y: number;
    z?: number; // For bubble size
    label?: string;
    category?: string;
    [key: string]: any;
}

interface ScatterChartProps {
    data: ScatterDataPoint[];
    title?: string;
    xLabel?: string;
    yLabel?: string;
    showBubbles?: boolean; // Use z-value for bubble size
    colorByCategory?: boolean;
    onPointClick?: (item: ScatterDataPoint, index: number) => void;
    height?: number;
    animate?: boolean;
}

const D3ScatterChart: React.FC<ScatterChartProps> = ({
    data,
    title,
    xLabel,
    yLabel,
    showBubbles = false,
    colorByCategory = false,
    onPointClick,
    height = 300,
    animate = true,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const [dimensions, setDimensions] = useState({ width: 0, height: height });

    const drawChart = useCallback(() => {
        if (!svgRef.current || !data || data.length === 0 || dimensions.width === 0) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const margin = { top: 20, right: 30, bottom: 50, left: 50 };
        const innerWidth = dimensions.width - margin.left - margin.right;
        const innerHeight = dimensions.height - margin.top - margin.bottom;

        const g = svg
            .attr('width', dimensions.width)
            .attr('height', dimensions.height)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Tooltip
        const tooltip = createTooltip();

        // Scales
        const xExtent = d3.extent(data, d => d.x) as [number, number];
        const yExtent = d3.extent(data, d => d.y) as [number, number];

        const x = d3.scaleLinear()
            .domain([xExtent[0] * 0.9, xExtent[1] * 1.1])
            .range([0, innerWidth]);

        const y = d3.scaleLinear()
            .domain([yExtent[0] * 0.9, yExtent[1] * 1.1])
            .range([innerHeight, 0]);

        // Size scale for bubbles
        const zExtent = d3.extent(data, d => d.z || 100) as [number, number];
        const sizeScale = d3.scaleSqrt()
            .domain(zExtent)
            .range([5, 30]);

        // Color scale for categories
        const categories = Array.from(new Set(data.map(d => d.category || 'default')));
        const colorScale = d3.scaleOrdinal<string>()
            .domain(categories)
            .range(CHART_COLORS);

        // Grid lines
        g.append('g')
            .attr('class', 'grid')
            .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => ''))
            .selectAll('line')
            .attr('stroke', '#334155')
            .attr('stroke-opacity', 0.3);

        g.append('g')
            .attr('class', 'grid')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x).tickSize(-innerHeight).tickFormat(() => ''))
            .selectAll('line')
            .attr('stroke', '#334155')
            .attr('stroke-opacity', 0.3);

        // X axis
        g.append('g')
            .attr('transform', `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x).ticks(6).tickFormat(d => formatValue(d as number)))
            .selectAll('text')
            .attr('fill', '#94a3b8')
            .attr('font-size', '10px');

        // X axis label
        if (xLabel) {
            g.append('text')
                .attr('x', innerWidth / 2)
                .attr('y', innerHeight + 40)
                .attr('text-anchor', 'middle')
                .attr('fill', '#64748b')
                .attr('font-size', '11px')
                .text(xLabel);
        }

        // Y axis
        g.append('g')
            .call(d3.axisLeft(y).ticks(5).tickFormat(d => formatValue(d as number)))
            .selectAll('text')
            .attr('fill', '#94a3b8')
            .attr('font-size', '10px');

        // Y axis label
        if (yLabel) {
            g.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('x', -innerHeight / 2)
                .attr('y', -40)
                .attr('text-anchor', 'middle')
                .attr('fill', '#64748b')
                .attr('font-size', '11px')
                .text(yLabel);
        }

        // Draw points
        const points = g.selectAll('.point')
            .data(data)
            .enter()
            .append('circle')
            .attr('class', 'point')
            .attr('cx', d => x(d.x))
            .attr('cy', d => y(d.y))
            .attr('r', 0)
            .attr('fill', d => colorByCategory ? colorScale(d.category || 'default') : CHART_COLORS[0])
            .attr('fill-opacity', 0.7)
            .attr('stroke', '#0f172a')
            .attr('stroke-width', 1)
            .attr('cursor', onPointClick ? 'pointer' : 'default')
            .on('mouseover', function (event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('r', showBubbles ? sizeScale(d.z || 100) * 1.2 : 10)
                    .attr('fill-opacity', 1);

                showTooltip(tooltip, event, `
          <div style="font-weight:800; margin-bottom:4px;">${d.label || 'Point'}</div>
          <div style="display:flex; gap:12px; margin-top:4px;">
            <span>X: <strong>${formatValue(d.x)}</strong></span>
            <span>Y: <strong>${formatValue(d.y)}</strong></span>
          </div>
          ${d.z ? `<div style="color:#94a3b8; margin-top:4px;">Size: ${formatValue(d.z)}</div>` : ''}
          ${d.category ? `<div style="color:${colorScale(d.category)}; margin-top:4px;">${d.category}</div>` : ''}
        `);
            })
            .on('mouseout', function (event, d) {
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr('r', showBubbles ? sizeScale(d.z || 100) : 6)
                    .attr('fill-opacity', 0.7);
                hideTooltip(tooltip);
            })
            .on('click', function (event, d) {
                if (onPointClick) onPointClick(d, data.indexOf(d));
            });

        // Animate points
        if (animate) {
            points
                .transition()
                .duration(800)
                .delay((d, i) => i * 10)
                .attr('r', d => showBubbles ? sizeScale(d.z || 100) : 6);
        } else {
            points.attr('r', d => showBubbles ? sizeScale(d.z || 100) : 6);
        }

        // Legend for categories
        if (colorByCategory && categories.length > 1) {
            const legend = svg.append('g')
                .attr('transform', `translate(${dimensions.width - 100}, 20)`);

            categories.forEach((cat, i) => {
                const legendItem = legend.append('g')
                    .attr('transform', `translate(0, ${i * 20})`);

                legendItem.append('circle')
                    .attr('r', 5)
                    .attr('fill', colorScale(cat));

                legendItem.append('text')
                    .attr('x', 12)
                    .attr('y', 4)
                    .attr('fill', '#94a3b8')
                    .attr('font-size', '10px')
                    .text(cat);
            });
        }

        return () => {
            tooltip.remove();
        };
    }, [data, dimensions, xLabel, yLabel, showBubbles, colorByCategory, onPointClick, animate]);

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
        <div ref={containerRef} className="w-full h-full">
            {title && (
                <div className="text-sm font-bold text-slate-300 mb-2">{title}</div>
            )}
            <svg ref={svgRef} className="w-full" style={{ height }} />
        </div>
    );
};

export default D3ScatterChart;
