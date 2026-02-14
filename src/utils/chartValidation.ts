import { ChartSpec, DataRow } from '../../types';

/**
 * Chart Validation & Quality Utilities
 * Validates chart specifications and data quality
 * Provides warnings and recommendations for dashboard improvements
 */

export interface ChartValidationResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
  recommendations: string[];
  score: number; // 0-100, higher is better
}

export interface DataQualityWarning {
  level: 'info' | 'warning' | 'error';
  message: string;
  affectedField?: string;
  recommendation?: string;
}

/**
 * Validate a chart specification and data
 */
export function validateChartSpec(
  spec: ChartSpec,
  data: DataRow[],
  headers: string[]
): ChartValidationResult {
  const result: ChartValidationResult = {
    valid: true,
    warnings: [],
    errors: [],
    recommendations: [],
    score: 100
  };

  if (!spec) {
    result.valid = false;
    result.errors.push('Chart specification is missing');
    return result;
  }

  if (!data || data.length === 0) {
    result.valid = false;
    result.errors.push('No data provided for chart');
    result.score = 0;
    return result;
  }

  // Validate axis columns exist
  const safeHeaders = headers || [];
  if (spec.xAxis && !safeHeaders.includes(spec.xAxis)) {
    result.valid = false;
    result.errors.push(`X-axis column "${spec.xAxis}" not found in dataset`);
    result.score -= 50;
  }

  if (spec.yAxis && !safeHeaders.includes(spec.yAxis) && spec.yAxis !== 'count') {
    result.valid = false;
    result.errors.push(`Y-axis column "${spec.yAxis}" not found in dataset`);
    result.score -= 50;
  }

  // Check data cardinality for different chart types
  const xValues = new Set(data.map(r => String(r[spec.xAxis] || '')));
  const yValues = new Set(data.map(r => String(r[spec.yAxis] || '')));

  // Pie charts should have moderate cardinality
  if (spec.type === 'pie' && xValues.size > 20) {
    result.warnings.push(
      `Pie chart has ${xValues.size} categories, which may be hard to read. Consider using a bar chart or sunburst.`
    );
    result.recommendations.push('Use aggregation with "Top N + Other" grouping for high-cardinality pie charts');
    result.score -= 20;
  }

  // Sunburst can handle more, but warn if extreme
  if (spec.type === 'sunburst' && xValues.size > 50) {
    result.warnings.push(
      `Sunburst has ${xValues.size} categories. Visualization might be cluttered.`
    );
    result.score -= 10;
  }

  // Scatter plots should have numeric data
  if (spec.type === 'scatter') {
    const xNumeric = data.filter(r => !isNaN(Number(r[spec.xAxis]))).length;
    const yNumeric = data.filter(r => !isNaN(Number(r[spec.yAxis]))).length;

    if (xNumeric < data.length * 0.7) {
      result.warnings.push(`X-axis has only ${Math.round((xNumeric / data.length) * 100)}% numeric values`);
      result.score -= 15;
    }

    if (yNumeric < data.length * 0.7) {
      result.warnings.push(`Y-axis has only ${Math.round((yNumeric / data.length) * 100)}% numeric values`);
      result.score -= 15;
    }
  }

  // Check for missing data
  const xMissing = data.filter(r => r[spec.xAxis] === null || r[spec.xAxis] === undefined).length;
  const yMissing = data.filter(r => r[spec.yAxis] === null || r[spec.yAxis] === undefined).length;

  if (xMissing > data.length * 0.1) {
    result.warnings.push(
      `X-axis has ${Math.round((xMissing / data.length) * 100)}% missing values`
    );
    result.score -= 10;
  }

  if (yMissing > data.length * 0.1) {
    result.warnings.push(
      `Y-axis has ${Math.round((yMissing / data.length) * 100)}% missing values`
    );
    result.score -= 10;
  }

  // Ensure score is 0-100
  result.score = Math.max(0, Math.min(100, result.score));

  return result;
}

/**
 * Assess overall data quality
 */
export function assessDataQuality(
  data: DataRow[],
  headers: string[]
): {
  overallScore: number;
  warnings: DataQualityWarning[];
  missingValuePercents: { [key: string]: number };
  cardinalities: { [key: string]: number };
} {
  const warnings: DataQualityWarning[] = [];
  const missingValuePercents: { [key: string]: number } = {};
  const cardinalities: { [key: string]: number } = {};

  if (!data || data.length === 0) {
    return {
      overallScore: 0,
      warnings: [{ level: 'error', message: 'Dataset is empty' }],
      missingValuePercents: {},
      cardinalities: {}
    };
  }

  let issueCount = 0;
  const safeHeaders = headers || [];

  for (const header of safeHeaders) {
    // Count missing values
    const missing = data.filter(r => r[header] === null || r[header] === undefined || String(r[header]).trim() === '').length;
    const missingPercent = (missing / data.length) * 100;
    missingValuePercents[header] = missingPercent;

    if (missingPercent > 50) {
      warnings.push({
        level: 'error',
        affectedField: header,
        message: `${header} has ${Math.round(missingPercent)}% missing values`,
        recommendation: 'Consider removing or imputing this column'
      });
      issueCount += 2;
    } else if (missingPercent > 20) {
      warnings.push({
        level: 'warning',
        affectedField: header,
        message: `${header} has ${Math.round(missingPercent)}% missing values`,
        recommendation: 'Consider handling missing values before analysis'
      });
      issueCount += 1;
    } else if (missingPercent > 5) {
      warnings.push({
        level: 'info',
        affectedField: header,
        message: `${header} has ${Math.round(missingPercent)}% missing values`
      });
    }

    // Count unique values
    const unique = new Set(
      data.map(r => String(r[header] || '').toLowerCase().trim()).filter(v => v)
    ).size;
    cardinalities[header] = unique;

    // Warn about high cardinality
    if (unique > data.length * 0.8 && unique > 100) {
      warnings.push({
        level: 'warning',
        affectedField: header,
        message: `${header} has very high cardinality (${unique} unique values)`,
        recommendation: 'This column may not be useful for grouping or categorization'
      });
      issueCount += 1;
    }

    // Warn about low cardinality in numeric-looking fields
    if (unique === 1) {
      warnings.push({
        level: 'info',
        affectedField: header,
        message: `${header} has only one unique value`,
        recommendation: 'This column does not provide useful variation for analysis'
      });
    }
  }

  // Calculate overall score (100 - issues)
  let overallScore = 100 - issueCount * 5;
  overallScore = Math.max(0, Math.min(100, overallScore));

  return {
    overallScore,
    warnings,
    missingValuePercents,
    cardinalities
  };
}

/**
 * Recommend chart types based on column types and cardinalities
 */
export function recommendChartTypes(
  xColumnCardinality: number,
  yColumnCardinality: number,
  xIsNumeric: boolean,
  yIsNumeric: boolean
): Array<{ type: string; score: number; reason: string }> {
  const recommendations: Array<{ type: string; score: number; reason: string }> = [];

  // Both numeric → scatter or bubble
  if (xIsNumeric && yIsNumeric) {
    recommendations.push({
      type: 'scatter',
      score: 95,
      reason: 'Both columns are numeric, perfect for scatter plot'
    });

    if (xColumnCardinality > 50) {
      recommendations.push({
        type: 'density',
        score: 80,
        reason: 'High density scatter might reveal clusters'
      });
    }
  }

  // One numeric, one categorical
  if ((xIsNumeric && !yIsNumeric) || (!xIsNumeric && yIsNumeric)) {
    recommendations.push({
      type: 'bar',
      score: 90,
      reason: 'Mixed numeric and categorical data'
    });

    if (xColumnCardinality < 12 && yColumnCardinality < 12) {
      recommendations.push({
        type: 'heatmap',
        score: 75,
        reason: 'Could create a heatmap for cross-tabulation'
      });
    }
  }

  // Both categorical
  if (!xIsNumeric && !yIsNumeric) {
    if (xColumnCardinality < 8 && yColumnCardinality < 8) {
      recommendations.push({
        type: 'heatmap',
        score: 85,
        reason: 'Low cardinality categorical, good for heatmap'
      });
    }

    recommendations.push({
      type: 'bar',
      score: 70,
      reason: 'Categorical data, can show counts'
    });
  }

  // High cardinality categorical
  if (!xIsNumeric && xColumnCardinality > 20) {
    recommendations.push({
      type: 'pie',
      score: 40,
      reason: 'High cardinality may make pie chart cluttered'
    });

    recommendations.push({
      type: 'wordcloud',
      score: 70,
      reason: 'Word cloud could visualize categories proportionally'
    });
  }

  // Moderate cardinality categorical
  if (!xIsNumeric && xColumnCardinality > 5 && xColumnCardinality <= 20) {
    recommendations.push({
      type: 'pie',
      score: 75,
      reason: 'Pie chart suitable for moderate cardinality'
    });
  }

  // Low cardinality categorical
  if (!xIsNumeric && xColumnCardinality <= 5) {
    recommendations.push({
      type: 'pie',
      score: 95,
      reason: 'Pie chart perfect for low cardinality distribution'
    });
  }

  return recommendations.sort((a, b) => b.score - a.score);
}

/**
 * Generate human-readable insights from chart data
 */
export function generateChartInsights(
  data: Array<{ label: string; value: number }>,
  chartType: string
): string[] {
  const insights: string[] = [];

  if (!data || data.length === 0) return insights;

  // Sort by value
  const sorted = [...data].sort((a, b) => b.value - a.value);

  // Top and bottom insights
  if (sorted.length > 0) {
    insights.push(`Highest: ${sorted[0].label} (${sorted[0].value.toLocaleString()})`);
  }

  if (sorted.length > 1) {
    insights.push(`Lowest: ${sorted[sorted.length - 1].label} (${sorted[sorted.length - 1].value.toLocaleString()})`);
  }

  // Distribution insights
  if (sorted.length > 2) {
    const total = sorted.reduce((sum, d) => sum + d.value, 0);
    const top3Sum = sorted.slice(0, 3).reduce((sum, d) => sum + d.value, 0);
    const concentration = (top3Sum / total) * 100;

    if (concentration > 70) {
      insights.push(`Highly concentrated: Top 3 accounts for ${Math.round(concentration)}% of total`);
    } else if (concentration < 30) {
      insights.push(`Well distributed: Top 3 accounts for only ${Math.round(concentration)}% of total`);
    } else {
      insights.push(`Balanced distribution: Top 3 accounts for ${Math.round(concentration)}% of total`);
    }
  }

  // Variance insights
  if (sorted.length > 2) {
    const values = sorted.map(d => d.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const maxDeviation = Math.max(...values.map(v => Math.abs(v - avg)));

    if (maxDeviation > avg * 2) {
      insights.push('High variability across categories');
    }
  }

  return insights;
}
