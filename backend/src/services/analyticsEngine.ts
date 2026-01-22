
import { DataForensicsEngine, ColumnProfile, ColumnRole, ForensicResult } from './dataForensicsEngine.js';
import { PredictiveAnalytics } from './predictiveAnalytics.js';
import { AnalysisStrategist, DashboardBlueprint } from './analysisStrategist.js';

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
        console.log(`[Analytics] Analyzing ${data.length} rows for AI-First dashboard generation...`);

        // 1. Leverage Forensics Engine for deep profiling
        const sampleSize = Math.min(data.length, 2000);
        const sample = data.slice(0, sampleSize);
        const forensics = await DataForensicsEngine.analyze(headers, sample, sampleSize);

        // 2. AI-First Strategy: Generate Dashboard Blueprint
        const blueprint = await AnalysisStrategist.generateBlueprint(headers, forensics.profiles, sample);

        // Enrich profiles with semantic context
        forensics.profiles.forEach(p => {
            if (blueprint.semanticContext[p.column]) {
                p.semanticDescription = blueprint.semanticContext[p.column];
            }
        });

        // 3. Generate KPIs (Mix of Blueprint + Statistical base)
        const kpis = this.generateKPIs(data, forensics.profiles, blueprint);

        // 4. Generate Charts (Blueprint driven + discoveries)
        const charts = this.generateCharts(data, forensics.profiles, blueprint);

        // 5. Generate Filters
        const filters = this.generateFilters(forensics.profiles, data);

        // 6. Generate Insights (AI contextualized)
        const insights = this.generateInsights(kpis, charts, blueprint);

        // 7. Append Predictive Charts (Forecasts)
        const predictiveCharts = this.generatePredictiveCharts(data, forensics.profiles);
        charts.push(...predictiveCharts);

        return {
            kpis,
            charts: this.prioritizeCharts(charts),
            layout: this.generateLayout(charts),
            filters,
            insights
        };
    }

    private static prioritizeCharts(charts: ChartSpec[]): ChartSpec[] {
        const pMap: Record<string, number> = { 'high': 0, 'medium': 1, 'low': 2 };
        return [...charts].sort((a, b) => {
            if (pMap[a.priority] !== pMap[b.priority]) return pMap[a.priority] - pMap[b.priority];
            return a.id.localeCompare(b.id);
        });
    }

    private static generateKPIs(data: any[], profiles: ColumnProfile[], blueprint?: DashboardBlueprint): KPI[] {
        const kpis: KPI[] = [];
        const totalRows = data.length;

        // --- 1. AI Blueprint KPIs (Highest Value) ---
        if (blueprint && blueprint.recommendedKPIs) {
            blueprint.recommendedKPIs.forEach(spec => {
                const col = profiles.find(p => p.column === spec.column);
                let value: any = '-';
                let sparkline: number[] = [];

                if (col || spec.operation === 'count') {
                    const values = data.map(r => spec.column ? parseFloat(r[spec.column]) : 1).filter(n => !isNaN(n));
                    const total = values.reduce((s, v) => s + v, 0);

                    if (spec.operation === 'avg') value = total / (values.length || 1);
                    else if (spec.operation === 'unique') value = new Set(data.map(r => r[spec.column!])).size;
                    else value = total;

                    if (spec.format === 'currency') value = this.formatCurrency(value);
                    else if (spec.format === 'percentage') value = `${(value * 100).toFixed(1)}%`;
                    else value = Math.round(value).toLocaleString();

                    sparkline = this.generateSparkline(values.slice(0, 50));
                }

                kpis.push({
                    id: spec.id,
                    label: spec.label,
                    value,
                    category: spec.category,
                    importance: spec.importance as any,
                    sparklineData: sparkline,
                    calculation: {
                        column: spec.column,
                        operation: spec.operation,
                        format: spec.format
                    }
                } as any);
            });
        }

        // --- 2. Volume KPIs ---
        if (!kpis.find(k => k.id === 'total_records')) {
            kpis.push({
                id: 'total_records',
                label: 'Total Records',
                value: totalRows,
                category: 'volume',
                trend: 0,
                trendDirection: 'neutral'
            });
        }

        // --- 3. Financial Discovery ---
        const currencyCols = profiles.filter(p => p.role === 'currency' || (p.dataType === 'number' && (p.column.toLowerCase().includes('price') || p.column.toLowerCase().includes('amount') || p.column.toLowerCase().includes('total') || p.column.toLowerCase().includes('cost') || p.column.toLowerCase().includes('revenue'))));

        currencyCols.slice(0, 2).forEach(col => {
            if (kpis.find(k => k.id.includes(col.column))) return;
            const values = data.map(r => parseFloat(r[col.column])).filter(n => !isNaN(n));
            const total = values.reduce((sum, val) => sum + val, 0);

            kpis.push({
                id: `total_${col.column}`,
                label: `Total ${col.column}`,
                value: this.formatCurrency(total),
                category: 'financial',
                calculation: { column: col.column, operation: 'sum', format: 'currency' }
            });
        });

        // --- 4. Quality Discovery ---
        const qualityScore = Object.values(profiles).reduce((acc, p) => acc + (1 - p.nullPercent / 100), 0) / profiles.length;
        if (!kpis.find(k => k.id === 'data_health')) {
            kpis.push({
                id: 'data_health',
                label: 'Data Health Score',
                value: `${(qualityScore * 100).toFixed(1)}%`,
                category: 'quality',
                status: qualityScore > 0.9 ? 'on_track' : (qualityScore > 0.7 ? 'at_risk' : 'off_track')
            });
        }
        return kpis.slice(0, 10);
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

    private static generateCharts(data: any[], profiles: ColumnProfile[], blueprint?: DashboardBlueprint): ChartSpec[] {
        const charts: ChartSpec[] = [];
        const cols = profiles;

        // --- 1. AI Blueprint Charts (Strategic Choice) ---
        if (blueprint && blueprint.recommendedCharts) {
            blueprint.recommendedCharts.forEach(spec => {
                let chartData: any[] = [];
                const xCol = profiles.find(p => p.column === spec.xAxis);
                const yCol = profiles.find(p => p.column === spec.yAxis);

                if (!xCol) return;

                if (spec.type === 'sunburst') {
                    // AI suggested a hierarchy discovery
                    chartData = this.aggregateByCategory(data, spec.xAxis, spec.yAxis, spec.aggregation as any);
                } else if (spec.type === 'scatter') {
                    chartData = data.slice(0, 500).map(r => ({ x: r[spec.xAxis], y: r[spec.yAxis] }));
                } else if (spec.type === 'line' && xCol.dataType === 'date') {
                    chartData = this.aggregateByTime(data, spec.xAxis, spec.yAxis);
                } else {
                    chartData = this.aggregateByCategory(data, spec.xAxis, spec.yAxis, spec.aggregation as any);
                }

                charts.push({
                    id: spec.id,
                    title: spec.title,
                    type: spec.type as any,
                    priority: spec.priority as any,
                    size: (spec.type === 'sunburst' || spec.type === 'line') ? 'large' : 'medium',
                    description: spec.description,
                    data: chartData,
                    options: { xAxis: spec.xAxis, yAxis: spec.yAxis }
                });
            });
        }

        // --- 2. Statistical Discoveries (Secondary) ---
        const dateCol = cols.find(p => p.role === 'timestamp' || p.dataType === 'date');
        const catCols = cols.filter(p => p.dataType === 'string' && p.uniqueCount < 50 && p.uniqueCount > 1);
        const numCols = cols.filter(p => p.dataType === 'number' && p.role !== 'identifier');
        const geoCols = cols.filter(p => ['city', 'country', 'region', 'state', 'zip'].includes(p.role));

        // Time trends if not in blueprint
        if (dateCol && numCols.length > 0 && charts.length < 4) {
            numCols.slice(0, 2).forEach(num => {
                if (!charts.find(c => c.id.includes(num.column))) {
                    charts.push({
                        id: `trend_discovery_${num.column}`,
                        title: `${num.column} Momentum`,
                        type: 'line',
                        priority: 'medium',
                        size: 'large',
                        data: this.aggregateByTime(data, dateCol.column, num.column),
                        options: { xAxis: 'Date', yAxis: num.column }
                    });
                }
            });
        }

        // Categorical breakdowns
        catCols.slice(0, 3).forEach(cat => {
            if (charts.length > 10) return;
            const metric = numCols[0];
            const op = /avg|rating|score|satisfaction|stay|age/i.test(metric?.column || '') ? 'avg' : 'sum';

            charts.push({
                id: `dist_auto_${cat.column}`,
                title: `${cat.column} Analysis`,
                type: 'bar',
                priority: 'low',
                size: 'medium',
                data: this.aggregateByCategory(data, cat.column, metric?.column, op),
                options: { xAxis: cat.column, yAxis: metric?.column || 'Count' }
            });
        });

        // 6. Pro Visuals: Maps (Always High Priority if exists)
        if (geoCols.length > 0 && numCols.length > 0) {
            const geo = geoCols[0];
            const metric = numCols[0];
            charts.push({
                id: `geo_map_${geo.column}`,
                title: `Geographic Distribution: ${metric.column}`,
                type: geo.role === 'country' ? 'choropleth' : 'scattergeo',
                priority: 'high',
                size: 'large',
                data: this.aggregateByCategory(data, geo.column, metric.column),
                options: { xAxis: geo.column, yAxis: metric.column }
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

    private static generateInsights(kpis: KPI[], charts: ChartSpec[], blueprint?: DashboardBlueprint): string[] {
        const insights: string[] = [];

        if (blueprint && blueprint.objective) {
            insights.push(`Analytical Objective: ${blueprint.objective}`);
        }

        // Growth insights
        const records = kpis.find(k => k.id === 'total_records');
        if (records) insights.push(`Dataset comprises ${records.value.toLocaleString()} audited records.`);

        // AI specific insights
        if (blueprint && blueprint.semanticContext) {
            const meanings = Object.values(blueprint.semanticContext).slice(0, 3);
            if (meanings.length > 0) {
                insights.push(`Data Intelligence: Core metrics focused on ${meanings.join(', ')}.`);
            }
        }

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

    private static aggregateByCategory(data: any[], catCol: string, metricCol?: string, op: 'sum' | 'avg' | 'count' = 'sum') {
        const sums: Record<string, number> = {};
        const counts: Record<string, number> = {};

        data.forEach(row => {
            const key = row[catCol] || 'Unknown';
            let val = 1;

            if (metricCol) {
                const rawVal = row[metricCol];
                if (typeof rawVal === 'string') {
                    const lowVal = rawVal.toLowerCase();
                    if (lowVal === 'yes' || lowVal === 'true' || lowVal === 'high' || lowVal === 'recovered') val = 1;
                    else if (lowVal === 'no' || lowVal === 'false' || lowVal === 'low' || lowVal === 'stable') val = 0;
                    else val = parseFloat(rawVal) || 0;
                } else {
                    val = parseFloat(rawVal) || 0;
                }
            }

            sums[key] = (sums[key] || 0) + val;
            counts[key] = (counts[key] || 0) + 1;
        });

        if (op === 'avg') {
            return Object.entries(sums).map(([name, sum]) => ({
                name,
                value: parseFloat((sum / (counts[name] || 1)).toFixed(2))
            })).sort((a, b) => b.value - a.value);
        }

        return Object.entries(sums).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
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

        // 2. AI Strategy
        const blueprint = await AnalysisStrategist.generateBlueprint(headers, forensics.profiles, sample);

        // 3. Base Analytics
        const allKpis = this.generateKPIs(data, forensics.profiles, blueprint);
        const allCharts = this.generateCharts(data, forensics.profiles, blueprint);

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
                filteredKpis = allKpis.slice(0, 10); // More KPIs
                filteredCharts = allCharts.slice(0, 12); // Way more charts for a "Pro" feel
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
