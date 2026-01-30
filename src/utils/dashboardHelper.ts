
import { Dataset, ChartSpec } from '../../types';
import { GroqService } from '../../services/groqService';

const findClosestColumn = (target: string | undefined, headers: string[]): string | undefined => {
    if (!target) return undefined;
    if (headers.includes(target)) return target;
    const normalized = (s: string) => s.toLowerCase().replace(/[\s_-]/g, '');
    const targetNorm = normalized(target);
    const match = headers.find(h => normalized(h) === targetNorm);
    if (match) return match;
    return headers.find(h => normalized(h).includes(targetNorm) || targetNorm.includes(normalized(h)));
};

/**
 * Parse a value to number.
 * Returns null for unparseable values (no longer returns 0 to avoid skewing aggregations).
 * Consumer must filter out null values before calculations.
 */
const parseNumericValue = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;

    const lower = String(val).toLowerCase().trim();

    // Empty or N/A indicators
    if (lower === '' || lower === '-' || lower === 'n/a' || lower === 'na' || lower === 'null' || lower === 'none') {
        return null;
    }

    // Semantic Booleans & Statuses
    if (['yes', 'true', 'y', '1', 'recovered', 'success', 'high'].includes(lower)) return 1;
    if (['no', 'false', 'n', '0', 'died', 'failure', 'low', 'stable'].includes(lower)) return 0;

    const str = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? null : num;
};

export const aggregateData = (chart: ChartSpec, dataset: Dataset, filteredData: any[]): any[] => {
    const headers = dataset.headers;
    const xAxis = findClosestColumn(chart.xAxis, headers) || chart.xAxis;
    const yAxis = findClosestColumn(chart.yAxis, headers) || chart.yAxis;
    const zAxis = findClosestColumn(chart.zAxis, headers) || chart.zAxis;

    // PRIORITY 1: Use pre-aggregated data from backend if available
    if (chart.data && Array.isArray(chart.data) && chart.data.length > 0) {
        return chart.data.map((d: any) => ({
            name: d.name ?? d.label ?? d.x ?? d.category ?? 'Unknown',
            value: Number(d.value ?? d.y ?? d.count ?? 0),
            label: d.name ?? d.label ?? d.x ?? d.category ?? 'Unknown',
            ...d
        }));
    }

    // PRIORITY 2: Manual aggregation from raw data (for user-edited charts)
    if (!filteredData || filteredData.length === 0) return [];

    // --- Histogram Logic ---
    if (chart.type === 'histogram') {
        const values = filteredData.map(d => parseNumericValue(d[xAxis])).filter((n): n is number => n !== null);
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
                const zVal = zAxis ? parseNumericValue(row[zAxis]) : 1;

                if (map.has(key)) {
                    map.get(key)!.z += zVal;
                } else {
                    map.set(key, { x: xVal, y: yVal, z: zVal });
                }
            });
            return Array.from(map.values());
        }

        // Scatter / Bubble - SUPPORT CATEGORICAL AXES
        return filteredData.map(row => {
            const xRaw = row[xAxis];
            const yRaw = row[yAxis];

            // Try numeric first, fallback to raw if specifically categorical
            const xNum = parseNumericValue(xRaw);
            const yNum = parseNumericValue(yRaw);

            // If the raw value is a non-empty string and numeric parsing yielded null (likely categorical)
            // we use the original string.
            const xFinal = (xNum === null && typeof xRaw === 'string') ? xRaw : (xNum ?? 0);
            const yFinal = (yNum === null && typeof yRaw === 'string') ? yRaw : (yNum ?? 0);
            const zVal = zAxis ? parseNumericValue(row[zAxis]) : 100;

            return {
                x: xFinal,
                y: yFinal,
                z: zVal ?? 100,
                name: row[dataset.headers[0]]
            };
        }).slice(0, 500);
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
        value: parseNumericValue(item.value)
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
