
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

// Cell issue type for data cleaning
export interface CellIssue {
  row: number;
  col: number;
  columnName: string;
  currentValue: any;
  issueType: 'missing' | 'invalid_format' | 'outlier' | 'duplicate' | 'inconsistent' | 'semantic_error';
  severity: 'error' | 'warning' | 'info';
  suggestedValue: any;
  confidence: number;
  explanation: string;
  recoveryMethod?: 'ai_infer' | 'lookup' | 'calculate' | 'pattern' | 'default' | 'remove' | 'remove_row' | 'remove_column';
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
  id: string;
  title: string;
  value: string | number;
  unit?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral' | 'flat';
  };
  category?: 'financial' | 'quality' | 'operational' | 'efficiency' | 'growth' | 'volume';
  status?: 'on_track' | 'at_risk' | 'off_track';
  sparklineData?: number[];
  comparison?: {
    period: string;
    value: number;
    interpretation: string;
  };
  calculation?: {
    column?: string;
    operation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'unique' | 'quality';
    format?: 'currency' | 'percentage' | 'number';
  };
  reasoning?: string;
  validation?: {
    status: 'verified' | 'unverified';
    evidence: string;
    sampleRows?: number;
    dataSourceAnchor?: string; // Filter/Logic used for grounding
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
  id: number;
  workspace_id?: number;
  createdAt: string;
  rowCount: number;
  name: string;
  sourceType: SourceType;
  headers: string[];
  data: DataRow[];
  cleaningActions?: CleaningAction[];
  cleaningHistory?: CleaningAction[];
  quarantinedData?: DataRow[];
  stats?: ColumnStats[];
  healthScore?: number;
  fraudRate?: number;
  issuesCount?: { errors: number; warnings: number; infos: number; frauds: number };
  lastCleaned?: Date;
  historyStack?: HistoryStep[];
  cleaningSuggestions?: CleaningAction[];
  analysisInsights?: AnalysisInsight[];
  kpis?: KPI[];
  customCharts?: ChartSpec[];
  generatedReport?: string;
  strategicReport?: StrategicReport;
  cleaningReport?: string;
  validationRules?: ValidationRule[];
  dashboardConfig?: DashboardConfig;
  dataQualitySource?: 'PRO_CLEANED' | 'RAW_ORIGINAL' | 'VERSION';
  savedQueries?: SavedQuery[];
  raw_data?: DataRow[];
  savedCharts?: ChartSpec[]; // Charts created in Sheets/Playground
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
  type: string; // bar, line, pie, donut, scatter, bubble, funnel, gauge, treemap, heatmap, choropleth, scattergeo, sunburst, box, violin
  title: string;
  description?: string;
  category?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  size?: 'small' | 'medium' | 'large' | 'full';
  xAxis?: string; // Legacy/Direct property
  yAxis?: string; // Legacy/Direct property
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

  // AnalyticsEngine 2.0 properties
  data?: any;
  options?: any;
  reasoning?: string;
  validation?: {
    status: 'verified' | 'unverified';
    evidence: string;
  };
  layout?: {
    w: number; // width in grid units (1-4)
    h: number; // height in grid units (1-4)
    x?: number;
    y?: number;
  };

  // Deep Integration Metadata
  sourceQuery?: string; // SQL or NL query that generated this chart
  sourceModule?: 'sheets' | 'dashboard' | 'report' | 'playground' | 'ai';
  isWidget?: boolean; // If true, renders in "widget mode" (simplified)
  createdBy?: string; // User ID
  createdAt?: string;
  datasetId?: string; // Link back to source dataset
}

export interface FilterSpec {
  id: string;
  label: string;
  column: string;
  type: 'date' | 'select' | 'range' | 'search';
  options?: string[];
  min?: number;
  max?: number;
}

export interface Pattern {
  type: string;
  description: string;
  affectedColumns: string[];
  severity: string;
  confidence: number;
  recommendation: string;
}

export type WidgetType = 'chart' | 'kpi' | 'table' | 'query' | 'pivot' | 'text';

export interface BaseWidgetSpec {
  id: string;
  type: WidgetType;
  title: string;
  description?: string;
  layout?: {
    w: number;
    h: number;
    x?: number;
    y?: number;
  };
  sourceModule?: 'sheets' | 'dashboard' | 'report' | 'playground' | 'ai';
}

export interface ChartWidgetSpec extends BaseWidgetSpec {
  type: 'chart';
  chart: ChartSpec;
}

export interface KPIWidgetSpec extends BaseWidgetSpec {
  type: 'kpi';
  kpi: KPI;
}

export interface TableWidgetSpec extends BaseWidgetSpec {
  type: 'table';
  datasetId?: string; // Optional override
}

export interface QueryWidgetSpec extends BaseWidgetSpec {
  type: 'query';
  initialQuery?: string;
}

export interface PivotWidgetSpec extends BaseWidgetSpec {
  type: 'pivot';
  state?: any;
}

export interface TextWidgetSpec extends BaseWidgetSpec {
  type: 'text';
  content: string;
}

export type WidgetSpec = ChartWidgetSpec | KPIWidgetSpec | TableWidgetSpec | QueryWidgetSpec | PivotWidgetSpec | TextWidgetSpec;

export interface DashboardConfig {
  name?: string;
  description?: string;
  widgets: WidgetSpec[]; // Unified widget list
  // Backward compatibility (deprecated but kept for now)
  charts: ChartSpec[];
  kpis: KPI[];
  patterns: Pattern[];
  filters?: FilterSpec[];
  insights?: string[];
  layout?: any;
  metadata?: any;
  theme?: 'indigo' | 'emerald' | 'vibrant' | 'minimal' | 'dark' | 'light';
}

export type ReportBlockType = 'text' | 'heading1' | 'heading2' | 'heading3' | 'bullet' | 'ordered' | 'divider' | 'chart' | 'kpi' | 'table' | 'pivot' | 'query' | 'image' | 'callout';

export interface ReportBlock {
  id: string;
  type: ReportBlockType;
  content: any; // text string, ChartSpec, KPI, etc.
  metadata?: any;
}

export interface ReportSection {
  id: string;
  title: string;
  blocks?: ReportBlock[]; // New block-based structure
  content: string; // Markdown
  charts: ChartSpec[];
  kpis: KPI[];
  keyTakeaways: string[];
  swot?: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  recommendations?: {
    action: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    rationale: string;
  }[];
  risks?: {
    category: string;
    description: string;
    level: 'critical' | 'high' | 'medium' | 'low';
    mitigation: string;
  }[];
  reasoning?: string;
  logicPath?: string; // Mermaid logic string
  dataFrames?: CalculatedDataFrame[];
}

export interface CalculatedDataFrame {
  id: string;
  title: string;
  description: string;
  logic: string; // The "First Principles" formula or reasoning
  headers: { name: string; type: string; description: string; validationRule?: string }[];
  rows: any[];
  summaryInsights: string[];
}

export interface StrategicReport {
  title: string;
  subtitle?: string;
  executiveSummary: string;
  sections: ReportSection[];
  dataFrames?: CalculatedDataFrame[];
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

export type ColumnRole = 'dimension' | 'measure' | 'time' | 'geography' | 'country' | 'state' | 'city' | 'id' | 'text' | 'unknown';

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
export interface ShareSnapshot {
  resourceType: 'dashboard' | 'report';
  title: string;
  snapshot: {
    kpis?: any[];
    charts?: any[];
    summary?: string;
    sections?: any[];
  };
  viewedAt?: string;
}
