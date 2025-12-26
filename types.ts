
export interface DataRow {
  [key: string]: any;
}

export type SourceType = 
  | 'csv' | 'excel' | 'googlesheets' 
  | 'postgres' | 'mysql' | 'sqlserver' | 'mariadb' | 'azure_sql' | 'snowflake' | 'redshift' | 'bigquery'
  | 'salesforce' | 'hubspot' | 'zoho' | 'shopify' | 'woocommerce' | 'amazon_seller'
  | 'google_ads' | 'facebook_ads' | 'tiktok_ads' | 'linkedin_ads' | 'ga4'
  | 'stripe' | 'quickbooks' | 'xero' | 'netsuite'
  | 's3' | 'google_drive' | 'sharepoint' | 'azure_blob' | 'github' | 'jira';

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

export interface KPI {
  label: string;
  value: string | number;
  trend?: number; // percentage change
  trendDirection?: 'up' | 'down' | 'neutral';
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
  kpis?: KPI[];
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
  description?: string;
}

export type AppView = 'upload' | 'clean' | 'explore' | 'dashboard' | 'report' | 'billing' | 'playground';

export interface ConnectorDef {
  id: SourceType;
  name: string;
  category: 'database' | 'finance' | 'sales' | 'marketing' | 'files' | 'engineering';
  icon: string; // SVG path or url
  description: string;
  authType: 'oauth' | 'db_connection' | 'api_key';
  brandColor?: string; // hex code for UI theming
  fields: string[];
}
