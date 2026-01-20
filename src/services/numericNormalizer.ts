/**
 * EXTREME Numeric Normalization - Handle EVERY number format on Earth.
 * Part of the Elite Data Cleaning Layer.
 */

// --- 1. THOUSAND SEPARATOR INFERENCE ---

/**
 * Heuristic to detect common thousand and decimal separators from a sample set.
 */
export function inferNumericLocales(values: string[]): {
    thousandSep: string | null;
    decimalSep: string;
    confidence: number;
} {
    let dotSepCount = 0;
    let commaSepCount = 0;
    let spaceSepCount = 0;

    // Pattern patterns: 
    // dots: 1.000,00 (EU)
    // commas: 1,000.00 (US)
    // spaces: 1 000,00 (FR/Scientific)

    values.forEach(val => {
        if (!val) return;
        if (/[0-9]\.[0-9]{3},[0-9]{2}/.test(val)) dotSepCount++;
        if (/[0-9],[0-9]{3}\.[0-9]{2}/.test(val)) commaSepCount++;
        if (/[0-9]\s[0-9]{3},[0-9]{2}/.test(val)) spaceSepCount++;
    });

    if (dotSepCount > commaSepCount) {
        return { thousandSep: '.', decimalSep: ',', confidence: 0.8 };
    } else if (commaSepCount > dotSepCount) {
        return { thousandSep: ',', decimalSep: '.', confidence: 0.8 };
    }

    // Fallback to auto-detection per string
    return { thousandSep: null, decimalSep: '.', confidence: 0.5 };
}

/**
 * Converts an Excel date serial number to a JavaScript Date object.
 * Excel's 1900 date system starts on Jan 1, 1900, which is serial number 1.
 * JavaScript's Date object handles months 0-indexed.
 */
export function parseExcelDate(serial: number): Date {
    // Excel 1900 date system starts on Jan 1, 1900.
    // Serial 1 is 1900-01-01.
    // JS Date(1900, 0, 1) is Jan 1, 1900.
    // We subtract 1 from the serial to align with 0-indexed day offset from 1900-01-01.
    const date = new Date(1900, 0, serial - 1);
    return date;
}

// --- 2. CURRENCY & SYMBOLS ---

const CURRENCY_SYMBOLS: Record<string, string> = {
    '$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', '₹': 'INR',
    '₽': 'RUB', '₺': 'TRY', 'R$': 'BRL', '₪': 'ILS', '₫': 'VND',
    '₱': 'PHP', '₩': 'KRW', '₦': 'NGN', '₴': 'UAH', '₡': 'CRC',
    '₵': 'GHS',
};

/**
 * Extracts amount and currency info from a string.
 */
export function extractCurrencyInfo(value: string): {
    amount: string;
    currency: string | null;
    symbol: string | null;
} {
    if (!value) return { amount: '', currency: null, symbol: null };

    let symbol: string | null = null;
    let cleaned = value.trim();

    // Find any known currency symbols
    for (const s of Object.keys(CURRENCY_SYMBOLS)) {
        if (cleaned.includes(s)) {
            symbol = s;
            cleaned = cleaned.replace(s, '').trim();
            break;
        }
    }

    return {
        amount: cleaned,
        currency: symbol ? CURRENCY_SYMBOLS[symbol] : null,
        symbol
    };
}

// --- 3. EXTREME PARSING ---

/**
 * Normalizes a numeric string into a real number.
 * Handles negative formats like (100), 100-, 100CR.
 * Handles fractions (1 1/2) and scientific notation.
 */
export function normalizeNumeric(value: string, locale?: { thousandSep?: string; decimalSep?: string }): number | null {
    if (value === null || value === undefined) return null;
    let s = value.toString().trim().toUpperCase();

    if (!s || s === '-' || s === 'N/A' || s === '#N/A') return null;

    // Handle Infinite/NaN
    if (s === 'NAN' || s === 'NONE') return null;
    if (s.includes('INF')) return s.includes('-') ? -Infinity : Infinity;

    // 1. Handle Negative Formats (Credit/Debit/Parentheses)
    let multiplier = 1;
    if (s.startsWith('(') && s.endsWith(')')) {
        multiplier = -1;
        s = s.slice(1, -1);
    } else if (s.endsWith('-') || s.endsWith('CR') || s.endsWith('DB')) {
        multiplier = -1;
        s = s.replace(/(-|CR|DB)$/, '');
    }

    // 2. Handle Localization (Thousand separators)
    // If locale isn't provided, try to guess
    if (locale?.thousandSep) {
        s = s.split(locale.thousandSep).join('');
    } else {
        // Simple heuristic: if there's both , and ., the first is thousand
        const lastComma = s.lastIndexOf(',');
        const lastDot = s.lastIndexOf('.');
        if (lastComma > -1 && lastDot > -1) {
            if (lastComma < lastDot) s = s.split(',').join(''); // 1,000.00
            else s = s.split('.').join('').replace(',', '.'); // 1.000,00
        } else if (lastComma > -1 && lastDot === -1) {
            // Check if it looks like decimal (e.g. 10,50) or thousand (1,000)
            const parts = s.split(',');
            if (parts[parts.length - 1].length === 3) s = s.split(',').join(''); // 1,000
            else s = s.replace(',', '.'); // 10,50
        }
    }

    // Clean remaining non-numeric chars except for decimal point, minus, and E
    s = s.replace(/[^\d.E-]/g, '');

    // 3. Handle Fractions (e.g. "3 1/2")
    if (value.includes('/')) {
        const parts = value.trim().split(/\s+/);
        if (parts.length === 2) {
            const whole = parseFloat(parts[0]);
            const fracParts = parts[1].split('/');
            if (fracParts.length === 2) {
                return (whole + parseFloat(fracParts[0]) / parseFloat(fracParts[1])) * multiplier;
            }
        } else if (parts.length === 1 && parts[0].includes('/')) {
            const fracParts = parts[0].split('/');
            if (fracParts.length === 2) {
                return (parseFloat(fracParts[0]) / parseFloat(fracParts[1])) * multiplier;
            }
        }
    }

    const num = parseFloat(s);
    return isNaN(num) ? null : num * multiplier;
}
