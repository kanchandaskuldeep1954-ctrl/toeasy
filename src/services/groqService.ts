import { Dataset, AnalysisInsight, ChartSpec, CleaningAction, ValidationRule, DataRow, KPI, SourceType, RuleCategory, DashboardConfig, StrategicReport, QualityDimension } from "../../types";
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
  static async analyzeDatasetSemantics(dataset: Dataset): Promise<any> {
    const response = await this.callApi<{ result: any }>('analyze', 'POST', { dataset });
    return response.result; // This is the semantic analysis object from backend
  }

  // Synthetic data generation
  static async generateSyntheticDataset(topic: string, fields: string[], count: number): Promise<DataRow[]> {
    const result = await this.callApi<{ data: DataRow[] }>('generate-synthetic', 'POST', { topic, fields, count });
    return result.data;
  }

  // Real Web Scraper
  static async scrapeRealWeb(url: string, topic: string, fields: string[], count: number): Promise<DataRow[]> {
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
  // ENHANCED: Handles formula-based recovery, complex expressions, and detailed audit trail
  static applyBatchRulesToDataset(dataset: Dataset, rules: ValidationRule[]): Dataset {
    console.log(`[Cleaning Engine] Processing ${(dataset.data || []).length} rows with ${rules.length} rules`);

    // Combine main data and any previously quarantined data
    let pool = JSON.parse(JSON.stringify([...(dataset.data || []), ...(dataset.quarantinedData || [])])) as DataRow[];

    // Initialize metadata for all rows
    pool.forEach(row => {
      if (!row.__metadata) {
        row.__metadata = {
          recoveredFields: [],
          validationErrors: [],
          recoveryExplanations: {},
          auditLog: []
        };
      } else {
        row.__metadata.validationErrors = [];
        row.__metadata.auditLog = row.__metadata.auditLog || [];
      }
    });

    const activeRules = rules.filter(r => r.active);
    const recoveryRules = activeRules.filter(r => r.category === 'Recovery');
    const auditRules = activeRules.filter(r => r.category === 'Audit');

    console.log(`[Cleaning Engine] Active rules: ${recoveryRules.length} recovery, ${auditRules.length} audit`);

    const MAX_PASSES = 6;
    let totalRecoveries = 0;

    // Multi-pass recovery for handling dependencies
    for (let pass = 1; pass <= MAX_PASSES; pass++) {
      let changesInPass = 0;

      pool.forEach((row, index) => {
        recoveryRules.forEach(rule => {
          try {
            const val = row[rule.column];

            // Build the check function with error handling
            const checkFn = new Function('value', 'row', 'index', 'fullData', `
              try { 
                return (${rule.expression}); 
              } catch(e) { 
                return true; 
              }
            `);

            const isValid = checkFn(val, row, index, pool);

            if (!isValid && rule.healFunction) {
              // Execute heal function with comprehensive error handling
              const healFn = new Function('value', 'row', 'index', 'fullData', `
                try { 
                  ${rule.healFunction} 
                } catch(e) { 
                  console.warn('Heal function error:', e.message);
                }
              `);

              const preHealVal = JSON.stringify(row[rule.column]);
              healFn(val, row, index, pool);
              const postHealVal = JSON.stringify(row[rule.column]);

              if (preHealVal !== postHealVal) {
                // Track the recovery
                if (!row.__metadata!.recoveredFields!.includes(rule.column)) {
                  row.__metadata!.recoveredFields!.push(rule.column);
                }
                row.__metadata!.recoveryExplanations![rule.column] = `[Pass ${pass}] ${rule.description}`;
                row.__metadata!.recoveryPass = pass;
                row.__metadata!.auditLog!.push({
                  action: 'recovered',
                  field: rule.column,
                  from: preHealVal,
                  to: postHealVal,
                  rule: rule.id,
                  pass: pass,
                  timestamp: new Date().toISOString()
                });
                changesInPass++;
                totalRecoveries++;
              }
            }
          } catch (e) {
            console.warn(`Rule execution error (${rule.id}):`, e);
          }
        });
      });

      console.log(`[Cleaning Engine] Pass ${pass}: ${changesInPass} recoveries`);

      // Optimization: stop if no changes in this pass (equilibrium reached)
      if (changesInPass === 0 && pass > 1) {
        console.log(`[Cleaning Engine] Equilibrium reached at pass ${pass}`);
        break;
      }
    }

    // Audit phase: validate all rows against audit rules
    const cleanData: DataRow[] = [];
    const vaultData: DataRow[] = [];

    pool.forEach((row, index) => {
      let quarantine = false;
      const violations: string[] = [];

      auditRules.forEach(rule => {
        try {
          // Handle multi-column rules (column = '*')
          const targetCol = rule.column === '*' ? null : rule.column;
          const val = targetCol ? row[targetCol] : null;

          const checkFn = new Function('value', 'row', 'index', 'fullData', `
            try { 
              return (${rule.expression}); 
            } catch(e) { 
              return true; 
            }
          `);

          if (!checkFn(val, row, index, pool)) {
            const severity = rule.severity || 'error';
            violations.push(`${rule.qualityDimension || 'Validity'}: ${rule.description}`);

            // Only quarantine on critical/error severity
            if (severity === 'critical' || severity === 'error') {
              quarantine = true;
            }
          }
        } catch (e) {
          // Rule execution failed, don't quarantine due to rule error
          console.warn(`Audit rule execution error (${rule.id}):`, e);
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

    const healthScore = Math.round((cleanData.length / Math.max(pool.length, 1)) * 100);

    console.log(`[Cleaning Engine] Complete: ${cleanData.length} clean, ${vaultData.length} quarantined, ${totalRecoveries} total recoveries, health: ${healthScore}%`);

    return {
      ...dataset,
      data: cleanData,
      quarantinedData: vaultData,
      healthScore,
    };
  }


  // Suggest validation rules
  static async suggestValidationRules(dataset: Dataset, semanticContext?: any): Promise<ValidationRule[]> {
    try {
      const result = await this.callApi<{ rules: ValidationRule[] }>('suggest-rules', 'POST', { dataset, semanticContext });
      return result.rules || [];
    } catch (e) {
      console.warn("Suggest rules failed, returning empty rules:", e);
      return [];
    }
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
  static async consultVerifiedAgent(dataset: Dataset, query: string, context?: any, history?: any[]): Promise<string> {
    try {
      if (!dataset.id || !dataset.workspace_id) throw new Error("Dataset ID missing");
      const response = await apiClient.post<{ reply: string }>(
        `/workspaces/${dataset.workspace_id}/datasets/${dataset.id}/chat`,
        { message: query, context }
      );
      return response.data.reply;
    } catch (e) {
      console.error("Agent chat failed", e);
      return "I'm having trouble connecting to the Pro Cleaning Agent. Please try again.";
    }
  }

  // Deep Semantic Analysis (Pro)
  static async analyzePro(dataset: Dataset): Promise<any> {
    if (!dataset.id || !dataset.workspace_id) return null;
    try {
      const response = await apiClient.post<{ analysis: any }>(
        `/workspaces/${dataset.workspace_id}/datasets/${dataset.id}/analyze-pro`,
        {}
      );
      return response.data.analysis;
    } catch (e) {
      console.error("Pro Analysis failed", e);
      return null;
    }
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
  static async generateReport(dataset: Dataset, reportType: string = 'strategic', extraContext?: { cleaningHistory?: any[], activityLogs?: any[], webData?: any }): Promise<StrategicReport> {
    return await this.callApi<StrategicReport>('generate-report', 'POST', { dataset, reportType, extraContext });
  }

  // Modify report with AI (Copilot)
  static async modifyReport(dataset: Dataset, report: StrategicReport, instruction: string): Promise<StrategicReport> {
    return await this.callApi<StrategicReport>('modify-report', 'POST', { dataset, report, instruction });
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
   * Pivot data for 2D Heatmaps and Matrix charts
   */
  static matrixPivot(
    data: DataRow[],
    xColumn: string,
    yColumn: string,
    valueColumn: string
  ): Array<{ x: string; y: string; z: number }> {
    try {
      const pivoted: Array<{ x: string; y: string; z: number }> = [];
      const xSet = new Set<string>();
      const ySet = new Set<string>();

      data.forEach(row => {
        const x = String(row[xColumn] || 'Unknown');
        const y = String(row[yColumn] || 'Default');
        const z = Number(row[valueColumn]) || 0;
        pivoted.push({ x, y, z });
        xSet.add(x);
        ySet.add(y);
      });

      // If cardinality is too high, limit it to preserve performance
      if (xSet.size > 20 || ySet.size > 20) {
        const topX = Array.from(xSet).slice(0, 20);
        const topY = Array.from(ySet).slice(0, 20);
        return pivoted.filter(p => topX.includes(p.x) && topY.includes(p.y));
      }

      return pivoted;
    } catch (e) {
      console.error('Matrix pivot error:', e);
      return [];
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

      // For heatmaps, use matrix pivot if two axes provided
      if (chartSpec.type === 'heatmap' && xAxis && yAxis && xAxis !== yAxis) {
        return GroqService.matrixPivot(data, xAxis, yAxis, yAxis) as any;
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

  /**
   * Calculate time-based aggregation (monthly, quarterly, yearly)
   * Detects appropriate interval based on data range
   */
  static aggregateByTime(
    data: DataRow[],
    dateColumn: string,
    valueColumn: string,
    operation: 'sum' | 'avg' | 'count' = 'sum'
  ): Array<{ label: string; value: number }> {
    try {
      const aggregated: { [key: string]: any } = {};

      for (const row of data) {
        const dateStr = String(row[dateColumn] || '');
        const value = Number(row[valueColumn]) || 0;

        // Extract year-month from various date formats
        const match = dateStr.match(/(\d{4})-(\d{2})/);
        if (!match) continue;

        const yearMonth = `${match[1]}-${match[2]}`;

        if (!aggregated[yearMonth]) {
          aggregated[yearMonth] = { values: [], count: 0, sum: 0 };
        }

        aggregated[yearMonth].values.push(value);
        aggregated[yearMonth].count += 1;
        aggregated[yearMonth].sum += value;
      }

      // Convert to result format
      const result = Object.entries(aggregated)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([label, data]: [string, any]) => {
          let resultValue = 0;
          switch (operation) {
            case 'sum':
              resultValue = data.sum;
              break;
            case 'avg':
              resultValue = data.sum / data.count;
              break;
            case 'count':
              resultValue = data.count;
              break;
          }
          return { label, value: resultValue };
        });

      return result;
    } catch (error) {
      console.error('Time aggregation error:', error);
      return [];
    }
  }
}

