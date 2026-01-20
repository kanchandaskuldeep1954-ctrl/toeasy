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
export function detectPII(value: string): 'ssn' | 'credit_card' | 'iban' | 'email' | null {
    if (!value) return null;
    const s = value.replace(/\s|-/g, '');

    // 1. Credit Card
    if (/^\d{13,19}$/.test(s) && validateLuhn(s)) return 'credit_card';

    // 2. SSN (Basic US pattern)
    if (/^\d{3}-?\d{2}-?\d{4}$/.test(value)) return 'ssn';

    // 3. IBAN (Basic)
    if (/^[A-Z]{2}\d{2}[A-Z\d]{4,30}$/.test(s)) return 'iban';

    // 4. Email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';

    return null;
}

/**
 * Masks sensitive data based on type.
 */
export function maskPII(value: string, type: string): string {
    if (!value) return value;
    switch (type) {
        case 'email':
            const parts = value.split('@');
            return parts[0].slice(0, 1) + '***@' + parts[1];
        case 'credit_card':
            return '****-****-****-' + value.slice(-4);
        case 'ssn':
            return '***-**-' + value.slice(-4);
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
