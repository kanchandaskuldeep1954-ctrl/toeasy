
export interface DataRow {
  [key: string]: any;
}

export type SourceType = 'csv' | 'googlesheets' | 'postgres' | 'mysql' | 'meta_ads' | 'google_ads' | 'mixpanel';

export type PlanTier = 'basic' | 'pro' | 'enterprise';

export interface Subscription {
  tier: PlanTier;
  interval: 'month' | 'year';
  status: 'active' | 'trialing' | 'canceled';
  expiresAt: Date;
}

export interface UserUsage {
  rowsProcessed: number;
  aiQueriesUsed: number;
  connectorsCount: number;
}

export interface Dataset {
  name: string;
  sourceType: SourceType;
  headers: string[];
  data: DataRow[];
  originalData?: DataRow[];
  stats: ColumnStats[];
  lastCleaned?: Date;
  cleaningHistory?: CleaningAction[];
  customCharts?: ChartSpec[];
}

export interface ColumnStats {
  column: string;
  type: 'numeric' | 'categorical' | 'date' | 'unknown';
  uniqueValues: number;
  missingValues: number;
  min?: number;
  max?: number;
  avg?: number;
  outliers?: number;
  topValues?: { value: any; count: number }[];
}

export interface ValidationRule {
  id: string;
  column: string;
  type: 'range' | 'format' | 'regex' | 'required' | 'unique';
  params: {
    min?: number;
    max?: number;
    pattern?: string;
    format?: 'email' | 'date' | 'number';
  };
  severity: 'error' | 'warning';
  active: boolean;
}

export interface CleaningAction {
  id: string;
  type: 'missing_values' | 'duplicates' | 'outliers' | 'formatting' | 'inconsistency' | 'validation_fix' | 'smart_clean';
  title: string;
  description: string;
  impactedRows: number;
  status: 'pending' | 'applied' | 'rejected';
  suggestion: string;
}

export interface AnalysisInsight {
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  suggestion?: string;
  type?: string;
}

export interface ChartSpec {
  id: string;
  type: 'bar' | 'line' | 'pie' | 'scatter' | 'area';
  title: string;
  xAxis: string;
  yAxis: string;
  color?: string;
}

export type AppView = 'upload' | 'clean' | 'explore' | 'dashboard' | 'report' | 'billing' | 'playground';
