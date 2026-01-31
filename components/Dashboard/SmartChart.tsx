import React from 'react';
import { PlotlyChart } from './PlotlyChart';
import { PremiumBar } from './Premium/PremiumBar';
import { PremiumLine } from './Premium/PremiumLine';
import { PremiumPie } from './Premium/PremiumPie';
import { PremiumScatter } from './Premium/PremiumScatter';
import { PremiumRadar } from './Premium/PremiumRadar';
import { PremiumTreemap } from './Premium/PremiumTreemap';
import { PremiumFunnel } from './Premium/PremiumFunnel';
import { ChartSpec } from '../../types';

interface SmartChartProps {
    chart: ChartSpec;
    data?: any[];
    height?: number;
    activeFilter?: string | null;
    onClick?: (data: any) => void;
}

export const SmartChart: React.FC<SmartChartProps> = (props) => {
    const { chart, data = [] } = props;

    // Normalize type
    const type = chart.type?.toLowerCase() || 'bar';

    // Route to Premium Engine (Recharts) for Standard BI Charts
    if (type === 'bar' || type === 'bar-horizontal' || type === 'bar_horizontal') {
        return <PremiumBar {...props} data={data} />;
    }

    if (type === 'line' || type === 'area') {
        return <PremiumLine {...props} data={data} />;
    }

    if (type === 'pie' || type === 'donut' || type === 'doughnut') {
        return <PremiumPie {...props} data={data} />;
    }

    if (type === 'scatter' || type === 'bubble') {
        return <PremiumScatter {...props} data={data} />;
    }

    if (type === 'radar') {
        return <PremiumRadar {...props} data={data} />;
    }

    if (type === 'treemap') {
        return <PremiumTreemap {...props} data={data} />;
    }

    if (type === 'funnel') {
        return <PremiumFunnel {...props} data={data} />;
    }

    // Default: Return Plotly for Scientific/Complex Charts (Heatmap, Maps, 3D, etc.)
    return <PlotlyChart {...props} data={data} />;
};
