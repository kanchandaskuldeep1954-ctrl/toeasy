
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
    yAxis: string;
    aggregation: 'sum' | 'avg' | 'count' | 'none';
    description: string;
    priority: 'high' | 'medium';
}

export class AnalysisStrategist {

    static async generateBlueprint(headers: string[], profiles: ColumnProfile[], sample: any[]): Promise<DashboardBlueprint> {
        // Prepare metadata for LLM
        const metadata = profiles.map(p => ({
            column: p.column,
            role: p.role,
            type: p.dataType,
            sample: p.sampleValues.slice(0, 3)
        }));

        const prompt = `You are a World-Class Data Strategy Consultant and Chief Analytics Officer.
Analyze this dataset metadata and provide a Strategic Dashboard Blueprint.

Headers: ${headers.join(', ')}
Profiles: ${JSON.stringify(metadata)}
Sample Rows: ${JSON.stringify(sample.slice(0, 3))}

### TASK:
1. Identify the specific INDUSTRY and the PRIMARY BUSINESS OBJECTIVE (e.g., "SaaS Revenue Growth", "Hospital Operational Efficiency", "Logistics Fuel Optimization").
2. Define 3-5 CRITICAL KPIs that a CEO or Manager in this industry would care about most.
3. Recommend 4-6 HIGH-VALUE CHARTS including at least one hierarchical discovery chart (sunburst) and one correlation analysis (scatter).
4. Provide semantic context: What does each column ACTUALLY represent in the real world?

### SYNTAX RULES:
- Use correct Column Names from the list.
- KPIs must have an operation: sum, avg, count, unique, min, or max.
- Charts must have a type: bar, line, pie, funnel, heatmap, scatter, sunburst, or box.
- Output ONLY valid JSON.

### OUTPUT FORMAT:
{
  "industry": "string",
  "objective": "string",
  "targetAudience": "string",
  "semanticContext": { "col_name": "real world meaning" },
  "recommendedKPIs": [
    { "id": "slug", "label": "Human Label", "column": "col_name", "operation": "avg", "format": "number", "category": "efficiency", "importance": "critical" }
  ],
  "recommendedCharts": [
    { "id": "slug", "title": "Chart Title", "type": "bar", "xAxis": "col1", "yAxis": "col2", "aggregation": "avg", "description": "why this matters", "priority": "high" }
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
            recommendedCharts: []
        };
    }
}
