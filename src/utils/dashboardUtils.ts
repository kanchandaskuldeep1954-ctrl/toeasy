import { ChartSpec, Dataset } from '../../types';
import { GroqService } from '../../src/services/groqService';

export const aggregateData = (chart: ChartSpec, filteredData: any[], headers: string[]) => {
    try {
        if (!chart || !filteredData || filteredData.length === 0) return [];

        const xAxis = chart.xAxis || 'name';
        const yAxis = chart.yAxis || 'value';
        const zAxis = chart.zAxis;

        // --- Histogram Logic ---
        if (chart.type === 'histogram') {
            const values = filteredData.map(d => Number(d[xAxis])).filter(n => !isNaN(n));
            if (values.length === 0) return [];
            const min = Math.min(...values);
            const max = Math.max(...values);
            const binCount = Math.min(20, Math.ceil(Math.sqrt(values.length))); // Sturgis-ish rule
            const binSize = (max - min) / binCount || 1;

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
                // Matrix pivot for heatmap
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

            // Scatter / Bubble: Return raw x/y/z mapped properly
            return filteredData.map(row => ({
                [xAxis]: Number(row[xAxis]) || 0, // Keep original keys for axes to bind to
                [yAxis]: Number(row[yAxis]) || 0,
                z: zAxis ? (Number(row[zAxis]) || 100) : 100,
                name: row[headers[0]] || 'Item',
                // Also provide generic x/y for fallback
                x: Number(row[xAxis]) || 0,
                y: Number(row[yAxis]) || 0,
            })).slice(0, 1000); // Limit scatter points for performance
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

        // --- Standard Aggregation (Bar, Line, Area, Pie, Radar, Funnel, Gauge, Stacked, Composed) ---
        const limit = chart.limit || (chart.type === 'pie' ? 10 : 50);
        const showOther = chart.showOther !== false;

        // Detect if we need multi-series aggregation (stacked, composed, or just has multiple numeric columns)
        // For stacked/composed, we typically want to Group By X, and then have Sum(Y1), Sum(Y2), etc.

        // If the chart type implies multi-series or flexible series:
        if (chart.type === 'stacked' || chart.type === 'stacked_bar' || chart.type === 'composed' || chart.type === 'combo') {
            // Identify all numeric columns that are NOT the x-axis
            const numericColumns = headers.filter(h =>
                h !== xAxis &&
                filteredData.some(row => typeof row[h] === 'number' || !isNaN(Number(row[h])))
            ).slice(0, 10); // Limit to 10 series max

            const grouped: Record<string, any> = {};

            filteredData.forEach(row => {
                const xVal = String(row[xAxis] || 'Unknown');
                if (!grouped[xVal]) {
                    grouped[xVal] = { [xAxis]: xVal };
                    numericColumns.forEach(col => grouped[xVal][col] = 0);
                }

                numericColumns.forEach(col => {
                    const val = Number(row[col]) || 0;
                    // Default to SUM for now
                    grouped[xVal][col] += val;
                });
            });

            const result = Object.values(grouped);

            // Smart Sorting:
            // 1. If X-axis looks like a date/time, sort chronologically
            // 2. Otherwise sort by the first metric (descending)
            const sampleX = result[0]?.[xAxis];
            const isDate = sampleX && !isNaN(Date.parse(sampleX)) && isNaN(Number(sampleX)); // Simple heuristic

            if (isDate) {
                result.sort((a, b) => new Date(a[xAxis]).getTime() - new Date(b[xAxis]).getTime());
            } else if (numericColumns.length > 0) {
                const firstMetric = numericColumns[0];
                result.sort((a, b) => b[firstMetric] - a[firstMetric]);
            }

            return result.slice(0, limit);
        }


        // Single Series Aggregation (Legacy / Simple)
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
            value: Number(item.value.toFixed(2)),
            [xAxis]: item.label, // Provide original keys too
            [yAxis]: Number(item.value.toFixed(2))
        }));

        if (chart.type === 'line' || chart.type === 'area') {
            if (result.length > 0 && !isNaN(Date.parse(result[0].name))) {
                result.sort((a, b) => new Date(a.name).getTime() - new Date(b.name).getTime());
            }
        }

        return result || [];
    } catch (err) {
        console.error('aggregateData error:', err);
        return [];
    }
};
