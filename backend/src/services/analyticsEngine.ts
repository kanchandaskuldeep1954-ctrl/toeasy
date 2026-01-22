
import { DataForensicsEngine, ColumnProfile, ColumnRole, ForensicResult } from './dataForensicsEngine.js';
import { PredictiveAnalytics } from './predictiveAnalytics.js';

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
    type: 'line' | 'bar' | 'bar-horizontal' | 'pie' | 'doughnut' | 'donut' | 'scatter' | 'bubble' | 'heatmap' | 'funnel' | 'area' | 'treemap' | 'radar' | 'gauge' | 'waterfall' | 'histogram' | 'choropleth' | 'scattergeo' | 'sunburst' | 'box' | 'violin';
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

        // 6. Append Predictive Charts (Forecasts)
        const predictiveCharts = this.generatePredictiveCharts(data, forensics.profiles);
        charts.push(...predictiveCharts);

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

        // --- 5. Advanced Growth & Retention ---
        const advancedKpis = this.generateAdvancedKPIs(data, profiles);
        kpis.push(...advancedKpis);

        return kpis;
    }

    private static generateAdvancedKPIs(data: any[], profiles: ColumnProfile[]): KPI[] {
        const kpis: KPI[] = [];
        const dateCol = profiles.find(p => p.role === 'timestamp' || p.dataType === 'date');
        const numCols = profiles.filter(p => p.role === 'currency' || (p.dataType === 'number' && !p.column.toLowerCase().includes('id')));
        const idCol = profiles.find(p => p.role === 'identifier' || p.column.toLowerCase().includes('id') || p.column.toLowerCase().includes('email'));

        if (!dateCol) return kpis;

        // 1. Growth Rates (MoM / YoY) for key metrics
        numCols.slice(0, 3).forEach(col => {
            const growth = this.calculateGrowth(data, dateCol.column, col.column);
            if (growth) {
                kpis.push({
                    id: `${col.column}_growth`,
                    label: `${col.column} Growth (MoM)`,
                    value: `${growth.percent > 0 ? '+' : ''}${growth.percent.toFixed(1)}%`,
                    trend: growth.percent,
                    trendDirection: growth.percent >= 0 ? 'up' : 'down',
                    status: growth.percent > 0 ? 'on_track' : 'at_risk',
                    category: 'financial',
                    sparklineData: growth.history
                });
            }
        });

        // 2. Retention / Churn (if ID column exists)
        if (idCol) {
            const retention = this.calculateRetention(data, dateCol.column, idCol.column);
            if (retention) {
                kpis.push({
                    id: 'retention_rate',
                    label: 'Retention Rate (30d)',
                    value: `${(retention.rate * 100).toFixed(1)}%`,
                    category: 'efficiency',
                    status: retention.rate > 0.6 ? 'on_track' : 'off_track',
                    trend: retention.trend, // Change from previous window
                    trendDirection: retention.trend >= 0 ? 'up' : 'down'
                });

                kpis.push({
                    id: 'churn_rate',
                    label: 'Churn Rate',
                    value: `${((1 - retention.rate) * 100).toFixed(1)}%`,
                    category: 'efficiency',
                    status: (1 - retention.rate) < 0.1 ? 'on_track' : 'at_risk',
                    trendDirection: (1 - retention.rate) < 0.1 ? 'up' : 'down' // Lower churn is better 'up' status logic might need inversion visual
                });
            }
        }

        // 3. Statistical Variance (Stability)
        numCols.slice(0, 2).forEach(col => {
            const values = data.map(r => Number(r[col.column])).filter(n => !isNaN(n));
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
            const stdDev = Math.sqrt(variance);
            const cv = (stdDev / mean) * 100; // Coefficient of Variation

            // If CV is low, data is stable/predictable
            kpis.push({
                id: `${col.column}_volatility`,
                label: `${col.column} Volatility`,
                value: `${cv.toFixed(1)}%`,
                category: 'quality',
                status: cv < 20 ? 'on_track' : 'at_risk',
                trendDirection: cv < 20 ? 'up' : 'down'
            });
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

        // 4. Funnel/Distribution (Status/Process Tracking)
        const statusCol = cols.find(p => p.role === 'status');
        if (statusCol) {
            if (statusCol.uniqueCount <= 8) {
                charts.push({
                    id: 'status_funnel',
                    title: 'Process Operational Flow',
                    type: 'funnel',
                    priority: 'high',
                    size: 'medium',
                    data: this.aggregateByCategory(data, statusCol.column),
                    options: { xAxis: statusCol.column, yAxis: 'Count' }
                });
            } else {
                charts.push({
                    id: 'status_distribution',
                    title: `${statusCol.column} Distribution (Volume)`,
                    type: 'bar',
                    priority: 'medium',
                    size: 'medium',
                    data: this.aggregateByCategory(data, statusCol.column),
                    options: { xAxis: statusCol.column, yAxis: 'Count' }
                });
            }
        }

        // 5. Ranking (Top N)
        if (catCols.length > 0 && numCols.length > 0) {
            const totalCategories = catCols[0].uniqueCount;
            const topN = Math.min(totalCategories, 10);
            const isPartial = topN < totalCategories;

            charts.push({
                id: `top_${topN}_${catCols[0].column}`,
                title: `${isPartial ? `Top ${topN} ` : ''}${catCols[0].column} by ${numCols[0].column}`,
                type: 'bar-horizontal',
                priority: 'high',
                size: 'medium',
                data: this.aggregateByCategory(data, catCols[0].column, numCols[0].column)
                    .sort((a: any, b: any) => b.value - a.value)
                    .slice(0, topN),
                options: { xAxis: catCols[0].column, yAxis: numCols[0].column, orientation: 'horizontal' }
            });
        }

        // 6. Pro Visuals: Maps
        if (geoCols.length > 0 && numCols.length > 0) {
            const geo = geoCols[0];
            const metric = numCols[0];
            charts.push({
                id: `geo_map_${geo.column}`,
                title: `${metric.column} by ${geo.column} (Geographic)`,
                type: geo.role === 'country' ? 'choropleth' : 'scattergeo',
                priority: 'high',
                size: 'large',
                data: this.aggregateByCategory(data, geo.column, metric.column),
                options: { xAxis: geo.column, yAxis: metric.column }
            });
        }

        // 7. Pro Visuals: Statistical Distribution
        if (numCols.length > 0) {
            const num = numCols[0];
            charts.push({
                id: `dist_box_${num.column}`,
                title: `${num.column} Distribution (Box Plot)`,
                type: 'box',
                priority: 'medium',
                size: 'medium',
                data: data.slice(0, 500).map(r => ({ name: 'Distribution', value: parseFloat(r[num.column]) })),
                options: { yAxis: num.column }
            });
        }

        // 8. Pro Visuals: Sunburst (if Hierarchical categories exist)
        const reasonCol = cols.find(p => p.role === 'reason');
        if (statusCol && reasonCol) {
            charts.push({
                id: 'root_cause_sunburst',
                title: 'Operational Root Cause Analysis',
                type: 'sunburst',
                priority: 'high',
                size: 'large',
                data: this.aggregateByCategory(data, reasonCol.column, numCols[0]?.column),
                options: { labels: reasonCol.column, parents: statusCol.column }
            });
        } else if (catCols.length >= 2) {
            charts.push({
                id: 'category_sunburst',
                title: 'Nested Category Discovery',
                type: 'sunburst',
                priority: 'medium',
                size: 'medium',
                data: this.aggregateByCategory(data, catCols[0].column, numCols[0]?.column),
                options: { labels: catCols[0].column, parents: catCols[1].column }
            });
        }

        // 9. Pro Visuals: Heatmap (Quality Matrix)
        if (catCols.length > 0 && statusCol) {
            const isHealthcare = /condition|procedure|patient/i.test(catCols[0].column);
            charts.push({
                id: 'quality_heatmap',
                title: isHealthcare ? 'Clinical Outcome Matrix' : 'Quality Matrix (Product vs Status)',
                type: 'heatmap',
                priority: 'medium',
                size: 'medium',
                data: [], // Handled by standard heatmapping logic in PlotlyChart
                options: { xAxis: catCols[0].column, yAxis: statusCol.column, zAxis: numCols[0]?.column || 'Count' }
            });
        }

        // 10. Pro Visuals: Correlations (Scatter)
        const ageCol = numCols.find(p => /age/i.test(p.column));
        const costCol = numCols.find(p => /cost|amount|price/i.test(p.column));
        if (ageCol && costCol) {
            charts.push({
                id: 'age_cost_correlation',
                title: 'Healthcare Economic Analysis (Age vs Cost)',
                type: 'scatter',
                priority: 'medium',
                size: 'medium',
                data: data.slice(0, 500).map(r => ({ x: r[ageCol.column], y: r[costCol.column] })),
                options: { xAxis: ageCol.column, yAxis: costCol.column }
            });
        }

        // 9. Fallback: Default Templates if no charts generated
        const headers = profiles.map(p => p.column);
        if (charts.length < 3 && headers.length >= 2) {
            const h1 = headers[0];
            const h2 = headers[1];

            if (!charts.find(c => c.id === 'default_bar')) {
                charts.push({
                    id: 'default_bar',
                    title: 'Overview (Default)',
                    type: 'bar',
                    priority: 'low',
                    size: 'medium',
                    data: data.slice(0, 10).map(r => ({ label: String(r[h1] || 'Item'), value: Number(r[h2]) || 0 })),
                    options: { xAxis: h1, yAxis: h2 }
                });
            }
            if (!charts.find(c => c.id === 'default_line')) {
                charts.push({
                    id: 'default_line',
                    title: 'Trend Analysis (Default)',
                    type: 'line',
                    priority: 'low',
                    size: 'medium',
                    data: data.slice(0, 10).map(r => ({ label: String(r[h1] || 'Time'), value: Number(r[h2]) || 0 })),
                    options: { xAxis: h1, yAxis: h2 }
                });
            }
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

    static async generateReportArtifacts(headers: string[], data: any[], reportType: 'strategic' | 'operational' | 'financial' | 'quality' | 'risk' = 'strategic'): Promise<{ kpis: KPI[], charts: ChartSpec[], forensics: ForensicResult }> {
        // 1. Forensics
        const sampleSize = Math.min(data.length, 2000);
        const sample = data.slice(0, sampleSize);
        const forensics = await DataForensicsEngine.analyze(headers, sample, sampleSize);

        // 2. Base Analytics
        const allKpis = this.generateKPIs(data, forensics.profiles);
        const allCharts = this.generateCharts(data, forensics.profiles);

        // 3. Filter & Enhance based on Report Type
        let filteredKpis = allKpis;
        let filteredCharts = allCharts;

        switch (reportType) {
            case 'financial':
                filteredKpis = allKpis.filter(k => k.category === 'financial' || k.id === 'total_records');
                filteredCharts = allCharts.filter(c =>
                    c.title.toLowerCase().includes('cost') ||
                    c.title.toLowerCase().includes('revenue') ||
                    c.title.toLowerCase().includes('sales') ||
                    c.title.toLowerCase().includes('price') ||
                    c.type === 'waterfall'
                );
                // Add waterfall if missing
                if (!filteredCharts.find(c => c.type === 'waterfall')) {
                    // Try to finding positive/negative contributions
                    // Placeholder for advanced logic
                }
                break;

            case 'operational':
                filteredKpis = allKpis.filter(k => k.category === 'operational' || k.category === 'efficiency');
                filteredCharts = allCharts.filter(c => c.type === 'funnel' || c.type === 'line' || c.type === 'bar');
                break;

            case 'quality':
                filteredKpis = allKpis.filter(k => k.category === 'quality');
                filteredCharts = allCharts.filter(c => c.type === 'bar' || c.type === 'scatter'); // Distribution & Outliers
                break;

            case 'risk':
                // Focus on potential outliers and "bad" status
                filteredCharts = allCharts.filter(c => c.type === 'scatter' || c.type === 'heatmap');
                break;

            case 'strategic':
            default:
                // Mix of high-level KPIs and trends
                filteredKpis = allKpis.slice(0, 8);
                filteredCharts = allCharts.slice(0, 6);
                break;
        }

        return { kpis: filteredKpis, charts: filteredCharts, forensics };
    }

    private static calculateGrowth(data: any[], dateCol: string, valCol: string): { percent: number, history: number[] } | null {
        // Group by Month
        const monthly: Record<string, number> = {};
        data.forEach(r => {
            const d = new Date(r[dateCol]);
            if (isNaN(d.getTime())) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const val = Number(r[valCol]) || 0;
            monthly[key] = (monthly[key] || 0) + val;
        });

        const sortedKeys = Object.keys(monthly).sort();
        if (sortedKeys.length < 2) return null;

        const currentMonth = sortedKeys[sortedKeys.length - 1];
        const prevMonth = sortedKeys[sortedKeys.length - 2];

        const currentVal = monthly[currentMonth];
        const prevVal = monthly[prevMonth];

        if (prevVal === 0) return null;

        const change = ((currentVal - prevVal) / prevVal) * 100;
        const history = sortedKeys.map(k => monthly[k]);

        return { percent: change, history };
    }

    private static calculateRetention(data: any[], dateCol: string, idCol: string): { rate: number, trend: number } | null {
        // Simple Cohort: Users present in Previous Month vs Current Month
        // This is a simplified proxy for standard retention
        const monthlyUsers: Record<string, Set<string>> = {};

        data.forEach(r => {
            const d = new Date(r[dateCol]);
            if (isNaN(d.getTime())) return;
            // Group by Month
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const id = String(r[idCol]);
            if (!monthlyUsers[key]) monthlyUsers[key] = new Set();
            monthlyUsers[key].add(id);
        });

        const sortedKeys = Object.keys(monthlyUsers).sort();
        if (sortedKeys.length < 2) return null;

        const currentMonth = sortedKeys[sortedKeys.length - 1];
        const prevMonth = sortedKeys[sortedKeys.length - 2];

        const prevUsers = monthlyUsers[prevMonth];
        const currentUsers = monthlyUsers[currentMonth];

        // Retention: How many of Prev users are also in Current?
        let retained = 0;
        prevUsers.forEach(id => {
            if (currentUsers.has(id)) retained++;
        });

        const rate = retained / prevUsers.size;

        // Trend (compare to month before that if possible)
        let trend = 0;
        if (sortedKeys.length >= 3) {
            const prevPrevMonth = sortedKeys[sortedKeys.length - 3];
            const prevPrevUsers = monthlyUsers[prevPrevMonth];
            let prevRetained = 0;
            prevPrevUsers.forEach(id => {
                if (prevUsers.has(id)) prevRetained++;
            });
            const prevRate = prevRetained / prevPrevUsers.size;
            trend = (rate - prevRate) * 100;
        }

        return { rate, trend };
    }

    private static generatePredictiveCharts(data: any[], profiles: ColumnProfile[]): ChartSpec[] {
        const charts: ChartSpec[] = [];
        const dateCol = profiles.find(p => p.role === 'timestamp' || p.dataType === 'date');
        const numCols = profiles.filter(p => p.role === 'currency' || (p.dataType === 'number' && !p.column.toLowerCase().includes('id')));

        if (!dateCol || numCols.length === 0) return charts;

        // 1. Forecast Trend for Primary Metric
        const primaryMetric = numCols[0];
        const timeSeriesData = this.aggregateByTime(data, dateCol.column, primaryMetric.column)
            .map((d, i) => ({ x: i, y: d.value, label: d.name }));

        if (timeSeriesData.length > 5) {
            const regression = PredictiveAnalytics.performLinearRegression(timeSeriesData.map(d => ({ x: d.x, y: d.y })), 3);

            if (regression.rSquared > 0.5) { // Only show if correlation is decent
                // Create Forecast Data
                const forecastData = regression.forecast.map((p, i) => ({
                    name: `Forecast +${i + 1}`,
                    value: p.y,
                    type: 'forecast'
                }));

                charts.push({
                    id: `forecast_${primaryMetric.column}`,
                    title: `${primaryMetric.column} Forecast (Trend)`,
                    type: 'line',
                    priority: 'high',
                    size: 'large',
                    description: `Projected trend based on linear regression (R²=${regression.rSquared.toFixed(2)})`,
                    data: [...timeSeriesData.map(d => ({ name: d.label, value: d.y })), ...forecastData],
                    options: { xAxis: 'Time', yAxis: primaryMetric.column, showTrend: true }
                });
            }
        }

        // 2. Anomaly Detection
        const values = data.map(r => Number(r[primaryMetric.column])).filter(n => !isNaN(n));
        const anomalies = PredictiveAnalytics.detectAnomaliesZScore(values, 2.5);

        if (anomalies.length > 0) {
            charts.push({
                id: `anomalies_${primaryMetric.column}`,
                title: `${primaryMetric.column} Anomalies`,
                type: 'scatter',
                priority: 'medium',
                size: 'medium',
                description: `Detected ${anomalies.length} potential anomalies (Z-Score > 2.5)`,
                data: anomalies.map(a => ({ x: a.index, y: a.value, label: `Row ${a.index}` })),
                options: { xAxis: 'Row Index', yAxis: primaryMetric.column, color: '#ef4444' } // Red for anomalies
            });
        }

        return charts;
    }

    private static generateLayout(charts: ChartSpec[]): any {
        return {
            columns: 4,
            rows: 'auto'
        };
    }
}
