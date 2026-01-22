
import { Dataset, ChartSpec } from '../../types';
import { GroqService } from '../../services/groqService';

export const aggregateData = (chart: ChartSpec, dataset: Dataset, filteredData: any[]): any[] => {
    // PRIORITY 1: Use pre-aggregated data from backend if available
    // This is the data pre-computed by AnalyticsEngine
    if (chart.data && Array.isArray(chart.data) && chart.data.length > 0) {
        // Normalize data to ensure it has the right format
        return chart.data.map((d: any) => ({
            name: d.name ?? d.label ?? d.x ?? d.category ?? 'Unknown',
            value: Number(d.value ?? d.y ?? d.count ?? 0),
            label: d.name ?? d.label ?? d.x ?? d.category ?? 'Unknown',
            ...d
        }));
    }

    // PRIORITY 2: Manual aggregation from raw data (for user-edited charts)
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

        return bins.map(b => ({ label: b.range, value: b.count }));
    }

    // --- Scatter / Bubble / Heatmap Logic ---
    if (chart.type === 'scatter' || chart.type === 'bubble' || chart.type === 'heatmap') {
        if (chart.type === 'heatmap') {
            // For heatmap, we treat X and Y as categorical buckets
            const map = new Map<string, { x: string, y: string, z: number }>();
            filteredData.forEach(row => {
                const xVal = String(row[xAxis] || 'Unknown');
                const yVal = String(row[yAxis] || 'Unknown');
                const key = `${xVal}::${yVal}`;
                const zVal = zAxis ? (Number(row[zAxis]) || 1) : 1; // Count or Sum Z

                if (map.has(key)) {
                    map.get(key)!.z += zVal;
                } else {
                    map.set(key, { x: xVal, y: yVal, z: zVal });
                }
            });
            return Array.from(map.values());
        }

        // Scatter / Bubble
        return filteredData.map(row => ({
            x: Number(row[xAxis]) || 0,
            y: Number(row[yAxis]) || 0,
            z: zAxis ? (Number(row[zAxis]) || 100) : 100, // Z determines bubble size
            name: row[dataset.headers[0]]
        })).slice(0, 500); // Limit points for performance
    }

    // --- Box / Violin Logic (Raw Distribution) ---
    if (chart.type === 'box' || chart.type === 'violin') {
        const map = new Map<string, number[]>();
        filteredData.forEach(row => {
            const key = String(row[xAxis] || 'Total');
            const val = Number(row[yAxis]) || 0;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(val);
        });

        // Flatten for Plotly or return grouped
        const results: any[] = [];
        map.forEach((vals, label) => {
            vals.forEach(v => results.push({ label, value: v }));
        });
        return results.slice(0, 1000); // Limit to 1k points for preview
    }

    // --- Sunburst Logic (Hierarchical) ---
    if (chart.type === 'sunburst') {
        const childCol = xAxis; // Usually the leaf
        const parentCol = (chart as any).options?.parents || dataset.headers.find(h => h !== childCol && h !== yAxis);

        const map = new Map<string, { value: number, parent: string }>();
        filteredData.forEach(row => {
            const label = String(row[childCol] || 'Unknown');
            const parent = parentCol ? String(row[parentCol] || '') : '';
            const val = chart.aggregation === 'count' ? 1 : (parseFloat(String(row[yAxis])) || 0);

            if (map.has(label)) {
                map.get(label)!.value += val;
            } else {
                map.set(label, { value: val, parent });
            }
        });

        return Array.from(map.entries()).map(([label, info]) => ({
            label,
            value: info.value,
            parent: info.parent
        }));
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
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 20);
    }

    // --- Standard Aggregation (Bar, Line, Area, Pie, Radar, Funnel, Gauge) ---
    // IMPROVED: Use smart aggregation for high-cardinality data with automatic "Top N + Other" grouping
    const limit = chart.limit || (chart.type === 'pie' ? 10 : 20);
    const showOther = chart.showOther !== false; // Default true

    // Use smart aggregation from GroqService for intelligent grouping
    const smartData = GroqService.smartAggregateData(
        filteredData,
        xAxis,
        yAxis,
        chart.aggregation || 'sum',
        limit,
        showOther
    );

    // Handle truncation of labels for readability
    let result = smartData.map(item => ({
        label: item.label.length > 20 ? item.label.substring(0, 18) + '...' : item.label,
        value: Number(item.value.toFixed(2))
    }));

    // Sorting typically helps standard charts (already done by smartAggregateData)
    // Only re-sort if this is a time-series chart
    if (chart.type === 'line' || chart.type === 'area') {
        // For time-series, check if data looks like dates
        if (result.length > 0 && !isNaN(Date.parse(result[0].label))) {
            result.sort((a, b) => new Date(a.label).getTime() - new Date(b.label).getTime());
        }
    }

    return result;
};
