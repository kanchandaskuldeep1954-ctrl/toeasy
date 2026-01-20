/**
 * ENTERPRISE Cross-Field Validation Engine
 * Validates relationships between columns:
 * - Date sequences (start < end)
 * - Mathematical consistency (total = qty × price)
 * - Geographic validation (ZIP → City/State)
 * - Business logic (email domain ↔ company)
 * - Referential integrity
 * 
 * Part of the Elite Data Cleaning Layer.
 */

// ============== INTERFACES ==============

export interface CrossFieldIssue {
    row: number;
    ruleId: string;
    ruleName: string;
    field1: string;
    field2: string;
    value1: any;
    value2: any;
    message: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    suggestion?: string;
}

export interface CrossFieldRule {
    id: string;
    name: string;
    description: string;
    category: 'date' | 'math' | 'geographic' | 'business' | 'format' | 'referential';
    severity: 'critical' | 'error' | 'warning' | 'info';
    validate: (row: any, context?: ValidationContext) => CrossFieldIssue | null;
}

export interface ValidationContext {
    allData?: any[];
    columnProfiles?: any;
    lookupTables?: Record<string, any[]>;
}

// ============== DATE VALIDATION RULES ==============

/**
 * Ensure end date is after start date
 */
export function createDateSequenceRule(
    startDateCol: string,
    endDateCol: string,
    allowEqual: boolean = true
): CrossFieldRule {
    return {
        id: `date_seq_${startDateCol}_${endDateCol}`,
        name: 'Date Sequence',
        description: `${endDateCol} must be after ${startDateCol}`,
        category: 'date',
        severity: 'error',
        validate: (row) => {
            const start = parseDate(row[startDateCol]);
            const end = parseDate(row[endDateCol]);

            if (!start || !end) return null; // Skip if either is null

            const isValid = allowEqual ? end >= start : end > start;

            if (!isValid) {
                return {
                    row: 0, // Will be set by caller
                    ruleId: `date_seq_${startDateCol}_${endDateCol}`,
                    ruleName: 'Date Sequence',
                    field1: startDateCol,
                    field2: endDateCol,
                    value1: row[startDateCol],
                    value2: row[endDateCol],
                    message: `${endDateCol} (${row[endDateCol]}) is before ${startDateCol} (${row[startDateCol]})`,
                    severity: 'error',
                    suggestion: `Swap dates or correct the values`
                };
            }
            return null;
        }
    };
}

/**
 * Ensure date is not in the future (for historical data)
 */
export function createNotFutureDateRule(dateCol: string): CrossFieldRule {
    return {
        id: `not_future_${dateCol}`,
        name: 'Not Future Date',
        description: `${dateCol} should not be in the future`,
        category: 'date',
        severity: 'warning',
        validate: (row) => {
            const date = parseDate(row[dateCol]);
            if (!date) return null;

            if (date > new Date()) {
                return {
                    row: 0,
                    ruleId: `not_future_${dateCol}`,
                    ruleName: 'Not Future Date',
                    field1: dateCol,
                    field2: '',
                    value1: row[dateCol],
                    value2: null,
                    message: `${dateCol} is in the future`,
                    severity: 'warning',
                    suggestion: `Verify if this is intentional`
                };
            }
            return null;
        }
    };
}

/**
 * Age derived from DOB should match declared age
 */
export function createAgeDOBRule(ageCol: string, dobCol: string, tolerance: number = 1): CrossFieldRule {
    return {
        id: `age_dob_${ageCol}_${dobCol}`,
        name: 'Age from DOB',
        description: `Age should match date of birth calculation`,
        category: 'date',
        severity: 'error',
        validate: (row) => {
            const age = parseFloat(row[ageCol]);
            const dob = parseDate(row[dobCol]);

            if (isNaN(age) || !dob) return null;

            const today = new Date();
            const calculatedAge = Math.floor(
                (today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
            );

            if (Math.abs(age - calculatedAge) > tolerance) {
                return {
                    row: 0,
                    ruleId: `age_dob_${ageCol}_${dobCol}`,
                    ruleName: 'Age from DOB',
                    field1: ageCol,
                    field2: dobCol,
                    value1: age,
                    value2: row[dobCol],
                    message: `Age ${age} doesn't match DOB (calculated: ${calculatedAge})`,
                    severity: 'error',
                    suggestion: `Correct age to ${calculatedAge} or verify DOB`
                };
            }
            return null;
        }
    };
}

// ============== MATHEMATICAL VALIDATION RULES ==============

/**
 * Validate mathematical relationship: result = operand1 × operand2
 */
export function createMultiplicationRule(
    resultCol: string,
    operand1Col: string,
    operand2Col: string,
    tolerance: number = 0.01
): CrossFieldRule {
    return {
        id: `mult_${resultCol}_${operand1Col}_${operand2Col}`,
        name: 'Multiplication Check',
        description: `${resultCol} = ${operand1Col} × ${operand2Col}`,
        category: 'math',
        severity: 'error',
        validate: (row) => {
            const result = parseFloat(row[resultCol]);
            const op1 = parseFloat(row[operand1Col]);
            const op2 = parseFloat(row[operand2Col]);

            if (isNaN(result) || isNaN(op1) || isNaN(op2)) return null;

            const expected = op1 * op2;
            const diff = Math.abs(result - expected);
            const relDiff = expected !== 0 ? diff / expected : diff;

            if (relDiff > tolerance) {
                return {
                    row: 0,
                    ruleId: `mult_${resultCol}_${operand1Col}_${operand2Col}`,
                    ruleName: 'Multiplication Check',
                    field1: resultCol,
                    field2: `${operand1Col} × ${operand2Col}`,
                    value1: result,
                    value2: expected,
                    message: `${resultCol}=${result} doesn't equal ${operand1Col}×${operand2Col}=${expected}`,
                    severity: 'error',
                    suggestion: `Update ${resultCol} to ${expected.toFixed(2)}`
                };
            }
            return null;
        }
    };
}

/**
 * Validate sum: result = sum of operands
 */
export function createSumRule(
    resultCol: string,
    operandCols: string[],
    tolerance: number = 0.01
): CrossFieldRule {
    return {
        id: `sum_${resultCol}_${operandCols.join('_')}`,
        name: 'Sum Check',
        description: `${resultCol} = sum of ${operandCols.join(' + ')}`,
        category: 'math',
        severity: 'error',
        validate: (row) => {
            const result = parseFloat(row[resultCol]);
            if (isNaN(result)) return null;

            let sum = 0;
            for (const col of operandCols) {
                const val = parseFloat(row[col]);
                if (isNaN(val)) return null;
                sum += val;
            }

            const diff = Math.abs(result - sum);
            const relDiff = sum !== 0 ? diff / sum : diff;

            if (relDiff > tolerance) {
                return {
                    row: 0,
                    ruleId: `sum_${resultCol}_${operandCols.join('_')}`,
                    ruleName: 'Sum Check',
                    field1: resultCol,
                    field2: operandCols.join(' + '),
                    value1: result,
                    value2: sum,
                    message: `${resultCol}=${result} doesn't equal sum=${sum}`,
                    severity: 'error',
                    suggestion: `Update ${resultCol} to ${sum.toFixed(2)}`
                };
            }
            return null;
        }
    };
}

/**
 * Percentage should be between 0 and 100 (or 0 and 1)
 */
export function createPercentageRangeRule(
    percentCol: string,
    isDecimal: boolean = false
): CrossFieldRule {
    const maxVal = isDecimal ? 1 : 100;
    return {
        id: `pct_range_${percentCol}`,
        name: 'Percentage Range',
        description: `${percentCol} should be 0-${maxVal}`,
        category: 'math',
        severity: 'warning',
        validate: (row) => {
            const val = parseFloat(row[percentCol]);
            if (isNaN(val)) return null;

            if (val < 0 || val > maxVal) {
                return {
                    row: 0,
                    ruleId: `pct_range_${percentCol}`,
                    ruleName: 'Percentage Range',
                    field1: percentCol,
                    field2: '',
                    value1: val,
                    value2: null,
                    message: `${percentCol}=${val} is outside valid range (0-${maxVal})`,
                    severity: 'warning',
                    suggestion: isDecimal && val > 1 && val <= 100
                        ? `Did you mean ${(val / 100).toFixed(2)}?`
                        : `Verify the value`
                };
            }
            return null;
        }
    };
}

// ============== GEOGRAPHIC VALIDATION ==============

/**
 * US ZIP code should match state (basic validation using first digit)
 */
export function createZipStateRule(zipCol: string, stateCol: string): CrossFieldRule {
    const zipPrefixToStates: Record<string, string[]> = {
        '0': ['CT', 'MA', 'ME', 'NH', 'NJ', 'NY', 'PR', 'RI', 'VT', 'VI'],
        '1': ['DE', 'NY', 'PA'],
        '2': ['DC', 'MD', 'NC', 'SC', 'VA', 'WV'],
        '3': ['AL', 'FL', 'GA', 'MS', 'TN'],
        '4': ['IN', 'KY', 'MI', 'OH'],
        '5': ['IA', 'MN', 'MT', 'ND', 'SD', 'WI'],
        '6': ['IL', 'KS', 'MO', 'NE'],
        '7': ['AR', 'LA', 'OK', 'TX'],
        '8': ['AZ', 'CO', 'ID', 'NM', 'NV', 'UT', 'WY'],
        '9': ['AK', 'AS', 'CA', 'GU', 'HI', 'MP', 'OR', 'WA'],
    };

    return {
        id: `zip_state_${zipCol}_${stateCol}`,
        name: 'ZIP-State Match',
        description: `ZIP code prefix should match state`,
        category: 'geographic',
        severity: 'warning',
        validate: (row) => {
            const zip = String(row[zipCol] || '').replace(/\D/g, '');
            const state = String(row[stateCol] || '').toUpperCase().trim();

            if (!zip || zip.length < 1 || !state) return null;

            const prefix = zip[0];
            const validStates = zipPrefixToStates[prefix] || [];

            if (!validStates.includes(state)) {
                return {
                    row: 0,
                    ruleId: `zip_state_${zipCol}_${stateCol}`,
                    ruleName: 'ZIP-State Match',
                    field1: zipCol,
                    field2: stateCol,
                    value1: row[zipCol],
                    value2: state,
                    message: `ZIP ${row[zipCol]} doesn't match state ${state}`,
                    severity: 'warning',
                    suggestion: `Expected states for ZIP prefix ${prefix}: ${validStates.join(', ')}`
                };
            }
            return null;
        }
    };
}

/**
 * Country code should match phone number prefix
 */
export function createPhoneCountryRule(phoneCol: string, countryCol: string): CrossFieldRule {
    const countryPhonePrefixes: Record<string, string[]> = {
        'US': ['1'], 'USA': ['1'], 'UNITED STATES': ['1'],
        'UK': ['44'], 'GB': ['44'], 'UNITED KINGDOM': ['44'],
        'IN': ['91'], 'INDIA': ['91'],
        'AU': ['61'], 'AUSTRALIA': ['61'],
        'CA': ['1'], 'CANADA': ['1'],
        'DE': ['49'], 'GERMANY': ['49'],
        'FR': ['33'], 'FRANCE': ['33'],
        'JP': ['81'], 'JAPAN': ['81'],
        'CN': ['86'], 'CHINA': ['86'],
        'BR': ['55'], 'BRAZIL': ['55'],
    };

    return {
        id: `phone_country_${phoneCol}_${countryCol}`,
        name: 'Phone-Country Match',
        description: `Phone prefix should match country`,
        category: 'geographic',
        severity: 'info',
        validate: (row) => {
            const phone = String(row[phoneCol] || '').replace(/\D/g, '');
            const country = String(row[countryCol] || '').toUpperCase().trim();

            if (!phone || phone.length < 10 || !country) return null;

            const expectedPrefixes = countryPhonePrefixes[country];
            if (!expectedPrefixes) return null; // Unknown country

            const hasMatchingPrefix = expectedPrefixes.some(p => phone.startsWith(p));

            if (!hasMatchingPrefix) {
                return {
                    row: 0,
                    ruleId: `phone_country_${phoneCol}_${countryCol}`,
                    ruleName: 'Phone-Country Match',
                    field1: phoneCol,
                    field2: countryCol,
                    value1: row[phoneCol],
                    value2: country,
                    message: `Phone doesn't have expected prefix for ${country} (${expectedPrefixes.join(', ')})`,
                    severity: 'info'
                };
            }
            return null;
        }
    };
}

// ============== BUSINESS LOGIC VALIDATION ==============

/**
 * Email domain should match company name
 */
export function createEmailCompanyRule(emailCol: string, companyCol: string): CrossFieldRule {
    return {
        id: `email_company_${emailCol}_${companyCol}`,
        name: 'Email-Company Match',
        description: `Email domain should relate to company`,
        category: 'business',
        severity: 'info',
        validate: (row) => {
            const email = String(row[emailCol] || '').toLowerCase();
            const company = String(row[companyCol] || '').toLowerCase();

            if (!email || !company || !email.includes('@')) return null;

            const domain = email.split('@')[1]?.split('.')[0] || '';

            // Skip common public email domains
            const publicDomains = ['gmail', 'yahoo', 'hotmail', 'outlook', 'aol', 'icloud', 'mail', 'protonmail'];
            if (publicDomains.includes(domain)) return null;

            // Check if domain appears in company name
            const companyWords = company.replace(/[^\w\s]/g, '').split(/\s+/);
            const isRelated = companyWords.some(word =>
                word.length > 2 && (domain.includes(word) || word.includes(domain))
            );

            if (!isRelated && domain.length > 3) {
                return {
                    row: 0,
                    ruleId: `email_company_${emailCol}_${companyCol}`,
                    ruleName: 'Email-Company Match',
                    field1: emailCol,
                    field2: companyCol,
                    value1: email,
                    value2: company,
                    message: `Email domain "${domain}" doesn't match company name`,
                    severity: 'info',
                    suggestion: `Verify if this is a personal vs corporate email`
                };
            }
            return null;
        }
    };
}

/**
 * Gender should match salutation/title
 */
export function createGenderSalutationRule(genderCol: string, salutationCol: string): CrossFieldRule {
    const maleSalutations = ['MR', 'MR.', 'SIR', 'MISTER'];
    const femaleSalutations = ['MS', 'MS.', 'MRS', 'MRS.', 'MISS', 'MA\'AM', 'MADAM'];
    const maleGenders = ['M', 'MALE', 'MAN', 'BOY'];
    const femaleGenders = ['F', 'FEMALE', 'WOMAN', 'GIRL'];

    return {
        id: `gender_salutation_${genderCol}_${salutationCol}`,
        name: 'Gender-Salutation Match',
        description: `Gender should match salutation`,
        category: 'business',
        severity: 'warning',
        validate: (row) => {
            const gender = String(row[genderCol] || '').toUpperCase().trim();
            const salutation = String(row[salutationCol] || '').toUpperCase().trim();

            if (!gender || !salutation) return null;

            const isMaleGender = maleGenders.includes(gender);
            const isFemaleGender = femaleGenders.includes(gender);
            const isMaleSalutation = maleSalutations.includes(salutation);
            const isFemaleSalutation = femaleSalutations.includes(salutation);

            if ((isMaleGender && isFemaleSalutation) || (isFemaleGender && isMaleSalutation)) {
                return {
                    row: 0,
                    ruleId: `gender_salutation_${genderCol}_${salutationCol}`,
                    ruleName: 'Gender-Salutation Match',
                    field1: genderCol,
                    field2: salutationCol,
                    value1: gender,
                    value2: salutation,
                    message: `Gender "${gender}" doesn't match salutation "${salutation}"`,
                    severity: 'warning'
                };
            }
            return null;
        }
    };
}

/**
 * Status and reason consistency
 */
export function createStatusReasonRule(
    statusCol: string,
    reasonCol: string,
    statusReasonMap: Record<string, string[]>
): CrossFieldRule {
    return {
        id: `status_reason_${statusCol}_${reasonCol}`,
        name: 'Status-Reason Consistency',
        description: `Reason should be valid for status`,
        category: 'business',
        severity: 'error',
        validate: (row) => {
            const status = String(row[statusCol] || '').toUpperCase().trim();
            const reason = String(row[reasonCol] || '').toUpperCase().trim();

            if (!status || !reason) return null;

            const validReasons = statusReasonMap[status];
            if (!validReasons) return null; // Unknown status

            if (!validReasons.includes(reason)) {
                return {
                    row: 0,
                    ruleId: `status_reason_${statusCol}_${reasonCol}`,
                    ruleName: 'Status-Reason Consistency',
                    field1: statusCol,
                    field2: reasonCol,
                    value1: status,
                    value2: reason,
                    message: `Reason "${reason}" is not valid for status "${status}"`,
                    severity: 'error',
                    suggestion: `Valid reasons: ${validReasons.join(', ')}`
                };
            }
            return null;
        }
    };
}

// ============== FORMAT VALIDATION ==============

/**
 * If one field has a value, another field should also have a value
 */
export function createRequiredIfRule(
    triggerCol: string,
    requiredCol: string,
    triggerCondition?: (value: any) => boolean
): CrossFieldRule {
    return {
        id: `required_if_${triggerCol}_${requiredCol}`,
        name: 'Required Field',
        description: `${requiredCol} is required when ${triggerCol} has a value`,
        category: 'format',
        severity: 'error',
        validate: (row) => {
            const trigger = row[triggerCol];
            const required = row[requiredCol];

            const isTriggerActive = triggerCondition
                ? triggerCondition(trigger)
                : trigger !== null && trigger !== undefined && trigger !== '';

            const isRequiredEmpty = required === null || required === undefined || required === '';

            if (isTriggerActive && isRequiredEmpty) {
                return {
                    row: 0,
                    ruleId: `required_if_${triggerCol}_${requiredCol}`,
                    ruleName: 'Required Field',
                    field1: triggerCol,
                    field2: requiredCol,
                    value1: trigger,
                    value2: required,
                    message: `${requiredCol} is required when ${triggerCol} has a value`,
                    severity: 'error'
                };
            }
            return null;
        }
    };
}

// ============== HELPER FUNCTIONS ==============

function parseDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;

    // Handle Excel serial dates
    if (typeof value === 'number' && value > 30000 && value < 60000) {
        return new Date((value - 25569) * 86400000);
    }

    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
}

// ============== MAIN VALIDATION ENGINE ==============

/**
 * Run all cross-field validations on a dataset
 */
export function validateCrossFields(
    data: any[],
    rules: CrossFieldRule[],
    context?: ValidationContext
): CrossFieldIssue[] {
    const issues: CrossFieldIssue[] = [];

    for (let i = 0; i < data.length; i++) {
        const row = data[i];

        for (const rule of rules) {
            const issue = rule.validate(row, context);
            if (issue) {
                issue.row = i;
                issues.push(issue);
            }
        }
    }

    return issues;
}

/**
 * Auto-detect applicable rules based on column names
 */
export function detectApplicableRules(headers: string[], sample: any[]): CrossFieldRule[] {
    const rules: CrossFieldRule[] = [];
    const lowerHeaders = headers.map(h => h.toLowerCase());

    // Find date pairs
    const datePatterns = ['date', 'time', 'created', 'updated', 'modified', 'start', 'end', 'begin', 'finish'];
    const dateCols = headers.filter(h =>
        datePatterns.some(p => h.toLowerCase().includes(p))
    );

    for (let i = 0; i < dateCols.length; i++) {
        for (let j = i + 1; j < dateCols.length; j++) {
            const col1 = dateCols[i].toLowerCase();
            const col2 = dateCols[j].toLowerCase();

            // Check for start/end pairs
            if ((col1.includes('start') && col2.includes('end')) ||
                (col1.includes('begin') && col2.includes('end')) ||
                (col1.includes('created') && col2.includes('updated'))) {
                rules.push(createDateSequenceRule(dateCols[i], dateCols[j]));
            }
        }
    }

    // Find multiplication candidates (qty, price, total, amount)
    const qtyPatterns = ['qty', 'quantity', 'count', 'units', 'number'];
    const pricePatterns = ['price', 'rate', 'cost', 'unit price', 'per unit'];
    const totalPatterns = ['total', 'amount', 'sum', 'value', 'spent'];

    const qtyCols = headers.filter(h => qtyPatterns.some(p => h.toLowerCase().includes(p)));
    const priceCols = headers.filter(h => pricePatterns.some(p => h.toLowerCase().includes(p)));
    const totalCols = headers.filter(h => totalPatterns.some(p => h.toLowerCase().includes(p)));

    for (const qty of qtyCols) {
        for (const price of priceCols) {
            for (const total of totalCols) {
                // Validate that this combination makes sense
                rules.push(createMultiplicationRule(total, qty, price));
            }
        }
    }

    // Email and company
    const emailCols = headers.filter(h => h.toLowerCase().includes('email'));
    const companyCols = headers.filter(h =>
        ['company', 'organization', 'employer', 'business'].some(p => h.toLowerCase().includes(p))
    );

    for (const email of emailCols) {
        for (const company of companyCols) {
            rules.push(createEmailCompanyRule(email, company));
        }
    }

    // ZIP and state
    const zipCols = headers.filter(h =>
        ['zip', 'postal', 'postcode'].some(p => h.toLowerCase().includes(p))
    );
    const stateCols = headers.filter(h =>
        h.toLowerCase() === 'state' || h.toLowerCase().includes('province')
    );

    for (const zip of zipCols) {
        for (const state of stateCols) {
            rules.push(createZipStateRule(zip, state));
        }
    }

    // Gender and salutation
    const genderCols = headers.filter(h =>
        ['gender', 'sex'].some(p => h.toLowerCase().includes(p))
    );
    const salutationCols = headers.filter(h =>
        ['salutation', 'title', 'prefix'].some(p => h.toLowerCase().includes(p))
    );

    for (const gender of genderCols) {
        for (const salutation of salutationCols) {
            rules.push(createGenderSalutationRule(gender, salutation));
        }
    }

    // Percentage columns
    const pctCols = headers.filter(h =>
        ['percent', 'pct', '%', 'rate', 'ratio'].some(p => h.toLowerCase().includes(p))
    );

    for (const pct of pctCols) {
        // Detect if decimal or 0-100 based on sample
        const values = sample.map(row => parseFloat(row[pct])).filter(v => !isNaN(v));
        const maxVal = Math.max(...values);
        const isDecimal = maxVal <= 1;
        rules.push(createPercentageRangeRule(pct, isDecimal));
    }

    return rules;
}

/**
 * Summary of validation issues by severity
 */
export function summarizeIssues(issues: CrossFieldIssue[]): {
    critical: number;
    error: number;
    warning: number;
    info: number;
    byRule: Record<string, number>;
} {
    const summary = {
        critical: 0,
        error: 0,
        warning: 0,
        info: 0,
        byRule: {} as Record<string, number>
    };

    for (const issue of issues) {
        summary[issue.severity]++;
        summary.byRule[issue.ruleId] = (summary.byRule[issue.ruleId] || 0) + 1;
    }

    return summary;
}
