
import { DashboardConfig, ChartSpec, KPI, AnalyticsEngine } from './analyticsEngine.js';

export type IndustryType = 'ecommerce' | 'saas' | 'finance' | 'healthcare' | 'manufacturing';

export class IndustryDashboards {

    static getTemplate(industry: IndustryType, data: any[]): Partial<DashboardConfig> {
        switch (industry) {
            case 'ecommerce': return this.getEcommerceTemplate(data);
            case 'saas': return this.getSaaSTemplate(data);
            case 'finance': return this.getFinanceTemplate(data);
            case 'healthcare': return this.getHealthcareTemplate(data);
            case 'manufacturing': return this.getManufacturingTemplate(data);
            default: return {};
        }
    }

    private static getEcommerceTemplate(data: any[]): Partial<DashboardConfig> {
        return {
            kpis: [
                { id: 'conversion_rate', label: 'Conversion Rate', value: '3.2%', category: 'efficiency', status: 'on_track' },
                { id: 'aov', label: 'Avg Order Value', value: '$85.00', category: 'financial' },
                { id: 'cart_abandonment', label: 'Cart Abandonment', value: '45%', category: 'operational', status: 'at_risk' },
                { id: 'cac', label: 'CAC', value: '$12.50', category: 'financial' }
            ] as KPI[],
            charts: [
                {
                    id: 'sales_funnel',
                    title: 'Sales Funnel',
                    type: 'funnel',
                    priority: 'high',
                    size: 'medium',
                    data: [
                        { label: 'Visitors', value: 10000 },
                        { label: 'Viewed Product', value: 5000 },
                        { label: 'Added to Cart', value: 2000 },
                        { label: 'Purchased', value: 320 }
                    ],
                    options: {}
                },
                {
                    id: 'sales_trend',
                    title: 'Sales Trend',
                    type: 'line',
                    priority: 'high',
                    size: 'large',
                    data: [], // To be populated with real data
                    options: { xAxis: 'Date', yAxis: 'Amount' }
                }
            ] as ChartSpec[]
        };
    }

    private static getSaaSTemplate(data: any[]): Partial<DashboardConfig> {
        return {
            kpis: [
                { id: 'mrr', label: 'MRR', value: '$0.00', category: 'financial' },
                { id: 'arr', label: 'ARR', value: '$0.00', category: 'financial' },
                { id: 'churn', label: 'Churn Rate', value: '0%', category: 'efficiency' },
                { id: 'ltv', label: 'LTV', value: '$0', category: 'financial' }
            ] as KPI[],
            charts: [
                {
                    id: 'mrr_growth',
                    title: 'MRR Growth',
                    type: 'bar',
                    priority: 'high',
                    size: 'large',
                    data: [],
                    options: { xAxis: 'Month', yAxis: 'MRR' }
                }
            ] as ChartSpec[]
        };
    }

    private static getFinanceTemplate(data: any[]): Partial<DashboardConfig> {
        return {
            kpis: [
                { id: 'roi', label: 'ROI', value: '150%', category: 'financial', status: 'on_track' },
                { id: 'net_margin', label: 'Net Margin', value: '25%', category: 'financial' },
                { id: 'burn_rate', label: 'Burn Rate', value: '$50k/mo', category: 'operational' },
                { id: 'liquidity', label: 'Liquidity Ratio', value: '1.5', category: 'financial' }
            ] as KPI[],
            charts: [
                {
                    id: 'expense_breakdown',
                    title: 'Expense Breakdown',
                    type: 'doughnut',
                    priority: 'medium',
                    size: 'medium',
                    data: [],
                    options: {}
                }
            ] as ChartSpec[]
        };
    }

    private static getHealthcareTemplate(data: any[]): Partial<DashboardConfig> {
        return {
            kpis: [
                { id: 'occupancy', label: 'Bed Occupancy', value: '85%', category: 'operational', status: 'at_risk' },
                { id: 'wait_time', label: 'Avg Wait Time', value: '15m', category: 'efficiency', status: 'on_track' },
                { id: 'readmission', label: 'Readmission Rate', value: '4%', category: 'quality' },
                { id: 'patient_sat', label: 'Patient Satisfaction', value: '4.8/5', category: 'quality' }
            ] as KPI[],
            charts: [
                {
                    id: 'patient_flow',
                    title: 'Patient Flow',
                    type: 'bar-horizontal',
                    priority: 'high',
                    size: 'large',
                    data: [],
                    options: {}
                }
            ] as ChartSpec[]
        };
    }

    private static getManufacturingTemplate(data: any[]): Partial<DashboardConfig> {
        return {
            kpis: [
                { id: 'oee', label: 'OEE', value: '78%', category: 'efficiency', status: 'at_risk' }, // Overall Equipment Effectiveness
                { id: 'defect_rate', label: 'Defect Rate', value: '0.5%', category: 'quality', status: 'on_track' },
                { id: 'downtime', label: 'Downtime', value: '2h', category: 'operational' },
                { id: 'yield', label: 'Yield', value: '98%', category: 'efficiency' }
            ] as KPI[],
            charts: [
                {
                    id: 'production_output',
                    title: 'Daily Output',
                    type: 'line',
                    priority: 'high',
                    size: 'large',
                    data: [],
                    options: {}
                }
            ] as ChartSpec[]
        };
    }
}
