import { Dataset, AnalysisInsight, ChartSpec, CleaningAction, ValidationRule, DataRow, KPI, SourceType, RuleCategory, DashboardConfig, StrategicReport, QualityDimension } from "../types";
import { apiClient } from "./apiClient.js";

/**
 * GroqService - Now a client-side HTTP wrapper
 * All actual API calls go to the backend API via apiClient
 * The API key stays secure on the server side
 * apiClient automatically handles VITE_BACKEND_URL environment variable
 */
export class GroqService {
  private static async callApi<T>(endpoint: string, method: 'POST' | 'GET' = 'POST', body?: any): Promise<T> {
    try {
      console.log(`Calling backend API: ${method} /${endpoint}`, body);
      const response = method === 'POST' 
        ? await apiClient.post<T>(`/${endpoint}`, body)
        : await apiClient.get<T>(`/${endpoint}`);
      
      console.log(`API response from /${endpoint}:`, response.data);
      return response.data as T;
    } catch (error: any) {
      console.error(`API call to ${endpoint} failed:`, error);
      if (error.response?.data) {
        throw new Error(error.response.data.error || `API error: ${error.response.status}`);
      }
      throw new Error(error.message || 'Unknown error');
    }
  }
  
  // Deep semantic analysis
  static async analyzeDatasetSemantics(dataset: Dataset): Promise<string> {
    const result = await this.callApi<{ result: string }>('analyze', 'POST', { dataset });
    return result.result;
  }

  // Synthetic data generation
  static async generateSyntheticDataset(topic: string, fields: string[], count: number): Promise<DataRow[]> {
    const result = await this.callApi<{ data: DataRow[] }>('generate-synthetic', 'POST', { topic, fields, count });
    return result.data;
  }

  // Generate validation logic from description
  static async generateLogicFromDescription(
    dataset: Dataset,
    category: RuleCategory,
    title: string
  ): Promise<{ expression: string; healFunction?: string; relationshipType: string; category?: RuleCategory; qualityDimension?: QualityDimension }> {
    return await this.callApi('generate-logic', 'POST', { dataset, category, title });
  }

  // Batch apply rules to dataset (client-side operation)
  static applyBatchRulesToDataset(dataset: Dataset, rules: ValidationRule[]): Dataset {
    let pool = JSON.parse(JSON.stringify([...(dataset.data || []), ...(dataset.quarantinedData || [])])) as DataRow[];

    pool.forEach(row => {
      if (!row.__metadata) {
        row.__metadata = { recoveredFields: [], validationErrors: [], recoveryExplanations: {} };
      } else {
        row.__metadata.validationErrors = [];
      }
    });

    const activeRules = rules.filter(r => r.active);
    const recoveryRules = activeRules.filter(r => r.category === 'Recovery');
    const auditRules = activeRules.filter(r => r.category === 'Audit');

    const MAX_PASSES = 6;

    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      let changesInPass = 0;

      pool.forEach((row, index) => {
        recoveryRules.forEach(rule => {
          try {
            const val = row[rule.column];

            const checkFn = new Function('value', 'row', 'index', 'fullData', `try { return (${rule.expression}); } catch(e) { return true; }`);
            const isValid = checkFn(val, row, index, pool);

            if (!isValid && rule.healFunction) {
              const healFn = new Function('value', 'row', 'index', 'fullData', `try { ${rule.healFunction} } catch(e) {}`);
              const preHealVal = JSON.stringify(row[rule.column]);

              healFn(val, row, index, pool);

              const postHealVal = JSON.stringify(row[rule.column]);

              if (preHealVal !== postHealVal) {
                if (!row.__metadata!.recoveredFields!.includes(rule.column)) {
                  row.__metadata!.recoveredFields!.push(rule.column);
                }
                row.__metadata!.recoveryExplanations![rule.column] = `[Pass ${pass}] ${rule.description}`;
                row.__metadata!.recoveryPass = pass;
                changesInPass++;
              }
            }
          } catch (e) { }
        });
      });

      if (changesInPass === 0 && pass > 1) break;
    }

    const cleanData: DataRow[] = [];
    const vaultData: DataRow[] = [];

    pool.forEach((row, index) => {
      let quarantine = false;
      const violations: string[] = [];

      auditRules.forEach(rule => {
        const val = row[rule.column];
        const checkFn = new Function('value', 'row', 'index', 'fullData', `try { return (${rule.expression}); } catch(e) { return true; }`);

        if (!checkFn(val, row, index, pool)) {
          violations.push(`${rule.qualityDimension || 'Validity'}: ${rule.description}`);
          quarantine = true;
        }
      });

      row.__metadata!.validationErrors = violations;

      if (quarantine) {
        row.__metadata!.isQuarantined = true;
        vaultData.push(row);
      } else {
        row.__metadata!.isQuarantined = false;
        cleanData.push(row);
      }
    });

    return {
      ...dataset,
      data: cleanData,
      quarantinedData: vaultData,
      healthScore: Math.round((cleanData.length / pool.length) * 100),
    };
  }

  // Suggest validation rules
  static async suggestValidationRules(dataset: Dataset, semanticContext?: string): Promise<ValidationRule[]> {
    const result = await this.callApi<{ rules: ValidationRule[] }>('suggest-rules', 'POST', { dataset, semanticContext });
    return result.rules;
  }

  // Generate rule from natural language
  static async generateRuleFromNL(dataset: Dataset, instruction: string, category: RuleCategory): Promise<ValidationRule> {
    const logic = await this.generateLogicFromDescription(dataset, category, instruction);
    return {
      id: Math.random().toString(36).substr(2),
      category: category,
      column: dataset.headers[0],
      description: instruction,
      active: true,
      ...logic,
    } as any;
  }

  // Consult verified agent
  static async consultVerifiedAgent(dataset: Dataset, query: string, context?: any): Promise<string> {
    const result = await this.callApi<{ result: string }>('consult-agent', 'POST', { dataset, query, context });
    return result.result;
  }

  // Audit dataset (placeholder)
  static async auditDataset(dataset: Dataset): Promise<{ actions: CleaningAction[]; insights: AnalysisInsight[] }> {
    return { actions: [], insights: [] };
  }

  // Generate cleaning code (placeholder)
  static async generateCleaningCode(dataset: Dataset, action: CleaningAction): Promise<string> {
    return "return row;";
  }

  // Suggest dashboard
  static async suggestDashboard(dataset: Dataset): Promise<DashboardConfig> {
    return await this.callApi<DashboardConfig>('suggest-dashboard', 'POST', { dataset });
  }

  // Modify chart with AI
  static async modifyChartWithAI(dataset: Dataset, chart: ChartSpec, prompt: string): Promise<ChartSpec> {
    return await this.callApi<ChartSpec>('modify-chart', 'POST', { dataset, chart, prompt });
  }

  // Generate chart from prompt
  static async generateChartFromPrompt(dataset: Dataset, prompt: string): Promise<ChartSpec> {
    return await this.callApi<ChartSpec>('generate-chart', 'POST', { dataset, prompt });
  }

  // Generate report
  static async generateReport(dataset: Dataset): Promise<StrategicReport> {
    return await this.callApi<StrategicReport>('generate-report', 'POST', { dataset });
  }

  // Extract KPIs
  static async extractKPIs(dataset: Dataset, data: DataRow[]): Promise<KPI[]> {
    const dash = await this.suggestDashboard(dataset);
    return dash.kpis || [];
  }

  // Generate SQL from natural language
  static async generateSQLFromNL(dataset: Dataset, query: string): Promise<{ sql: string; explanation: string }> {
    return await this.callApi('generate-sql', 'POST', { dataset, query });
  }
}
