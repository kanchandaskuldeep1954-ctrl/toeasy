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

// Elite Layer Imports
import * as CharNormalizer from './characterNormalizer';
import * as NumNormalizer from './numericNormalizer';
import * as DateNormalizer from './dateNormalizer';
import * as ValidationEngine from './validationEngine';
import * as StructuralCleaner from './structuralCleaner';

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
    isGarbage?: boolean;     // True if column is detected as structural garbage
    garbageReason?: string;
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
    | 'interpolate' | 'forward_fill' | 'backward_fill' | 'default'
    | 'remove' | 'remove_row' | 'remove_column';

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
 * Detect if a column is structural garbage
 */
function detectGarbageColumn(column: string, values: any[], nullCount: number): { isGarbage: boolean; reason?: string } {
    const totalCount = values.length;
    if (totalCount === 0) return { isGarbage: false };

    // 1. Column name is just a number (e.g. "56456")
    if (/^\d+$/.test(column) && column.length > 3) {
        return { isGarbage: true, reason: `Header "${column}" appears to be a random number, not a semantic title.` };
    }

    // 2. High null ratio (>90%) with low complexity
    const nullRatio = nullCount / totalCount;
    if (nullRatio > 0.9) {
        const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
        if (nonNull.length < 5) {
            return { isGarbage: true, reason: `Over 90% of column "${column}" is empty and contains no significant data patterns.` };
        }
    }

    // 3. Low entropy (all values same or random single chars)
    const uniqueValues = [...new Set(values.filter(v => v !== null && v !== undefined && v !== ''))];
    if (uniqueValues.length === 1 && totalCount > 10) {
        return { isGarbage: true, reason: `Column "${column}" contains only one repeated value: "${uniqueValues[0]}".` };
    }

    return { isGarbage: false };
}

/**
 * Detect industry/domain from column names and values
 */
export function detectDomain(columns: string[], sampleData: DataRow[]): { domain: IndustryDomain; confidence: number } {
    const normalizedColumns = columns.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ''));

    // Deeper indicators for professional domains
    const domainIndicators: Record<IndustryDomain, string[]> = {
        finance: ['revenue', 'profit', 'expense', 'balance', 'transaction', 'account', 'investment', 'portfolio', 'equity', 'ebitda', 'tax', 'asset', 'liability'],
        healthcare: ['patient', 'diagnosis', 'prescription', 'treatment', 'medication', 'doctor', 'hospital', 'medical', 'billing', 'hicn', 'icd10', 'vitals'],
        ecommerce: ['product', 'order', 'cart', 'sku', 'shipping', 'customer', 'price', 'quantity', 'discount', 'vendor', 'inventory', 'asin', 'upc'],
        education: ['student', 'course', 'grade', 'enrollment', 'teacher', 'class', 'semester', 'gpa', 'tuition', 'degree', 'alumni'],
        logistics: ['shipment', 'tracking', 'delivery', 'warehouse', 'inventory', 'carrier', 'freight', 'waybill', 'bol', 'etd', 'eta'],
        retail: ['store', 'sale', 'product', 'inventory', 'sku', 'price', 'customer', 'receipt', 'pos', 'barcode', 'aisle'],
        manufacturing: ['production', 'batch', 'material', 'quality', 'defect', 'assembly', 'part', 'oee', 'cycle_time', 'bom', 'wip'],
        real_estate: ['property', 'listing', 'rent', 'lease', 'tenant', 'landlord', 'mortgage', 'sqft', 'parcel', 'mls', 'zoning'],
        hr: ['employee', 'salary', 'department', 'hire', 'performance', 'leave', 'position', 'manager', 'payroll', 'benefits', 'ssn'],
        crm: ['lead', 'opportunity', 'contact', 'campaign', 'conversion', 'deal', 'pipeline', 'funnel', 'stage', 'revenue_potential'],
        inventory: ['stock', 'warehouse', 'bin', 'location', 'reorder', 'sku', 'quantity', 'safety_stock', 'lead_time', 'eoq'],
        general: [],
    };

    let bestDomain: IndustryDomain = 'general';
    let maxScore = 0;

    for (const [domain, indicators] of Object.entries(domainIndicators)) {
        let score = 0;
        for (const indicator of indicators) {
            if (normalizedColumns.some(c => c.includes(indicator))) {
                score += 2; // Exact header match
            }
        }

        // Sample data inspection for domain context
        const flattenedValues = sampleData.slice(0, 10).flatMap(row => Object.values(row).map(v => String(v).toLowerCase()));
        for (const indicator of indicators) {
            if (flattenedValues.some(v => v.includes(indicator))) {
                score += 0.5; // Data value match
            }
        }

        if (score > maxScore) {
            maxScore = score;
            bestDomain = domain as IndustryDomain;
        }
    }

    return { domain: bestDomain, confidence: Math.min(maxScore / 5, 1) };
}

/**
 * Analyze a dataset for semantic understanding
 */
export async function analyzeDatasetSemantics(dataset: Dataset): Promise<DatasetSemantics> {
    const { headers, data } = dataset;

    // 1. Run Local Analysis (Base Layer)
    // Detect domain
    const { domain, confidence: domainConfidence } = detectDomain(headers, data);

    // Analyze each column
    const columns: ColumnSemantics[] = headers.filter(h => h !== '__metadata').map(column => {
        const values = data.map(row => row[column]);

        // Elite Layer: Character and Unicode cleaning before analysis
        const cleanedValues = values.map(v => {
            if (typeof v === 'string') {
                let cleaned = CharNormalizer.stripInvisibleCharacters(v);
                cleaned = CharNormalizer.normalizeWhitespace(cleaned, { convertNBSP: true, trimEnds: true });
                return cleaned;
            }
            return v;
        });

        const { type, confidence } = detectFieldType(column, cleanedValues);

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
        const invalidValues = findInvalidValues(values, type, column);

        // Structural Garbage Detection
        const { isGarbage, reason: garbageReason } = detectGarbageColumn(column, values, nullCount);

        return {
            column,
            fieldType: type,
            confidence,
            patterns,
            validValues: uniqueValues.slice(0, 10),
            invalidValues,
            nullCount,
            uniqueCount: uniqueValues.length,
            isGarbage,
            garbageReason
        };
    });

    // Detect relationships between columns
    let relationships = detectColumnRelationships(headers, data);

    // Calculate quality score
    const totalCells = data.length * headers.filter(h => h !== '__metadata').length;
    const nullCells = columns.reduce((sum, c) => sum + c.nullCount, 0);
    const invalidCells = columns.reduce((sum, c) => sum + c.invalidValues.length, 0);
    let qualityScore = Math.round(((totalCells - nullCells - invalidCells) / totalCells) * 100);

    // Generate recommendations
    const recommendations = generateRecommendations(columns, relationships);

    let result: DatasetSemantics = {
        domain,
        domainConfidence,
        businessContext: generateBusinessContext(domain, columns),
        columns,
        relationships,
        qualityScore,
        recommendations,
    };

    // 2. Try Pro Analysis (Backend/AI Enrichment)
    try {
        // Only run if we have IDs and sufficient data to justify API cost
        if (dataset.workspace_id && dataset.id && data.length > 0) {
            console.log("🚀 Starting Pro Semantic Analysis (Backend)...");
            // Import dynamically to avoid circular dependencies if any
            const { GroqService } = await import('./groqService');
            const proResult = await GroqService.analyzePro(dataset);

            if (proResult && proResult.semantic_profile) {
                console.log("✅ Pro Analysis Successful. Merging insights...");

                // Merge Domain & Context
                if (proResult.semantic_profile.industry_context) {
                    result.businessContext = proResult.semantic_profile.industry_context;
                }
                if (proResult.semantic_profile.data_quality_score) {
                    // Average the scores for balance
                    result.qualityScore = Math.round((result.qualityScore + proResult.semantic_profile.data_quality_score) / 2);
                }

                // Merge Column Insights
                if (proResult.columns && Array.isArray(proResult.columns)) {
                    proResult.columns.forEach((proCol: any) => {
                        const localCol = result.columns.find(c => c.column === proCol.name);
                        if (localCol) {
                            // Override or enrich
                            if (proCol.semantic_type && proCol.semantic_type !== 'unknown') {
                                localCol.fieldType = proCol.semantic_type as SemanticFieldType;
                            }
                            if (proCol.is_garbage !== undefined) {
                                localCol.isGarbage = proCol.is_garbage;
                                if (proCol.is_garbage && proCol.garbage_reason) {
                                    localCol.garbageReason = proCol.garbage_reason;
                                }
                            }
                            if (proCol.description) {
                                localCol.patterns.push(`Context: ${proCol.description}`);
                            }
                        }
                    });
                }

                // Merge Relationships
                if (proResult.relationships && Array.isArray(proResult.relationships)) {
                    proResult.relationships.forEach((proRel: any) => {
                        // Add if not duplicate
                        const exists = result.relationships.some(r =>
                            (r.column1 === proRel.source && r.column2 === proRel.target) ||
                            (r.column1 === proRel.target && r.column2 === proRel.source)
                        );
                        if (!exists) {
                            result.relationships.push({
                                column1: proRel.source,
                                column2: proRel.target,
                                type: proRel.type || 'dependency',
                                confidence: proRel.strength || 0.7,
                                formula: proRel.details
                            });
                        }
                    });
                }

                // Merge Recommendations
                if (proResult.cleaning_recommendations && Array.isArray(proResult.cleaning_recommendations)) {
                    result.recommendations = [
                        ...result.recommendations,
                        ...proResult.cleaning_recommendations
                    ];
                }
            }
        }
    } catch (e) {
        console.warn("⚠️ Pro Analysis failed or timed out, using local analysis only:", e);
    }

    return result;
}

/**
 * Find invalid values in a column based on semantic type
 * ENHANCED: Detects nonsense "trash" values in text fields
 */
function findInvalidValues(values: any[], fieldType: SemanticFieldType, column?: string): any[] {
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
            case 'text':
            case 'description':
            case 'comment':
            case 'notes':
                // TRASH DETECTION: Pure numeric strings in long text fields are usually garbage (e.g. '435345')
                if (strValue.length > 4 && /^\d+$/.test(strValue.replace(/[\s\-\(\)\.]/g, ''))) {
                    // Check if it's NOT a phone number or ID
                    if (column && !['phone', 'id', 'sku', 'code', 'order'].some(k => column.toLowerCase().includes(k))) {
                        isValid = false;
                    }
                }
                break;
        }

        if (!isValid) {
            invalid.push({ value, index: idx });
        }
    });

    return invalid;
}

/**
 * Detect relationships between columns using statistical and semantic cues
 */
function detectColumnRelationships(headers: string[], data: DataRow[]): ColumnRelationship[] {
    const relationships: ColumnRelationship[] = [];
    const cleanHeaders = headers.filter(h => h !== '__metadata');

    // 1. Numerical Calculation Relationships (A * B = C)
    const numericColumns = cleanHeaders.filter(h => {
        const values = data.slice(0, 50).map(row => row[h]).filter(v => v !== null && v !== undefined && v !== '');
        return values.length > 0 && values.every(v => !isNaN(Number(String(v).replace(/[$,%]/g, ''))));
    });

    for (let i = 0; i < numericColumns.length; i++) {
        for (let j = i + 1; j < numericColumns.length; j++) {
            for (let k = 0; k < numericColumns.length; k++) {
                if (k === i || k === j) continue;

                const factor1 = numericColumns[i];
                const factor2 = numericColumns[j];
                const result = numericColumns[k];

                const matches = data.slice(0, 100).filter(row => {
                    const f1 = Number(String(row[factor1] || 0).replace(/[$,%]/g, ''));
                    const f2 = Number(String(row[factor2] || 0).replace(/[$,%]/g, ''));
                    const res = Number(String(row[result] || 0).replace(/[$,%]/g, ''));
                    if (f1 === 0 || f2 === 0) return Math.abs(res - (f1 + f2)) < 0.01; // Try addition
                    return Math.abs(res - (f1 * f2)) < 0.01 || Math.abs(res - (f1 + f2)) < 0.01;
                }).length;

                if (matches / Math.min(data.length, 100) > 0.8) {
                    relationships.push({
                        column1: result,
                        column2: `${factor1}, ${factor2}`,
                        type: 'calculation',
                        formula: `${result} derived from ${factor1} and ${factor2}`,
                        confidence: matches / Math.min(data.length, 100),
                    });
                }
            }
        }
    }

    // 2. Functional Dependency (If A then always B)
    for (let i = 0; i < cleanHeaders.length; i++) {
        for (let j = 0; j < cleanHeaders.length; j++) {
            if (i === j) continue;

            const colA = cleanHeaders[i];
            const colB = cleanHeaders[j];

            const mapping: Record<string, any> = {};
            let consistent = true;
            let pairs = 0;

            for (const row of data.slice(0, 200)) {
                const valA = String(row[colA]);
                const valB = row[colB];
                if (!row[colA] || !row[colB]) continue;

                if (mapping[valA] !== undefined && mapping[valA] !== valB) {
                    consistent = false;
                    break;
                }
                mapping[valA] = valB;
                pairs++;
            }

            if (consistent && pairs > 5 && Object.keys(mapping).length < pairs) {
                relationships.push({
                    column1: colA,
                    column2: colB,
                    type: 'lookup',
                    confidence: 0.9,
                });
            }
        }
    }

    // 3. Semantic Grouping (Address components, Name components)
    const semanticGroups = [
        ['first_name', 'last_name', 'full_name'],
        ['address', 'city', 'state', 'country', 'postal_code'],
        ['sku', 'product_name', 'price'],
        ['order_id', 'customer_id', 'order_date']
    ];

    semanticGroups.forEach(group => {
        const present = group.filter(h => cleanHeaders.some(ch => ch.toLowerCase().includes(h)));
        if (present.length > 1) {
            for (let i = 0; i < present.length; i++) {
                for (let j = i + 1; j < present.length; j++) {
                    relationships.push({
                        column1: present[i],
                        column2: present[j],
                        type: 'dependency',
                        confidence: 0.8,
                    });
                }
            }
        }
    });

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
            const total = col.nullCount + col.uniqueCount;
            const nullPercentage = Math.round((col.nullCount / total) * 100);
            if (nullPercentage > 20) {
                recommendations.push(`Column "${col.column}" has ${nullPercentage}% missing values - consider recovery or removal`);
            }
        }

        if (col.isGarbage) {
            recommendations.push(`CRITICAL: Column "${col.column}" detected as structural garbage. Reason: ${col.garbageReason}`);
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

        // Handle missing values - SKIP if column is garbage
        if (!colSem.isGarbage) {
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

        // Handle Garbage Columns
        if (colSem.isGarbage) {
            plans.push({
                row: -1, // Indicates whole column
                column: colSem.column,
                currentValue: null,
                suggestedValue: null,
                strategy: 'remove_column',
                confidence: 1.0,
                explanation: colSem.garbageReason || `Column ${colSem.column} is structural garbage.`,
                dataLossRisk: 'medium',
            });
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

    // --- ELITE LAYER RECOVERY ---

    // Strategy 2: Numeric Normalization
    if (['currency', 'price', 'amount', 'percentage', 'quantity', 'count'].includes(colSem.fieldType)) {
        const cleanedNum = NumNormalizer.normalizeNumeric(String(currentValue || ''));
        if (cleanedNum !== null && String(cleanedNum) !== String(currentValue)) {
            return {
                row: rowIndex,
                column,
                currentValue,
                suggestedValue: cleanedNum,
                strategy: 'calculate',
                confidence: 0.9,
                explanation: `Elite Numeric Parsing: Corrected from "${currentValue}" to ${cleanedNum}`,
                dataLossRisk: 'none',
            };
        }
    }

    // Strategy 3: Date Normalization
    if (['date', 'datetime', 'year', 'month'].includes(colSem.fieldType)) {
        const cleanedDate = DateNormalizer.normalizeDate(String(currentValue || ''));
        const cleanedDateStr = cleanedDate ? cleanedDate.toISOString().split('T')[0] : null;
        if (cleanedDateStr && cleanedDateStr !== String(currentValue)) {
            return {
                row: rowIndex,
                column,
                currentValue,
                suggestedValue: cleanedDateStr,
                strategy: 'pattern',
                confidence: 0.85,
                explanation: `Elite Date Parsing: Normalized from "${currentValue}" to standard ISO (${cleanedDateStr})`,
                dataLossRisk: 'none',
            };
        }
    }

    // Strategy 4: Unicode/Character Normalization
    if (typeof currentValue === 'string') {
        let cleanedChar = CharNormalizer.repairMojibake(currentValue);
        cleanedChar = CharNormalizer.normalizeWhitespace(cleanedChar, { convertNBSP: true, trimEnds: true });

        if (cleanedChar !== currentValue) {
            return {
                row: rowIndex,
                column,
                currentValue,
                suggestedValue: cleanedChar,
                strategy: 'pattern',
                confidence: 0.95,
                explanation: `Elite Unicode Repair: Fixed encoding artifacts and whitespace`,
                dataLossRisk: 'none',
            };
        }
    }

    // Strategy 5: Lookup value based on relationships
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

    // Strategy 6: Use mode (most common value) for categorical
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

    // Strategy 7: Use mean/median for numeric
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

    // Strategy 8: Default value for specific types
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

    // Strategy 9: Semantic removal/quarantine or Row Removal
    const isCriticalIdentifier = ['name', 'full_name', 'id', 'sku', 'email'].includes(colSem.fieldType);

    if (isCriticalIdentifier && (currentValue === null || currentValue === undefined || currentValue === '')) {
        // Professional Proactive Check: Is the rest of the row also empty or low value?
        const row = data[rowIndex];
        const nonNullCount = Object.values(row).filter(v => v !== null && v !== undefined && v !== '' && v !== '0').length;

        if (nonNullCount < 3) {
            return {
                row: rowIndex,
                column,
                currentValue: currentValue || '(missing)',
                suggestedValue: null,
                strategy: 'remove_row',
                confidence: 0.98,
                explanation: `Critical identifier "${column}" is missing and record has insufficient data for recovery. Professional practice suggests removing this hollow record to preserve data integrity.`,
                dataLossRisk: 'low',
            };
        }

        // Otherwise, just mark as semantic error but don't force row deletion yet
        return {
            row: rowIndex,
            column,
            currentValue: currentValue || '(missing)',
            suggestedValue: null,
            strategy: 'remove',
            confidence: 0.7,
            explanation: `Critical identifier "${column}" is missing. Record has other data points, but this identifier is unrecoverable. Action required: Manual verification or record disposal.`,
            dataLossRisk: 'medium',
        };
    }

    // Default to cell-level removal (quarantine cell)
    return {
        row: rowIndex,
        column,
        currentValue: currentValue || '(missing)',
        suggestedValue: null,
        strategy: 'remove',
        confidence: 0.95,
        explanation: `Field "${column}" (${colSem.fieldType}) contains semantic errors or missing data that breaks automation flows. Record remains, but data point is flagged for exclusion.`,
        dataLossRisk: 'medium',
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

/**
 * Find mode (most common value)
 */
function findMode(values: any[]): any {
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
function getDefaultValue(fieldType: SemanticFieldType): any {
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
                    plan.strategy === 'remove' ? 'remove' :
                        plan.strategy === 'remove_row' ? 'remove_row' :
                            plan.strategy === 'remove_column' ? 'remove_column' : 'ai_infer',
    }));
}

/**
 * Apply a single recovery plan to the data with full audit tracking
 */
export function applyRecoveryPlan(
    data: DataRow[],
    plan: RecoveryPlan
): { data: DataRow[]; historyEntry: ChangeHistoryEntry } {
    const newData = [...data];
    const row = { ...newData[plan.row] };

    const oldValue = row[plan.column];
    row[plan.column] = plan.suggestedValue;

    // 1. Initialize metadata
    if (!row.__metadata) row.__metadata = {};
    if (!row.__metadata.recoveredFields) row.__metadata.recoveredFields = [];
    if (!row.__metadata.recoveryExplanations) row.__metadata.recoveryExplanations = {};
    if (!row.__metadata.auditLog) row.__metadata.auditLog = [];

    // 2. Track recovery
    if (!row.__metadata.recoveredFields.includes(plan.column)) {
        row.__metadata.recoveredFields.push(plan.column);
    }
    row.__metadata.recoveryExplanations[plan.column] = plan.explanation;
    row.__metadata.lastModified = new Date().toISOString();

    // 3. Create Audit Log Entry (Pro Analyst Requirement)
    const auditAction = plan.strategy === 'remove' ? 'quarantined' :
        plan.strategy === 'remove_row' ? 'modified' :
            'recovered';

    // Use a clearer reason for removals
    const auditReason = plan.strategy === 'remove' ? `Cell-level cleanup: ${plan.explanation}` : plan.explanation;

    const auditEntry = {
        action: auditAction as any,
        field: plan.column,
        from: String(oldValue || ''),
        to: String(plan.suggestedValue || 'CLEARED'),
        reason: auditReason,
        timestamp: new Date().toISOString(),
        rule: plan.strategy
    };
    row.__metadata.auditLog.push(auditEntry);

    newData[plan.row] = row;

    const historyEntry: ChangeHistoryEntry = {
        id: `${Date.now()}-${plan.row}-${plan.column}`,
        timestamp: new Date(),
        action: plan.strategy === 'remove' ? 'quarantine' : 'recover',
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
