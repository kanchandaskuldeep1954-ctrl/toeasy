/**
 * D3 Chart Utilities
 * Shared helpers for all D3 chart components
 */

import * as d3 from 'd3';

export interface ChartDimensions {
    width: number;
    height: number;
    marginTop: number;
    marginRight: number;
    marginBottom: number;
    marginLeft: number;
    innerWidth: number;
    innerHeight: number;
}

export interface DataPoint {
    label: string;
    value: number;
    [key: string]: any;
}

// Premium color palette
export const CHART_COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#14b8a6', // Teal
    '#f97316', // Orange
    '#3b82f6', // Blue
];

export const CHART_GRADIENTS = {
    indigo: ['#6366f1', '#4f46e5'],
    emerald: ['#10b981', '#059669'],
    amber: ['#f59e0b', '#d97706'],
    rose: ['#f43f5e', '#e11d48'],
};

/**
 * Calculate chart dimensions with margins
 */
export function computeDimensions(
    containerWidth: number,
    containerHeight: number,
    margins = { top: 20, right: 20, bottom: 40, left: 50 }
): ChartDimensions {
    return {
        width: containerWidth,
        height: containerHeight,
        marginTop: margins.top,
        marginRight: margins.right,
        marginBottom: margins.bottom,
        marginLeft: margins.left,
        innerWidth: containerWidth - margins.left - margins.right,
        innerHeight: containerHeight - margins.top - margins.bottom,
    };
}

/**
 * Format large numbers for display
 */
export function formatValue(value: number): string {
    if (Math.abs(value) >= 1e9) return (value / 1e9).toFixed(1) + 'B';
    if (Math.abs(value) >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (Math.abs(value) >= 1e3) return (value / 1e3).toFixed(1) + 'K';
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

/**
 * Create gradient definitions for SVG
 */
export function createGradient(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    id: string,
    color1: string,
    color2: string,
    direction: 'vertical' | 'horizontal' = 'vertical'
): void {
    const gradient = svg.append('defs')
        .append('linearGradient')
        .attr('id', id)
        .attr('x1', '0%')
        .attr('y1', direction === 'vertical' ? '0%' : '0%')
        .attr('x2', direction === 'vertical' ? '0%' : '100%')
        .attr('y2', direction === 'vertical' ? '100%' : '0%');

    gradient.append('stop')
        .attr('offset', '0%')
        .attr('stop-color', color1)
        .attr('stop-opacity', 1);

    gradient.append('stop')
        .attr('offset', '100%')
        .attr('stop-color', color2)
        .attr('stop-opacity', 0.7);
}

/**
 * Create tooltip element
 */
export function createTooltip(): d3.Selection<HTMLDivElement, unknown, HTMLElement, any> {
    // Remove existing tooltip
    d3.select('body').selectAll('.d3-tooltip').remove();

    return d3.select('body')
        .append('div')
        .attr('class', 'd3-tooltip')
        .style('position', 'absolute')
        .style('visibility', 'hidden')
        .style('background', 'rgba(15, 23, 42, 0.95)')
        .style('color', '#f8fafc')
        .style('padding', '12px 16px')
        .style('border-radius', '12px')
        .style('font-size', '12px')
        .style('font-weight', '600')
        .style('box-shadow', '0 10px 40px rgba(0,0,0,0.3)')
        .style('border', '1px solid rgba(99, 102, 241, 0.3)')
        .style('pointer-events', 'none')
        .style('z-index', '9999')
        .style('backdrop-filter', 'blur(8px)');
}

/**
 * Show tooltip
 */
export function showTooltip(
    tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>,
    event: MouseEvent,
    content: string
): void {
    tooltip
        .style('visibility', 'visible')
        .html(content)
        .style('left', (event.pageX + 15) + 'px')
        .style('top', (event.pageY - 10) + 'px');
}

/**
 * Hide tooltip
 */
export function hideTooltip(
    tooltip: d3.Selection<HTMLDivElement, unknown, HTMLElement, any>
): void {
    tooltip.style('visibility', 'hidden');
}

/**
 * Animate on load with stagger
 */
export function animateElements(
    selection: d3.Selection<any, any, any, any>,
    duration: number = 800,
    staggerDelay: number = 50
): void {
    selection
        .attr('opacity', 0)
        .transition()
        .duration(duration)
        .delay((d: any, i: number) => i * staggerDelay)
        .attr('opacity', 1);
}

/**
 * Responsive resize handler
 */
export function useResizeObserver(
    ref: React.RefObject<HTMLElement>,
    callback: (width: number, height: number) => void
): void {
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(entries => {
        if (!entries.length) return;
        const { width, height } = entries[0].contentRect;
        callback(width, height);
    });

    if (ref.current) {
        observer.observe(ref.current);
    }
}

export default {
    CHART_COLORS,
    CHART_GRADIENTS,
    computeDimensions,
    formatValue,
    createGradient,
    createTooltip,
    showTooltip,
    hideTooltip,
    animateElements,
};
