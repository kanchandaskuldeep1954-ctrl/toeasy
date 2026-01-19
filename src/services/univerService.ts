/**
 * Univer Service - Enhanced AI-Powered Data Cleaning
 * 
 * This service provides powerful semantic understanding and cleaning capabilities:
 * - Industry/domain detection (finance, healthcare, e-commerce, etc.)
 * - Semantic field type inference (name, email, phone, currency, date, etc.)
 * - Cross-row relationship detection for data recovery
 * - Pattern-based value recovery
 * - Lowest data loss rate through intelligent recovery
 */

import { DataRow, ValidationRule, QualityDimension, Dataset, CellIssue } from '../../types';
import { apiClient } from './apiClient';

// Change history entry type
export interface ChangeHistoryEntry {
    id: string;
    timestamp: Date;
    action: 'fix' | 'edit' | 'recover' | 'quarantine' | 'undo';
    actor: 'ai' | 'user';
    row: number;
    column: string;
    oldValue: any;
    newValue: any;
    explanation: string;
    canUndo: boolean;
}

// Industry/Domain types
export type IndustryDomain =
    | 'finance' | 'healthcare' | 'ecommerce' | 'education'
    | 'logistics' | 'retail' | 'manufacturing' | 'real_estate'
    | 'hr' | 'crm' | 'inventory' | 'general';

// Semantic field types
export type SemanticFieldType =
    | 'name' | 'first_name' | 'last_name' | 'full_name'
    | 'email' | 'phone' | 'address' | 'city' | 'state' | 'country' | 'postal_code'
    | 'currency' | 'price' | 'amount' | 'percentage' | 'quantity' | 'count'
    | 'date' | 'datetime' | 'time' | 'year' | 'month' | 'day'
    | 'id' | 'sku' | 'code' | 'reference'
    | 'url' | 'domain' | 'ip_address'
    | 'text' | 'description' | 'notes' | 'comment'
    | 'boolean' | 'status' | 'category' | 'type'
    | 'unknown';

// Semantic analysis result for a column
export interface ColumnSemantics {
    column: string;
    fieldType: SemanticFieldType;
    confidence: number;
    patterns: string[];
    validValues: any[];
    invalidValues: any[];
    nullCount: number;
    uniqueCount: number;
    inferredFormat?: string;
    relatedColumns?: string[];
    recoverySource?: string; // Column to use for recovery
}

// Dataset semantic analysis
export interface DatasetSemantics {
    domain: IndustryDomain;
    domainConfidence: number;
    businessContext: string;
    columns: ColumnSemantics[];
    relationships: ColumnRelationship[];
    qualityScore: number;
    recommendations: string[];
}

// Relationship between columns
export interface ColumnRelationship {
    column1: string;
    column2: string;
    type: 'lookup' | 'calculation' | 'derivation' | 'dependency';
    formula?: string;
    confidence: number;
}

// Recovery strategies
export type RecoveryStrategy =
    | 'lookup' | 'calculate' | 'pattern' | 'mode' | 'mean' | 'median'
    | 'interpolate' | 'forward_fill' | 'backward_fill' | 'default' | 'remove';

// Recovery plan for a cell
export interface RecoveryPlan {
    row: number;
    column: string;
    currentValue: any;
    suggestedValue: any;
    strategy: RecoveryStrategy;
    confidence: number;
    explanation: string;
    dataLossRisk: 'none' | 'low' | 'medium' | 'high';
}

/**
 * Pattern matchers for semantic field detection
 */
const FIELD_PATTERNS: Record<SemanticFieldType, RegExp[]> = {
    email: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/i],
    phone: [/^\+?[\d\s\-\(\)]{7,20}$/, /^\d{3}[-.]?\d{3}[-.]?\d{4}$/],
    postal_code: [/^\d{5}(-\d{4})?$/, /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i],
    url: [/^https?:\/\/[^\s]+$/i],
    ip_address: [/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/],
    date: [/^\d{4}[-/]\d{2}[-/]\d{2}$/, /^\d{2}[-/]\d{2}[-/]\d{4}$/],
    datetime: [/^\d{4}[-/]\d{2}[-/]\d{2}[T\s]\d{2}:\d{2}/],
    time: [/^\d{2}:\d{2}(:\d{2})?$/],
    currency: [/^\$?[\d,]+\.?\d{0,2}$/, /^€[\d,]+\.?\d{0,2}$/, /^₹[\d,]+\.?\d{0,2}$/],
    percentage: [/^\d+\.?\d*%$/],
    boolean: [/^(true|false|yes|no|1|0)$/i],

    // Patterns from column names
    name: [], first_name: [], last_name: [], full_name: [],
    address: [], city: [], state: [], country: [],
    price: [], amount: [], quantity: [], count: [],
    year: [], month: [], day: [],
    id: [], sku: [], code: [], reference: [],
    domain: [], text: [], description: [], notes: [], comment: [],
    status: [], category: [], type: [], unknown: [],
};

/**
 * Column name hints for semantic detection
 */
const COLUMN_NAME_HINTS: Record<string, SemanticFieldType> = {
    // Names
    'name': 'name', 'fullname': 'full_name', 'full_name': 'full_name',
    'firstname': 'first_name', 'first_name': 'first_name', 'fname': 'first_name',
    'lastname': 'last_name', 'last_name': 'last_name', 'lname': 'last_name',
    'customer': 'name', 'client': 'name', 'user': 'name', 'employee': 'name',

    // Contact
    'email': 'email', 'mail': 'email', 'emailaddress': 'email', 'e_mail': 'email',
    'phone': 'phone', 'telephone': 'phone', 'mobile': 'phone', 'cell': 'phone',
    'phonenumber': 'phone', 'phone_number': 'phone', 'contact': 'phone',

    // Address
    'address': 'address', 'street': 'address', 'streetaddress': 'address',
    'city': 'city', 'town': 'city',
    'state': 'state', 'province': 'state', 'region': 'state',
    'country': 'country', 'nation': 'country',
    'zip': 'postal_code', 'zipcode': 'postal_code', 'postalcode': 'postal_code', 'postcode': 'postal_code',

    // Financial
    'price': 'price', 'cost': 'price', 'amount': 'amount', 'total': 'amount',
    'subtotal': 'amount', 'grandtotal': 'amount', 'revenue': 'amount', 'sales': 'amount',
    'quantity': 'quantity', 'qty': 'quantity', 'count': 'count', 'units': 'quantity',
    'discount': 'percentage', 'tax': 'percentage', 'rate': 'percentage',

    // Dates
    'date': 'date', 'created': 'datetime', 'updated': 'datetime', 'modified': 'datetime',
    'createdAt': 'datetime', 'created_at': 'datetime', 'updatedAt': 'datetime', 'updated_at': 'datetime',
    'dob': 'date', 'birthdate': 'date', 'birth_date': 'date',
    'year': 'year', 'month': 'month', 'day': 'day',

    // IDs
    'id': 'id', 'uid': 'id', 'uuid': 'id', 'key': 'id',
    'sku': 'sku', 'productcode': 'code', 'product_code': 'code', 'itemcode': 'code',
    'orderid': 'id', 'order_id': 'id', 'invoiceid': 'id', 'invoice_id': 'id',

    // Status
    'status': 'status', 'condition': 'status', 'statefield': 'status',
    'category': 'category', 'type': 'type', 'class': 'category',

    // Text
    'description': 'description', 'desc': 'description', 'details': 'description',
    'notes': 'notes', 'comments': 'comment', 'comment': 'comment', 'remarks': 'notes',
};

/**
 * Detect semantic field type from column name and sample values
 */
export function detectFieldType(
    columnName: string,
    values: any[]
): { type: SemanticFieldType; confidence: number } {
    const normalizedName = columnName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Check column name hints first
    if (COLUMN_NAME_HINTS[normalizedName]) {
        return { type: COLUMN_NAME_HINTS[normalizedName], confidence: 0.85 };
    }

    // Partial match on column name
    for (const [hint, type] of Object.entries(COLUMN_NAME_HINTS)) {
        if (normalizedName.includes(hint) || hint.includes(normalizedName)) {
            return { type, confidence: 0.7 };
        }
    }

    // Check value patterns
    const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
    if (nonNullValues.length === 0) {
        return { type: 'unknown', confidence: 0 };
    }

    // Test each pattern type
    for (const [fieldType, patterns] of Object.entries(FIELD_PATTERNS)) {
        if (patterns.length === 0) continue;

        const matchCount = nonNullValues.filter(v =>
            patterns.some(p => p.test(String(v)))
        ).length;

        const matchRatio = matchCount / nonNullValues.length;
        if (matchRatio >= 0.7) {
            return { type: fieldType as SemanticFieldType, confidence: matchRatio };
        }
    }

    // Check if numeric
    const numericCount = nonNullValues.filter(v => !isNaN(Number(v))).length;
    if (numericCount / nonNullValues.length > 0.9) {
        // Could be price, quantity, or general number
        if (normalizedName.includes('price') || normalizedName.includes('cost') || normalizedName.includes('amount')) {
            return { type: 'price', confidence: 0.8 };
        }
        if (normalizedName.includes('qty') || normalizedName.includes('quantity') || normalizedName.includes('count')) {
            return { type: 'quantity', confidence: 0.8 };
        }
        return { type: 'amount', confidence: 0.6 };
    }

    return { type: 'text', confidence: 0.5 };
}

/**
 * Detect industry/domain from column names and values
 */
export function detectDomain(columns: string[], sampleData: DataRow[]): { domain: IndustryDomain; confidence: number } {
    const normalizedColumns = columns.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''));

    const domainIndicators: Record<IndustryDomain, string[]> = {
        finance: ['revenue', 'profit', 'expense', 'balance', 'transaction', 'account', 'investment', 'portfolio'],
        healthcare: ['patient', 'diagnosis', 'prescription', 'treatment', 'medication', 'doctor', 'hospital', 'medical'],
        ecommerce: ['product', 'order', 'cart', 'sku', 'shipping', 'customer', 'price', 'quantity', 'discount'],
        education: ['student', 'course', 'grade', 'enrollment', 'teacher', 'class', 'semester', 'gpa'],
        logistics: ['shipment', 'tracking', 'delivery', 'warehouse', 'inventory', 'carrier', 'freight'],
        retail: ['store', 'sale', 'product', 'inventory', 'sku', 'price', 'customer', 'receipt'],
        manufacturing: ['production', 'batch', 'material', 'quality', 'defect', 'assembly', 'part'],
        real_estate: ['property', 'listing', 'rent', 'lease', 'tenant', 'landlord', 'mortgage', 'sqft'],
        hr: ['employee', 'salary', 'department', 'hire', 'performance', 'leave', 'position', 'manager'],
        crm: ['lead', 'opportunity', 'contact', 'campaign', 'conversion', 'deal', 'pipeline'],
        inventory: ['stock', 'warehouse', 'bin', 'location', 'reorder', 'sku', 'quantity'],
        general: [],
    };

    let bestDomain: IndustryDomain = 'general';
    let maxScore = 0;

    for (const [domain, indicators] of Object.entries(domainIndicators)) {
        let score = 0;
        for (const indicator of indicators) {
            if (normalizedColumns.some(c => c.includes(indicator))) {
                score += 1;
            }
        }
        if (score > maxScore) {
            maxScore = score;
            bestDomain = domain as IndustryDomain;
        }
    }

    return { domain: bestDomain, confidence: Math.min(maxScore / 3, 1) };
}

/**
 * Analyze a dataset for semantic understanding
 */
export async function analyzeDatasetSemantics(dataset: Dataset): Promise<DatasetSemantics> {
    const { headers, data } = dataset;

    // Detect domain
    const { domain, confidence: domainConfidence } = detectDomain(headers, data);

    // Analyze each column
    const columns: ColumnSemantics[] = headers.filter(h => h !== '__metadata').map(column => {
        const values = data.map(row => row[column]);
        const { type, confidence } = detectFieldType(column, values);

        const nullCount = values.filter(v => v === null || v === undefined || v === '').length;
        const uniqueValues = [...new Set(values.filter(v => v !== null && v !== undefined && v !== ''))];

        // Detect patterns in the values
        const patterns: string[] = [];
        if (type === 'email') {
            const domains = values
                .filter(v => v && typeof v === 'string' && v.includes('@'))
                .map(v => v.split('@')[1])
                .filter(Boolean);
            if (domains.length > 0) {
                patterns.push(`Common domains: ${[...new Set(domains)].slice(0, 3).join(', ')}`);
            }
        }

        // Find invalid values
        const invalidValues = findInvalidValues(values, type);

        return {
            column,
            fieldType: type,
            confidence,
            patterns,
            validValues: uniqueValues.slice(0, 10),
            invalidValues,
            nullCount,
            uniqueCount: uniqueValues.length,
        };
    });

    // Detect relationships between columns
    const relationships = detectColumnRelationships(headers, data);

    // Calculate quality score
    const totalCells = data.length * headers.filter(h => h !== '__metadata').length;
    const nullCells = columns.reduce((sum, c) => sum + c.nullCount, 0);
    const invalidCells = columns.reduce((sum, c) => sum + c.invalidValues.length, 0);
    const qualityScore = Math.round(((totalCells - nullCells - invalidCells) / totalCells) * 100);

    // Generate recommendations
    const recommendations = generateRecommendations(columns, relationships);

    return {
        domain,
        domainConfidence,
        businessContext: generateBusinessContext(domain, columns),
        columns,
        relationships,
        qualityScore,
        recommendations,
    };
}

/**
 * Find invalid values in a column based on semantic type
 */
function findInvalidValues(values: any[], fieldType: SemanticFieldType): any[] {
    const invalid: any[] = [];

    values.forEach((value, idx) => {
        if (value === null || value === undefined || value === '') return;

        const strValue = String(value);
        let isValid = true;

        switch (fieldType) {
            case 'email':
                isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue);
                break;
            case 'phone':
                isValid = /^\+?[\d\s\-\(\)]{7,20}$/.test(strValue);
                break;
            case 'price':
            case 'amount':
            case 'quantity':
                isValid = !isNaN(Number(strValue.replace(/[$,€₹]/g, '')));
                if (isValid && (fieldType === 'price' || fieldType === 'quantity')) {
                    const num = Number(strValue.replace(/[$,€₹]/g, ''));
                    isValid = num >= 0; // Prices and quantities shouldn't be negative
                }
                break;
            case 'date':
                isValid = !isNaN(Date.parse(strValue));
                break;
            case 'postal_code':
                isValid = /^\d{5}(-\d{4})?$|^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i.test(strValue);
                break;
            case 'url':
                isValid = /^https?:\/\/[^\s]+$/.test(strValue);
                break;
        }

        if (!isValid) {
            invalid.push({ value, index: idx });
        }
    });

    return invalid;
}

/**
 * Detect relationships between columns
 */
function detectColumnRelationships(headers: string[], data: DataRow[]): ColumnRelationship[] {
    const relationships: ColumnRelationship[] = [];

    // Look for calculation relationships (e.g., Total = Quantity * Price)
    const numericColumns = headers.filter(h => {
        const values = data.map(row => row[h]).filter(v => v !== null && v !== undefined);
        return values.every(v => !isNaN(Number(v)));
    });

    for (let i = 0; i < numericColumns.length; i++) {
        for (let j = i + 1; j < numericColumns.length; j++) {
            for (let k = j + 1; k < numericColumns.length; k++) {
                const cols = [numericColumns[i], numericColumns[j], numericColumns[k]];

                // Check if any column is the product of the other two
                for (let p = 0; p < 3; p++) {
                    const product = cols[p];
                    const factor1 = cols[(p + 1) % 3];
                    const factor2 = cols[(p + 2) % 3];

                    const matches = data.filter(row => {
                        const pVal = Number(row[product]);
                        const f1Val = Number(row[factor1]);
                        const f2Val = Number(row[factor2]);
                        return Math.abs(pVal - (f1Val * f2Val)) < 0.01;
                    }).length;

                    if (matches / data.length > 0.9) {
                        relationships.push({
                            column1: product,
                            column2: `${factor1} * ${factor2}`,
                            type: 'calculation',
                            formula: `${product} = ${factor1} * ${factor2}`,
                            confidence: matches / data.length,
                        });
                    }
                }
            }
        }
    }

    // Look for lookup relationships (same value patterns)
    // This would be enhanced with AI for more complex patterns

    return relationships;
}

/**
 * Generate business context description
 */
function generateBusinessContext(domain: IndustryDomain, columns: ColumnSemantics[]): string {
    const contexts: Record<IndustryDomain, string> = {
        finance: 'Financial transaction and accounting data',
        healthcare: 'Healthcare and patient management data',
        ecommerce: 'E-commerce orders and products data',
        education: 'Educational records and student data',
        logistics: 'Logistics and shipping data',
        retail: 'Retail sales and inventory data',
        manufacturing: 'Manufacturing and production data',
        real_estate: 'Real estate listings and properties data',
        hr: 'Human resources and employee data',
        crm: 'Customer relationship management data',
        inventory: 'Inventory and stock management data',
        general: 'General business data',
    };

    return contexts[domain] || contexts.general;
}

/**
 * Generate cleaning recommendations
 */
function generateRecommendations(columns: ColumnSemantics[], relationships: ColumnRelationship[]): string[] {
    const recommendations: string[] = [];

    for (const col of columns) {
        if (col.nullCount > 0) {
            const nullPercentage = Math.round((col.nullCount / (col.nullCount + col.uniqueCount)) * 100);
            if (nullPercentage > 20) {
                recommendations.push(`Column "${col.column}" has ${nullPercentage}% missing values - consider recovery or removal`);
            }
        }

        if (col.invalidValues.length > 0) {
            recommendations.push(`Column "${col.column}" has ${col.invalidValues.length} invalid ${col.fieldType} values`);
        }
    }

    for (const rel of relationships) {
        if (rel.type === 'calculation') {
            recommendations.push(`Detected formula relationship: ${rel.formula}`);
        }
    }

    return recommendations;
}

/**
 * Generate recovery plans for all issues with lowest data loss
 */
export function generateRecoveryPlans(
    data: DataRow[],
    headers: string[],
    semantics: DatasetSemantics
): RecoveryPlan[] {
    const plans: RecoveryPlan[] = [];

    for (const colSem of semantics.columns) {
        const colIndex = headers.indexOf(colSem.column);
        if (colIndex === -1) continue;

        // Handle missing values
        data.forEach((row, rowIndex) => {
            const value = row[colSem.column];

            if (value === null || value === undefined || value === '') {
                const plan = createRecoveryPlan(
                    rowIndex,
                    colSem.column,
                    value,
                    colSem,
                    semantics.relationships,
                    data
                );
                if (plan) plans.push(plan);
            }
        });

        // Handle invalid values
        for (const invalid of colSem.invalidValues) {
            const plan = createRecoveryPlan(
                invalid.index,
                colSem.column,
                invalid.value,
                colSem,
                semantics.relationships,
                data
            );
            if (plan) plans.push(plan);
        }
    }

    // Sort by confidence (highest first) and data loss risk (lowest first)
    plans.sort((a, b) => {
        const riskOrder = { none: 0, low: 1, medium: 2, high: 3 };
        if (riskOrder[a.dataLossRisk] !== riskOrder[b.dataLossRisk]) {
            return riskOrder[a.dataLossRisk] - riskOrder[b.dataLossRisk];
        }
        return b.confidence - a.confidence;
    });

    return plans;
}

/**
 * Create a recovery plan for a specific cell
 */
function createRecoveryPlan(
    rowIndex: number,
    column: string,
    currentValue: any,
    colSem: ColumnSemantics,
    relationships: ColumnRelationship[],
    data: DataRow[]
): RecoveryPlan | null {
    // Strategy 1: Use calculation relationship
    const calcRel = relationships.find(r =>
        r.type === 'calculation' && r.column1 === column
    );
    if (calcRel && calcRel.formula) {
        // Try to calculate from related columns
        // This is a simplified version - would need proper formula parsing
        const match = calcRel.formula.match(/(\w+)\s*\*\s*(\w+)/);
        if (match) {
            const val1 = Number(data[rowIndex][match[1]]);
            const val2 = Number(data[rowIndex][match[2]]);
            if (!isNaN(val1) && !isNaN(val2)) {
                return {
                    row: rowIndex,
                    column,
                    currentValue,
                    suggestedValue: val1 * val2,
                    strategy: 'calculate',
                    confidence: calcRel.confidence,
                    explanation: `Calculated using formula: ${calcRel.formula}`,
                    dataLossRisk: 'none',
                };
            }
        }
    }

    // Strategy 2: Lookup from similar rows
    // Find rows with similar values in other columns
    const lookupValue = findLookupValue(rowIndex, column, data, colSem);
    if (lookupValue !== null) {
        return {
            row: rowIndex,
            column,
            currentValue,
            suggestedValue: lookupValue.value,
            strategy: 'lookup',
            confidence: lookupValue.confidence,
            explanation: lookupValue.explanation,
            dataLossRisk: 'low',
        };
    }

    // Strategy 3: Use mode (most common value) for categorical
    if (['status', 'category', 'type', 'boolean'].includes(colSem.fieldType)) {
        const mode = findMode(data.map(r => r[column]));
        if (mode !== null) {
            return {
                row: rowIndex,
                column,
                currentValue,
                suggestedValue: mode,
                strategy: 'mode',
                confidence: 0.6,
                explanation: `Using most common value in column: "${mode}"`,
                dataLossRisk: 'low',
            };
        }
    }

    // Strategy 4: Use mean/median for numeric
    if (['price', 'amount', 'quantity', 'count'].includes(colSem.fieldType)) {
        const values = data
            .map(r => r[column])
            .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
            .map(Number);

        if (values.length > 0) {
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            return {
                row: rowIndex,
                column,
                currentValue,
                suggestedValue: Math.round(mean * 100) / 100,
                strategy: 'mean',
                confidence: 0.5,
                explanation: `Using column average: ${Math.round(mean * 100) / 100}`,
                dataLossRisk: 'medium',
            };
        }
    }

    // Strategy 5: Default value for specific types
    const defaultValue = getDefaultValue(colSem.fieldType);
    if (defaultValue !== null) {
        return {
            row: rowIndex,
            column,
            currentValue,
            suggestedValue: defaultValue,
            strategy: 'default',
            confidence: 0.3,
            explanation: `Using default value for ${colSem.fieldType} type`,
            dataLossRisk: 'medium',
        };
    }

    // Strategy 6: Remove/quarantine if no recovery possible
    return {
        row: rowIndex,
        column,
        currentValue,
        suggestedValue: null,
        strategy: 'remove',
        confidence: 1,
        explanation: 'No valid recovery method found - recommend quarantine',
        dataLossRisk: 'high',
    };
}

/**
 * Find value by looking up similar rows
 */
function findLookupValue(
    rowIndex: number,
    column: string,
    data: DataRow[],
    colSem: ColumnSemantics
): { value: any; confidence: number; explanation: string } | null {
    const row = data[rowIndex];

    // Find similar rows based on other columns
    for (const otherRow of data) {
        if (otherRow === row) continue;

        const targetValue = otherRow[column];
        if (targetValue === null || targetValue === undefined || targetValue === '') continue;

        // Count matching columns
        let matches = 0;
        let total = 0;

        for (const col of Object.keys(row)) {
            if (col === column || col === '__metadata') continue;
            if (row[col] === otherRow[col]) matches++;
            total++;
        }

        if (total > 0 && matches / total > 0.8) {
            return {
                value: targetValue,
                confidence: matches / total,
                explanation: `Matched from similar row with ${Math.round(matches / total * 100)}% similarity`,
            };
        }
    }

    return null;
}

/**
 * Find mode (most common value)
 */
function findMode(values: any[]): any | null {
    const counts = new Map<any, number>();
    let maxCount = 0;
    let mode = null;

    for (const v of values) {
        if (v === null || v === undefined || v === '') continue;
        const count = (counts.get(v) || 0) + 1;
        counts.set(v, count);
        if (count > maxCount) {
            maxCount = count;
            mode = v;
        }
    }

    return maxCount > 1 ? mode : null;
}

/**
 * Get default value for a field type
 */
function getDefaultValue(fieldType: SemanticFieldType): any | null {
    const defaults: Partial<Record<SemanticFieldType, any>> = {
        boolean: false,
        status: 'Unknown',
        category: 'Uncategorized',
        quantity: 0,
        count: 0,
        price: 0,
        amount: 0,
    };

    return defaults[fieldType] ?? null;
}

/**
 * Convert recovery plans to cell issues for UI display
 */
export function recoveryPlansToCellIssues(
    plans: RecoveryPlan[],
    headers: string[]
): CellIssue[] {
    return plans.map(plan => ({
        row: plan.row,
        col: headers.indexOf(plan.column),
        columnName: plan.column,
        currentValue: plan.currentValue,
        issueType: plan.currentValue === null || plan.currentValue === undefined || plan.currentValue === ''
            ? 'missing'
            : 'invalid_format',
        severity: plan.dataLossRisk === 'none' || plan.dataLossRisk === 'low' ? 'warning' : 'error',
        suggestedValue: plan.suggestedValue,
        confidence: plan.confidence,
        explanation: plan.explanation,
        recoveryMethod: plan.strategy === 'calculate' ? 'calculate' :
            plan.strategy === 'lookup' ? 'lookup' :
                plan.strategy === 'pattern' ? 'pattern' :
                    plan.strategy === 'remove' ? 'remove' : 'ai_infer',
    }));
}

/**
 * Apply a single recovery plan to the data
 */
export function applyRecoveryPlan(
    data: DataRow[],
    plan: RecoveryPlan
): { data: DataRow[]; historyEntry: ChangeHistoryEntry } {
    const newData = [...data];
    const row = { ...newData[plan.row] };

    const oldValue = row[plan.column];
    row[plan.column] = plan.suggestedValue;

    // Add recovery metadata
    if (!row.__metadata) row.__metadata = {};
    if (!row.__metadata.recoveredFields) row.__metadata.recoveredFields = [];
    if (!row.__metadata.recoveryExplanations) row.__metadata.recoveryExplanations = {};

    row.__metadata.recoveredFields.push(plan.column);
    row.__metadata.recoveryExplanations[plan.column] = plan.explanation;

    newData[plan.row] = row;

    const historyEntry: ChangeHistoryEntry = {
        id: `${Date.now()}-${plan.row}-${plan.column}`,
        timestamp: new Date(),
        action: 'recover',
        actor: 'ai',
        row: plan.row,
        column: plan.column,
        oldValue,
        newValue: plan.suggestedValue,
        explanation: plan.explanation,
        canUndo: true,
    };

    return { data: newData, historyEntry };
}
