/**
 * DataForensicsEngine - Universal AI-Powered Data Quality Engine
 * 
 * This engine dynamically analyzes ANY dataset to:
 * 1. Understand column semantics and relationships
 * 2. Detect data quality issues across 10+ dimensions
 * 3. Generate comprehensive validation rules
 * 4. Create recovery scripts for calculable values
 * 5. Handle millions of rows efficiently via sampling
 */

// ============== TYPE DEFINITIONS ==============

export type ColumnRole =
    | 'identifier'      // Primary keys, IDs, unique identifiers
    | 'measure'         // Numeric values for calculations
    | 'dimension'       // Categorical grouping fields
    | 'timestamp'       // Date/time fields
    | 'status'          // Status/state indicators
    | 'reason'          // Explanation/notes fields
    | 'reference'       // Foreign keys, lookups
    | 'contact'         // Email, phone, address
    | 'currency'        // Money values
    | 'percentage'      // Percentage values
    | 'calculated'      // Derived from other columns
    | 'garbage'         // Always null/empty - remove
    | 'unknown';        // Cannot determine

export type QualityDimension =
    | 'Completeness'    // Missing values
    | 'Accuracy'        // Correct values
    | 'Consistency'     // Cross-field consistency
    | 'Validity'        // Format/range valid
    | 'Timeliness'      // Date/freshness valid
    | 'Uniqueness'      // No duplicates
    | 'Integrity'       // Referential integrity
    | 'Conformity'      // Pattern matching (email, phone)
    | 'Recoverability'  // Can calculate missing
    | 'Semantics';      // Business logic valid

export interface ColumnProfile {
    column: string;
    role: ColumnRole;
    dataType: 'string' | 'number' | 'date' | 'boolean' | 'mixed';
    confidence: number;
    nullCount: number;
    nullPercent: number;
    uniqueCount: number;
    uniquePercent: number;
    sampleValues: any[];
    detectedPatterns: string[];
    validValues?: string[];           // For enums/categories
    validNullCondition?: string;      // When null is OK
    relatedColumns?: string[];        // Dependent columns
    isGarbage: boolean;               // Should be removed
    placeholders: PlaceholderInfo[];  // ERROR, UNKNOWN, etc.
}

export interface PlaceholderInfo {
    value: string;
    count: number;
    percent: number;
    isRecoverable: boolean;
}

export interface MathRelationship {
    resultColumn: string;
    formula: string;             // Human readable: "Quantity × Price"
    expression: string;          // JS: "row['Quantity'] * row['Price']"
    dependsOn: string[];
    canRecover: string[];        // Which cols can be calculated
    confidence: number;
}

export interface CrossFieldRule {
    condition: string;           // When this applies
    requirement: string;         // What must be true
    expression: string;          // JS expression
    description: string;
}

export interface ValidationRule {
    id: string;
    description: string;
    category: 'Recovery' | 'Audit';
    column: string;
    qualityDimension: QualityDimension;
    expression: string;
    healFunction: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    confidence: number;
    reasoning: string;
    active: boolean;
}

export interface ForensicResult {
    profiles: ColumnProfile[];
    mathRelationships: MathRelationship[];
    crossFieldRules: CrossFieldRule[];
    validationRules: ValidationRule[];
    garbageColumns: string[];
    summary: {
        totalColumns: number;
        totalRows: number;
        issuesFound: number;
        rulesGenerated: number;
        recoverableIssues: number;
        estimatedHealthAfterClean: number;
    };
}

// ============== MAIN ENGINE CLASS ==============

export class DataForensicsEngine {

    // Placeholder patterns to detect across ANY dataset
    private static readonly PLACEHOLDER_PATTERNS = [
        'ERROR', 'error', 'Error',
        'UNKNOWN', 'unknown', 'Unknown',
        'N/A', 'n/a', 'NA', 'na', 'N.A.',
        'NULL', 'null', 'Null',
        'UNDEFINED', 'undefined',
        'MISSING', 'missing', 'Missing',
        'TBD', 'tbd', 'TBA', 'tba',
        'NONE', 'none', 'None',
        '-', '--', '---', '.',
        '#N/A', '#REF!', '#VALUE!', '#ERROR!',
        '0000-00-00', '1900-01-01', '1970-01-01'
    ];

    // Common ID column patterns
    private static readonly ID_PATTERNS = [
        /^id$/i, /^.*_id$/i, /^.*id$/i, /^key$/i, /^.*_key$/i,
        /^uuid$/i, /^guid$/i, /^code$/i, /^.*_code$/i,
        /^sku$/i, /^ref$/i, /^.*_ref$/i, /^number$/i, /^.*_number$/i,
        /^transaction.*$/i, /^order.*$/i, /^invoice.*$/i
    ];

    // Common date column patterns
    private static readonly DATE_PATTERNS = [
        /date$/i, /^date/i, /_date$/i, /datetime$/i, /timestamp$/i,
        /created/i, /updated/i, /modified/i, /time$/i, /_at$/i
    ];

    // Common status column patterns
    private static readonly STATUS_PATTERNS = [
        /status$/i, /^status/i, /state$/i, /^state/i,
        /condition$/i, /phase$/i, /stage$/i
    ];

    // Common amount/money patterns
    private static readonly AMOUNT_PATTERNS = [
        /amount$/i, /price$/i, /cost$/i, /total$/i, /sum$/i,
        /fee$/i, /charge$/i, /payment$/i, /revenue$/i, /spent$/i,
        /value$/i, /balance$/i, /salary$/i, /rate$/i
    ];

    // Common quantity patterns
    private static readonly QUANTITY_PATTERNS = [
        /qty$/i, /quantity$/i, /count$/i, /number$/i, /units$/i,
        /items$/i, /pieces$/i, /volume$/i
    ];

    /**
     * Main entry point - analyze any dataset and generate rules
     */
    static async analyze(
        headers: string[],
        data: any[],
        sampleSize: number = 500
    ): Promise<ForensicResult> {
        // Sample data for large datasets (millions of rows)
        const sample = data.length > sampleSize
            ? this.stratifiedSample(data, sampleSize)
            : data;

        // Step 1: Profile each column
        const profiles = this.profileAllColumns(headers, sample, data.length);

        // Step 2: Detect mathematical relationships
        const mathRelationships = this.detectMathRelationships(headers, sample, profiles);

        // Step 3: Detect cross-field rules
        const crossFieldRules = this.detectCrossFieldRules(headers, sample, profiles);

        // Step 4: Identify garbage columns
        const garbageColumns = profiles
            .filter(p => p.isGarbage)
            .map(p => p.column);

        // Step 5: Generate validation rules
        const validationRules = this.generateAllRules(
            profiles,
            mathRelationships,
            crossFieldRules,
            headers,
            sample
        );

        // Calculate summary
        const issuesFound = profiles.reduce((sum, p) =>
            sum + p.placeholders.length + (p.nullPercent > 0 ? 1 : 0), 0);

        const recoverableIssues = validationRules
            .filter(r => r.category === 'Recovery').length;

        return {
            profiles,
            mathRelationships,
            crossFieldRules,
            validationRules,
            garbageColumns,
            summary: {
                totalColumns: headers.length,
                totalRows: data.length,
                issuesFound,
                rulesGenerated: validationRules.length,
                recoverableIssues,
                estimatedHealthAfterClean: Math.min(100, 70 + (recoverableIssues / Math.max(issuesFound, 1)) * 30)
            }
        };
    }

    /**
     * Stratified sampling for large datasets
     * Ensures we capture edge cases and variations
     */
    private static stratifiedSample(data: any[], size: number): any[] {
        if (data.length <= size) return data;

        const sample: any[] = [];
        const step = Math.floor(data.length / size);

        // Take evenly distributed samples
        for (let i = 0; i < size - 50 && i * step < data.length; i++) {
            sample.push(data[i * step]);
        }

        // Always include first and last 25 rows (often contain edge cases)
        sample.push(...data.slice(0, 25));
        sample.push(...data.slice(-25));

        return sample;
    }

    /**
     * Profile all columns to understand their nature
     */
    private static profileAllColumns(
        headers: string[],
        sample: any[],
        totalRows: number
    ): ColumnProfile[] {
        return headers.map(col => this.profileColumn(col, sample, totalRows));
    }

    /**
     * Deep profile a single column
     */
    private static profileColumn(
        column: string,
        sample: any[],
        totalRows: number
    ): ColumnProfile {
        const values = sample.map(row => row[column]);
        const nonNullValues = values.filter(v =>
            v !== null && v !== undefined && v !== ''
        );

        // Count nulls
        const nullCount = values.length - nonNullValues.length;
        const nullPercent = Math.round((nullCount / values.length) * 100);

        // Count unique
        const uniqueSet = new Set(nonNullValues.map(v => String(v)));
        const uniqueCount = uniqueSet.size;
        const uniquePercent = Math.round((uniqueCount / Math.max(nonNullValues.length, 1)) * 100);

        // Detect placeholders
        const placeholders = this.detectPlaceholders(nonNullValues);

        // Detect data type
        const dataType = this.detectDataType(nonNullValues);

        // Detect role
        const role = this.detectColumnRole(column, nonNullValues, dataType, uniquePercent);

        // Check if garbage (always null or placeholder)
        const isGarbage = nullPercent >= 95 ||
            (placeholders.length === 1 && placeholders[0].percent >= 95);

        // Get valid values for enums
        const validValues = role === 'dimension' || role === 'status'
            ? this.extractValidValues(nonNullValues, placeholders)
            : undefined;

        // Get sample values (excluding placeholders)
        const cleanValues = nonNullValues.filter(v =>
            !this.PLACEHOLDER_PATTERNS.includes(String(v))
        );
        const sampleValues = [...new Set(cleanValues.slice(0, 5))];

        return {
            column,
            role,
            dataType,
            confidence: 0.8,
            nullCount: Math.round((nullCount / values.length) * totalRows),
            nullPercent,
            uniqueCount,
            uniquePercent,
            sampleValues,
            detectedPatterns: this.detectPatterns(nonNullValues),
            validValues,
            isGarbage,
            placeholders
        };
    }

    /**
     * Detect placeholder values in a column
     */
    private static detectPlaceholders(values: any[]): PlaceholderInfo[] {
        const placeholders: PlaceholderInfo[] = [];
        const valueCounts: Record<string, number> = {};

        values.forEach(v => {
            const str = String(v);
            valueCounts[str] = (valueCounts[str] || 0) + 1;
        });

        // Check known placeholders
        for (const placeholder of this.PLACEHOLDER_PATTERNS) {
            if (valueCounts[placeholder]) {
                placeholders.push({
                    value: placeholder,
                    count: valueCounts[placeholder],
                    percent: Math.round((valueCounts[placeholder] / values.length) * 100),
                    isRecoverable: true
                });
            }
        }

        // Check for common suspicious numeric placeholders (like 0, -1, 9999) 
        // but ONLY if they are heavily repeated (over 50% of data) 
        // to avoid flagging real data like '100' or '250'.
        const suspiciousNumbers = ['0', '-1', '999', '9999', '0000'];
        Object.entries(valueCounts).forEach(([val, count]) => {
            if (suspiciousNumbers.includes(val)) {
                const percent = Math.round((count / values.length) * 100);
                if (percent >= 50) {
                    placeholders.push({
                        value: val,
                        count,
                        percent,
                        isRecoverable: false
                    });
                }
            }
        });

        return placeholders;
    }

    /**
     * Detect the data type of a column
     */
    private static detectDataType(values: any[]): 'string' | 'number' | 'date' | 'boolean' | 'mixed' {
        if (values.length === 0) return 'string';

        const cleanValues = values.filter(v =>
            !this.PLACEHOLDER_PATTERNS.includes(String(v))
        );
        if (cleanValues.length === 0) return 'string';

        let numericCount = 0;
        let dateCount = 0;
        let boolCount = 0;

        for (const val of cleanValues) {
            const str = String(val).trim();

            // Check boolean
            if (['true', 'false', '0', '1', 'yes', 'no'].includes(str.toLowerCase())) {
                boolCount++;
                continue;
            }

            // Check date
            if (this.isValidDate(str)) {
                dateCount++;
                continue;
            }

            // Check numeric
            if (!isNaN(Number(str)) && str !== '') {
                numericCount++;
            }
        }

        const total = cleanValues.length;
        if (numericCount / total > 0.8) return 'number';
        if (dateCount / total > 0.8) return 'date';
        if (boolCount / total > 0.8) return 'boolean';
        if ((numericCount + dateCount) / total > 0.5) return 'mixed';

        return 'string';
    }

    /**
     * Check if a string is a valid date
     */
    private static isValidDate(str: string): boolean {
        // Common date patterns
        const datePatterns = [
            /^\d{4}-\d{2}-\d{2}$/,           // 2024-01-15
            /^\d{2}\/\d{2}\/\d{4}$/,         // 01/15/2024
            /^\d{2}-\d{2}-\d{4}$/,           // 15-01-2024
            /^\d{4}\/\d{2}\/\d{2}$/,         // 2024/01/15
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/ // ISO format
        ];

        for (const pattern of datePatterns) {
            if (pattern.test(str)) {
                const d = new Date(str);
                return !isNaN(d.getTime()) && d.getFullYear() > 1900;
            }
        }
        return false;
    }

    /**
     * Detect the semantic role of a column
     */
    private static detectColumnRole(
        column: string,
        values: any[],
        dataType: string,
        uniquePercent: number
    ): ColumnRole {
        const colLower = column.toLowerCase();

        // Check against known patterns
        if (this.ID_PATTERNS.some(p => p.test(column))) return 'identifier';
        if (this.DATE_PATTERNS.some(p => p.test(column))) return 'timestamp';
        if (this.STATUS_PATTERNS.some(p => p.test(column))) return 'status';

        if (this.AMOUNT_PATTERNS.some(p => p.test(column))) {
            return colLower.includes('percent') ? 'percentage' : 'currency';
        }

        if (this.QUANTITY_PATTERNS.some(p => p.test(column))) return 'measure';

        // Check for reason/notes
        if (/reason|note|comment|description|remark|message/i.test(column)) {
            return 'reason';
        }

        // Check for contact info
        if (/email|phone|tel|mobile|address|contact/i.test(column)) {
            return 'contact';
        }

        // Infer from data characteristics
        if (dataType === 'number') {
            return uniquePercent > 80 ? 'identifier' : 'measure';
        }

        if (dataType === 'date') return 'timestamp';

        // Low cardinality text = dimension/category
        if (dataType === 'string' && uniquePercent < 20) {
            return 'dimension';
        }

        // High cardinality text with ID-like values
        if (uniquePercent > 90) return 'identifier';

        return 'unknown';
    }

    /**
     * Extract valid enum values (excluding placeholders)
     */
    private static extractValidValues(values: any[], placeholders: PlaceholderInfo[]): string[] {
        const placeholderSet = new Set(placeholders.map(p => p.value));
        const validSet = new Set<string>();

        values.forEach(v => {
            const str = String(v);
            if (!placeholderSet.has(str) && str.length > 0) {
                validSet.add(str);
            }
        });

        return Array.from(validSet).slice(0, 20); // Max 20 valid values
    }

    /**
     * Detect patterns in values (regex patterns for validation)
     */
    private static detectPatterns(values: any[]): string[] {
        const patterns: string[] = [];
        const sampleStr = values.slice(0, 100).map(v => String(v));

        // Email pattern
        if (sampleStr.some(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))) {
            patterns.push('email');
        }

        // Phone pattern
        if (sampleStr.some(s => /^[\d\s\-\+\(\)]{7,}$/.test(s))) {
            patterns.push('phone');
        }

        // URL pattern
        if (sampleStr.some(s => /^https?:\/\//.test(s))) {
            patterns.push('url');
        }

        // UUID pattern
        if (sampleStr.some(s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s))) {
            patterns.push('uuid');
        }

        return patterns;
    }

    /**
     * Detect mathematical relationships between columns
     * e.g., Total = Quantity × Price
     */
    private static detectMathRelationships(
        headers: string[],
        sample: any[],
        profiles: ColumnProfile[]
    ): MathRelationship[] {
        const relationships: MathRelationship[] = [];

        const numericProfiles = profiles.filter(p =>
            p.dataType === 'number' && !p.isGarbage
        );

        if (numericProfiles.length < 2) return relationships;

        // Test multiplication relationships (Result = A × B)
        for (let i = 0; i < numericProfiles.length; i++) {
            for (let j = i + 1; j < numericProfiles.length; j++) {
                for (let k = 0; k < numericProfiles.length; k++) {
                    if (k === i || k === j) continue;

                    const colA = numericProfiles[i].column;
                    const colB = numericProfiles[j].column;
                    const colResult = numericProfiles[k].column;

                    const matches = this.testMultiplicationRelation(sample, colA, colB, colResult);

                    if (matches > 0.8) {
                        relationships.push({
                            resultColumn: colResult,
                            formula: `${colA} × ${colB}`,
                            expression: `parseFloat(row['${colA}']) * parseFloat(row['${colB}'])`,
                            dependsOn: [colA, colB],
                            canRecover: [colA, colB, colResult],
                            confidence: matches
                        });
                    }
                }
            }
        }

        // Test addition relationships (Result = A + B)
        for (let i = 0; i < numericProfiles.length; i++) {
            for (let j = i + 1; j < numericProfiles.length; j++) {
                for (let k = 0; k < numericProfiles.length; k++) {
                    if (k === i || k === j) continue;

                    const colA = numericProfiles[i].column;
                    const colB = numericProfiles[j].column;
                    const colResult = numericProfiles[k].column;

                    const matches = this.testAdditionRelation(sample, colA, colB, colResult);

                    if (matches > 0.8) {
                        relationships.push({
                            resultColumn: colResult,
                            formula: `${colA} + ${colB}`,
                            expression: `parseFloat(row['${colA}']) + parseFloat(row['${colB}'])`,
                            dependsOn: [colA, colB],
                            canRecover: [colA, colB, colResult],
                            confidence: matches
                        });
                    }
                }
            }
        }

        return relationships;
    }

    /**
     * Test if Result ≈ A × B
     */
    private static testMultiplicationRelation(
        data: any[],
        colA: string,
        colB: string,
        colResult: string
    ): number {
        let matches = 0;
        let testable = 0;

        for (const row of data) {
            const a = parseFloat(row[colA]);
            const b = parseFloat(row[colB]);
            const result = parseFloat(row[colResult]);

            if (isNaN(a) || isNaN(b) || isNaN(result)) continue;
            if (a === 0 || b === 0) continue;

            testable++;
            const expected = a * b;
            // Allow 1% tolerance for floating point
            if (Math.abs(expected - result) / Math.max(Math.abs(result), 1) < 0.01) {
                matches++;
            }
        }

        return testable > 10 ? matches / testable : 0;
    }

    /**
     * Test if Result ≈ A + B
     */
    private static testAdditionRelation(
        data: any[],
        colA: string,
        colB: string,
        colResult: string
    ): number {
        let matches = 0;
        let testable = 0;

        for (const row of data) {
            const a = parseFloat(row[colA]);
            const b = parseFloat(row[colB]);
            const result = parseFloat(row[colResult]);

            if (isNaN(a) || isNaN(b) || isNaN(result)) continue;

            testable++;
            const expected = a + b;
            if (Math.abs(expected - result) / Math.max(Math.abs(result), 1) < 0.01) {
                matches++;
            }
        }

        return testable > 10 ? matches / testable : 0;
    }

    /**
     * Detect cross-field validation rules
     * e.g., If Status = "Error", then Reason must not be null
     */
    private static detectCrossFieldRules(
        headers: string[],
        sample: any[],
        profiles: ColumnProfile[]
    ): CrossFieldRule[] {
        const rules: CrossFieldRule[] = [];

        // Find status/category columns
        const statusCols = profiles.filter(p =>
            p.role === 'status' || p.role === 'dimension'
        );

        // Find reason/notes columns
        const reasonCols = profiles.filter(p => p.role === 'reason');

        // Check status → reason dependencies
        for (const statusCol of statusCols) {
            for (const reasonCol of reasonCols) {
                const dependency = this.detectStatusReasonDependency(
                    sample,
                    statusCol.column,
                    reasonCol.column,
                    statusCol.validValues || []
                );

                if (dependency) {
                    rules.push(dependency);
                }
            }
        }

        return rules;
    }

    /**
     * Detect if a reason column depends on status values
     */
    private static detectStatusReasonDependency(
        data: any[],
        statusCol: string,
        reasonCol: string,
        statusValues: string[]
    ): CrossFieldRule | null {
        // Group by status and check reason null patterns
        const statusReasonMap: Record<string, { total: number; nulls: number }> = {};

        for (const row of data) {
            const status = String(row[statusCol] || '');
            const reason = row[reasonCol];

            if (!statusReasonMap[status]) {
                statusReasonMap[status] = { total: 0, nulls: 0 };
            }
            statusReasonMap[status].total++;
            if (reason === null || reason === undefined || reason === '') {
                statusReasonMap[status].nulls++;
            }
        }

        // Find statuses where reason is mostly null (valid) vs mostly filled (required)
        const nullOkStatuses: string[] = [];
        const requireReasonStatuses: string[] = [];

        for (const [status, stats] of Object.entries(statusReasonMap)) {
            if (stats.total < 3) continue; // Need enough samples

            const nullPercent = stats.nulls / stats.total;
            if (nullPercent > 0.8) {
                nullOkStatuses.push(status);
            } else if (nullPercent < 0.2) {
                requireReasonStatuses.push(status);
            }
        }

        if (nullOkStatuses.length > 0 && requireReasonStatuses.length > 0) {
            const requireList = requireReasonStatuses.map(s => `'${s}'`).join(', ');
            return {
                condition: `Status in [${requireList}]`,
                requirement: `${reasonCol} must have a value`,
                expression: `
          const status = row['${statusCol}'];
          const reason = row['${reasonCol}'];
          const requiresReason = [${requireList}].includes(status);
          return !requiresReason || (reason !== null && reason !== '' && reason !== undefined);
        `.trim(),
                description: `${reasonCol} is required when ${statusCol} is ${requireReasonStatuses.join(' or ')}`
            };
        }

        return null;
    }

    /**
     * Generate all validation rules based on analysis
     */
    private static generateAllRules(
        profiles: ColumnProfile[],
        mathRelationships: MathRelationship[],
        crossFieldRules: CrossFieldRule[],
        headers: string[],
        sample: any[]
    ): ValidationRule[] {
        const rules: ValidationRule[] = [];
        let ruleId = 1;

        // 1. Garbage column detection rules
        for (const profile of profiles.filter(p => p.isGarbage)) {
            rules.push({
                id: `rule_${ruleId++}`,
                description: `Column '${profile.column}' is ${profile.nullPercent >= 95 ? 'always empty' : 'filled with placeholder values'} - recommend removal`,
                category: 'Audit',
                column: profile.column,
                qualityDimension: 'Completeness',
                expression: 'false', // Always fails
                healFunction: '',
                severity: 'warning',
                confidence: 0.95,
                reasoning: `${profile.nullPercent}% null values or placeholders detected`,
                active: true
            });
        }

        // 2. Placeholder replacement rules
        for (const profile of profiles.filter(p => !p.isGarbage && p.placeholders.length > 0)) {
            for (const placeholder of profile.placeholders) {
                const mathRel = mathRelationships.find(r => r.canRecover.includes(profile.column));

                if (mathRel && profile.dataType === 'number') {
                    // Can recover mathematically
                    rules.push(this.createMathRecoveryRule(
                        ruleId++,
                        profile,
                        placeholder,
                        mathRel
                    ));
                } else {
                    // Replace with null
                    rules.push({
                        id: `rule_${ruleId++}`,
                        description: `Replace placeholder '${placeholder.value}' in '${profile.column}' with null`,
                        category: 'Recovery',
                        column: profile.column,
                        qualityDimension: 'Validity',
                        expression: `row['${profile.column}'] !== '${placeholder.value}'`,
                        healFunction: `if (row['${profile.column}'] === '${placeholder.value}') { row['${profile.column}'] = null; }`,
                        severity: 'error',
                        confidence: 0.9,
                        reasoning: `Found ${placeholder.count} occurrences (${placeholder.percent}%) of placeholder value`,
                        active: true
                    });
                }
            }
        }

        // 3. Mathematical recovery rules
        for (const rel of mathRelationships) {
            for (const recoverableCol of rel.dependsOn) {
                rules.push(this.createInverseMathRecoveryRule(ruleId++, rel, recoverableCol));
            }
        }

        // 4. Cross-field validation rules
        for (const cfRule of crossFieldRules) {
            rules.push({
                id: `rule_${ruleId++}`,
                description: cfRule.description,
                category: 'Audit',
                column: '*', // Multi-column
                qualityDimension: 'Consistency',
                expression: cfRule.expression,
                healFunction: '',
                severity: 'error',
                confidence: 0.85,
                reasoning: `Detected conditional requirement: ${cfRule.condition} → ${cfRule.requirement}`,
                active: true
            });
        }

        // 5. Null/completeness rules for non-garbage columns
        for (const profile of profiles.filter(p => !p.isGarbage && p.nullPercent > 5)) {
            if (profile.role === 'identifier') {
                rules.push({
                    id: `rule_${ruleId++}`,
                    description: `Identifier column '${profile.column}' should not have missing values`,
                    category: 'Audit',
                    column: profile.column,
                    qualityDimension: 'Completeness',
                    expression: `row['${profile.column}'] !== null && row['${profile.column}'] !== '' && row['${profile.column}'] !== undefined`,
                    healFunction: '',
                    severity: 'critical',
                    confidence: 0.95,
                    reasoning: `${profile.nullPercent}% missing values in identifier column`,
                    active: true
                });
            } else {
                rules.push({
                    id: `rule_${ruleId++}`,
                    description: `Flag rows with missing values in '${profile.column}'`,
                    category: 'Audit',
                    column: profile.column,
                    qualityDimension: 'Completeness',
                    expression: `row['${profile.column}'] !== null && row['${profile.column}'] !== '' && row['${profile.column}'] !== undefined`,
                    healFunction: '',
                    severity: 'warning',
                    confidence: 0.7,
                    reasoning: `${profile.nullPercent}% missing values detected`,
                    active: true
                });
            }
        }

        // 6. Enum/valid value rules
        for (const profile of profiles.filter(p => p.validValues && p.validValues.length > 0 && p.validValues.length <= 15)) {
            const validList = profile.validValues!.map(v => `'${v}'`).join(', ');
            rules.push({
                id: `rule_${ruleId++}`,
                description: `'${profile.column}' must be one of valid values or null`,
                category: 'Audit',
                column: profile.column,
                qualityDimension: 'Validity',
                expression: `[${validList}].includes(row['${profile.column}']) || row['${profile.column}'] === null || row['${profile.column}'] === ''`,
                healFunction: '',
                severity: 'warning',
                confidence: 0.8,
                reasoning: `Detected ${profile.validValues!.length} valid values for this categorical column`,
                active: true
            });
        }

        // 7. Date validation rules
        for (const profile of profiles.filter(p => p.role === 'timestamp' || p.dataType === 'date')) {
            rules.push({
                id: `rule_${ruleId++}`,
                description: `Validate date format in '${profile.column}'`,
                category: 'Recovery',
                column: profile.column,
                qualityDimension: 'Timeliness',
                expression: `
          const v = row['${profile.column}'];
          if (v === null || v === '') return true;
          if (['ERROR', 'UNKNOWN', 'N/A'].includes(v)) return false;
          const d = new Date(v);
          return !isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100;
        `.trim(),
                healFunction: `
          const v = row['${profile.column}'];
          if (['ERROR', 'UNKNOWN', 'N/A'].includes(v)) {
            row['${profile.column}'] = null;
          }
        `.trim(),
                severity: 'error',
                confidence: 0.85,
                reasoning: 'Date column requires valid date format',
                active: true
            });
        }

        // 8. Contact validation rules
        for (const profile of profiles.filter(p => p.detectedPatterns.includes('email'))) {
            rules.push({
                id: `rule_${ruleId++}`,
                description: `Validate email format in '${profile.column}'`,
                category: 'Audit',
                column: profile.column,
                qualityDimension: 'Conformity',
                expression: `
          const v = row['${profile.column}'];
          if (v === null || v === '') return true;
          return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v);
        `.trim(),
                healFunction: '',
                severity: 'warning',
                confidence: 0.9,
                reasoning: 'Email pattern detected - validating format',
                active: true
            });
        }

        // 9. Numeric range validation
        for (const profile of profiles.filter(p => p.dataType === 'number' && !p.isGarbage)) {
            // Check for negative values in positive-only contexts
            if (profile.role === 'measure' || profile.role === 'currency') {
                const hasNegatives = profile.sampleValues.some(v => parseFloat(v) < 0);
                if (!hasNegatives) {
                    rules.push({
                        id: `rule_${ruleId++}`,
                        description: `'${profile.column}' should not have negative values`,
                        category: 'Audit',
                        column: profile.column,
                        qualityDimension: 'Accuracy',
                        expression: `
              const v = parseFloat(row['${profile.column}']);
              return isNaN(v) || v >= 0;
            `.trim(),
                        healFunction: '',
                        severity: 'warning',
                        confidence: 0.7,
                        reasoning: 'No negative values found in sample - enforcing non-negative',
                        active: true
                    });
                }
            }
        }

        // 10. Uniqueness rules for identifiers
        for (const profile of profiles.filter(p => p.role === 'identifier' && p.uniquePercent > 95)) {
            rules.push({
                id: `rule_${ruleId++}`,
                description: `Check for duplicate values in identifier '${profile.column}'`,
                category: 'Audit',
                column: profile.column,
                qualityDimension: 'Uniqueness',
                expression: 'true', // Checked during batch processing
                healFunction: '',
                severity: 'critical',
                confidence: 0.9,
                reasoning: 'Identifier columns should have unique values',
                active: true
            });
        }

        return rules;
    }

    /**
     * Create a mathematical recovery rule
     */
    private static createMathRecoveryRule(
        ruleId: number,
        profile: ColumnProfile,
        placeholder: PlaceholderInfo,
        mathRel: MathRelationship
    ): ValidationRule {
        return {
            id: `rule_${ruleId}`,
            description: `Calculate missing '${profile.column}' from ${mathRel.formula}`,
            category: 'Recovery',
            column: profile.column,
            qualityDimension: 'Recoverability',
            expression: `
        const v = row['${profile.column}'];
        return v !== '${placeholder.value}' && v !== 'ERROR' && v !== 'UNKNOWN' && !isNaN(parseFloat(v));
      `.trim(),
            healFunction: `
        const v = row['${profile.column}'];
        if (v === '${placeholder.value}' || v === 'ERROR' || v === 'UNKNOWN' || isNaN(parseFloat(v))) {
          const calculated = ${mathRel.expression};
          if (!isNaN(calculated)) {
            row['${profile.column}'] = calculated.toString();
          } else {
            row['${profile.column}'] = null;
          }
        }
      `.trim(),
            severity: 'error',
            confidence: mathRel.confidence,
            reasoning: `Detected formula: ${mathRel.formula} with ${Math.round(mathRel.confidence * 100)}% confidence`,
            active: true
        };
    }

    /**
     * Create inverse mathematical recovery (e.g., Qty = Total / Price)
     */
    private static createInverseMathRecoveryRule(
        ruleId: number,
        mathRel: MathRelationship,
        targetCol: string
    ): ValidationRule {
        const otherCol = mathRel.dependsOn.find(c => c !== targetCol)!;
        const isMultiplication = mathRel.formula.includes('×');

        let inverseExpr: string;
        let inverseFormula: string;

        if (isMultiplication) {
            inverseExpr = `parseFloat(row['${mathRel.resultColumn}']) / parseFloat(row['${otherCol}'])`;
            inverseFormula = `${mathRel.resultColumn} / ${otherCol}`;
        } else {
            inverseExpr = `parseFloat(row['${mathRel.resultColumn}']) - parseFloat(row['${otherCol}'])`;
            inverseFormula = `${mathRel.resultColumn} - ${otherCol}`;
        }

        return {
            id: `rule_${ruleId}`,
            description: `Calculate missing '${targetCol}' from ${inverseFormula}`,
            category: 'Recovery',
            column: targetCol,
            qualityDimension: 'Recoverability',
            expression: `
        const v = row['${targetCol}'];
        return v !== 'ERROR' && v !== 'UNKNOWN' && v !== null && v !== '' && !isNaN(parseFloat(v));
      `.trim(),
            healFunction: `
        const v = row['${targetCol}'];
        if (v === 'ERROR' || v === 'UNKNOWN' || v === null || v === '' || isNaN(parseFloat(v))) {
          const divisor = parseFloat(row['${otherCol}']);
          if (divisor !== 0 && !isNaN(divisor)) {
            const calculated = ${inverseExpr};
            if (!isNaN(calculated) && isFinite(calculated)) {
              row['${targetCol}'] = ${isMultiplication ? 'Math.round(calculated)' : 'calculated'}.toString();
            }
          }
        }
      `.trim(),
            severity: 'error',
            confidence: mathRel.confidence * 0.9,
            reasoning: `Inverse calculation from ${mathRel.formula} relationship`,
            active: true
        };
    }
}
