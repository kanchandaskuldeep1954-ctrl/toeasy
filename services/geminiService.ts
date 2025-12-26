
import { GoogleGenAI, Type } from "@google/genai";
import { Dataset, AnalysisInsight, ChartSpec, CleaningAction, ValidationRule, DataRow, KPI } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export class GeminiService {
  private static readonly MODEL_NAME = 'gemini-3-pro-preview';

  private static async callWithRetry<T>(fn: () => Promise<T>, maxRetries = 2, initialDelay = 1000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        // console.error(`Attempt ${i + 1} failed:`, error);
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(2, i)));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  static async extractKPIs(dataset: Dataset): Promise<KPI[]> {
    return this.callWithRetry(async () => {
      const sample = dataset.data.slice(0, 50);
      const prompt = `Analyze this dataset sample and calculate 3-4 Key Performance Indicators (KPIs).
      Headers: ${dataset.headers.join(', ')}
      Sample Data: ${JSON.stringify(sample)}
      
      Return a JSON array of objects with keys: label, value (string or number), trend (number, optional, make up a reasonable trend based on data if time series exists, else null), trendDirection ('up', 'down', 'neutral').`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.STRING },
                trend: { type: Type.NUMBER },
                trendDirection: { type: Type.STRING, enum: ['up', 'down', 'neutral'] }
              },
              required: ["label", "value"]
            }
          }
        }
      });
      return JSON.parse(response.text || '[]');
    });
  }

  static async auditDataset(dataset: Dataset): Promise<{ 
    actions: CleaningAction[];
    insights: AnalysisInsight[];
  }> {
    return this.callWithRetry(async () => {
      const sample = dataset.data.slice(0, 30);
      const statsSummary = dataset.stats.map(s => ({ col: s.column, missing: s.missingValues, unique: s.uniqueValues, type: s.type }));

      const prompt = `Act as an Elite Data Quality Auditor.
      Headers: ${JSON.stringify(dataset.headers)}
      Metadata: ${JSON.stringify(statsSummary)}
      Sample: ${JSON.stringify(sample)}
      
      Identify 3-5 specific cleaning actions and 3 quality insights.
      
      Return JSON:
      {
        "actions": [{ "id": "...", "type": "...", "title": "...", "description": "...", "impactedRows": 0, "suggestion": "..." }],
        "insights": [{ "title": "...", "description": "...", "importance": "high|medium|low" }]
      }`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        actions: (parsed.actions || []).map((a: any) => ({ ...a, status: 'pending', id: Math.random().toString(36).substr(2, 9) })),
        insights: parsed.insights || []
      };
    });
  }

  static async autoCleanDataset(dataset: Dataset, actions: CleaningAction[]): Promise<DataRow[]> {
    return this.callWithRetry(async () => {
      // In a real app, we would chunk this. For this demo, we limit to 200 rows to ensure speed and reliability.
      const rowLimit = 200; 
      const dataToClean = dataset.data.slice(0, rowLimit);
      
      const prompt = `Apply these cleaning protocols: ${JSON.stringify(actions.map(a => a.suggestion))}
      
      Data: ${JSON.stringify(dataToClean)}
      
      Return the CLEANED JSON array. Maintain structure. Fix issues.`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      let cleaned = JSON.parse(response.text || '[]');
      
      // If original dataset was larger, append the rest (this is a simplified logic for the UI demo)
      if (dataset.data.length > rowLimit) {
        cleaned = [...cleaned, ...dataset.data.slice(rowLimit)];
      }
      return cleaned;
    });
  }

  static async suggestDashboard(dataset: Dataset, goal?: string): Promise<ChartSpec[]> {
    return this.callWithRetry(async () => {
      const prompt = `Design a professional dashboard. Goal: ${goal || "General Overview"}.
      Columns: ${dataset.headers.join(', ')}
      Stats: ${JSON.stringify(dataset.stats.slice(0, 5))}
      
      Suggest 4-6 high-value charts. Return JSON array of ChartSpec (id, type, title, xAxis, yAxis, description).
      Types: bar, line, pie, scatter, area.`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      return JSON.parse(response.text || '[]');
    });
  }

  static async generateReport(dataset: Dataset, focus?: string): Promise<string> {
    return this.callWithRetry(async () => {
      const prompt = `Write a professional executive summary report for this dataset.
      Focus: ${focus || "Key Trends and Insights"}
      Data Context: ${dataset.headers.join(', ')}
      
      Structure:
      # Executive Summary
      # Key Findings
      # Strategic Recommendations
      
      Use Markdown. Be concise but professional.`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
      });

      return response.text || "Report generation unavailable.";
    });
  }

  static async askQuestion(dataset: Dataset, question: string): Promise<string> {
    return this.callWithRetry(async () => {
      const sample = dataset.data.slice(0, 50);
      const prompt = `Data Analyst answering: "${question}"
      Context: ${JSON.stringify(sample)}
      
      Answer clearly. If calculating, explain steps.`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
      });

      return response.text || "I couldn't derive an answer from the data provided.";
    });
  }

  static async executeNaturalLanguageQuery(dataset: Dataset, query: string): Promise<DataRow[]> {
    return this.callWithRetry(async () => {
      const sample = dataset.data.slice(0, 50);
      const prompt = `Filter/Transform this data based on: "${query}"
      Data: ${JSON.stringify(sample)}
      
      Return ONLY the resulting JSON array.`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      return JSON.parse(response.text || '[]');
    });
  }

  static async executeRawSQL(dataset: Dataset, sql: string): Promise<DataRow[]> {
    return this.callWithRetry(async () => {
      const sample = dataset.data.slice(0, 50);
      const prompt = `Simulate SQL: "${sql}" on table 'data'.
      Data: ${JSON.stringify(sample)}
      
      Return JSON result array.`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      return JSON.parse(response.text || '[]');
    });
  }

  static async suggestChartForResults(data: DataRow[]): Promise<ChartSpec | null> {
    if (!data || data.length === 0) return null;
    return this.callWithRetry(async () => {
      const keys = Object.keys(data[0]);
      const prompt = `Best chart for this data? Keys: ${keys.join(', ')}. Sample: ${JSON.stringify(data[0])}.
      Return JSON: { type, title, xAxis, yAxis }.`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      return JSON.parse(response.text || 'null');
    });
  }

  static async suggestValidationRules(dataset: Dataset): Promise<Partial<ValidationRule>[]> {
     const prompt = `Suggest 3 validation rules for: ${dataset.headers.join(', ')}. Return JSON array of {column, type, severity}.`;
     const response = await ai.models.generateContent({
       model: this.MODEL_NAME,
       contents: prompt,
       config: { responseMimeType: "application/json" }
     });
     return JSON.parse(response.text || '[]');
  }
}
