
import { GroqService } from './groq.service.js';
import { ColumnProfile } from './dataForensicsEngine.js';

export interface DashboardBlueprint {
    industry: string;
    objective: string;
    targetAudience: string;
    recommendedKPIs: BlueprintKPI[];
    recommendedCharts: BlueprintChart[];
    semanticContext: Record<string, string>; // Maps column names to their "Real World" meaning
}

export interface BlueprintKPI {
    id: string;
    label: string;
    column?: string;
    operation: 'sum' | 'avg' | 'count' | 'unique' | 'max' | 'min';
    format: 'currency' | 'number' | 'percentage';
    category: 'financial' | 'operational' | 'quality' | 'volume' | 'efficiency';
    importance: 'critical' | 'secondary';
}

export interface BlueprintChart {
    id: string;
    title: string;
    type: string;
    xAxis: string;
    formula?: string; // Optional mathematical expression for calculated metrics
    aggregation: 'sum' | 'avg' | 'count' | 'none' | 'formula';
    description: string;
    priority: 'high' | 'medium';
}


export class AnalysisStrategist {

    private static readonly STRATEGY_TEMPLATES: Record<string, string> = {
        sales_data: "STRATEGY: SALES INTELLIGENCE. Focus on Revenue Growth, Customer Acquisition Cost (CAC), and Lifetime Value (LTV). Critical charts: Revenue over Time (Line), Top Products (Bar), Sales by Region (Map/Bar).",
        financial_report: "STRATEGY: FINANCIAL HEALTH. Focus on Profit Margins, OpEx vs CapEx, and Liquidity. Critical charts: P&L Waterfalls, Expense Breakdown (Treemap), Cash Flow Trends.",
        employee_roster: "STRATEGY: WORKFORCE ANALYTICS. Focus on Headcount, Diversity, and Salary bands. Critical charts: Dept Distribution, Salary vs Experience, Retention/Turnover rates.",
        inventory: "STRATEGY: INVENTORY OPTIMIZATION. Focus on Stock turnover, Days Sales of Inventory (DSI), and Dead stock. Critical charts: Stock Levels by Category, Value Distribution.",
        customer_list: "STRATEGY: CUSTOMER SEGMENTATION. Focus on Demographics, Purchasing Power, and Churn Risk. Critical charts: Age/Location distribution, RFM Analysis.",
        transaction_log: "STRATEGY: TRANSACTION FORENSICS. Focus on Anomaly Detection, Volume Trends, and Avg Transaction Value.",
        time_series: "STRATEGY: TREND ANALYSIS. Focus on Seasonality, Cyclical patterns, and Forecasting.",
        survey_results: "STRATEGY: SENTIMENT & PREFERENCE. Focus on Top choice distribution, Satisfaction scores (NPS), and keyword frequency."
    };

    static async generateBlueprint(headers: string[], profiles: ColumnProfile[], sample: any[], sourceType?: string): Promise<DashboardBlueprint> {
        // Prepare metadata for LLM
        const metadata = profiles.map(p => ({
            column: p.column,
            role: p.role,
            type: p.dataType,
            sample: p.sampleValues.slice(0, 3)
        }));

        const strategyContext = sourceType && this.STRATEGY_TEMPLATES[sourceType]
            ? `\n### DETECTED CONTEXT: ${sourceType.toUpperCase()}\n${this.STRATEGY_TEMPLATES[sourceType]}\n\nBUT DO NOT BE RIGID. Use this only as a starting point. Your true goal is to find the "Hidden Story" in the data.`
            : "\n### CONTEXT: General Data Analysis. The user wants to find the 'Story' hidden in this data.";

        const prompt = `You are Toeasy AI, a brilliant, fun, and first-principles Data Scientist.
Your goal is to make the user's life easier by INSTANTLY finding the most valuable and interesting patterns in their data.
We are NOT building a boring corporate report. We are building a "Data Experience".

Headers: ${headers.join(', ')}
Profiles: ${JSON.stringify(metadata)}
${strategyContext}

### YOUR MISSION:
3. **Dynamic Logic**: Don't settle for raw columns. If a metric like "Net Profit" is missing but "Revenue" and "Cost" exist, suggest a chart with a FORMULA: `row.Revenue - row.Cost`.
4. **Relationship Discovery**: Look for patterns nobody asked for. Outliers? Weird correlations? Pareto distributions?
5. **First Principles**: Ignore "Standard Practices" if they are boring. What is the *fundamental truth* of this dataset?

### TASK:
1. Identify the INDUSTRY and OBJECTIVE.
2. Define 3-5 CRITICAL KPIs.
3. Recommend 4-6 CHARTS. Use varied types (Sunburst, Heatmap, Scatter) to make it visually stunning.
4. **Formula Injection**: If a chart requires a calculation across multiple columns, provide a valid JavaScript-like expression in the "formula" field (e.g., `row["Total Sales"] * 0.2`).
5. **Reasoning**: For every chart, write a 1-sentence "Hook" that explains why this chart is interesting.

### OUTPUT FORMAT (JSON ONLY):
{
  "industry": "string",
  "objective": "string",
  "targetAudience": "string",
  "semanticContext": { "col_name": "real world meaning" },
  "recommendedKPIs": [
    { "id": "slug", "label": "Human Label", "column": "col_name", "operation": "sum", "format": "currency", "category": "efficiency", "importance": "critical" }
  ],
  "recommendedCharts": [
    { "id": "slug", "title": "Chart Title", "type": "bar", "xAxis": "col1", "yAxis": "col2", "aggregation": "formula", "formula": "row.col2 - row.col3", "description": "why this matters", "priority": "high", "reasoning": "The Hook: explaining the fun/value of this chart." }
  ]
}`;

        const response = await GroqService.callGroq(prompt, 3000);
        try {
            // Robust parsing
            let jsonStr = response.trim();
            if (jsonStr.includes('```json')) jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
            else if (jsonStr.includes('```')) jsonStr = jsonStr.split('```')[1].split('```')[0].trim();

            const blueprint = JSON.parse(jsonStr) as DashboardBlueprint;
            console.log(`[Strategist] Blueprint generated for ${blueprint.industry}: ${blueprint.objective}`);
            return blueprint;
        } catch (e) {
            console.error('[Strategist] Blueprint parsing failed, using fallback strategy', e);
            return this.getFallbackBlueprint(headers, profiles);
        }
    }

    private static getFallbackBlueprint(headers: string[], profiles: ColumnProfile[]): DashboardBlueprint {
        return {
            industry: "General Analysis",
            objective: "Exploratory Data Discovery",
            targetAudience: "Data Analyst",
            semanticContext: {},
            recommendedKPIs: [
                { id: 'total_records', label: 'Total Records', operation: 'count', format: 'number', category: 'volume', importance: 'critical' }
            ],
            recommendedCharts: [],
            // @ts-ignore
            semanticContext: {}
        };
    }
}
