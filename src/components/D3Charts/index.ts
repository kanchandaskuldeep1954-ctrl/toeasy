/**
 * D3 Charts - Barrel Export
 * 
 * All D3 chart components and utilities exported from a single location
 */

// Utilities
export { default as chartUtils, CHART_COLORS, CHART_GRADIENTS, formatValue } from './chartUtils';
export type { DataPoint, ChartDimensions } from './chartUtils';

// Chart Components
export { default as D3BarChart } from './D3BarChart';
export { default as D3LineChart } from './D3LineChart';
export { default as D3PieChart } from './D3PieChart';
export { default as D3ScatterChart } from './D3ScatterChart';

// Re-export all as named exports for convenience
import D3BarChart from './D3BarChart';
import D3LineChart from './D3LineChart';
import D3PieChart from './D3PieChart';
import D3ScatterChart from './D3ScatterChart';

export const D3Charts = {
    BarChart: D3BarChart,
    LineChart: D3LineChart,
    PieChart: D3PieChart,
    ScatterChart: D3ScatterChart,
};

export default D3Charts;
