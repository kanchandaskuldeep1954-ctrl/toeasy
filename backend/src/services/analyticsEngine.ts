
import { DataForensicsEngine, ColumnProfile, ColumnRole } from './dataForensicsEngine.js';

export interface DashboardConfig {
    kpis: KPI[];
    charts: ChartSpec[];
    layout: any;
    insights: string[];
    filters: FilterSpec[];
}

export interface KPI {
    id: string;
    label: string;
    value: string | number;
    unit?: string;
    trend?: number;
    trendDirection?: 'up' | 'down' | 'neutral';
    status?: 'on_track' | 'at_risk' | 'off_track';
    sparklineData?: number[];
    category: 'financial' | 'operational' | 'quality' | 'volume' | 'efficiency';
    calculation?: {
        column?: string;
        operation: 'sum' | 'avg' | 'count' | 'max' | 'min' | 'unique';
        format?: 'currency' | 'number' | 'percentage';
    };
}

export interface ChartSpec {
    id: string;
    title: string;
    type: 'line' | 'bar' | 'pie' | 'doughnut' | 'scatter' | 'heatmap' | 'funnel' | 'area' | 'treemap';
    description?: string;
    data: any;
    options: any;
    priority: 'high' | 'medium' | 'low';
    size: 'small' | 'medium' | 'large' | 'full';
}

export interface FilterSpec {
    id: string;
    label: string;
    column: string;
    type: 'date' | 'select' | 'range' | 'search';
    options?: string[];
    min?: number;
    max?: number;
}

export class AnalyticsEngine {

    static async analyze(headers: string[], data: any[]): Promise<DashboardConfig> {
        console.log(`[Analytics] Analyzing ${data.length} rows for dashboard generation...`);

        // 1. Leverage Forensics Engine for deep profiling
        // We sample up to 2000 rows for analytics to be more accurate than forensics
        const sampleSize = Math.min(data.length, 2000);
        const sample = data.slice(0, sampleSize);
        const forensics = await DataForensicsEngine.analyze(headers, sample, sampleSize);

        // 2. Generate KPIs
        const kpis = this.generateKPIs(data, forensics.profiles);

        // 3. Generate Charts
        const charts = this.generateCharts(data, forensics.profiles);

        // 4. Generate Filters
        const filters = this.generateFilters(forensics.profiles, data);

        // 5. Generate Insights
        const insights = this.generateInsights(kpis, charts);

        return {
            kpis,
            charts,
            layout: this.generateLayout(charts),
            filters,
            insights
        };
    }

    private static generateKPIs(data: any[], profiles: ColumnProfile[]): KPI[] {
        const kpis: KPI[] = [];
        const totalRows = data.length;

        // --- 1. Volume KPIs ---
        kpis.push({
            id: 'total_records',
            label: 'Total Records',
            value: totalRows,
            category: 'volume',
            trend: 0,
            trendDirection: 'neutral'
        });

        // --- 2. Financial KPIs ---
        const currencyCols = profiles.filter(p => p.role === 'currency' || (p.dataType === 'number' && (p.column.toLowerCase().includes('price') || p.column.toLowerCase().includes('amount') || p.column.toLowerCase().includes('total') || p.column.toLowerCase().includes('cost') || p.column.toLowerCase().includes('revenue'))));

        currencyCols.forEach(col => {
            const values = data.map(r => parseFloat(r[col.column])).filter(n => !isNaN(n));
            const total = values.reduce((sum, val) => sum + val, 0);
            const avg = total / (values.length || 1);

            kpis.push({
                id: `total_${col.column}`,
                label: `Total ${col.column}`,
                value: this.formatCurrency(total),
                category: 'financial',
                sparklineData: this.generateSparkline(values.slice(0, 50)), // Sample for sparkline
                calculation: { column: col.column, operation: 'sum', format: 'currency' }
            });

            kpis.push({
                id: `avg_${col.column}`,
                label: `Avg ${col.column}`,
                value: this.formatCurrency(avg),
                category: 'financial',
                calculation: { column: col.column, operation: 'avg', format: 'currency' }
            });
        });

        // --- 3. Operational/Status KPIs ---
        const statusCols = Object.values(profiles).filter(p => p.role === 'status' || p.column.toLowerCase().includes('status'));
        statusCols.forEach(col => {
            const counts: Record<string, number> = {};
            data.forEach(r => {
                const val = r[col.column];
                if (val) counts[val] = (counts[val] || 0) + 1;
            });

            // Find success/completed rate
            const successKeys = Object.keys(counts).filter(k =>
                ['completed', 'success', 'paid', 'shipped', 'delivered', 'active', 'done'].some(s => k.toLowerCase().includes(s))
            );

            if (successKeys.length > 0) {
                const successCount = successKeys.reduce((sum, k) => sum + counts[k], 0);
                const rate = (successCount / totalRows) * 100;

                kpis.push({
                    id: `${col.column}_success_rate`,
                    label: `${col.column} Success Rate`,
                    value: `${rate.toFixed(1)}%`,
                    category: 'operational',
                    status: rate > 80 ? 'on_track' : (rate > 50 ? 'at_risk' : 'off_track')
                });
            }
        });

        // --- 4. Quality KPIs ---
        const qualityScore = Object.values(profiles).reduce((acc, p) => acc + (1 - p.nullPercent), 0) / Object.keys(profiles).length;
        kpis.push({
            id: 'data_health',
            label: 'Data Health Score',
            value: `${(qualityScore * 100).toFixed(1)}%`,
            category: 'quality',
            status: qualityScore > 0.9 ? 'on_track' : (qualityScore > 0.7 ? 'at_risk' : 'off_track')
        });

        return kpis;
    }

    private static generateCharts(data: any[], profiles: ColumnProfile[]): ChartSpec[] {
        const charts: ChartSpec[] = [];
        const cols = profiles;

        // Find key columns
        const dateCol = cols.find(p => p.role === 'timestamp' || p.dataType === 'date');
        const catCols = cols.filter(p => p.dataType === 'string' && p.uniqueCount < 50 && p.uniqueCount > 1);
        const numCols = cols.filter(p => p.dataType === 'number' && p.role !== 'identifier');
        const geoCols = cols.filter(p => ['city', 'country', 'region', 'state', 'zip'].includes(p.role) || ['city', 'country', 'region'].some(t => p.column.toLowerCase().includes(t)));

        // 1. Time Series Trends (if date column exists)
        if (dateCol && numCols.length > 0) {
            numCols.slice(0, 3).forEach(num => {
                charts.push({
                    id: `trend_${num.column}`,
                    title: `${num.column} Over Time`,
                    type: 'line',
                    priority: 'high',
                    size: 'large',
                    data: this.aggregateByTime(data, dateCol.column, num.column),
                    options: { xAxis: 'Date', yAxis: num.column }
                });
            });
        }

        // 2. Formatting Distribution (Categorical)
        catCols.slice(0, 4).forEach(cat => {
            // Find a suitable metric to aggregate (first numeric col, or just count)
            const metric = numCols[0];

            charts.push({
                id: `dist_${cat.column}`,
                title: `${cat.column} Distribution`,
                type: 'bar',
                priority: 'medium',
                size: 'medium',
                data: this.aggregateByCategory(data, cat.column, metric?.column),
                options: { xAxis: cat.column, yAxis: metric ? metric.column : 'Count' }
            });

            // Pie chart for low cardinality
            if (cat.uniqueCount < 8) {
                charts.push({
                    id: `share_${cat.column}`,
                    title: `${cat.column} Share`,
                    type: 'doughnut',
                    priority: 'medium',
                    size: 'small',
                    data: this.aggregateByCategory(data, cat.column, metric?.column),
                    options: { xAxis: cat.column, yAxis: metric ? metric.column : 'Count' }
                });
            }
        });

        // 3. Relationships (Scatter)
        if (numCols.length >= 2) {
            charts.push({
                id: `scatter_${numCols[0].column}_${numCols[1].column}`,
                title: `${numCols[0].column} vs ${numCols[1].column}`,
                type: 'scatter',
                priority: 'medium',
                size: 'medium',
                data: data.slice(0, 500).map(r => ({ x: r[numCols[0].column], y: r[numCols[1].column] })),
                options: { xAxis: numCols[0].column, yAxis: numCols[1].column }
            });
        }

        // 4. Funnel (if status exists)
        const statusCol = cols.find(p => p.role === 'status');
        if (statusCol) {
            charts.push({
                id: 'status_funnel',
                title: 'Process Funnel',
                type: 'funnel',
                priority: 'high',
                size: 'medium',
                data: this.aggregateByCategory(data, statusCol.column),
                options: { xAxis: statusCol.column, yAxis: 'Count' }
            });
        }

        // 5. Ranking (Top 10)
        if (catCols.length > 0 && numCols.length > 0) {
            charts.push({
                id: `top_10_${catCols[0].column}`,
                title: `Top 10 ${catCols[0].column} by ${numCols[0].column}`,
                type: 'bar', // Horizontal bar ideally
                priority: 'high',
                size: 'medium',
                data: this.aggregateByCategory(data, catCols[0].column, numCols[0].column).sort((a: any, b: any) => b.value - a.value).slice(0, 10),
                options: { xAxis: catCols[0].column, yAxis: numCols[0].column, orientation: 'horizontal' }
            });
        }

        return charts;
    }

    private static generateFilters(profiles: ColumnProfile[], data: any[]): FilterSpec[] {
        const filters: FilterSpec[] = [];
        const cols = profiles;

        // 1. Date Filters
        const dateCol = cols.find(p => p.role === 'timestamp' || p.dataType === 'date');
        if (dateCol) {
            filters.push({
                id: `filter_${dateCol.column}`,
                label: dateCol.column,
                column: dateCol.column,
                type: 'date'
            });
        }

        // 2. Categorical Selectors (Low cardinality)
        cols.filter(p => p.dataType === 'string' && p.uniqueCount < 20 && p.uniqueCount > 1).slice(0, 5).forEach(col => {
            // Get unique values
            const uniqueVals = Array.from(new Set(data.map(r => r[col.column]).filter(v => v))).slice(0, 20) as string[];

            filters.push({
                id: `filter_${col.column}`,
                label: col.column,
                column: col.column,
                type: 'select',
                options: uniqueVals
            });
        });

        // 3. Status Filters specifically
        const statusCol = cols.find(p => p.role === 'status');
        if (statusCol && !filters.find(f => f.column === statusCol.column)) {
            const uniqueVals = Array.from(new Set(data.map(r => r[statusCol.column]).filter(v => v))).slice(0, 20) as string[];
            filters.push({
                id: `filter_${statusCol.column}`,
                label: statusCol.column,
                column: statusCol.column,
                type: 'select',
                options: uniqueVals
            });
        }

        return filters;
    }

    private static generateInsights(kpis: KPI[], charts: ChartSpec[]): string[] {
        const insights: string[] = [];

        // Growth insights
        const records = kpis.find(k => k.id === 'total_records');
        if (records) insights.push(`Dataset contains ${records.value} records.`);

        // Financial insights
        const revenue = kpis.find(k => k.category === 'financial' && k.label.includes('Total'));
        if (revenue) insights.push(`Total generated value is ${revenue.value}.`);

        return insights;
    }

    // --- Helpers ---

    private static formatCurrency(val: number): string {
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
        return `$${val.toFixed(2)}`;
    }

    private static generateSparkline(data: number[]): number[] {
        return data;
    }

    private static aggregateByCategory(data: any[], catCol: string, metricCol?: string) {
        const agg: Record<string, number> = {};
        data.forEach(row => {
            const key = row[catCol] || 'Unknown';
            const val = metricCol ? parseFloat(row[metricCol]) : 1;
            if (!isNaN(val)) {
                agg[key] = (agg[key] || 0) + val;
            }
        });

        return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }

    private static aggregateByTime(data: any[], dateCol: string, metricCol: string) {
        // Simple sorting by date for time series
        const sorted = [...data].sort((a, b) => new Date(a[dateCol]).getTime() - new Date(b[dateCol]).getTime());

        return sorted.map(r => ({
            name: r[dateCol],
            value: parseFloat(r[metricCol]) || 0
        })).filter(d => !isNaN(d.value));
    }

    private static generateLayout(charts: ChartSpec[]): any {
        return {
            columns: 4,
            rows: 'auto'
        };
    }
}
