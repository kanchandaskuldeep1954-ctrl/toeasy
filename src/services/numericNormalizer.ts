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

// --- 4. ADVANCED NUMERIC FORMATS ---

/**
 * Convert Roman Numerals to number (IV -> 4, MCMXC -> 1990)
 * Validates format to avoid false positives (e.g. "C" could be grade C)
 */
export function parseRomanNumeral(roman: string): number | null {
    if (!roman) return null;
    const r = roman.trim().toUpperCase();

    // Strict Roman Numeral pattern
    if (!/^M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(r)) return null;
    if (r.length === 0) return null;

    const map: Record<string, number> = {
        'I': 1, 'V': 5, 'X': 10, 'L': 50,
        'C': 100, 'D': 500, 'M': 1000
    };

    let result = 0;
    for (let i = 0; i < r.length; i++) {
        const current = map[r[i]];
        const next = map[r[i + 1]];

        if (next && current < next) {
            result -= current;
        } else {
            result += current;
        }
    }

    return result;
}

/**
 * Convert English number words to number ("one hundred twenty five" -> 125)
 * Handles basic integers up to billions
 */
export function parseNumberWords(text: string): number | null {
    if (!text) return null;
    const lower = text.trim().toLowerCase().replace(/-/g, ' ').replace(/\s+/g, ' ');

    // Quick check if it contains number words
    const commonWords = ['one', 'two', 'three', 'ten', 'hundred', 'thousand', 'million'];
    if (!commonWords.some(w => lower.includes(w))) return null;

    const small: Record<string, number> = {
        'zero': 0, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
        'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
        'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
        'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19,
        'twenty': 20, 'thirty': 30, 'forty': 40, 'fifty': 50,
        'sixty': 60, 'seventy': 70, 'eighty': 80, 'ninety': 90
    };

    const magnitude: Record<string, number> = {
        'hundred': 100,
        'thousand': 1000,
        'million': 1000000,
        'billion': 1000000000
    };

    const words = lower.split(' ');
    let total = 0;
    let current = 0;

    for (const word of words) {
        if (word === 'and') continue;

        if (small[word] !== undefined) {
            current += small[word];
        } else if (word === 'hundred') {
            current *= 100;
        } else if (magnitude[word]) {
            total += current * magnitude[word];
            current = 0;
        } else {
            // Unknown word found, likely not a clean number string
            return null;
        }
    }

    return total + current;
}

/**
 * Normalize ordinals (1st -> 1, 2nd -> 2)
 */
export function normalizeOrdinal(text: string): number | null {
    if (!text) return null;
    const clean = text.trim().toLowerCase();

    // Match 1st, 2nd, 3rd, 4th, 11th, 21st, etc.
    const match = clean.match(/^(\d+)(st|nd|rd|th)$/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return null;
}

/**
 * Parse abbreviated numbers (1.5M -> 1,500,000)
 */
export function parseAbbreviatedNumber(text: string): number | null {
    if (!text) return null;
    const clean = text.trim().toUpperCase();

    // Match patterns like 1.5M, 10k, 5B
    const match = clean.match(/^([\d.,]+)\s*([KMB])$/);
    if (!match) return null;

    let numStr = match[1];
    const multiplierChar = match[2];

    // Simple normalization of number part
    numStr = numStr.replace(/,/g, ''); // Assuming standard US format for code simplicity
    const num = parseFloat(numStr);

    if (isNaN(num)) return null;

    switch (multiplierChar) {
        case 'K': return num * 1000;
        case 'M': return num * 1000000;
        case 'B': return num * 1000000000;
    }
    return null;
}

/**
 * Parse Hexadecimal (0xFF) or Binary (0b1010)
 */
export function parseBinaryHex(text: string): number | null {
    if (!text) return null;
    const clean = text.trim();

    // Hex
    if (/^0x[0-9A-Fa-f]+$/.test(clean)) {
        return parseInt(clean, 16);
    }

    // Binary
    if (/^0b[01]+$/.test(clean)) {
        return parseInt(clean.substring(2), 2);
    }

    return null;
}

/**
 * Normalize Percentage (50% -> 0.5 or 50 based on context option)
 */
export function normalizePercentage(text: string, asDecimal: boolean = true): number | null {
    if (!text) return null;
    if (!text.includes('%')) return null;

    const clean = text.replace('%', '').trim();
    const num = normalizeNumeric(clean);

    if (num === null) return null;

    return asDecimal ? num / 100 : num;
}
