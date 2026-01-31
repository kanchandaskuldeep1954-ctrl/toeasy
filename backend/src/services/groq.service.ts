import Groq from 'groq-sdk';
import { config } from '../config.js';
import { DataForensicsEngine } from './dataForensicsEngine.js';
import { AnalyticsEngine } from './analyticsEngine.js';
import { logger } from '../utils/logger.js';
import { SafeExecutor } from '../utils/safeExecutor.js';


const groq = new Groq({
  apiKey: config.groqApiKey,
});

export class GroqService {
  private static readonly model = 'llama-3.3-70b-versatile';
  private static readonly maxRetries = 2;

  static async analyzeDataset(headers: string[], sample: any): Promise<string> {
    const prompt = `You are a data analyst. Analyze this dataset structure:
Headers: ${headers.join(', ')}
Sample Row: ${JSON.stringify(sample)}

Provide a brief semantic analysis of what this dataset contains, potential quality issues, and recommended data types for each column.`;

    return this.callGroq(prompt, 1000);
  }

  static async generateSyntheticData(
    topic: string,
    fields: string[],
    count: number
  ): Promise<any[]> {
    // Handle auto-detect fields by analyzing topic
    let actualFields = fields;
    if (fields.includes('Auto-Detect') || fields.length === 0) {
      // Generate fields based on topic
      actualFields = await this.detectFieldsForTopic(topic);
    }

    logger.info(`Synthetic data generation - Topic: ${topic}, Fields: ${actualFields.join(',')}, Count: ${count}`);

    // Build a smarter prompt for realistic data generation
    const fieldDescriptions = actualFields.map(f => `- ${f} (provide realistic values)`).join('\n');

    const prompt = `You are a data generation expert. Generate exactly ${count} realistic JSON objects for this topic: "${topic}"

Required fields (use these exact names):
${fieldDescriptions}

Rules:
1. Generate REALISTIC, VARIED data that matches the topic
2. Use appropriate data types (strings, numbers, dates, booleans)
3. Include realistic variations and edge cases
4. For dates, use ISO 8601 format (YYYY-MM-DD)
5. For prices/money, use decimal numbers
6. For locations, use real place names
7. Return ONLY a valid JSON array, no markdown or explanation
8. Make sure each object has all ${actualFields.length} fields

Example format:
[
  { ${actualFields.map(f => `"${f}": "value"`).join(', ')} },
  { ${actualFields.map(f => `"${f}": "value"`).join(', ')} }
]

Now generate exactly ${count} realistic objects:`;

    const maxTokens = Math.min(count * 50, 8000); // Scale tokens based on count
    const groqResponse = await this.callGroq(prompt, maxTokens);

    console.log(`Groq synthetic response length: ${groqResponse.length}, first 200 chars: ${groqResponse.substring(0, 200)}`);

    try {
      // Try to extract JSON array from response
      const data = this.cleanAndParseJSON(groqResponse);
      if (!data) {
        throw new Error('No JSON content found in response');
      }
      const cleanedData = Array.isArray(data) ? data : [data];

      console.log(`Parsed ${cleanedData.length} records`);

      // Ensure all records have all fields
      const normalized = cleanedData.map(row => {
        const normalized: any = {};
        actualFields.forEach(field => {
          normalized[field] = row[field] !== undefined ? row[field] : null;
        });
        return normalized;
      });

      const finalResult = normalized.slice(0, count);
      console.log(`Returning ${finalResult.length} synthetic records`);
      return finalResult;
    } catch (error) {
      console.error('Failed to parse synthetic data:', error instanceof Error ? error.message : error);
      console.log(`Full response was: ${groqResponse.substring(0, 500)}...`);
      // Return empty array if parsing fails - will be caught by index.ts
      return [];
    }
  }

  // Helper method to detect fields based on topic
  private static async detectFieldsForTopic(topic: string): Promise<string[]> {
    const prompt = `For a dataset about "${topic}", suggest exactly 5-8 realistic field names (column names).
Return ONLY a JSON array of field names, no explanation.
Example: ["id", "name", "email", "created_at"]

Generate fields:`;

    const result = await this.callGroq(prompt, 500);

    try {
      let jsonStr = result.trim();
      if (jsonStr.includes('[')) {
        jsonStr = jsonStr.substring(jsonStr.indexOf('['), jsonStr.lastIndexOf(']') + 1);
      }
      const fields = JSON.parse(jsonStr);
      return Array.isArray(fields) ? fields : ['id', 'name', 'value'];
    } catch {
      // Default fields based on topic
      if (topic.toLowerCase().includes('real estate') || topic.toLowerCase().includes('property')) {
        return ['id', 'address', 'price', 'beds', 'baths', 'sqft', 'type', 'listed_date'];
      } else if (topic.toLowerCase().includes('user') || topic.toLowerCase().includes('customer')) {
        return ['id', 'name', 'email', 'phone', 'created_at', 'status'];
      } else if (topic.toLowerCase().includes('product') || topic.toLowerCase().includes('item')) {
        return ['id', 'name', 'price', 'category', 'stock', 'rating', 'created_at'];
      } else if (topic.toLowerCase().includes('order') || topic.toLowerCase().includes('purchase')) {
        return ['id', 'order_id', 'customer_id', 'amount', 'status', 'date', 'items'];
      } else {
        return ['id', 'name', 'description', 'value', 'created_at', 'updated_at'];
      }
    }
  }

  static async generateDashboard(headers: string[], sample: any, sourceType?: string): Promise<any> {
    try {
      // Use the Universal Analytics Engine for professional-grade dashboard generation
      // Ensure data is array
      const data = Array.isArray(sample) ? sample : [sample];
      return await AnalyticsEngine.analyze(headers, data, sourceType);
    } catch (e) {
      console.error('Analytics Engine failed, falling back to basic AI:', e);
      // Fallback to basic AI if engine fails
      const prompt = `Create a simple dashboard specification for this dataset:
Headers: ${headers.join(', ')}
Return JSON with: { charts: [], kpis: [], layout: {} }`;

      const result = await this.callGroq(prompt, 2000);
      try { return JSON.parse(result); } catch { return { charts: [], kpis: [], layout: {} }; }
    }
  }

  static async generateSQL(dataset: any, query: string): Promise<{ sql: string; explanation: string }> {
    // Extract headers and sample data from dataset
    let headers: string[] = [];
    let sampleData: any[] = [];

    if (dataset && dataset.columns && Array.isArray(dataset.columns)) {
      headers = dataset.columns;
      sampleData = dataset.data || [];
    } else if (dataset && dataset.headers && Array.isArray(dataset.headers)) {
      headers = dataset.headers;
      sampleData = dataset.data || [];
    } else if (dataset && dataset.data && Array.isArray(dataset.data) && dataset.data.length > 0) {
      // Extract headers from first row if available
      headers = Object.keys(dataset.data[0]);
      sampleData = dataset.data;
    } else if (dataset && Array.isArray(dataset) && dataset.length > 0) {
      // Handle case where dataset itself is the array
      headers = Object.keys(dataset[0]);
      sampleData = dataset;
    }

    if (headers.length === 0) {
      headers = ['id', 'name', 'value']; // Default fallback
    }

    // Build a smart prompt with column information and sample data
    const columnInfo = headers.map((h, i) => {
      const sampleValue = sampleData.length > 0 ? sampleData[0][h] : 'N/A';
      const dataType = typeof sampleValue;
      return `- ${h} (${dataType}): e.g., ${JSON.stringify(sampleValue)}`;
    }).join('\n');

    const prompt = `You are an expert SQL analyst. A user is asking for a SQL query on a dataset.

Dataset Schema (with sample values):
${columnInfo}

User Request: "${query}"

Instructions:
1. Generate a valid SQL SELECT query that matches the user's intent
2. Match column names intelligently - if user says "price" but real column is "product_price", use "product_price"
3. Use ONLY the columns that actually exist in the dataset
4. Support patterns: COUNT(*), selecting specific columns, WHERE filters, ORDER BY, LIMIT, DISTINCT
5. If you cannot fulfill the request with available columns, explain why

Respond ONLY with valid JSON, no markdown or extra text:
{"sql": "SELECT ...", "explanation": "Brief explanation"}`;

    try {
      const result = await this.callGroq(prompt, 600);
      console.log('Raw Groq response:', result.substring(0, 300));

      // Try to parse the response
      try {
        const parsed = JSON.parse(result);
        if (parsed.sql) {
          return parsed;
        }
      } catch {
        // Try to extract JSON from the response if it contains other text
        const jsonMatch = result.match(/\{[^{}]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.sql) {
              return parsed;
            }
          } catch (e) {
            // Continue to fallback
          }
        }
      }

      // Fallback: Generate smart SQL from query pattern
      console.warn('Failed to parse Groq response, using smart fallback');
      const sql = this.generateSmartSQL(query, headers, sampleData);
      return {
        sql,
        explanation: 'Generated from query pattern (AI response parsing failed)'
      };
    } catch (error) {
      console.error('Groq generateSQL error:', error instanceof Error ? error.message : error);
      // Ultimate fallback
      const sql = this.generateSmartSQL(query, headers, sampleData);
      return {
        sql,
        explanation: 'Generated from query pattern (AI unavailable)'
      };
    }
  }

  private static generateSmartSQL(query: string, headers: string[], sampleData: any[]): string {
    const lowerQuery = query.toLowerCase();
    const columnStr = headers.length > 0 ? headers.join(', ') : '*';

    // Smart column matching function
    const findMatchingColumn = (userTerm: string): string | null => {
      const lowerTerm = userTerm.toLowerCase();

      // Exact match (case-insensitive)
      const exact = headers.find(h => h.toLowerCase() === lowerTerm);
      if (exact) return exact;

      // Partial match - column contains the user term or vice versa
      const partial = headers.find(h =>
        h.toLowerCase().includes(lowerTerm) || lowerTerm.includes(h.toLowerCase())
      );
      if (partial) return partial;

      return null;
    };

    // Count queries (how many, count, total)
    if (lowerQuery.includes('count') || lowerQuery.includes('how many') || lowerQuery.includes('total')) {
      return `SELECT COUNT(*) as total FROM data`;
    }

    // Specific column selection (show/select/display column_name)
    const columnMatch = query.match(/(?:show|select|give|display|only)\s+(?:me\s+)?(?:the\s+)?(?:only\s+)?([\w]+)/i);
    if (columnMatch) {
      const userColumn = columnMatch[1];
      const matchedColumn = findMatchingColumn(userColumn);
      if (matchedColumn) {
        if (lowerQuery.includes('order') || lowerQuery.includes('sort')) {
          return `SELECT ${matchedColumn} FROM data ORDER BY ${matchedColumn} DESC`;
        }
        return `SELECT ${matchedColumn} FROM data`;
      } else {
        // Column not found - suggest available columns
        const suggestion = `-- Requested "${userColumn}" not found. Available: ${headers.join(', ')}`;
        return `SELECT ${columnStr} FROM data LIMIT 5 ${suggestion}`;
      }
    }

    // Distinct/Unique values
    if (lowerQuery.includes('distinct') || lowerQuery.includes('unique') || lowerQuery.includes('different')) {
      const columnMatch = query.match(/([\w]+)/);
      if (columnMatch) {
        const userColumn = columnMatch[1];
        const matchedColumn = findMatchingColumn(userColumn);
        if (matchedColumn) {
          return `SELECT DISTINCT ${matchedColumn} FROM data`;
        }
      }
    }

    // Limit queries (first/top N rows)
    if (lowerQuery.includes('first') || lowerQuery.includes('top')) {
      const numMatch = query.match(/(\d+)/);
      const limit = numMatch ? numMatch[1] : '5';
      return `SELECT ${columnStr} FROM data LIMIT ${limit}`;
    }

    // Default: select all
    return `SELECT ${columnStr} FROM data`;
  }

  public static async callGroq(prompt: string, maxTokens: number = 1000): Promise<string> {
    // Check if API key is set
    if (!config.groqApiKey) {
      console.error('GROQ_API_KEY is not set in environment');
      throw new Error('GROQ_API_KEY is not configured');
    }

    let lastError: any;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`Groq API call attempt ${attempt + 1}/${this.maxRetries + 1}`);
        const completion = await groq.chat.completions.create({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: maxTokens,
          temperature: 0.3, // Lower temperature for more consistent JSON
        });

        const content = completion.choices[0]?.message?.content || '';
        if (!content) {
          throw new Error('Empty response from Groq API');
        }

        console.log('Groq API response received successfully');
        return content;
      } catch (error) {
        lastError = error;
        console.error(`Groq API error on attempt ${attempt + 1}:`, error instanceof Error ? error.message : error);
        if (attempt < this.maxRetries) {
          const delay = 1000 * (attempt + 1);
          console.log(`Retrying after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    console.error('Groq API failed after all retries:', lastError instanceof Error ? lastError.message : lastError);
    throw lastError;
  }

  // ===== DASHBOARD AI METHODS =====

  static async suggestDashboard(dataset: any): Promise<any> {
    try {
      const headers = dataset.headers || Object.keys(dataset.data?.[0] || {});
      const data = dataset.data || [];

      logger.info(`[GroqService] Delegating dashboard generation for ${data.length} rows to AnalyticsEngine`);

      const config = await AnalyticsEngine.analyze(headers, data);
      return config;
    } catch (e) {
      logger.error('Analytics Engine failed in suggestDashboard:', e);
      // Construct a minimal safe fallback
      return {
        charts: [],
        kpis: [],
        layout: { columns: 4, rows: 'auto' },
        filters: [],
        insights: ['System could not analyze this dataset automatically.']
      };
    }
  }

  static async suggestDashboardFallback(dataset: any): Promise<any> {
    try {
      const headers = dataset.headers || Object.keys(dataset.data?.[0] || {});
      const sample = dataset.data?.slice(0, 50) || [];
      const numericCols = headers.filter((h: string) =>
        sample.some((r: any) => !isNaN(Number(r[h])))
      );
      const categoricalCols = headers.filter((h: string) => !numericCols.includes(h));

      const charts = [];

      if (categoricalCols.length > 0 && numericCols.length > 0) {
        charts.push({
          id: `chart-${Date.now()}-1`,
          type: 'bar',
          title: `${numericCols[0]} by ${categoricalCols[0]}`,
          description: `Distribution of ${numericCols[0]} across ${categoricalCols[0]}`,
          xAxis: categoricalCols[0],
          yAxis: numericCols[0],
          aggregation: 'sum',
          category: 'Overview',
          priority: 'critical'
        });
      }

      if (numericCols.length >= 2) {
        charts.push({
          id: `chart-${Date.now()}-2`,
          type: 'line',
          title: `${numericCols[1]} Trend`,
          description: `Over time or sequence`,
          xAxis: numericCols[0],
          yAxis: numericCols[1],
          aggregation: 'avg',
          category: 'Operational',
          priority: 'high'
        });
      }

      if (categoricalCols.length > 0) {
        charts.push({
          id: `chart-${Date.now()}-3`,
          type: 'pie',
          title: `Distribution by ${categoricalCols[0]}`,
          description: `Market share or composition`,
          xAxis: categoricalCols[0],
          yAxis: 'count',
          aggregation: 'count',
          category: 'Overview',
          priority: 'high'
        });
      }

      if (numericCols.length >= 2) {
        charts.push({
          id: `chart-${Date.now()}-4`,
          type: 'scatter',
          title: `${numericCols[0]} vs ${numericCols[1]} Correlation`,
          description: `Relationship analysis`,
          xAxis: numericCols[0],
          yAxis: numericCols[1],
          aggregation: 'none',
          category: 'Patterns',
          priority: 'medium'
        });
      }

      const kpis = [];
      if (numericCols.length > 0) {
        const sum = sample.reduce((a: number, r: any) => a + (Number(r[numericCols[0]]) || 0), 0);
        const avg = sum / (sample.length || 1);

        kpis.push({
          label: `Total ${numericCols[0]}`,
          value: sum.toLocaleString('en-US', { maximumFractionDigits: 0 }),
          category: 'financial',
          calculation: { column: numericCols[0], operation: 'sum', format: 'number' }
        });

        kpis.push({
          label: `Average ${numericCols[0]}`,
          value: avg.toLocaleString('en-US', { maximumFractionDigits: 1 }),
          category: 'operational',
          calculation: { column: numericCols[0], operation: 'avg', format: 'number' }
        });
      }

      kpis.push({
        label: 'Total Records',
        value: (dataset.data?.length || 0).toLocaleString(),
        category: 'quality',
        calculation: { column: headers[0], operation: 'count', format: 'number' }
      });

      return {
        charts: charts.slice(0, 6),
        kpis: kpis.slice(0, 5),
        patterns: [],
        metadata: { generatedAt: new Date().toISOString(), dataSource: 'Template-Based' }
      };
    } catch (error) {
      console.error('Fallback dashboard generation error:', error);
      return { charts: [], kpis: [], patterns: [], metadata: {} };
    }
  }

  static async modifyChartWithAI(dataset: any, chart: any, prompt: string): Promise<any> {
    try {
      const headers = dataset.headers || [];
      const groqPrompt = `You are a data visualization expert. Modify this chart specification based on user request.

Current Chart:
- Type: ${chart.type}
- Title: ${chart.title}
- X-Axis: ${chart.xAxis}
- Y-Axis: ${chart.yAxis}

User Request: "${prompt}"

Available columns: ${headers.slice(0, 15).join(', ')}

Return ONLY valid JSON (no markdown, no explanation):
{"type": "bar|line|pie|area|scatter|radar|donut|funnel|gauge|treemap|heatmap|choropleth|sunburst|box|violin", "title": "new title", "description": "description", "xAxis": "column_name", "yAxis": "column_name"}
For geographic data (countries, states, ISO codes), use "choropleth". For statistical distributions, prefer "box" or "violin". For hierarchical discovery, use "sunburst".`;

      const result = await this.callGroq(groqPrompt, 600);
      let jsonStr = result.trim();

      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }

      const modified = JSON.parse(jsonStr);
      return { ...chart, ...modified };
    } catch (error) {
      console.error('Chart modification error:', error instanceof Error ? error.message : error);
      return chart;
    }
  }

  static async generateChartFromPrompt(dataset: any, prompt: string): Promise<any> {
    try {
      const headers = dataset.headers || Object.keys(dataset.data?.[0] || {});

      const groqPrompt = `You are a data visualization expert. Generate a chart specification based on this user request.

Request: "${prompt}"
Dataset columns: ${headers.slice(0, 15).join(', ')}
Dataset size: ${dataset.data?.length || 0} rows

Return ONLY valid JSON (no markdown, no explanation):
{"type": "bar|line|pie|area|scatter|radar|donut|funnel|gauge|treemap|heatmap|choropleth|sunburst|box|violin", "title": "chart title", "description": "chart description", "xAxis": "column_name", "yAxis": "column_name", "aggregation": "sum|count|avg|max|min"}
Rules:
1. If data contains locations (Country, State, ISO), prefer "choropleth".
2. If user asks for "distribution" or "spread", prefer "box" or "violin".
3. If user asks for "composition" or "hierarchy", prefer "sunburst" or "treemap".
4. If user asks for "map", use "choropleth".
5. For heatmaps, specify xAxis, yAxis, AND a colorValue column. Heatmaps MUST represent 2D matrices (e.g., Status by Category or Region by Date).`;

      const result = await this.callGroq(groqPrompt, 600);
      let jsonStr = result.trim();

      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }

      const spec = JSON.parse(jsonStr);
      return {
        id: `chart-${Date.now()}`,
        type: spec.type || 'bar',
        title: spec.title || 'Generated Chart',
        description: spec.description || prompt.substring(0, 50),
        category: 'Overview',
        priority: 'high',
        xAxis: spec.xAxis || headers[0] || 'x',
        yAxis: spec.yAxis || headers[1] || headers[0] || 'y',
        aggregation: spec.aggregation || 'count'
      };
    } catch (error) {
      console.error('Chart generation error:', error instanceof Error ? error.message : error);
      const headers = dataset.headers || [];
      return {
        id: `chart-${Date.now()}`,
        type: 'bar',
        title: 'Generated Chart',
        description: prompt.substring(0, 50),
        category: 'Overview',
        priority: 'high',
        xAxis: headers[0] || 'x',
        yAxis: headers[1] || headers[0] || 'y',
        aggregation: 'count'
      };
    }
  }

  static async generateKPIFromPrompt(dataset: any, prompt: string): Promise<any> {
    try {
      const headers = dataset.headers || Object.keys(dataset.data?.[0] || {});

      const groqPrompt = `You are a data analyst. Generate a KPI (Key Performance Indicator) specification based on user request.

Request: "${prompt}"
Dataset columns: ${headers.slice(0, 15).join(', ')}

Return ONLY valid JSON (no markdown, no explanation):
{"label": "Metric Name", "column": "column_name", "operation": "sum|avg|count|min|max|unique", "format": "number|currency|percentage"}`;

      const result = await this.callGroq(groqPrompt, 400);
      const spec = this.cleanAndParseJSON(result);

      return {
        id: `kpi-${Date.now()}`,
        label: spec.label || 'New Metric',
        value: '-',
        category: 'custom',
        calculation: {
          column: spec.column || headers[0],
          operation: spec.operation || 'count',
          format: spec.format || 'number'
        }
      };
    } catch (error) {
      console.error('KPI generation error:', error);
      const headers = dataset.headers || [];
      return {
        id: `kpi-${Date.now()}`,
        label: 'New Metric',
        value: '-',
        calculation: { column: headers[0], operation: 'count', format: 'number' }
      };
    }
  }

  static async generateTransformations(headers: string[], sample: any[], sourceType?: string): Promise<any[]> {
    try {
      const prompt = `You are an expert Data Engineer.
Given this dataset, suggest 3-5 "Feature Engineering" transformations to create NEW valuable columns.
Focus on enriching the data, not just cleaning it.

Source Type: ${sourceType || 'General'}
Headers: ${headers.join(', ')}
Sample: ${JSON.stringify(sample.slice(0, 2))}

Examples of High-Value Transformations:
- "Extract Domain" from Email -> Analyze company distribution
- "Day of Week" from Date -> Analyze weekly patterns
- "Lead Score" from multiple factors -> Prioritize sales
- "Profit Margin" -> (Price - Cost) / Price

Return JSON Array ONLY:
[
  { "name": "New Column Name", "type": "string|number|date", "logic": "Explain logic (e.g. Extract domain from email)", "reasoning": "Why this is useful." }
]`;

      const result = await this.callGroq(prompt, 1500);
      const suggestions = this.cleanAndParseJSON(result);
      return Array.isArray(suggestions) ? suggestions : [];
    } catch (error) {
      console.error('Transformation generation error:', error);
      return [];
    }
  }

  static async modifyKPIWithAI(dataset: any, kpi: any, prompt: string): Promise<any> {
    try {
      const headers = dataset.headers || [];
      const groqPrompt = `You are a data analyst. Modify this KPI specification based on user request.

Current KPI:
- Label: ${kpi.label}
- Column: ${kpi.calculation?.column}
- Operation: ${kpi.calculation?.operation}

User Request: "${prompt}"

Available columns: ${headers.slice(0, 15).join(', ')}

Return ONLY valid JSON (no markdown, no explanation):
{"label": "updated name", "column": "column_name", "operation": "sum|avg|count|min|max|unique", "format": "number|currency|percentage"}`;

      const result = await this.callGroq(groqPrompt, 400);
      const modified = this.cleanAndParseJSON(result);

      return {
        ...kpi,
        label: modified.label || kpi.label,
        calculation: {
          ...kpi.calculation,
          column: modified.column || kpi.calculation?.column,
          operation: modified.operation || kpi.calculation?.operation,
          format: modified.format || kpi.calculation?.format
        }
      };
    } catch (error) {
      console.error('KPI modification error:', error);
      return kpi;
    }
  }

  static async generateReport(dataset: any, reportType: 'strategic' | 'operational' | 'financial' | 'quality' | 'risk' = 'strategic', extraContext: { cleaningHistory?: any[], activityLogs?: any[], webData?: any, theme?: string } = {}): Promise<any> {
    try {
      const headers = dataset.headers || Object.keys(dataset.data?.[0] || {});
      const data = dataset.data || [];
      const dataSize = data.length;
      const theme = extraContext.theme || 'modern_corporate';

      // 1. Generate Real Analytics Artifacts (KPIs & Charts & DataFrames)
      const { kpis, charts, forensics, dataFrames, correlations } = await AnalyticsEngine.generateReportArtifacts(headers, data, reportType) as any;

      // 2. Context Extraction (Cleaning & Activity Awareness)
      const cleaningContext = extraContext.cleaningHistory && extraContext.cleaningHistory.length > 0
        ? `DATA CLEANING HISTORY (Transparency & Trust):\n${extraContext.cleaningHistory.slice(-5).map((h: any) => `- ${h.action || 'Transformation'}: ${h.description || 'Optimized columns'}`).join('\n')}`
        : 'No specific cleaning history provided.';

      const activityContext = extraContext.activityLogs && extraContext.activityLogs.length > 0
        ? `WORKSPACE ACTIVITY (Operational Context):\n${extraContext.activityLogs.slice(-5).map((a: any) => `- ${a.action} on ${a.resource_type} (${new Date(a.created_at).toLocaleDateString()})`).join('\n')}`
        : 'No recent activity logs available.';

      // Context Extraction
      const piiColumns = forensics.profiles.filter((p: any) => p.role === 'contact' || p.detectedPatterns.includes('email') || p.detectedPatterns.includes('phone')).map((p: any) => p.column);
      const hasPredictiveCharts = charts.some((c: any) => c.type === 'line' && c.description?.includes('Forecast'));

      // Prepare context for LLM
      const kpiSummary = kpis.map((k: any) => `${k.label}: ${k.value} (ID: ${k.id}, reasoning: ${k.reasoning || ''})`).join('\n');
      const chartSummary = charts.map((c: any) => `- ID: "${c.id}" | Title: "${c.title}" | Type: ${c.type} | Logic: ${c.reasoning || 'n/a'}`).join('\n');
      const dfSummary = (dataFrames || []).map((df: any) => `- ID: "${df.id}" | Title: "${df.title}" | Logic: ${df.logic}`).join('\n');
      const correlationSummary = (correlations || []).map((c: any) => `${c.strength} ${c.type} correlation between ${c.colA} and ${c.colB} (r=${c.r.toFixed(2)}). Reasoning: ${c.reasoning}`).join('\n');

      const complianceContext = piiColumns.length > 0
        ? `CRITICAL COMPLIANCE NOTICE: The following columns contain potential PII: ${piiColumns.join(', ')}. You MUST include a 'Compliance & Privacy' section with GDPR/CCPA warnings.`
        : 'No PII detected in this dataset.';

      const predictiveContext = hasPredictiveCharts
        ? `PREDICTIVE INSIGHTS: Predictive models have generated forecasts. You MUST include a 'Future Outlook' section analyzing these trends.`
        : '';

      const groqPrompt = `You are a Chief Data Officer generating a PROESSIONAL ${reportType.toUpperCase()} REPORT.
      
      VISUAL THEME: ${theme} (Adapt terminology and tone to match).

      DATASET CONTEXT:
      - Rows: ${dataSize}
      - Columns: ${headers.slice(0, 15).join(', ')}

      KEY METRICS (Real Data):
      ${kpiSummary}

      AVAILABLE VISUALS (Real Charts):
      ${chartSummary}

      CALCULATED DATAFRAMES (Logic Anchors):
      ${dfSummary}

      DISCOVERED CORRELATIONS (Storytelling Bridges):
      ${correlationSummary}

      COMPLIANCE CONTEXT:
      ${complianceContext}

      PREDICTIVE CONTEXT:
      ${predictiveContext}

      PROCESS AWARENESS (CRITICAL):
      ${cleaningContext}
      ${activityContext}

      FIRST PRINCIPLES & CONCEPT WEAVER DIRECTIVE (CRITICAL):
      1. Every section MUST include a 'Reasoning' paragraph explaining the business logic behind the displayed metrics.
      2. CONCEPT WEAVER: You must explicitly explain the relationship between different charts. For example, if you assign Chart A and Chart B to a section, write a narrative bridge explaining how the trends in A influence or correlate with B.
      3. Do NOT just state numbers; explain the "Calculated Truth" (e.g., how Margin was derived from raw units).
      4. Use the provided Calculated DataFrames to anchor your logical arguments.
      5. MERMAID LOGIC: For each section, provide a 'logicPath' field containing a Mermaid flowchart (graph LR). 
         - CRITICAL: Use IDs and Labels correctly: NodeID["Label Text"]. 
         - Example: A["Raw Data"] --> B["Analysis"] --> C["Strategic Insight"]. 
         - Avoid spaces or special characters outside of brackets/quotes.

      TASK:
      Generate a comprehensive, structural report. You MUST assign the available charts to the most relevant sections.
      INTEGRATE PROCESS AWARENESS: Refer to the cleaning history specifically when discussing "Data Quality" to show how the current state was achieved. 
      
      RETURN JSON STRUCTURE (No Markdown):
      {
        "title": "Professional ${reportType} Analysis",
        "theme": "${theme}",
        "executiveSummary": "High-level executive summary referencing key metrics and cross-chart correlations.",
        "sections": [
          {
            "id": "section_id",
            "title": "Section Title",
            "content": "Deep dive narrative inclusive of cross-chart 'Concept Bridges'...",
            "reasoning": "First Principles justification for these specific metrics...",
            "logicPath": "mermaid_flowchart_syntax",
            "keyTakeaways": ["insight 1", "insight 2"],
            "swot": { "strengths": [], "weaknesses": [], "opportunities": [], "threats": [] },
            "recommendations": [{ "action": "...", "impact": "high", "effort": "low", "rationale": "..." }],
            "risks": [{ "category": "Compliance", "description": "...", "level": "medium", "mitigation": "..." }],
            "chartIds": ["id_of_relevant_chart_1"],
            "kpiIds": ["id_of_kpi_1"],
            "dataFrameIds": ["id_of_relevant_dataframe_1"]
          }
        ],
        "generatedAt": "${new Date().toISOString()}",
        "version": "5.0-ConceptWeaver"
      }`;

      const result = await this.callGroq(groqPrompt, 3000);
      let jsonStr = result.trim();

      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }

      const report = JSON.parse(jsonStr);

      // Hydrate Charts, KPIs, and DataFrames
      if (report && report.sections && Array.isArray(report.sections)) {
        report.sections = report.sections.map((section: any) => ({
          ...section,
          charts: (Array.isArray(section.chartIds) ? section.chartIds : []).map((id: string) => charts.find((c: any) => c.id === id) || charts[0]).filter((c: any) => c),
          kpis: (Array.isArray(section.kpiIds) ? section.kpiIds : []).map((id: string) => kpis.find((k: any) => k.id === id) || kpis.find((k: any) => k.label.includes(id))).filter((k: any) => k),
          dataFrames: (Array.isArray(section.dataFrameIds) ? section.dataFrameIds : []).map((id: string) => dataFrames.find((df: any) => df.id === id)).filter((df: any) => df)
        }));
      }

      // Ensure all DataFrames are at the top level for global access if needed
      report.dataFrames = dataFrames;

      // Fallback: If no charts assigned, distribute them
      const usedChartIds = new Set((report.sections || []).flatMap((s: any) => (s.charts || []).map((c: any) => c.id)));
      const unusedCharts = charts.filter((c: any) => !usedChartIds.has(c.id));

      if (unusedCharts.length > 0) {
        // distribute unused charts to sections
        report.sections.forEach((section: any, idx: number) => {
          if (unusedCharts.length > 0 && idx > 0) { // skip intro
            section.charts.push(unusedCharts.shift());
          }
        });
      }

      return report;
    } catch (error) {
      console.error('Advanced report generation error:', error instanceof Error ? error.message : error);
      // Robust Fallback using AnalyticsEngine even on Error
      try {
        const { kpis, charts } = await AnalyticsEngine.generateReportArtifacts(dataset.headers, dataset.data, reportType);
        return {
          title: `${reportType} Analysis Report (Auto-Generated)`,
          executiveSummary: `Analysis of ${dataset.data?.length} records. Key metrics indicate ${kpis[0]?.label}: ${kpis[0]?.value}.`,
          sections: [
            {
              id: 'overview',
              title: 'Performance Overview',
              content: 'Primary performance metrics and distribution analysis.',
              keyTakeaways: kpis.slice(0, 3).map(k => `${k.label}: ${k.value}`),
              charts: charts.slice(0, 2),
              kpis: kpis.slice(0, 4)
            },
            {
              id: 'trends',
              title: 'Trend Analysis',
              content: 'Detailed breakdown of trends over time and categories.',
              keyTakeaways: ['Review detailed charts below'],
              charts: charts.slice(2, 6),
              kpis: kpis.slice(4, 8)
            }
          ],
          generatedAt: new Date().toISOString(),
          version: '2.0-fallback'
        };
      } catch (fallbackError) {
        return {
          title: 'Report Generation Failed',
          executiveSummary: 'Could not generate report.',
          sections: [],
          generatedAt: new Date().toISOString(),
          version: '0.0'
        };
      }
    }
  }

  static async consultAgent(dataset: any, query: string, context?: any, history?: any[]): Promise<string> {
    try {
      const headers = dataset.headers || [];
      const historyText = history?.map((msg: any) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.text}`).join('\n') || '';

      const reportContext = context?.reportContext ? `\nCURRENT REPORT STATE:\nTitle: ${context.reportContext.title}\nSections: ${context.reportContext.sections?.map((s: any) => s.title).join(', ')}` : '';

      const groqPrompt = `You are a Lead Data Strategist & Agent. Answer this question about the dataset and current report.
      
      FIRST PRINCIPLES ANALYSIS:
      - Dataset columns: ${headers.join(', ')}
      - Total records: ${dataset.data?.length || 0}
      ${reportContext}
      ${historyText ? `\nConversation History:\n${historyText}\n` : ''}
      
      USER QUESTION: "${query}"
      
      DRIVE THE NARRATIVE:
      1. Provide a specific, data-backed answer (lookup values if needed).
      2. If appropriate, explain the "Thinking" or Logic (e.g., "I correlated X with Y to find Z").
      3. Be concise (max 4 sentences) but extremely insightful.
      
      ACTIONS (IF REQUESTED):
      If the user wants to DELETE or UPDATE data, return a JSON object ONLY:
      { "action": "DELETE_COL", "target": "column_name", "reason": "..." }
      { "action": "DELETE_ROW", "target": "row_index", "reason": "..." }
      { "action": "UPDATE_CELL", "rowIdx": number, "col": "field", "value": "...", "reason": "..." }`;

      return await this.callGroq(groqPrompt, 600);
    } catch (error) {
      console.error('Agent error:', error instanceof Error ? error.message : error);
      return 'Unable to analyze data at this moment. Please try again.';
    }
  }

  /**
   * ENHANCED: Universal Data Forensics Rule Generation
   * Uses DataForensicsEngine for comprehensive analysis of ANY dataset
   * Generates 50-100+ rules covering all quality dimensions
   */
  static async suggestValidationRules(dataset: any, semanticContext?: string): Promise<any[]> {
    try {
      const headers = dataset.headers || Object.keys(dataset.data?.[0] || {});
      const data = dataset.data || [];

      if (data.length === 0 || headers.length === 0) {
        return [];
      }

      console.log(`[Forensics] Analyzing dataset: ${headers.length} columns, ${data.length} rows`);

      // Use the DataForensicsEngine for comprehensive analysis
      const forensicResult = await DataForensicsEngine.analyze(headers, data, 500);

      console.log(`[Forensics] Analysis complete:
        - ${forensicResult.profiles.length} columns profiled
        - ${forensicResult.mathRelationships.length} math relationships detected
        - ${forensicResult.crossFieldRules.length} cross-field rules
        - ${forensicResult.garbageColumns.length} garbage columns
        - ${forensicResult.validationRules.length} rules generated`);

      // If forensics found good rules, validate them
      const validatedRules = forensicResult.validationRules.map((rule: any) => {
        // Test expression syntax
        let expressionValid = true;
        try {
          const testRow = data[0] || {};
          // Ensure special characters in column names don't break the function creation
          // We wrap the test in a try-catch block inside the function to handle runtime errors gracefully without flagging the rule as invalid syntax
          // Smarter evaluation: If it contains 'return', assume it's a full script.
          // Otherwise, wrap it in 'return (...)'.
          // Wrap in IIFE
          const exprCode = rule.expression.includes('return ')
            ? `(function(row) { try { ${rule.expression} } catch(e) { return true; } })(row)`
            : `(function(row) { try { return (${rule.expression}); } catch(e) { return true; } })(row)`;

          const testScript = SafeExecutor.compile(exprCode);
          if (testScript) {
            SafeExecutor.executeScript(testScript, { row: testRow });
          }
        } catch (e) {
          console.warn(`Rule "${rule.description}" expression syntax warning:`, e);
          // Only replace if it's a completely broken syntax that prevents compilation
          // Otherwise, we trust the AI's logic might just need runtime safety
          if (!rule.expression.includes("row['")) {
            // Auto-fix common mistake: row.Col Name -> row['Col Name']
            rule.expression = rule.expression.replace(/row\.([a-zA-Z0-9_]+)/g, "row['$1']");
          }
        }

        // Test heal function if present
        if (rule.healFunction && rule.category === 'Recovery') {
          try {
            const testRow = { ...data[0] };
            const healCode = `(function(row) { ${rule.healFunction} })(row)`;
            const healScript = SafeExecutor.compile(healCode);
            if (healScript) {
              SafeExecutor.executeScript(healScript, { row: testRow });
            }
          } catch (e) {
            // Don't blindly replace, just log warning
            console.warn(`Rule "${rule.description}" healFunction warning:`, e);
          }
        }

        return {
          ...rule,
          validated: expressionValid,
          confidenceScore: expressionValid ? (rule.confidence || 0.8) : 0.5
        };
      });

      // If not enough rules, supplement with AI-generated rules
      if (validatedRules.length < 10 && data.length > 0) {
        console.log('[Forensics] Supplementing with AI-generated rules...');
        const aiRules = await this.generateAISupplementRules(headers, data.slice(0, 20), forensicResult.profiles);
        validatedRules.push(...aiRules);
      }

      console.log(`[Forensics] Final rule count: ${validatedRules.length}`);
      return validatedRules;

    } catch (error) {
      console.error("Suggest rules error:", error);
      // Return safe fallback rules
      const headers = dataset.headers || Object.keys(dataset.data?.[0] || {});
      return headers.slice(0, 3).map((col: string) => ({
        id: Math.random().toString(36).substr(2),
        description: `Check ${col} is not empty`,
        category: 'Audit',
        column: col,
        qualityDimension: 'Completeness',
        expression: `row['${col}'] !== null && row['${col}'] !== ''`,
        healFunction: '',
        active: true,
        confidence: 0.5,
        reasoning: 'Fallback rule due to analysis error'
      }));
    }
  }

  /**
   * Generate AI-supplemented rules for complex patterns the forensics engine might miss
   */
  private static async generateAISupplementRules(headers: string[], sample: any[], profiles: any[]): Promise<any[]> {
    try {
      const profileSummary = profiles.slice(0, 8).map((p: any) =>
        `${p.column}: ${p.role} (${p.dataType}, ${p.nullPercent}% null, placeholders: ${p.placeholders?.map((ph: any) => ph.value).join(', ') || 'none'})`
      ).join('\n');

      const prompt = `You are a data quality expert. Analyze this dataset and generate validation rules.

COLUMN PROFILES:
${profileSummary}

SAMPLE ROW:
${JSON.stringify(sample[0] || {}, null, 2)}

Generate 5-10 validation rules following these patterns:
1. Cross-column dependencies (if A then B must be...)
2. Value range/format validations
3. Business logic rules
4. Data consistency rules

Return ONLY valid JSON array (no markdown):
[
  {
    "description": "Brief description",
    "category": "Recovery" or "Audit",
    "column": "column_name or *",
    "qualityDimension": "Completeness|Accuracy|Consistency|Validity|Timeliness|Uniqueness",
    "expression": "JS boolean - true if VALID (use row['col'] syntax)",
    "healFunction": "JS to fix row (only for Recovery, use row['col'] = value)",
    "reasoning": "Why this rule",
    "confidence": 0.7
  }
]

CRITICAL: Expression must return TRUE for VALID rows. Use row['columnName'] syntax.`;

      const result = await this.callGroq(prompt, 2500);

      let rules: any[] = [];
      try {
        rules = this.cleanAndParseJSON(result);
      } catch (e) {
        console.warn('Failed to parse AI supplement rules:', e);
        return [];
      }

      return rules.map((r: any) => ({
        ...r,
        id: Math.random().toString(36).substr(2),
        active: true,
        severity: 'warning',
        validated: false
      }));

    } catch (error) {
      console.error('AI supplement rules error:', error);
      return [];
    }
  }


  static async generateLogicFromDescription(dataset: any, category: string, description: string): Promise<any> {
    try {
      const headers = dataset.headers || Object.keys(dataset.data?.[0] || {});

      const prompt = `Generate JavaScript logic for a data validation rule.
          
          Headers: ${headers.join(', ')}
          Rule Description: "${description}"
          Category: ${category}
          
          Return JSON ONLY:
          {
              "expression": "JS boolean expression (true if valid)",
              "healFunction": "JS code to fix invalid row (modify 'row' object directly)",
              "qualityDimension": "Completeness|Accuracy|Consistency|Validity",
              "relationshipType": "Lookup|Calculation|Pattern|Validation"
          }`;

      const result = await this.callGroq(prompt, 1000);
      let logic = {};
      try {
        let jsonStr = result.trim();
        if (jsonStr.includes('```json')) jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
        else if (jsonStr.includes('```')) jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
        logic = JSON.parse(jsonStr);
      } catch (e) { console.error("Logic parsing failed", e); }

      return logic;
    } catch (error) {
      console.error("Generate logic error:", error);
      return { expression: 'true', healFunction: '' };
    }
  }

  // ===== PRO SEMANTIC DATA ANALYSIS METHODS =====

  /**
   * Pro: Analyze dataset semantics and deep relationships
   */
  static async analyzeSemantics(headers: string[], sample: any[], forensics: any): Promise<any> {
    const prompt = `You are a Senior Data Scientist and Expert Data Architect. 
Analyze this dataset to understand its deep root semantics, relationships, and hidden patterns.

Dataset Context:
Headers: ${headers.join(', ')}
Sample Data (JSON): ${JSON.stringify(sample.slice(0, 10))}
Forensic Profile Highlights: ${JSON.stringify({
      garbageColumns: forensics.garbageColumns,
      mathRelationships: forensics.mathRelationships.map((r: any) => r.formula),
      detectedRoles: forensics.profiles.map((p: any) => ({ col: p.column, role: p.role }))
    })}

Task:
1. Identify the CATEGORY and PURPOSE of this dataset.
2. Identify "TRASH" columns or rows (e.g., random numbers that don't belong, header artifacts).
3. Identify "JUNK" patterns within cells (e.g., numeric placeholders in text fields).
4. Discover SEMANTIC RELATIONSHIPS (e.g., "If Status is Completed, ErrorReason must be empty").
5. Identify RECOVERABLE PATTERNS (e.g., how can one column be inferred from others even if not purely mathematical).
6. Patterns for SHIFTING: Identify if there are empty areas that need data shifting.

Return ONLY valid JSON (no markdown, no explanation):
{
  "category": "string",
  "purpose": "string",
  "semanticInsights": ["insight 1", ...],
  "junkPatterns": [{ "column": "name", "pattern": "regex/description", "reason": "why" }],
  "columnRelationships": [{ "source": "colA", "target": "colB", "type": "dependency/correlation", "logic": "explanation" }],
  "recoverySuggestions": [{ "target": "col", "source": ["cols"], "logic": "how to recover" }]
}`;

    const result = await this.callGroq(prompt, 2000);
    try {
      let jsonStr = result.trim();
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }
      return JSON.parse(jsonStr);
    } catch (e) {
      console.error('Semantic Analysis Parsing Failed:', e);
      return { category: 'General', purpose: 'Data Management', semanticInsights: [], junkPatterns: [], columnRelationships: [], recoverySuggestions: [] };
    }
  }

  /**
   * Pro: Generate advanced cleaning rules based on semantic insights
   */
  static async generateAdvancedRules(headers: string[], sample: any[], semanticInsights: any): Promise<any[]> {
    const prompt = `You are an Elite Data Scientist and Data Cleaning Agent. 
Generate advanced cleaning and recovery rules based on these semantic insights:

Insights: ${JSON.stringify(semanticInsights)}
Headers: ${headers.join(', ')}

STRATEGIC GOALS:
1. RECOVERY OVER REMOVAL: Only remove a row or column if it is 100% unrecoverable garbage. If there is ANY semantic relationship to recover data, use it.
2. NO HALLUCINATED PLACEHOLDERS: Do NOT assume a numerical value (like '100', '250', '0') is a placeholder unless it perfectly matches a "junk pattern" or is logically impossible. Common amounts in a price column are NOT placeholders.
3. CONTEXTUAL ACCURACY: If a column name is a number (e.g. '56456'), it might be a system ID or an artifact. Do NOT remove unless it's entirely null or contains random junk.
4. COMPLEX LOGIC: You can use multi-line JavaScript with 'const' and 'return' for complex checks.

CRITICAL SYNTAX RULES:
- ALWAYS use bracket notation for column access: row['Column Name'].
- Handle nulls safely.
- Return TRUE if the row is VALID (KEEP IT).
- Return FALSE if the row is INVALID (NEEDS FIX).
- 'healFunction' MUST be a valid JS snippet that modifies the 'row' object.

Example Rule:
{
  "description": "If Status is Refund, Reason must be provided",
  "category": "Recovery",
  "column": "*",
  "expression": "const s = row['Status']; const r = row['Reason']; return s !== 'Refund' || (r && r.trim().length > 0);",
  "healFunction": "if (row['Status'] === 'Refund') row['Reason'] = 'Manual cleanup required';",
  "severity": "error"
}

Return ONLY a JSON array of rules:
[{
  "description": "string",
  "category": "Recovery" | "Audit",
  "column": "column_name" | "*",
  "qualityDimension": "Completeness" | "Validity" | "Consistency" | "Accuracy",
  "expression": "javascript_expression_or_script",
  "healFunction": "javascript_to_modify_row",
  "severity": "critical" | "error" | "warning",
  "reasoning": "string"
}]`;

    const result = await this.callGroq(prompt, 3000);
    return this.cleanAndParseJSON(result);
  }


  static async detectColumnTypes(dataset: any): Promise<any[]> {
    try {
      const headers = dataset.headers || Object.keys(dataset.data?.[0] || {});
      const sample = dataset.data?.slice(0, 100) || [];

      const analysis: any[] = [];

      for (const col of headers) {
        const values = sample.map((r: any) => r[col]).filter((v: any) => v !== null && v !== undefined && v !== '');

        if (values.length === 0) {
          analysis.push({ column: col, type: 'unknown', cardinality: 0, nullness: 100, confidence: 0 });
          continue;
        }

        // Analyze first 10 non-null values
        const samples = values.slice(0, 10);
        let type = 'unknown';
        let confidence = 0.5;

        // Check for datetime
        const dateCount = samples.filter((v: any) => {
          const dateStr = String(v);
          return !isNaN(Date.parse(dateStr)) || /^\d{4}-\d{2}-\d{2}/.test(dateStr);
        }).length;
        if (dateCount / samples.length > 0.8) {
          type = 'datetime';
          confidence = 0.95;
        }

        // Check for numeric
        if (type === 'unknown') {
          const numCount = samples.filter((v: any) => !isNaN(Number(v)) && v !== '').length;
          if (numCount / samples.length > 0.8) {
            // Check if it's currency or percentage
            const currencyCount = samples.filter((v: any) => String(v).match(/[$€£¥]/)).length;
            const percentCount = samples.filter((v: any) => String(v).match(/%/)).length;

            if (currencyCount / samples.length > 0.5) {
              type = 'currency';
            } else if (percentCount / samples.length > 0.5) {
              type = 'percentage';
            } else {
              type = 'numeric';
            }
            confidence = 0.95;
          }
        }

        // Check for ID-like (very high cardinality numeric or mixed)
        if (type === 'unknown') {
          const uniqueCount = new Set(values).size;
          if (uniqueCount / values.length > 0.8) {
            type = 'id';
            confidence = 0.9;
          }
        }

        // Default to categorical
        if (type === 'unknown') {
          type = 'categorical';
          confidence = 0.7;
        }

        const uniqueCount = new Set(values).size;
        const nullness = ((sample.length - values.length) / sample.length) * 100;

        analysis.push({
          column: col,
          type,
          cardinality: uniqueCount,
          nullness: Math.round(nullness),
          confidence,
          sampleValues: samples.slice(0, 3)
        });
      }

      return analysis;
    } catch (error) {
      console.error('Column type detection error:', error);
      return [];
    }
  }

  static async analyzeDatasetSemantics(dataset: any): Promise<any> {
    try {
      const headers = dataset.headers || Object.keys(dataset.data?.[0] || {});
      const sample = dataset.data?.slice(0, 20) || [];
      const columnTypes = await this.detectColumnTypes(dataset);

      // Create analysis prompt for Groq
      const typesSummary = columnTypes
        .map((ct: any) => `${ct.column}: ${ct.type} (${ct.cardinality} unique values)`)
        .join('; ');

      const semanticPrompt = `Analyze this dataset and provide semantic insights.

Columns (${headers.length}): ${headers.join(', ')}
Column Types: ${typesSummary}
Sample row: ${JSON.stringify(sample[0] || {})}

ANALYZE and return ONLY valid JSON (no markdown):
{
  "domain": "sales|operations|financial|marketing|scientific|other",
  "businessContext": "one sentence describing what this data represents",
  "primaryMeasure": "column name of main metric (if any)",
  "primaryDimension": "column name of main grouping (if any)",
  "timeColumn": "column name if time-series data else null",
  "keyInsights": ["insight1", "insight2"],
  "recommendedCharts": ["chart_type1", "chart_type2"]
}`;

      const result = await this.callGroq(semanticPrompt, 800);
      let analysis = {};

      try {
        // Extract JSON from markdown if needed
        let jsonStr = result.trim();
        if (jsonStr.includes('```json')) {
          jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
        } else if (jsonStr.includes('```')) {
          jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
        }
        analysis = JSON.parse(jsonStr);
      } catch (e) {
        console.warn('Failed to parse semantic analysis, using defaults:', e);
        analysis = {
          domain: 'unknown',
          businessContext: 'Data analysis',
          keyInsights: [],
          recommendedCharts: ['bar', 'line']
        };
      }

      // Build quality score
      const nullAvg = columnTypes.reduce((sum: number, ct: any) => sum + ct.nullness, 0) / columnTypes.length;
      const completeness = 100 - nullAvg;
      const quality = {
        completeness: Math.round(completeness),
        uniqueness: Math.round(columnTypes.reduce((sum: any, ct: any) => sum + (ct.cardinality / sample.length), 0) * 100 / columnTypes.length),
        consistency: 85, // placeholder
        validity: 90, // placeholder
        overall: Math.round((completeness + 85 + 90) / 3),
        warnings: nullAvg > 30 ? ['High number of null values detected'] : []
      };

      return {
        columnRoles: columnTypes,
        ...analysis,
        quality,
        isTimeSeriesData: !!(analysis as any).timeColumn,
        hasGeographicData: headers.some((h: string) => /city|country|state|region|location|geo/i.test(h))
      };
    } catch (error) {
      console.error('Semantic analysis error:', error);
      return {
        columnRoles: [],
        domain: 'unknown',
        keyInsights: [],
        quality: { completeness: 50, uniqueness: 50, consistency: 50, validity: 50, overall: 50, warnings: [] },
        isTimeSeriesData: false,
        hasGeographicData: false
      };
    }
  }

  static async detectRelationships(dataset: any): Promise<any[]> {
    try {
      const columnTypes = await this.detectColumnTypes(dataset);
      const numericCols = columnTypes.filter((ct: any) => ct.type === 'numeric' || ct.type === 'currency');
      const categoricalCols = columnTypes.filter((ct: any) => ct.type === 'categorical');
      const timeCols = columnTypes.filter((ct: any) => ct.type === 'datetime');

      const relationships = [];

      // All numeric pairs → correlation
      for (let i = 0; i < numericCols.length; i++) {
        for (let j = i + 1; j < numericCols.length; j++) {
          const col1 = numericCols[i].column;
          const col2 = numericCols[j].column;
          relationships.push({
            column1: col1,
            column2: col2,
            type: 'correlation',
            strength: 0.5, // placeholder - could calculate correlation coefficient
            description: `Correlation between ${col1} and ${col2}`
          });
        }
      }

      // Time + numeric → time series
      if (timeCols.length > 0 && numericCols.length > 0) {
        relationships.push({
          column1: timeCols[0].column,
          column2: numericCols[0].column,
          type: 'time-series',
          strength: 0.9,
          description: `Time series of ${numericCols[0].column}`
        });
      }

      // Categorical + numeric → categorical-numeric relationship
      for (const cat of categoricalCols.slice(0, 2)) {
        for (const num of numericCols.slice(0, 2)) {
          relationships.push({
            column1: cat.column,
            column2: num.column,
            type: 'categorical-numeric',
            strength: 0.7,
            description: `Distribution of ${num.column} by ${cat.column}`
          });
        }
      }

      return relationships;
    } catch (error) {
      console.error('Relationship detection error:', error);
      return [];
    }
  }

  /**
   * Generate optimized chart specifications from semantic analysis
   * Converts relationships and column types into production-ready chart configs
   */
  static async generateChartSpecFromAnalysis(
    analysis: any,
    relationships: any[],
    dataset: any
  ): Promise<any[]> {
    try {
      const charts = [];
      const columnTypes = analysis.columnRoles || [];
      const numericCols = columnTypes.filter((c: any) => c.type === 'numeric' || c.type === 'currency').map((c: any) => c.column);
      const categoricalCols = columnTypes.filter((c: any) => c.type === 'categorical').map((c: any) => c.column);

      // Sort relationships by strength
      const sortedRels = [...relationships].sort((a: any, b: any) => (b.strength || 0) - (a.strength || 0));

      // Generate charts from strongest relationships
      for (let i = 0; i < sortedRels.length && charts.length < 6; i++) {
        const rel = sortedRels[i];
        const cardinalityCap = 15;

        // Skip if high cardinality without proper aggregation
        if (rel.type === 'categorical-numeric') {
          const distinctCount = new Set((dataset.data || []).map((r: any) => r[rel.column1])).size;
          if (distinctCount > cardinalityCap) {
            // Use aggregation for high cardinality
            charts.push({
              id: `chart-${Date.now()}-${i}`,
              type: 'bar',
              title: `Top ${cardinalityCap} by ${rel.column2}`,
              description: rel.description,
              xAxis: rel.column1,
              yAxis: rel.column2,
              aggregation: 'sum',
              limit: cardinalityCap,
              showOther: true,
              category: i === 0 ? 'Overview' : 'Analysis',
              priority: i === 0 ? 'critical' : i < 3 ? 'high' : 'medium'
            });
          } else {
            // Direct bar chart for low cardinality
            charts.push({
              id: `chart-${Date.now()}-${i}`,
              type: 'bar',
              title: `${rel.column2} by ${rel.column1}`,
              description: rel.description,
              xAxis: rel.column1,
              yAxis: rel.column2,
              aggregation: 'sum',
              category: i === 0 ? 'Overview' : 'Analysis',
              priority: i === 0 ? 'critical' : i < 3 ? 'high' : 'medium'
            });
          }
        } else if (rel.type === 'time-series') {
          // Time series → line chart
          charts.push({
            id: `chart-${Date.now()}-${i}`,
            type: 'line',
            title: `${rel.column2} Over Time`,
            description: rel.description,
            xAxis: rel.column1,
            yAxis: rel.column2,
            aggregation: 'sum',
            category: 'Trends',
            priority: i === 0 ? 'critical' : 'high'
          });
        } else if (rel.type === 'correlation') {
          // Correlation → scatter
          charts.push({
            id: `chart-${Date.now()}-${i}`,
            type: 'scatter',
            title: `${rel.column1} vs ${rel.column2}`,
            description: rel.description,
            xAxis: rel.column1,
            yAxis: rel.column2,
            aggregation: 'none',
            category: 'Patterns',
            priority: 'medium'
          });
        }
      }

      // Fallback: Add pie chart if we have categorical data
      if (charts.length < 4 && categoricalCols.length > 0) {
        charts.push({
          id: `chart-${Date.now()}-pie`,
          type: 'pie',
          title: `Distribution of ${categoricalCols[0]}`,
          description: 'Market composition or category breakdown',
          xAxis: categoricalCols[0],
          yAxis: 'count',
          aggregation: 'count',
          limit: 10,
          showOther: true,
          category: 'Overview',
          priority: 'high'
        });
      }

      return charts.slice(0, 6);
    } catch (error) {
      console.error('Chart spec generation error:', error);
      return [];
    }
  }

  /**
   * Smart data aggregation utility
   * Groups high-cardinality data, aggregates dates, handles nulls intelligently
   */
  static smartAggregateData(
    data: any[],
    xColumn: string,
    yColumn: string,
    aggregation: string = 'sum',
    limit: number = 15,
    showOther: boolean = true
  ): any[] {
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
      result.sort((a: any, b: any) => b.value - a.value);

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
   * Pro Auditor Helper: Safely clean and parse AI-generated JSON
   * ULTRA-ROBUST: Handles all common AI output quirks using substring extraction
   */
  public static cleanAndParseJSON(input: string): any {
    if (!input || typeof input !== 'string') {
      console.warn('[GroqService] cleanAndParseJSON received empty or non-string input');
      return [];
    }

    let cleaned = input.trim();

    // 1. Extract JSON Block (Markdown/Junk Buffer)
    try {
      if (cleaned.includes('```json')) {
        cleaned = cleaned.split('```json')[1].split('```')[0].trim();
      } else if (cleaned.includes('```')) {
        const parts = cleaned.split('```');
        cleaned = (parts[1] || parts[0]).trim();
      }

      const firstSquare = cleaned.indexOf('[');
      const firstCurly = cleaned.indexOf('{');
      if (firstSquare !== -1 && (firstCurly === -1 || firstSquare < firstCurly)) {
        cleaned = cleaned.substring(firstSquare);
      } else if (firstCurly !== -1) {
        cleaned = cleaned.substring(firstCurly);
      }
    } catch (e) {
      console.warn('[GroqService] JSON extraction failed');
    }

    // 2. Handle Truncation (The "Last Valid Object" Strategy)
    if (cleaned.startsWith('[')) {
      const lastBrace = cleaned.lastIndexOf('}');
      const lastBracket = cleaned.lastIndexOf(']');

      if (lastBrace !== -1 && (lastBracket === -1 || lastBracket < lastBrace)) {
        console.log('[GroqService] Truncated array detected, recovering up to last valid object...');
        cleaned = cleaned.substring(0, lastBrace + 1) + ']';
      }
    }

    // 3. Regularize & Parse
    try {
      cleaned = cleaned.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
      cleaned = cleaned.replace(/:\s*undefined/g, ': null');
      cleaned = cleaned.replace(/:\s*NaN/g, ': null');
      cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
      cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');

      return JSON.parse(cleaned);
    } catch (e: any) {
      try {
        const lastSquare = cleaned.lastIndexOf(']');
        const lastBrace = cleaned.lastIndexOf('}');
        const end = Math.max(lastSquare, lastBrace);
        if (end !== -1) {
          return JSON.parse(cleaned.substring(0, end + 1));
        }
      } catch (e2) {
        console.warn('[GroqService] JSON recovery parse also failed');
      }

      console.error('[GroqService] All JSON parse attempts failed', {
        error: e.message,
        preview: cleaned.substring(0, 100)
      });
      return cleaned.startsWith('[') ? [] : {};
    }
  }




  static async modifyReportWithAI(dataset: any, report: any, instruction: string): Promise<any> {
    try {
      const headers = dataset.headers || [];
      const kpiSummary = (report.sections || [])
        .flatMap((s: any) => s.kpis || [])
        .map((k: any) => `${k.label}: ${k.value}`)
        .slice(0, 20)
        .join(', ');

      const originalSections = report.sections || [];

      const groqPrompt = `You are a Senior Data Scientist. Modify this report based on user instructions.
    
    INSTRUCTION: "${instruction}"
    
    DATASET: ${dataset.data?.length || 0} rows, Columns: ${headers.slice(0, 15).join(', ')}
    KNOWN METRICS: ${kpiSummary}
    
    RULES:
    1. REAL DATA ONLY. Do not invent numbers.
    2. If asked for NEW sections (Risk, Predictive), add them.
    3. CHARTS & VISUALS: If user asks for "charts", "visuals", or "detailed report", add up to 2 charts per NEW/MODIFIED section using this format:
       "charts": [{ "type": "bar", "title": "Sales by Product", "data": { "labels": ["Product A", "Product B"], "values": [100, 200] } }]
       Available chart types: "bar", "line", "pie", "scatter"
    4. CRITICAL OPTIMIZATION: For ANY section that does NOT need changes, return EXACTLY: { "id": "section_id", "unchanged": true }
    5. Only return full content for NEW or MODIFIED sections.
    
    INPUT SECTIONS:
    ${JSON.stringify(originalSections.map((s: any) => ({ id: s.id, title: s.title, contentPreview: s.content.substring(0, 100) + "..." })))}
    
    RETURN ONLY JSON ARRAY (Sections):
    [
      { "id": "intro", "unchanged": true },
      { 
        "id": "new_section", 
        "title": "...", 
        "content": "...",
        "charts": [{ "type": "bar", "title": "...", "data": { "labels": [...], "values": [...] } }]
      }
    ]`;

      const result = await this.callGroq(groqPrompt, 8000);

      const modifiedSections = this.cleanAndParseJSON(result);

      if (!Array.isArray(modifiedSections) || modifiedSections.length === 0) {
        console.warn('Modify Report: AI returned invalid structure, reverting.', modifiedSections);
        return report;
      }

      // Merge Logic: Rehydrate "unchanged" sections
      const mergedSections = modifiedSections.map((s: any) => {
        if (s.unchanged && s.id) {
          const original = originalSections.find((os: any) => os.id === s.id);
          return original || s;
        }
        return {
          ...s,
          id: s.id || `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          charts: s.charts || [],
          kpis: s.kpis || []
        };
      });

      return {
        ...report,
        sections: mergedSections,
        version: String(Number(report.version || "1.0") + 0.1)
      };

    } catch (error) {
      console.error('Modify report error:', error);
      return report;
    }
  }


}


