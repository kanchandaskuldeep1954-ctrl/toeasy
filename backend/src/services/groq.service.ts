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

      // Categorize columns
      const sample = dataset.data?.slice(0, 50) || [];
      const numericCols = headers.filter((h: string) => 
        sample.some((r: any) => !isNaN(Number(r[h])))
      );
      const categoricalCols = headers.filter((h: string) => !numericCols.includes(h));

      const charts = [];
      
      // Auto-generate charts based on available columns
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

      if (categoricalCols.length > 0 && numericCols.length > 0) {
        charts.push({
          id: `chart-${Date.now()}-5`,
          type: 'radar',
          title: `Performance Radar: ${categoricalCols[0]}`,
          description: `Multi-metric analysis`,
          xAxis: categoricalCols[0],
          yAxis: numericCols[0],
          aggregation: 'avg',
          category: 'Overview',
          priority: 'medium'
        });
      }

      // Generate KPIs
      const kpis = [];
      if (numericCols.length > 0) {
        const sum = sample.reduce((a: number, r: any) => a + (Number(r[numericCols[0]]) || 0), 0);
        const avg = sum / (sample.length || 1);
        const max = Math.max(...sample.map((r: any) => Number(r[numericCols[0]]) || 0));
        
        kpis.push({
          label: `Total ${numericCols[0]}`,
          value: sum.toLocaleString('en-US', { maximumFractionDigits: 0 }),
          category: 'financial',
          calculation: { column: numericCols[0], operation: 'sum', format: 'number' }
        });

        kpis.push({
          label: `Avg ${numericCols[0]}`,
          value: avg.toLocaleString('en-US', { maximumFractionDigits: 2 }),
          category: 'operational',
          calculation: { column: numericCols[0], operation: 'avg', format: 'number' }
        });

        kpis.push({
          label: `Max ${numericCols[0]}`,
          value: max.toLocaleString('en-US', { maximumFractionDigits: 0 }),
          category: 'efficiency',
          calculation: { column: numericCols[0], operation: 'max', format: 'number' }
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
        metadata: { generatedAt: new Date().toISOString(), dataSource: 'Auto-Generated' }
      };
    } catch (error) {
      console.error('Dashboard generation error:', error);
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
}
