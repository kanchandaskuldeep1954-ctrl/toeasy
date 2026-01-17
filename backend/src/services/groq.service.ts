import Groq from 'groq-sdk';
import { config } from '../config.js';

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

    console.log(`Synthetic data generation - Topic: ${topic}, Fields: ${actualFields.join(',')}, Count: ${count}`);

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
      let jsonStr = groqResponse.trim();

      // If empty, log and throw error
      if (!jsonStr) {
        throw new Error('Groq API returned empty response');
      }

      // If wrapped in markdown code blocks, extract the JSON
      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }

      // Remove any leading/trailing whitespace
      jsonStr = jsonStr.trim();

      if (!jsonStr) {
        throw new Error('No JSON content found in response');
      }

      // Fix common JSON issues
      // 1. Remove trailing commas before closing brackets
      jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');

      // 2. If it starts with [ and doesn't have matching ], add it
      if (jsonStr.startsWith('[') && !jsonStr.endsWith(']')) {
        // Find the last complete object and close the array
        const lastBracketIndex = jsonStr.lastIndexOf('}');
        if (lastBracketIndex !== -1) {
          jsonStr = jsonStr.substring(0, lastBracketIndex + 1) + ']';
        }
      }

      console.log(`Parsing JSON of length: ${jsonStr.length}`);
      const data = JSON.parse(jsonStr);
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

  static async generateDashboard(headers: string[], sample: any): Promise<any> {
    const prompt = `Create a dashboard specification for this dataset:
Headers: ${headers.join(', ')}
Sample: ${JSON.stringify(sample)}

Return JSON with: { charts: [], kpis: [], layout: {} }`;

    const result = await this.callGroq(prompt, 3000);

    try {
      return JSON.parse(result);
    } catch {
      return { charts: [], kpis: [], layout: {} };
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

  private static async callGroq(prompt: string, maxTokens: number = 1000): Promise<string> {
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
      if (headers.length === 0) return { charts: [], kpis: [], patterns: [] };

      console.log('🔍 Analyzing dataset semantics...');

      // NEW: Get semantic analysis
      const analysis = await this.analyzeDatasetSemantics(dataset);
      const relationships = await this.detectRelationships(dataset);

      console.log('📊 Analysis complete:', {
        domain: analysis.domain,
        relationshipCount: relationships.length,
        quality: analysis.quality.overall
      });

      const charts = [];
      const sample = dataset.data?.slice(0, 50) || [];

      // Build charts based on semantic relationships
      // 1. Primary relationship (highest priority)
      if (relationships.length > 0) {
        const primary = relationships[0];

        if (primary.type === 'categorical-numeric') {
          charts.push({
            id: `chart-${Date.now()}-1`,
            type: 'bar',
            title: `${primary.column2} by ${primary.column1}`,
            description: primary.description,
            xAxis: primary.column1,
            yAxis: primary.column2,
            aggregation: 'sum',
            category: 'Overview',
            priority: 'critical',
            insights: [`Primary dimension showing variation of ${primary.column2}`]
          });
        } else if (primary.type === 'time-series') {
          charts.push({
            id: `chart-${Date.now()}-1`,
            type: 'line',
            title: `${primary.column2} Over Time`,
            description: `Temporal trend of ${primary.column2}`,
            xAxis: primary.column1,
            yAxis: primary.column2,
            aggregation: 'sum',
            category: 'Overview',
            priority: 'critical',
            insights: ['Time-series trend analysis']
          });
        } else if (primary.type === 'correlation') {
          charts.push({
            id: `chart-${Date.now()}-1`,
            type: 'scatter',
            title: `${primary.column1} vs ${primary.column2}`,
            description: primary.description,
            xAxis: primary.column1,
            yAxis: primary.column2,
            aggregation: 'none',
            category: 'Patterns',
            priority: 'high',
            insights: ['Correlation analysis between key metrics']
          });
        }
      }

      // 2. Secondary relationships
      for (let i = 1; i < Math.min(relationships.length, 3); i++) {
        const rel = relationships[i];
        if (charts.length >= 5) break;

        if (rel.type === 'categorical-numeric' && i === 1) {
          charts.push({
            id: `chart-${Date.now()}-${i + 1}`,
            type: 'pie',
            title: `Distribution by ${rel.column1}`,
            description: `Market composition of ${rel.column1}`,
            xAxis: rel.column1,
            yAxis: rel.column2,
            aggregation: 'sum',
            category: 'Overview',
            priority: 'high'
          });
        }
      }

      // 3. Fallback charts for robustness
      const numericCols = analysis.columnRoles.filter((c: any) => c.type === 'numeric' || c.type === 'currency').map((c: any) => c.column);
      const categoricalCols = analysis.columnRoles.filter((c: any) => c.type === 'categorical').map((c: any) => c.column);

      if (charts.length < 3 && categoricalCols.length > 0 && numericCols.length > 0) {
        charts.push({
          id: `chart-${Date.now()}-fallback`,
          type: 'bar',
          title: `${numericCols[0]} by ${categoricalCols[0]}`,
          description: `Analysis of ${numericCols[0]}`,
          xAxis: categoricalCols[0],
          yAxis: numericCols[0],
          aggregation: 'sum',
          category: 'Overview',
          priority: 'medium'
        });
      }

      // Generate KPIs from primary numeric column
      const kpis = [];
      if (analysis.primaryMeasure && numericCols.length > 0) {
        const measureCol = analysis.primaryMeasure;
        const values = sample.map((r: any) => Number(r[measureCol]) || 0).filter((v: number) => !isNaN(v) && v !== null);

        if (values.length > 0) {
          const sum = values.reduce((a: number, b: number) => a + b, 0);
          const avg = sum / values.length;
          const max = Math.max(...values);
          const min = Math.min(...values);

          kpis.push({
            label: `Total ${measureCol}`,
            value: sum.toLocaleString('en-US', { maximumFractionDigits: 0 }),
            category: 'financial',
            calculation: { column: measureCol, operation: 'sum', format: 'number' }
          });

          kpis.push({
            label: `Average ${measureCol}`,
            value: avg.toLocaleString('en-US', { maximumFractionDigits: 1 }),
            category: 'operational',
            calculation: { column: measureCol, operation: 'avg', format: 'number' }
          });

          kpis.push({
            label: `Max ${measureCol}`,
            value: max.toLocaleString('en-US', { maximumFractionDigits: 0 }),
            category: 'efficiency',
            calculation: { column: measureCol, operation: 'max', format: 'number' }
          });
        }
      }

      kpis.push({
        label: 'Total Records',
        value: (dataset.data?.length || 0).toLocaleString(),
        category: 'quality',
        calculation: { column: headers[0], operation: 'count', format: 'number' }
      });

      kpis.push({
        label: 'Data Quality',
        value: `${analysis.quality.overall}%`,
        category: 'quality',
        calculation: { column: headers[0], operation: 'quality', format: 'percentage' }
      });

      return {
        charts: charts.slice(0, 6),
        kpis: kpis.slice(0, 5),
        patterns: [],
        metadata: {
          generatedAt: new Date().toISOString(),
          dataSource: 'AI-Generated',
          domain: analysis.domain,
          insights: analysis.keyInsights,
          quality: analysis.quality
        }
      };
    } catch (error) {
      console.error('Dashboard generation error:', error);
      // Fallback to template-based generation
      return this.suggestDashboardFallback(dataset);
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
{"type": "bar|line|pie|area|scatter|radar|donut|funnel|gauge|treemap|heatmap", "title": "new title", "description": "description", "xAxis": "column_name", "yAxis": "column_name"}`;

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
{"type": "bar|line|pie|area|scatter|radar|donut|funnel|gauge|treemap|heatmap", "title": "chart title", "description": "chart description", "xAxis": "column_name", "yAxis": "column_name", "aggregation": "sum|count|avg|max|min"}`;

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

  static async generateReport(dataset: any): Promise<any> {
    try {
      const headers = dataset.headers || Object.keys(dataset.data?.[0] || {});
      const dataSize = dataset.data?.length || 0;

      const groqPrompt = `You are a business intelligence analyst. Generate a strategic data analysis report.

Dataset: ${headers.slice(0, 10).join(', ')}
Records: ${dataSize}

Generate a report with ONLY this valid JSON structure (no markdown, no explanation):
{
  "title": "Strategic Analysis Report",
  "executiveSummary": "1-2 sentence summary of key findings",
  "sections": [
    {
      "id": "section1",
      "title": "Key Findings",
      "content": "markdown content with insights",
      "keyTakeaways": ["takeaway1", "takeaway2"]
    },
    {
      "id": "section2",
      "title": "Recommendations",
      "content": "markdown content with recommendations",
      "keyTakeaways": ["rec1", "rec2"]
    }
  ],
  "generatedAt": "${new Date().toISOString()}",
  "version": "1.0"
}`;

      const result = await this.callGroq(groqPrompt, 1500);
      let jsonStr = result.trim();

      if (jsonStr.includes('```json')) {
        jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
      } else if (jsonStr.includes('```')) {
        jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
      }

      return JSON.parse(jsonStr);
    } catch (error) {
      console.error('Report generation error:', error instanceof Error ? error.message : error);
      return {
        title: 'Data Analysis Report',
        executiveSummary: `Analysis of ${(dataset.data?.length || 0).toLocaleString()} records across ${(dataset.headers || []).length} dimensions.`,
        sections: [
          {
            id: 'overview',
            title: 'Overview',
            content: `Dataset contains ${(dataset.data?.length || 0).toLocaleString()} records with the following columns: ${(dataset.headers || []).join(', ')}`,
            keyTakeaways: ['Data loaded successfully', 'Ready for detailed analysis']
          }
        ],
        generatedAt: new Date().toISOString(),
        version: '1.0'
      };
    }
  }

  static async consultAgent(dataset: any, query: string, context?: any): Promise<string> {
    try {
      const headers = dataset.headers || [];

      const groqPrompt = `You are a data analyst AI assistant. Answer this question about the dataset concisely.

Dataset columns: ${headers.join(', ')}
Total records: ${dataset.data?.length || 0}
Question: "${query}"
${context ? `Context: ${JSON.stringify(context)}` : ''}

Provide a helpful answer in 1-3 sentences. Be specific and data-focused.`;

      return await this.callGroq(groqPrompt, 400);
    } catch (error) {
      console.error('Agent error:', error instanceof Error ? error.message : error);
      return 'Unable to analyze data at this moment. Please try again.';
    }
  }

  static async suggestValidationRules(dataset: any, semanticContext?: string): Promise<any[]> {
    try {
      const headers = dataset.headers || Object.keys(dataset.data?.[0] || {});
      const data = dataset.data || [];
      const sampleSize = Math.min(data.length, 100);
      const sample = data.slice(0, sampleSize);

      // ========== STEP 1: Pre-analyze data quality issues ==========
      const qualityIssues: any[] = [];
      const columnStats: { [key: string]: any } = {};

      for (const col of headers) {
        const values = sample.map((row: any) => row[col]);
        const nullCount = values.filter((v: any) => v === null || v === undefined || v === '' || v === 'null' || v === 'undefined').length;
        const nullPercent = (nullCount / sampleSize) * 100;

        // Detect data types
        const nonNullValues = values.filter((v: any) => v !== null && v !== undefined && v !== '');
        const numericCount = nonNullValues.filter((v: any) => !isNaN(Number(v)) && v !== '').length;
        const dateCount = nonNullValues.filter((v: any) => {
          const dateStr = String(v);
          return !isNaN(Date.parse(dateStr)) || /^\d{4}-\d{2}-\d{2}/.test(dateStr);
        }).length;

        const isNumeric = numericCount / Math.max(nonNullValues.length, 1) > 0.8;
        const isDate = dateCount / Math.max(nonNullValues.length, 1) > 0.8;

        // Check for type mismatches (expected numeric but has strings)
        const typeMismatch = isNumeric && nonNullValues.some((v: any) => isNaN(Number(v)));

        // Check for outliers in numeric columns
        let outliers: number[] = [];
        if (isNumeric) {
          const numValues = nonNullValues.map((v: any) => Number(v)).filter((v: any) => !isNaN(v));
          if (numValues.length > 5) {
            const mean = numValues.reduce((a, b) => a + b, 0) / numValues.length;
            const std = Math.sqrt(numValues.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / numValues.length);
            outliers = numValues.filter(v => Math.abs(v - mean) > 3 * std);
          }
        }

        // Check for duplicates in ID-like columns
        const uniqueValues = new Set(values.map((v: any) => String(v)));
        const duplicatePercent = 100 - (uniqueValues.size / values.length) * 100;
        const isIdLike = col.toLowerCase().includes('id') || col.toLowerCase().includes('key');

        // Check for invalid email patterns
        const isEmail = col.toLowerCase().includes('email');
        const invalidEmails = isEmail ? nonNullValues.filter((v: any) =>
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))
        ) : [];

        // Check for negative values where they shouldn't exist
        const isPriceOrQuantity = /price|cost|amount|qty|quantity|count|total/i.test(col);
        const negativeValues = isNumeric && isPriceOrQuantity ?
          nonNullValues.filter((v: any) => Number(v) < 0) : [];

        columnStats[col] = {
          nullPercent: Math.round(nullPercent),
          isNumeric,
          isDate,
          typeMismatch,
          outlierCount: outliers.length,
          duplicatePercent: Math.round(duplicatePercent),
          isIdLike,
          invalidEmailCount: invalidEmails.length,
          negativeCount: negativeValues.length,
          sampleValues: nonNullValues.slice(0, 3)
        };

        // Record quality issues found
        if (nullPercent > 5) {
          qualityIssues.push({
            column: col,
            issue: 'missing_values',
            severity: nullPercent > 20 ? 'high' : 'medium',
            detail: `${Math.round(nullPercent)}% null values`,
            suggestion: 'Fill with default, calculate from related columns, or flag for review'
          });
        }
        if (typeMismatch) {
          qualityIssues.push({
            column: col,
            issue: 'type_mismatch',
            severity: 'high',
            detail: 'Expected numeric but contains non-numeric values',
            suggestion: 'Parse numeric values, clean formatting characters'
          });
        }
        if (outliers.length > 0) {
          qualityIssues.push({
            column: col,
            issue: 'outliers',
            severity: 'medium',
            detail: `${outliers.length} statistical outliers detected`,
            suggestion: 'Cap at reasonable bounds or flag for review'
          });
        }
        if (isIdLike && duplicatePercent > 5) {
          qualityIssues.push({
            column: col,
            issue: 'duplicates',
            severity: 'high',
            detail: `ID column has ${Math.round(duplicatePercent)}% duplicates`,
            suggestion: 'Deduplicate or add unique constraint'
          });
        }
        if (invalidEmails.length > 0) {
          qualityIssues.push({
            column: col,
            issue: 'invalid_format',
            severity: 'medium',
            detail: `${invalidEmails.length} invalid email formats`,
            suggestion: 'Validate email format, fix typos'
          });
        }
        if (negativeValues.length > 0) {
          qualityIssues.push({
            column: col,
            issue: 'invalid_values',
            severity: 'medium',
            detail: `${negativeValues.length} negative values in ${col}`,
            suggestion: 'Convert to absolute value or flag as error'
          });
        }
      }

      // ========== STEP 2: Generate rules only for detected issues ==========
      if (qualityIssues.length === 0) {
        // No issues detected, return basic audit rules
        return headers.slice(0, 3).map((col: string, idx: number) => ({
          id: Math.random().toString(36).substr(2),
          description: `Audit ${col} for data quality`,
          category: 'Audit',
          column: col,
          qualityDimension: 'Completeness',
          expression: `row['${col}'] !== null && row['${col}'] !== undefined && row['${col}'] !== ''`,
          healFunction: '',
          active: true,
          confidence: 0.5,
          reasoning: 'Baseline audit rule - no specific issues detected'
        }));
      }

      // ========== STEP 3: Chain-of-thought prompt for targeted rules ==========
      const issuesSummary = qualityIssues.slice(0, 5).map(i =>
        `- ${i.column}: ${i.issue} (${i.severity}) - ${i.detail}`
      ).join('\n');

      const prompt = `You are a Data Quality Engineer. Generate validation rules to fix SPECIFIC issues found in this dataset.

=== DATA QUALITY ANALYSIS RESULTS ===
${issuesSummary}

=== COLUMN STATISTICS ===
${Object.entries(columnStats).slice(0, 5).map(([col, stats]: [string, any]) =>
        `${col}: ${stats.isNumeric ? 'numeric' : 'text'}, ${stats.nullPercent}% null, samples: ${JSON.stringify(stats.sampleValues)}`
      ).join('\n')}

=== CHAIN OF THOUGHT ===
For each issue above, think step-by-step:
1. What is the root cause of this issue?
2. Can it be automatically fixed (Recovery) or just flagged (Audit)?
3. Write the simplest JavaScript expression to detect violations
4. Write a safe heal function that won't corrupt data

=== RULES TO GENERATE ===
Generate exactly ${Math.min(qualityIssues.length, 5)} rules, one per detected issue.

Return ONLY valid JSON array (no markdown):
[
  {
    "description": "Brief description of what this rule does",
    "category": "Recovery" or "Audit",
    "column": "exact_column_name",
    "qualityDimension": "Completeness|Accuracy|Consistency|Validity",
    "expression": "JavaScript boolean - true if row is VALID",
    "healFunction": "JavaScript code to fix row (only for Recovery)",
    "reasoning": "Why this rule is needed based on analysis",
    "confidence": 0.8
  }
]

CRITICAL RULES:
- Expression must return TRUE for VALID rows (pass = good)
- healFunction must modify 'row' object directly: row['col'] = newValue
- Use safe defaults: row['price'] = row['price'] || 0
- For emails: use /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)
- For nulls: check value !== null && value !== '' && value !== undefined`;

      const result = await this.callGroq(prompt, 2500);
      let rules: any[] = [];

      try {
        let jsonStr = result.trim();
        if (jsonStr.includes('```json')) {
          jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
        } else if (jsonStr.includes('```')) {
          jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
        }
        rules = JSON.parse(jsonStr);
      } catch (e) {
        console.error("Rule parsing failed", e);
        // Return fallback rules based on detected issues
        return qualityIssues.slice(0, 3).map((issue, idx) => ({
          id: Math.random().toString(36).substr(2),
          description: `Fix ${issue.issue} in ${issue.column}`,
          category: issue.issue === 'missing_values' ? 'Recovery' : 'Audit',
          column: issue.column,
          qualityDimension: 'Completeness',
          expression: `row['${issue.column}'] !== null && row['${issue.column}'] !== ''`,
          healFunction: issue.issue === 'missing_values' ?
            `if (!row['${issue.column}']) row['${issue.column}'] = 'N/A'` : '',
          active: true,
          confidence: 0.6,
          reasoning: issue.detail
        }));
      }

      // ========== STEP 4: Validate generated expressions ==========
      const validatedRules = rules.map((r: any, idx: number) => {
        let expressionValid = true;
        let healFunctionValid = true;

        // Test expression syntax
        try {
          const testRow = sample[0] || {};
          const testFn = new Function('row', `return (${r.expression})`);
          testFn(testRow);
        } catch (e) {
          console.warn(`Rule ${idx} expression invalid:`, e);
          expressionValid = false;
          // Fix common issues
          r.expression = `row['${r.column}'] !== null && row['${r.column}'] !== ''`;
        }

        // Test heal function syntax
        if (r.healFunction && r.category === 'Recovery') {
          try {
            const testRow = { ...sample[0] };
            const healFn = new Function('row', r.healFunction);
            healFn(testRow);
          } catch (e) {
            console.warn(`Rule ${idx} healFunction invalid:`, e);
            healFunctionValid = false;
            r.healFunction = `if (!row['${r.column}']) row['${r.column}'] = 'N/A'`;
          }
        }

        return {
          ...r,
          id: Math.random().toString(36).substr(2),
          active: true,
          confidenceScore: (expressionValid && healFunctionValid) ? (r.confidence || 0.8) : 0.5,
          validated: expressionValid && healFunctionValid
        };
      });

      return validatedRules;

    } catch (error) {
      console.error("Suggest rules error:", error);
      // Return safe fallback rules
      const headers = dataset.headers || Object.keys(dataset.data?.[0] || {});
      return headers.slice(0, 2).map((col: string) => ({
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

  // ===== SEMANTIC DATA ANALYSIS METHODS =====

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
}
