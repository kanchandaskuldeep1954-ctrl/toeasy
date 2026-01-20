/**
 * EXTREME Validation Engine - Every domain-specific rule known.
 * Part of the Elite Data Cleaning Layer.
 */

// --- 1. FUZZY & PHONETIC ---

/**
 * Basic Levenshtein distance for fuzzy matching.
 */
export function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1, // insertion
                    matrix[i - 1][j] + 1 // deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

/**
 * Soundex algorithm for phonetic matching (e.g. Smith vs Smyth).
 */
export function soundex(s: string): string {
    const a = s.toLowerCase().split('');
    const f = a.shift() || '';
    const L = { a: '', e: '', i: '', o: '', u: '', y: '', h: '', w: '', b: 1, f: 1, p: 1, v: 1, c: 2, g: 2, j: 2, k: 2, q: 2, s: 2, x: 2, z: 2, d: 3, t: 3, l: 4, m: 5, n: 5, r: 6 };

    const r = [f.toUpperCase()];
    a.forEach(v => {
        const k = (L as any)[v];
        if (k && k !== r[r.length - 1]) r.push(k);
    });

    return (r.join('') + '000').slice(0, 4);
}

// --- 2. PII DETECTION & DOMAIN VALIDATORS ---

/**
 * Luhn algorithm for Credit Card validation.
 */
export function validateLuhn(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    let sum = 0;
    let isEven = false;
    for (let i = digits.length - 1; i >= 0; i--) {
        let n = parseInt(digits[i]);
        if (isEven) {
            n *= 2;
            if (n > 9) n -= 9;
        }
        sum += n;
        isEven = !isEven;
    }
    return sum % 10 === 0;
}

/**
 * Detects if a string is PII and its type.
 */
/**
 * Detects if a string is PII and its type.
 * Now supports Passport, Driver's License, VAT, IP, Phone, etc.
 */
export function detectPII(value: string): 'ssn' | 'credit_card' | 'iban' | 'email' | 'phone' | 'passport' | 'ip' | 'vat' | 'drivers_license' | null {
    if (!value || typeof value !== 'string') return null;
    const s = value.trim();
    const compact = s.replace(/[\s\-\.]/g, '');

    // 1. Credit Card (13-19 digits, Luhn check)
    if (/^\d{13,19}$/.test(compact) && validateLuhn(compact)) return 'credit_card';

    // 2. Email (Standard Regex)
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s)) return 'email';

    // 3. IP Address (IPv4)
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(s)) return 'ip';

    // 4. SSN (US: 3-2-4)
    if (/^\d{3}-?\d{2}-?\d{4}$/.test(s) && compact.length === 9) return 'ssn';

    // 5. Phone (International E.164 or US 10-digit)
    // Matches: +1-555-555-5555, (555) 555-5555, 555.555.5555
    if (/^(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(s)) return 'phone';

    // 6. IBAN (Country code + digits)
    if (/^[A-Z]{2}\d{2}[A-Z\d]{4,30}$/.test(compact)) return 'iban';

    // 7. Passport (Generic: 6-9 chars, usually alphanumeric)
    // US: 9 digits. UK: 9 digits. India: 1 letter + 7 digits.
    if (/^(?!^0+$)[a-zA-Z0-9]{6,9}$/.test(compact)) {
        // Use heuristics to distinguish from other IDs if needed
        // For now, if labeled as Passport in column, validationEngine usually handles. 
        // This is a loose check for "potential" passport.
        // Regex for US Passport (9 digits)
        if (/^\d{9}$/.test(compact)) return 'passport'; // Ambiguous with other IDs, but acceptable estimate
        // Regex for UK/India (Letter + digits)
        if (/^[A-Z][0-9]{7,8}$/.test(compact)) return 'passport';
    }

    // 8. VAT/Tax ID (EU: 2 letter country + digits)
    if (/^[A-Z]{2}[A-Z0-9]{2,12}$/.test(compact)) return 'vat';

    // 9. Drivers License (US State Patterns - Generic)
    // Most are 1 Letter + 6-12 digits OR 9 digits.
    if (/^[A-Z]\d{6,12}$/.test(compact)) return 'drivers_license';

    return null;
}

/**
 * Masks sensitive data based on type using configurable strategy.
 */
export function maskPII(
    value: string,
    type: string,
    strategy: 'redact' | 'partial' | 'hash' = 'partial'
): string {
    if (!value) return value;

    if (strategy === 'redact') {
        return '[REDACTED]';
    }

    if (strategy === 'hash') {
        // Simple hash simulation (in real app use SHA-256)
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            hash = (hash << 5) - hash + value.charCodeAt(i);
            hash |= 0;
        }
        return `hash_${Math.abs(hash).toString(16)}`;
    }

    // Partial Masking Strategy per Type
    const v = value.trim();

    switch (type) {
        case 'email': {
            const atIndex = v.indexOf('@');
            if (atIndex < 0) return v;
            const user = v.slice(0, atIndex);
            const domain = v.slice(atIndex);
            const visible = user.length > 2 ? user.slice(0, 2) : user.slice(0, 1);
            return `${visible}***${domain}`;
        }

        case 'credit_card':
            // Show last 4
            return '****-****-****-' + v.slice(-4);

        case 'ssn':
            // Show last 4
            return '***-**-' + v.slice(-4);

        case 'phone':
            // Show last 4
            return '***-***-' + v.slice(-4);

        case 'passport':
        case 'drivers_license':
            // Show first 1, last 2
            return v.length > 3 ? v[0] + '*****' + v.slice(-2) : '***';

        case 'iban':
            // Show first 2 (Country) and last 4
            return v.slice(0, 2) + '****' + v.slice(-4);

        case 'ip':
            // Mask last octet
            return v.replace(/\d+$/, '***');

        default:
            return '********';
    }
}

// --- 3. STATISTICAL OUTLIERS ---

/**
 * Detects outliers using IQR (Interquartile Range).
 */
export function detectOutliersIQR(values: number[]): { lower: number, upper: number, outliers: number[] } {
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;

    return {
        lower,
        upper,
        outliers: values.filter(v => v < lower || v > upper)
    };
}

/**
 * Benford's Law compliance check.
 */
export function checkBenfordCompliance(values: number[]): number {
    const firstDigits = values.map(v => parseInt(String(Math.abs(v)).charAt(0))).filter(d => d > 0);
    const count = firstDigits.length;
    if (count < 50) return 1; // Not enough data

    const actual1 = firstDigits.filter(d => d === 1).length / count;
    const expected1 = 0.301; // log10(1 + 1/1)

    return Math.abs(actual1 - expected1); // Closer to 0 is better
}
