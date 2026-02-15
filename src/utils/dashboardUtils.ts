import { ChartSpec, Dataset } from '../../types';
import { GroqService } from '../../src/services/groqService';

export const aggregateData = (chart: ChartSpec, filteredData: any[], headers: string[]) => {
    if (!filteredData || filteredData.length === 0) return [];

    const xAxis = chart.xAxis;
    const yAxis = chart.yAxis;
    const zAxis = chart.zAxis;

    // --- Histogram Logic ---
    if (chart.type === 'histogram') {
        const values = filteredData.map(d => Number(d[xAxis])).filter(n => !isNaN(n));
        if (values.length === 0) return [];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const binCount = 10;
        const binSize = (max - min) / binCount;
        const bins = Array.from({ length: binCount }, (_, i) => ({
            range: `${(min + i * binSize).toFixed(1)} - ${(min + (i + 1) * binSize).toFixed(1)}`,
            min: min + i * binSize,
            max: min + (i + 1) * binSize,
            count: 0
        }));

        values.forEach(v => {
            const binIndex = Math.min(Math.floor((v - min) / binSize), binCount - 1);
            if (bins[binIndex]) bins[binIndex].count++;
        });

        return bins.map(b => ({ name: b.range, value: b.count }));
    }

    // --- Scatter / Bubble / Heatmap Logic ---
    if (chart.type === 'scatter' || chart.type === 'bubble' || chart.type === 'heatmap') {
        if (chart.type === 'heatmap') {
            const map = new Map<string, { x: string, y: string, z: number }>();
            filteredData.forEach(row => {
                const xVal = String(row[xAxis] || 'Unknown');
                const yVal = String(row[yAxis] || 'Unknown');
                const key = `${xVal}::${yVal}`;
                const zVal = zAxis ? (Number(row[zAxis]) || 1) : 1;

                if (map.has(key)) {
                    map.get(key)!.z += zVal;
                } else {
                    map.set(key, { x: xVal, y: yVal, z: zVal });
                }
            });
            return Array.from(map.values());
        }

        return filteredData.map(row => ({
            x: Number(row[xAxis]) || 0,
            y: Number(row[yAxis]) || 0,
            z: zAxis ? (Number(row[zAxis]) || 100) : 100,
            name: row[headers[0]]
        })).slice(0, 500);
    }

    // --- Treemap Logic ---
    if (chart.type === 'treemap') {
        const map = new Map<string, number>();
        filteredData.forEach(row => {
            const key = String(row[xAxis] || 'Unknown');
            const val = chart.aggregation === 'count' ? 1 : (parseFloat(String(row[yAxis])) || 0);
            map.set(key, (map.get(key) || 0) + val);
        });
        return Array.from(map.entries())
            .map(([name, size]) => ({ name, size }))
            .sort((a, b) => b.size - a.size)
            .slice(0, 20);
    }

    // --- Standard Aggregation (Bar, Line, Area, Pie, Radar, Funnel, Gauge) ---
    const limit = chart.limit || (chart.type === 'pie' ? 10 : 20);
    const showOther = chart.showOther !== false;

    const smartData = GroqService.smartAggregateData(
        filteredData,
        xAxis,
        yAxis,
        chart.aggregation || 'sum',
        limit,
        showOther
    );

    let result = smartData.map(item => ({
        name: item.label.length > 20 ? item.label.substring(0, 18) + '...' : item.label,
        value: Number(item.value.toFixed(2))
    }));

    if (chart.type === 'line' || chart.type === 'area') {
        if (result.length > 0 && !isNaN(Date.parse(result[0].name))) {
            result.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
        }
    }

    return result || [];
};
