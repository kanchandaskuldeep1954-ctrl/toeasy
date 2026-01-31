import React from 'react';
import { PlotlyChart } from './PlotlyChart';
import { PremiumBar } from './Premium/PremiumBar';
import { PremiumLine } from './Premium/PremiumLine';
import { PremiumPie } from './Premium/PremiumPie';
import { ChartSpec } from '../../types';

interface SmartChartProps {
    chart: ChartSpec;
    data?: any[];
    height?: number;
    activeFilter?: string | null;
    onClick?: (data: any) => void;
}

export const SmartChart: React.FC<SmartChartProps> = (props) => {
    const { chart } = props;

    // Normalize type
    const type = chart.type?.toLowerCase() || 'bar';

    // Route to Premium Engine (Recharts) for Standard BI Charts
    if (type === 'bar' || type === 'bar-horizontal' || type === 'bar_horizontal') {
        return <PremiumBar {...props} />;
    }

    if (type === 'line' || type === 'area') {
        return <PremiumLine {...props} />;
    }

    if (type === 'pie' || type === 'donut' || type === 'doughnut') {
        return <PremiumPie {...props} />;
    }

    // Default: Return Plotly for Scientific/Complex Charts (Scatter, Heatmap, 3D, etc.)
    return <PlotlyChart {...props} />;
};
