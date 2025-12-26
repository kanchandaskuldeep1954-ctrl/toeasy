
import { GoogleGenAI, Type } from "@google/genai";
import { Dataset, AnalysisInsight, ChartSpec, CleaningAction, ValidationRule, DataRow } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export class GeminiService {
  private static readonly MODEL_NAME = 'gemini-3-pro-preview';

  private static async callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 2000): Promise<T> {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const isRateLimit = error?.message?.includes('429') || error?.status === 429;
        if (isRateLimit && i < maxRetries - 1) {
          const delay = initialDelay * Math.pow(2, i);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  static async auditDataset(dataset: Dataset): Promise<{ 
    actions: CleaningAction[];
    insights: AnalysisInsight[];
  }> {
    return this.callWithRetry(async () => {
      const sample = dataset.data.slice(0, 30);
      const statsSummary = dataset.stats.map(s => ({
        col: s.column,
        missing: s.missingValues,
        unique: s.uniqueValues,
        type: s.type,
        avg: s.avg,
        outliers: s.outliers
      }));

      const prompt = `Act as an Elite Data Quality Auditor. Perform a deep diagnostic of this dataset.
      Headers: ${JSON.stringify(dataset.headers)}
      Metadata: ${JSON.stringify(statsSummary)}
      Sample Records: ${JSON.stringify(sample)}
      
      Identify:
      1. Structural flaws (duplicate keys, inconsistent formats).
      2. Data quality gaps (null values, logical outliers).
      3. Statistical anomalies.

      Provide a JSON response with:
      - 'actions': Array of specific CleaningAction (id, type, title, description, impactedRows, suggestion). 
      - 'insights': Array of strategic AnalysisInsight (title, description, importance).`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              actions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    type: { type: Type.STRING },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    impactedRows: { type: Type.INTEGER },
                    suggestion: { type: Type.STRING }
                  },
                  required: ["id", "type", "title", "description", "suggestion"]
                }
              },
              insights: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    importance: { type: Type.STRING }
                  },
                  required: ["title", "description", "importance"]
                }
              }
            }
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        actions: (parsed.actions || []).map((a: any) => ({ ...a, status: 'pending' })),
        insights: parsed.insights || []
      };
    });
  }

  static async autoCleanDataset(dataset: Dataset, actions: CleaningAction[]): Promise<DataRow[]> {
    return this.callWithRetry(async () => {
      const prompt = `Act as a Data Transformation Specialist. Apply these expert-level cleaning protocols to the entire dataset based on the following instructions:
      Protocol: ${JSON.stringify(actions.map(a => a.suggestion))}
      Target Data Sample: ${JSON.stringify(dataset.data.slice(0, 100))}
      
      Return a fully cleaned version of the JSON array. Fix formats, fill gaps intelligently, and normalize values.`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {},
              additionalProperties: true
            }
          }
        }
      });

      return JSON.parse(response.text || '[]');
    });
  }

  static async suggestDashboard(dataset: Dataset, goal?: string): Promise<ChartSpec[]> {
    return this.callWithRetry(async () => {
      const prompt = `Design a professional executive dashboard for this dataset.
      Objective: ${goal || "Holistic business intelligence and operational efficiency"}
      Columns: ${dataset.headers.join(', ')}
      Key Stats: ${JSON.stringify(dataset.stats.map(s => ({ col: s.column, type: s.type, unique: s.uniqueValues })))}
      
      Suggest 6 high-value charts. Return as JSON array of ChartSpec (id, type, title, xAxis, yAxis).
      Types allowed: bar, line, pie, scatter, area.`;

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
                id: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['bar', 'line', 'pie', 'scatter', 'area'] },
                title: { type: Type.STRING },
                xAxis: { type: Type.STRING },
                yAxis: { type: Type.STRING }
              },
              required: ["id", "type", "title", "xAxis", "yAxis"]
            }
          }
        }
      });

      return JSON.parse(response.text || '[]');
    });
  }

  static async generateReport(dataset: Dataset, focus?: string): Promise<string> {
    return this.callWithRetry(async () => {
      const prompt = `Act as a Top-Tier Management Consultant. Write a definitive strategic analysis report.
      Dataset: ${dataset.name}
      Focus: ${focus || "Broad Strategic Value"}
      Context: ${dataset.data.length} records across ${dataset.headers.length} domains.
      
      Structure the report with these sections:
      # 01 EXECUTIVE SUMMARY
      A high-level view of current operations and major findings.
      
      # 02 STRATEGIC KPI ANALYSIS
      Deep dive into the core metrics. Use tables where appropriate.
      
      # 03 ANOMALIES & RISK VECTORS
      Highlight critical data health issues or business risks found.
      
      # 04 GROWTH OPPORTUNITIES
      Actionable, data-driven suggestions for improvement.
      
      # 05 CONCLUSION
      Final synthesis of findings.

      Use professional consulting language. Format in sophisticated Markdown.`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
      });

      return response.text || "Report compilation engine failed to respond.";
    });
  }

  static async askQuestion(dataset: Dataset, question: string): Promise<string> {
    return this.callWithRetry(async () => {
      const sample = dataset.data.slice(0, 60);
      const prompt = `Expert Data Analyst Perspective.
      Context Data: ${JSON.stringify(sample)}
      Request: ${question}
      
      Provide a precise, data-backed answer. If you need to perform calculations, explain your logic briefly.`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
      });

      return response.text || "Unable to derive insights for this specific query.";
    });
  }

  static async executeNaturalLanguageQuery(dataset: Dataset, query: string): Promise<DataRow[]> {
    return this.callWithRetry(async () => {
      const sample = dataset.data.slice(0, 30);
      const prompt = `Synthesize a specific data view for: "${query}"
      Schema: ${dataset.headers.join(', ')}
      Reference: ${JSON.stringify(sample)}
      
      Perform filtering, aggregation, or sorting as requested. Return the final set as a JSON array of objects.`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {},
              additionalProperties: true
            }
          }
        }
      });

      return JSON.parse(response.text || '[]');
    });
  }

  static async executeRawSQL(dataset: Dataset, sql: string): Promise<DataRow[]> {
    return this.callWithRetry(async () => {
      const sample = dataset.data.slice(0, 40);
      const prompt = `Simulate a SQL Engine executing: "${sql}"
      Table context: 'data'
      Columns: ${dataset.headers.join(', ')}
      Records: ${JSON.stringify(sample)}
      
      Return ONLY the resulting JSON array.`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {},
              additionalProperties: true
            }
          }
        }
      });

      return JSON.parse(response.text || '[]');
    });
  }

  static async suggestChartForResults(data: DataRow[]): Promise<ChartSpec | null> {
    if (!data || data.length === 0) return null;
    return this.callWithRetry(async () => {
      const keys = Object.keys(data[0]);
      const prompt = `Suggest the optimal visualization for this result set.
      Keys: ${keys.join(', ')}
      Sample: ${JSON.stringify(data[0])}
      Return JSON with: type (bar, line, pie, area, scatter), title, xAxis, yAxis.`;

      const response = await ai.models.generateContent({
        model: this.MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              type: { type: Type.STRING, enum: ['bar', 'line', 'pie', 'scatter', 'area'] },
              title: { type: Type.STRING },
              xAxis: { type: Type.STRING },
              yAxis: { type: Type.STRING }
            },
            required: ["type", "title", "xAxis", "yAxis"]
          }
        }
      });

      return JSON.parse(response.text || 'null');
    });
  }

  static async suggestValidationRules(dataset: Dataset): Promise<Partial<ValidationRule>[]> {
    return this.callWithRetry(async () => {
      const prompt = `Suggest high-level data governance rules for this schema.
      Headers: ${dataset.headers.join(', ')}
      Metrics: ${JSON.stringify(dataset.stats)}
      
      Provide 5 critical rules in JSON format.`;

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
                column: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['range', 'format', 'regex', 'required', 'unique'] },
                severity: { type: Type.STRING, enum: ['error', 'warning'] }
              },
              required: ["column", "type", "severity"]
            }
          }
        }
      });

      return JSON.parse(response.text || '[]');
    });
  }
}
