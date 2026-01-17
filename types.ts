
export interface DataRow {
  [key: string]: any;
  __metadata?: {
    isHealthy?: boolean;
    isFraud?: boolean;
    fraudProbability?: number;
    lastModified?: string;
    isQuarantined?: boolean;
    validationErrors?: string[];
    manualEdit?: boolean;
    restored?: boolean;
    recoveredFields?: string[];
    recoveryExplanations?: Record<string, string>;
    recoveryPass?: number; // Which pass fixed this row
    isSuspicious?: boolean;
    patternLabels?: string[];
    auditLog?: AuditLogEntry[]; // Track all recovery actions
  };
}

// Audit log entry for tracking data recovery actions
export interface AuditLogEntry {
  action: 'recovered' | 'quarantined' | 'modified' | 'validated';
  field: string;
  from?: string;
  to?: string;
  rule?: string;
  pass?: number;
  timestamp: string;
  reason?: string;
}


export type SourceType =
  | 'csv' | 'excel' | 'googlesheets'
  | 'postgres' | 'mysql' | 'sqlserver' | 'mariadb' | 'azure_sql' | 'snowflake' | 'redshift' | 'bigquery'
  | 'salesforce' | 'hubspot' | 'zoho' | 'shopify' | 'woocommerce' | 'amazon_seller'
  | 'google_ads' | 'facebook_ads' | 'tiktok_ads' | 'linkedin_ads' | 'ga4'
  | 'stripe' | 'quickbooks' | 'xero' | 'netsuite'
  | 's3' | 'google_drive' | 'sharepoint' | 'azure_blob' | 'github' | 'jira'
  | 'ai_scraper';

export type PlanTier = 'basic' | 'pro' | 'enterprise';

export const TIER_LIMITS = {
  basic: { maxRows: 500, maxQueries: 10, connectors: 1 },
  pro: { maxRows: 50000, maxQueries: 1000, connectors: 5 },
  enterprise: { maxRows: 1000000, maxQueries: 1000000, connectors: 100 }
};

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
  id?: string;
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  trendDirection?: 'up' | 'down' | 'neutral' | 'flat';
  category?: 'financial' | 'quality' | 'operational' | 'efficiency' | 'growth';
  status?: 'on_track' | 'at_risk' | 'off_track';
  comparison?: {
    period: string;
    value: number;
    interpretation: string;
  };
  calculation?: {
    column: string;
    operation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'unique';
    format?: 'currency' | 'percentage' | 'number';
  };
}

export interface HistoryStep {
  timestamp: Date;
  description: string;
  dataSnapshot: DataRow[];
}

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  sql: string;
  createdAt: Date;
  tags?: string[];
}

export interface Dataset {
  id?: string;
  createdAt?: string;
  rowCount?: number;
  cleaningActions?: CleaningAction[];
  name: string;
  sourceType: SourceType;
  headers: string[];
  data: DataRow[];
  originalData?: DataRow[];
  quarantinedData?: DataRow[];
  stats: ColumnStats[];
  healthScore?: number;
  fraudRate?: number;
  issuesCount?: { errors: number; warnings: number; infos: number; frauds: number };
  lastCleaned?: Date;
  cleaningHistory: CleaningAction[];
  historyStack?: HistoryStep[];
  cleaningSuggestions?: CleaningAction[];
  analysisInsights?: AnalysisInsight[];
  kpis?: KPI[];
  customCharts?: ChartSpec[];
  generatedReport?: string; // Legacy
  strategicReport?: StrategicReport; // New structured report
  cleaningReport?: string;
  validationRules?: ValidationRule[];
  dashboardConfig?: DashboardConfig;
  savedQueries?: SavedQuery[];
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
  inferredTypes?: string[];
}

export interface CleaningAction {
  id: string;
  type: 'missing_values' | 'duplicates' | 'outliers' | 'formatting' | 'inconsistency' | 'validation_fix' | 'smart_clean' | 'fraud_removal';
  severity: 'error' | 'warning' | 'info' | 'critical';
  title: string;
  description: string;
  impactedRows: number;
  status: 'pending' | 'applied' | 'preview' | 'rejected' | 'quarantined';
  suggestion: string;
  applyFunction?: string;
  timestamp?: Date;
}

export type RuleCategory = 'Recovery' | 'Audit';
export type QualityDimension = 'Completeness' | 'Accuracy' | 'Consistency' | 'Validity' | 'Timeliness' | 'Uniqueness' | 'Integrity' | 'Conformity' | 'Recoverability' | 'Semantics';

export interface ValidationRule {
  id: string;
  category: RuleCategory;
  qualityDimension?: QualityDimension;
  column: string;
  expression: string;
  healFunction?: string;
  severity: 'critical' | 'error' | 'warning' | 'info';
  description: string;
  active: boolean;
  relationshipType?: 'Lookup' | 'Calculation' | 'Pattern' | 'Validation';
  confidenceScore?: number;
  confidence?: number;  // Alias for confidenceScore
  reasoning?: string;
  validated?: boolean;  // Whether the expression was validated
}


export interface AnalysisInsight {
  title: string;
  description: string;
  importance: 'high' | 'medium' | 'low';
  impact?: string;
  recommendation?: string;
}

export interface ChartConfig {
  stacked?: boolean;
  normalized?: boolean;
  showLegend?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  showTooltips?: boolean;
  orientation?: 'vertical' | 'horizontal';
  interpolation?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  topN?: number;
  threshold?: number;
  trendline?: string;
  comparison?: string;
}

export interface ChartSpec {
  id: string;
  type: string;
  title: string;
  description?: string;
  category?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  xAxis: string;
  yAxis: string;
  zAxis?: string;
  groupBy?: string;
  aggregation?: string;
  filters?: string[];
  colorScheme?: string;
  customColors?: string[];
  chartConfig?: ChartConfig;
  insights?: string[];
  color?: string; // Legacy support
  limit?: number;
  showOther?: boolean;
}

export interface Pattern {
  type: string;
  description: string;
  affectedColumns: string[];
  severity: string;
  confidence: number;
  recommendation: string;
}

export interface DashboardConfig {
  charts: ChartSpec[];
  kpis: KPI[];
  patterns: Pattern[];
  metadata: any;
}

export interface ReportSection {
  id: string;
  title: string;
  content: string; // Markdown
  charts: ChartSpec[];
  kpis: KPI[];
  keyTakeaways: string[];
}

export interface StrategicReport {
  title: string;
  executiveSummary: string;
  sections: ReportSection[];
  generatedAt: string;
  version: string;
}

export type AppView = 'upload' | 'clean' | 'explore' | 'dashboard' | 'report' | 'billing' | 'playground' | 'create';

export interface ConnectorDef {
  id: SourceType;
  name: string;
  category: 'database' | 'finance' | 'sales' | 'marketing' | 'files' | 'engineering';
  icon: string;
  description: string;
  authType: 'oauth' | 'db_connection' | 'api_key';
  brandColor?: string;
  fields: string[];
}

// ===== SEMANTIC DATA ANALYSIS TYPES =====

export type ColumnRole = 'dimension' | 'measure' | 'time' | 'geography' | 'id' | 'text' | 'unknown';

export interface ColumnAnalysis {
  column: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'geographic' | 'id' | 'text' | 'currency' | 'percentage';
  role: ColumnRole;
  cardinality: number;
  nullness: number; // 0-100%
  confidence: number; // 0-1
  sampleValues?: any[];
  description?: string;
  isOutlier?: boolean;
}

export interface Relationship {
  column1: string;
  column2: string;
  type: 'correlation' | 'many-to-one' | 'categorical-numeric' | 'time-series';
  strength: number; // 0-1, correlation strength
  description?: string;
}

export interface QualityScore {
  completeness: number; // % of non-null values
  uniqueness: number; // avg cardinality ratio
  consistency: number; // 0-1
  validity: number; // 0-1
  overall: number; // weighted average
  warnings: string[];
}

export interface DatasetAnalysis {
  columnRoles: ColumnAnalysis[];
  domain?: string; // 'sales', 'operations', 'financial', etc
  insights: string[];
  relationships: Relationship[];
  quality: QualityScore;
  recommendedChartTypes: string[]; // 'line', 'bar', 'scatter', etc
  isTimeSeriesData: boolean;
  hasGeographicData: boolean;
  primaryMeasure?: string; // main KPI column
  primaryDimension?: string; // main grouping column
}

export interface ChartRecommendation {
  spec: ChartSpec;
  reason: string;
  confidence: number;
  insights?: string[];
}
