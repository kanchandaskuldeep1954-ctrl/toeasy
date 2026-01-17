/**
 * D3 Bar Chart Component
 * Interactive bar chart with animations, tooltips, and cross-filtering support
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
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

interface BarChartProps {
    data: DataPoint[];
    title?: string;
    xLabel?: string;
    yLabel?: string;
    color?: string;
    horizontal?: boolean;
    showValues?: boolean;
    onBarClick?: (item: DataPoint, index: number) => void;
    selectedItem?: string | null;
    height?: number;
    animate?: boolean;
}

const D3BarChart: React.FC<BarChartProps> = ({
    data,
    title,
    xLabel,
    yLabel,
    color = CHART_COLORS[0],
    horizontal = false,
    showValues = true,
    onBarClick,
    selectedItem,
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

        const margin = horizontal
            ? { top: 20, right: 30, bottom: 30, left: 100 }
            : { top: 20, right: 20, bottom: 60, left: 50 };

        const dim = computeDimensions(dimensions.width, dimensions.height, margin);

        // Create gradient
        createGradient(svg, 'barGradient', color, d3.color(color)!.darker(0.5).toString(), 'vertical');

        const g = svg
            .attr('width', dim.width)
            .attr('height', dim.height)
            .append('g')
            .attr('transform', `translate(${dim.marginLeft},${dim.marginTop})`);

        // Tooltip
        const tooltip = createTooltip();

        if (horizontal) {
            // Horizontal bar chart
            const x = d3.scaleLinear()
                .domain([0, d3.max(data, d => d.value) || 0])
                .range([0, dim.innerWidth]);

            const y = d3.scaleBand()
                .domain(data.map(d => d.label))
                .range([0, dim.innerHeight])
                .padding(0.3);

            // X axis
            g.append('g')
                .attr('transform', `translate(0,${dim.innerHeight})`)
                .call(d3.axisBottom(x).ticks(5).tickFormat(d => formatValue(d as number)))
                .selectAll('text')
                .attr('fill', '#94a3b8')
                .attr('font-size', '10px');

            // Y axis
            g.append('g')
                .call(d3.axisLeft(y))
                .selectAll('text')
                .attr('fill', '#94a3b8')
                .attr('font-size', '10px');

            // Bars
            const bars = g.selectAll('.bar')
                .data(data)
                .enter()
                .append('rect')
                .attr('class', 'bar')
                .attr('y', d => y(d.label) || 0)
                .attr('height', y.bandwidth())
                .attr('x', 0)
                .attr('rx', 4)
                .attr('fill', d => selectedItem === d.label ? d3.color(color)!.brighter(0.3).toString() : color)
                .attr('opacity', d => selectedItem && selectedItem !== d.label ? 0.4 : 1)
                .attr('cursor', onBarClick ? 'pointer' : 'default')
                .on('mouseover', function (event, d) {
                    d3.select(this).attr('fill', d3.color(color)!.brighter(0.3).toString());
                    showTooltip(tooltip, event, `
            <div style="font-weight:800; margin-bottom:4px;">${d.label}</div>
            <div style="color:#6366f1; font-size:16px;">${formatValue(d.value)}</div>
          `);
                })
                .on('mouseout', function (event, d) {
                    d3.select(this).attr('fill', selectedItem === d.label ? d3.color(color)!.brighter(0.3).toString() : color);
                    hideTooltip(tooltip);
                })
                .on('click', function (event, d) {
                    if (onBarClick) onBarClick(d, data.indexOf(d));
                });

            // Animate bars
            if (animate) {
                bars
                    .attr('width', 0)
                    .transition()
                    .duration(800)
                    .delay((d, i) => i * 50)
                    .attr('width', d => x(d.value));
            } else {
                bars.attr('width', d => x(d.value));
            }

            // Value labels
            if (showValues) {
                g.selectAll('.value-label')
                    .data(data)
                    .enter()
                    .append('text')
                    .attr('class', 'value-label')
                    .attr('x', d => x(d.value) + 5)
                    .attr('y', d => (y(d.label) || 0) + y.bandwidth() / 2)
                    .attr('dy', '0.35em')
                    .attr('fill', '#94a3b8')
                    .attr('font-size', '10px')
                    .attr('font-weight', '600')
                    .text(d => formatValue(d.value))
                    .attr('opacity', 0)
                    .transition()
                    .delay(800)
                    .attr('opacity', 1);
            }

        } else {
            // Vertical bar chart
            const x = d3.scaleBand()
                .domain(data.map(d => d.label))
                .range([0, dim.innerWidth])
                .padding(0.3);

            const y = d3.scaleLinear()
                .domain([0, d3.max(data, d => d.value) || 0])
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

            // Bars
            const bars = g.selectAll('.bar')
                .data(data)
                .enter()
                .append('rect')
                .attr('class', 'bar')
                .attr('x', d => x(d.label) || 0)
                .attr('width', x.bandwidth())
                .attr('y', dim.innerHeight)
                .attr('rx', 4)
                .attr('fill', 'url(#barGradient)')
                .attr('opacity', d => selectedItem && selectedItem !== d.label ? 0.4 : 1)
                .attr('cursor', onBarClick ? 'pointer' : 'default')
                .on('mouseover', function (event, d) {
                    d3.select(this).attr('fill', d3.color(color)!.brighter(0.3).toString());
                    showTooltip(tooltip, event, `
            <div style="font-weight:800; margin-bottom:4px;">${d.label}</div>
            <div style="color:#6366f1; font-size:16px;">${formatValue(d.value)}</div>
          `);
                })
                .on('mouseout', function (event, d) {
                    d3.select(this).attr('fill', 'url(#barGradient)');
                    hideTooltip(tooltip);
                })
                .on('click', function (event, d) {
                    if (onBarClick) onBarClick(d, data.indexOf(d));
                });

            // Animate bars
            if (animate) {
                bars
                    .transition()
                    .duration(800)
                    .delay((d, i) => i * 50)
                    .attr('y', d => y(d.value))
                    .attr('height', d => dim.innerHeight - y(d.value));
            } else {
                bars
                    .attr('y', d => y(d.value))
                    .attr('height', d => dim.innerHeight - y(d.value));
            }

            // Value labels on top
            if (showValues) {
                g.selectAll('.value-label')
                    .data(data)
                    .enter()
                    .append('text')
                    .attr('class', 'value-label')
                    .attr('x', d => (x(d.label) || 0) + x.bandwidth() / 2)
                    .attr('y', d => y(d.value) - 5)
                    .attr('text-anchor', 'middle')
                    .attr('fill', '#94a3b8')
                    .attr('font-size', '10px')
                    .attr('font-weight', '600')
                    .text(d => formatValue(d.value))
                    .attr('opacity', 0)
                    .transition()
                    .delay(800)
                    .attr('opacity', 1);
            }
        }

        // Cleanup tooltip on unmount
        return () => {
            tooltip.remove();
        };
    }, [data, dimensions, color, horizontal, showValues, onBarClick, selectedItem, animate]);

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

    // Draw chart when data or dimensions change
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

export default D3BarChart;
