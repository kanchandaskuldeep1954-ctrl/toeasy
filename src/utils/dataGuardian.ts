/**
 * Data Guardian Layer
 * Centralized data sanitization for charts, KPIs, and metrics
 * 
 * Philosophy:
 * 1. Never silently replace or ignore data - log, warn, and report
 * 2. All data entering visualizations MUST pass through this layer
 * 3. Provide quality scores for UI feedback
 */

export interface SanitizedValue {
    value: number;
    isValid: boolean;
    originalValue: any;
    warningCode?: 'NULL' | 'NAN' | 'TYPE_MISMATCH' | 'OVERFLOW' | 'EMPTY';
}

export interface SanitizedDataPoint {
    label: string;
    value: number;
    isValid: boolean;
    originalRow?: any;
}

export interface DataQualityReport {
    totalRows: number;
    validRows: number;
    nullCount: number;
    nanCount: number;
    typeMismatchCount: number;
    qualityScore: number; // 0-100
    qualityLevel: 'excellent' | 'good' | 'warning' | 'critical';
    warnings: string[];
}

export interface ChartSanitizationResult {
    data: SanitizedDataPoint[];
    quality: DataQualityReport;
    hasIssues: boolean;
}

export interface KPISanitizationResult {
    value: number | null;
    displayValue: string;
    quality: 'excellent' | 'good' | 'warning' | 'critical';
    qualityScore: number;
    validCount: number;
    totalCount: number;
    warnings: string[];
}

// ==================== CORE PARSING ====================

/**
 * Parse a value to number with full audit trail
 * Returns null for truly unparseable values (NOT 0)
 */
export function parseNumericSafe(val: any): SanitizedValue {
    // Null/undefined
    if (val === null || val === undefined) {
        return { value: 0, isValid: false, originalValue: val, warningCode: 'NULL' };
    }

    // Already a number
    if (typeof val === 'number') {
        if (isNaN(val)) {
            return { value: 0, isValid: false, originalValue: val, warningCode: 'NAN' };
        }
        if (!isFinite(val)) {
            return { value: 0, isValid: false, originalValue: val, warningCode: 'OVERFLOW' };
        }
        return { value: val, isValid: true, originalValue: val };
    }

    // String parsing
    if (typeof val === 'string') {
        const trimmed = val.trim();

        if (trimmed === '' || trimmed === '-' || trimmed === '.') {
            return { value: 0, isValid: false, originalValue: val, warningCode: 'EMPTY' };
        }

        // Semantic booleans
        const lower = trimmed.toLowerCase();
        if (['yes', 'true', 'y', '1', 'active', 'success', 'high'].includes(lower)) {
            return { value: 1, isValid: true, originalValue: val };
        }
        if (['no', 'false', 'n', '0', 'inactive', 'failure', 'low'].includes(lower)) {
            return { value: 0, isValid: true, originalValue: val };
        }

        // N/A, null strings
        if (['n/a', 'na', 'null', 'none', 'undefined', '-', '--'].includes(lower)) {
            return { value: 0, isValid: false, originalValue: val, warningCode: 'NULL' };
        }

        // Clean currency, commas, percentages
        const cleaned = trimmed
            .replace(/[$€£¥₹,]/g, '')
            .replace(/%$/, '')
            .replace(/\s/g, '');

        const num = parseFloat(cleaned);
        if (isNaN(num)) {
            return { value: 0, isValid: false, originalValue: val, warningCode: 'TYPE_MISMATCH' };
        }

        return { value: num, isValid: true, originalValue: val };
    }

    // Boolean
    if (typeof val === 'boolean') {
        return { value: val ? 1 : 0, isValid: true, originalValue: val };
    }

    // Fallback: try coercion
    const coerced = Number(val);
    if (!isNaN(coerced)) {
        return { value: coerced, isValid: true, originalValue: val };
    }

    return { value: 0, isValid: false, originalValue: val, warningCode: 'TYPE_MISMATCH' };
}

// ==================== CHART SANITIZATION ====================

/**
 * Sanitize data for chart rendering
 * Filters out invalid rows but tracks them for quality reporting
 */
export function sanitizeForChart(
    data: any[],
    labelKey: string,
    valueKey: string,
    options: {
        removeInvalid?: boolean;
        maxItems?: number;
    } = {}
): ChartSanitizationResult {
    const { removeInvalid = true, maxItems = 100 } = options;

    if (!data || !Array.isArray(data) || data.length === 0) {
        return {
            data: [],
            quality: {
                totalRows: 0,
                validRows: 0,
                nullCount: 0,
                nanCount: 0,
                typeMismatchCount: 0,
                qualityScore: 0,
                qualityLevel: 'critical',
                warnings: ['No data provided']
            },
            hasIssues: true
        };
    }

    const sanitized: SanitizedDataPoint[] = [];
    let nullCount = 0;
    let nanCount = 0;
    let typeMismatchCount = 0;

    for (const row of data) {
        const label = String(row[labelKey] ?? 'Unknown').substring(0, 50);
        const parsed = parseNumericSafe(row[valueKey]);

        if (!parsed.isValid) {
            switch (parsed.warningCode) {
                case 'NULL':
                case 'EMPTY':
                    nullCount++;
                    break;
                case 'NAN':
                    nanCount++;
                    break;
                case 'TYPE_MISMATCH':
                    typeMismatchCount++;
                    break;
            }
        }

        if (removeInvalid && !parsed.isValid) {
            continue;
        }

        sanitized.push({
            label,
            value: parsed.value,
            isValid: parsed.isValid,
            originalRow: row
        });
    }

    // Limit items
    const limited = sanitized.slice(0, maxItems);

    // Calculate quality
    const totalRows = data.length;
    const validRows = sanitized.filter(d => d.isValid).length;
    const issueCount = nullCount + nanCount + typeMismatchCount;
    const qualityScore = Math.max(0, Math.round(100 - (issueCount / totalRows) * 100));

    let qualityLevel: 'excellent' | 'good' | 'warning' | 'critical';
    if (qualityScore >= 95) qualityLevel = 'excellent';
    else if (qualityScore >= 80) qualityLevel = 'good';
    else if (qualityScore >= 50) qualityLevel = 'warning';
    else qualityLevel = 'critical';

    const warnings: string[] = [];
    if (nullCount > 0) warnings.push(`${nullCount} null/empty values`);
    if (nanCount > 0) warnings.push(`${nanCount} NaN values`);
    if (typeMismatchCount > 0) warnings.push(`${typeMismatchCount} type mismatches`);
    if (limited.length < sanitized.length) warnings.push(`Showing ${limited.length} of ${sanitized.length} items`);

    return {
        data: limited,
        quality: {
            totalRows,
            validRows,
            nullCount,
            nanCount,
            typeMismatchCount,
            qualityScore,
            qualityLevel,
            warnings
        },
        hasIssues: issueCount > 0
    };
}

// ==================== KPI SANITIZATION ====================

/**
 * Sanitize data for KPI calculation
 * Returns quality metrics alongside the computed value
 */
export function sanitizeForKPI(
    data: any[],
    column: string,
    operation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'median' = 'sum'
): KPISanitizationResult {
    if (!data || data.length === 0) {
        return {
            value: null,
            displayValue: 'N/A',
            quality: 'critical',
            qualityScore: 0,
            validCount: 0,
            totalCount: 0,
            warnings: ['No data']
        };
    }

    const parsed = data.map(row => parseNumericSafe(row[column]));
    const valid = parsed.filter(p => p.isValid);
    const values = valid.map(p => p.value);

    const totalCount = data.length;
    const validCount = valid.length;
    const qualityScore = Math.round((validCount / totalCount) * 100);

    let quality: 'excellent' | 'good' | 'warning' | 'critical';
    if (qualityScore >= 95) quality = 'excellent';
    else if (qualityScore >= 80) quality = 'good';
    else if (qualityScore >= 50) quality = 'warning';
    else quality = 'critical';

    const warnings: string[] = [];
    const invalidCount = totalCount - validCount;
    if (invalidCount > 0) {
        warnings.push(`${invalidCount} of ${totalCount} values excluded`);
    }

    if (values.length === 0) {
        return {
            value: null,
            displayValue: 'N/A',
            quality: 'critical',
            qualityScore: 0,
            validCount: 0,
            totalCount,
            warnings: ['No valid numeric values']
        };
    }

    let result: number;
    switch (operation) {
        case 'sum':
            result = values.reduce((a, b) => a + b, 0);
            break;
        case 'avg':
            result = values.reduce((a, b) => a + b, 0) / values.length;
            break;
        case 'count':
            result = values.length;
            break;
        case 'min':
            result = Math.min(...values);
            break;
        case 'max':
            result = Math.max(...values);
            break;
        case 'median':
            const sorted = [...values].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            result = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
            break;
        default:
            result = values.reduce((a, b) => a + b, 0);
    }

    return {
        value: result,
        displayValue: formatKPIValue(result),
        quality,
        qualityScore,
        validCount,
        totalCount,
        warnings
    };
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Format a KPI value for display
 */
export function formatKPIValue(value: number): string {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';

    const abs = Math.abs(value);
    if (abs >= 1e9) return (value / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return (value / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return (value / 1e3).toFixed(1) + 'K';

    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Get quality badge props for UI display
 */
export function getQualityBadge(level: 'excellent' | 'good' | 'warning' | 'critical'): {
    emoji: string;
    color: string;
    label: string;
} {
    switch (level) {
        case 'excellent':
            return { emoji: '🟢', color: '#10b981', label: 'Excellent' };
        case 'good':
            return { emoji: '🟡', color: '#f59e0b', label: 'Good' };
        case 'warning':
            return { emoji: '🟠', color: '#f97316', label: 'Warning' };
        case 'critical':
            return { emoji: '🔴', color: '#ef4444', label: 'Critical' };
    }
}

/**
 * Quick check if data array has quality issues
 */
export function hasDataQualityIssues(data: any[], valueKey: string): boolean {
    if (!data || data.length === 0) return true;

    const sample = data.slice(0, 100);
    let issueCount = 0;

    for (const row of sample) {
        const parsed = parseNumericSafe(row[valueKey]);
        if (!parsed.isValid) issueCount++;
    }

    return (issueCount / sample.length) > 0.1; // More than 10% issues
}

export default {
    parseNumericSafe,
    sanitizeForChart,
    sanitizeForKPI,
    formatKPIValue,
    getQualityBadge,
    hasDataQualityIssues
};
