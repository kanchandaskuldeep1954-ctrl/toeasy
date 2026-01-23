import { Dataset, AnalysisInsight, ChartSpec, CleaningAction, ValidationRule, DataRow, KPI, SourceType, RuleCategory, DashboardConfig, StrategicReport, QualityDimension } from "../types";

/**
 * GroqService - Now a client-side HTTP wrapper
 * All actual API calls go to the Railway backend
 * The API key stays secure on the server side
 * Uses proper environment variable for backend URL
 */
export class GroqService {
  private static getBaseUrl(): string {
    const backendUrl = (import.meta as any).env.VITE_BACKEND_URL;
    console.log('GroqService.getBaseUrl() - VITE_BACKEND_URL:', backendUrl);
    if (backendUrl) {
      // Remove trailing /api if present
      return backendUrl.endsWith('/api') ? backendUrl.slice(0, -4) : backendUrl;
    }
    // Fallback for development
    return typeof window !== 'undefined' ? '' : 'http://localhost:3000';
  }

  private static async callApi<T>(endpoint: string, method: 'POST' | 'GET' = 'POST', body?: any): Promise<T> {
    try {
      const baseUrl = this.getBaseUrl();
      const url = `${baseUrl}/api/${endpoint}`;
      console.log(`Calling API: ${method} ${url}`, body);

      // Get auth token from localStorage
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No token provided');
      }

      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `API error: ${response.status}`);
      }

      return await response.json() as T;
    } catch (error: any) {
      console.error(`API call to ${endpoint} failed:`, error);
      throw error;
    }
  }

  // Deep semantic analysis
  static async analyzeDatasetSemantics(dataset: Dataset): Promise<string> {
    const result = await this.callApi<{ result: string }>('analyze', 'POST', { dataset });
    return result.result;
  }

  // Synthetic data generation
  static async generateSyntheticDataset(topic: string, fields: string[], count: number): Promise<any> {
    const result = await this.callApi<{ data: DataRow[]; count: number; tier: string; maxAllowed: number; generatedAt: string }>('generate-synthetic', 'POST', { topic, fields, count });
    // Return the full response object including metadata
    return result;
  }

  // Real Web Scraper
  static async scrapeRealWeb(url: string, topic: string, fields: string[], count: number): Promise<any> {
    const result = await this.callApi<{ data: DataRow[] }>('scrape', 'POST', { url, topic, fields, count });
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

  // Generate KPI from prompt
  static async generateKPIFromPrompt(dataset: Dataset, prompt: string): Promise<KPI> {
    return await this.callApi<KPI>('generate-kpi', 'POST', { dataset, prompt });
  }

  // Modify KPI with AI
  static async modifyKPIWithAI(dataset: Dataset, kpi: KPI, prompt: string): Promise<KPI> {
    return await this.callApi<KPI>('modify-kpi', 'POST', { dataset, kpi, prompt });
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
  // ===== CLIENT-SIDE SMART UTILITIES =====

  /**
   * Smart data aggregation for high-cardinality data
   * Groups and aggregates data intelligently with support for "Other" category
   */
  static smartAggregateData(
    data: DataRow[],
    xColumn: string,
    yColumn: string,
    aggregation: string = 'sum',
    limit: number = 15,
    showOther: boolean = true
  ): Array<{ label: string; value: number }> {
    try {
      if (!data || data.length === 0) return [];

      const aggregated: { [key: string]: any } = {};

      // Group data
      for (const row of data) {
        const xVal = String(row[xColumn] || 'Unknown').trim();
        const yVal = Number(row[yColumn]) || 0;

        if (!aggregated[xVal]) {
          aggregated[xVal] = {
            label: xVal,
            value: 0,
            count: 0,
            sum: 0,
            max: yVal,
            min: yVal
          };
        }

        aggregated[xVal].sum += yVal;
        aggregated[xVal].count += 1;
        aggregated[xVal].max = Math.max(aggregated[xVal].max, yVal);
        aggregated[xVal].min = Math.min(aggregated[xVal].min, yVal);
      }

      // Apply aggregation function
      const result = Object.values(aggregated).map((item: any) => {
        let value = 0;
        switch (aggregation.toLowerCase()) {
          case 'sum':
            value = item.sum;
            break;
          case 'avg':
          case 'average':
            value = item.sum / item.count;
            break;
          case 'count':
            value = item.count;
            break;
          case 'max':
            value = item.max;
            break;
          case 'min':
            value = item.min;
            break;
          default:
            value = item.sum;
        }

        return { label: item.label, value };
      });

      // Sort by value descending
      result.sort((a, b) => b.value - a.value);

      // Handle limit and "Other" category
      if (result.length > limit) {
        const topItems = result.slice(0, limit);
        const otherItems = result.slice(limit);

        if (showOther && otherItems.length > 0) {
          const otherValue = otherItems.reduce((sum: number, item: any) => sum + item.value, 0);
          topItems.push({ label: 'Other', value: otherValue });
        }

        return topItems;
      }

      return result;
    } catch (error) {
      console.error('Smart aggregation error:', error);
      return data.slice(0, limit).map((item: any) => ({
        label: String(item[xColumn] || 'Unknown'),
        value: Number(item[yColumn]) || 0
      }));
    }
  }

  /**
   * Transform raw data for chart rendering
   * Handles aggregation, sorting, and data quality issues
   */
  static transformChartData(
    data: DataRow[],
    chartSpec: ChartSpec
  ): Array<{ label: string; value: number;[key: string]: any }> {
    try {
      if (!data || !chartSpec) return [];

      const { xAxis, yAxis, aggregation, limit, showOther } = chartSpec;

      // For scatter plots, return raw data
      if (chartSpec.type === 'scatter') {
        return data.map(row => ({
          label: String(row[xAxis] || ''),
          value: Number(row[yAxis]) || 0,
          [xAxis]: Number(row[xAxis]) || 0,
          [yAxis]: Number(row[yAxis]) || 0
        }));
      }

      // For all other charts, use smart aggregation
      return GroqService.smartAggregateData(
        data,
        xAxis,
        yAxis,
        aggregation || 'sum',
        limit || 15,
        showOther !== false
      );
    } catch (error) {
      console.error('Chart data transformation error:', error);
      return [];
    }
  }
}
