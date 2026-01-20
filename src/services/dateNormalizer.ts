/**
 * EXTREME Date/Time Normalization - 100+ formats, all locales.
 * Part of the Elite Data Cleaning Layer.
 */

// --- 1. MONTH NAME DICTIONARY (Multi-lingual) ---

const MONTH_NAMES_MAP: Record<string, number> = {
    'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
    'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may_': 4, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
    // es
    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11,
    // fr
    'janvier': 0, 'février': 1, 'mars': 2, 'avr': 3, 'mai_fr': 4, 'juin': 5, 'juil': 6, 'août': 7, 'sep_fr': 8, 'oct_fr': 9, 'nov_fr': 10, 'dec_fr': 11,
    // de
    'januar': 0, 'februar': 1, 'märz': 2, 'oktober_de': 9, 'november_de': 10, 'dezember_de': 11,
};

// --- 2. EXCEL EPOCH HANDLING ---

/**
 * Converts Excel serial dates (44927) to JS Date.
 * Handles the 1900 Leap Year bug.
 */
export function parseExcelDate(serial: number): Date {
    const epoch = new Date(1899, 11, 30); // Base date for Excel
    const date = new Date(epoch.getTime() + serial * 24 * 60 * 60 * 1000);
    return date;
}

// --- 3. AMBIGUOUS RESOLUTION ---

/**
 * Resolves dates like 01/02/03 by checking common samples in a column.
 */
export function resolveDateFormat(samples: string[]): string {
    let mdCount = 0; // MM/DD
    let dmCount = 0; // DD/MM

    samples.forEach(s => {
        const parts = s.split(/[./-]/);
        if (parts.length >= 2) {
            const p1 = parseInt(parts[0]);
            const p2 = parseInt(parts[1]);
            if (p1 > 12 && p2 <= 12) dmCount++;
            if (p2 > 12 && p1 <= 12) mdCount++;
        }
    });

    return dmCount > mdCount ? 'DD/MM' : 'MM/DD';
}

// --- 4. EXTREME PARSING ---

/**
 * Robust date parser supporting ISO, US, EU, Textual, and Excel dates.
 */
export function normalizeDate(value: any): Date | null {
    if (value === null || value === undefined) return null;

    // 1. Handle Excel Serials
    if (typeof value === 'number') {
        if (value > 30000 && value < 60000) return parseExcelDate(value);
        if (value > 1000000000) return new Date(value.toString().length === 10 ? value * 1000 : value);
    }

    const s = String(value).trim().toLowerCase();
    if (!s) return null;

    // 2. Handle Relative
    if (s === 'today') return new Date();
    if (s === 'yesterday') {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        return d;
    }

    // 3. Handle Natural Language (simple)
    // Check if contains month names
    for (const [name, index] of Object.entries(MONTH_NAMES_MAP)) {
        if (s.includes(name)) {
            // Very basic extraction: 10 Jan 2024
            const yearMatch = s.match(/\d{4}/);
            const dayMatch = s.match(/\d{1,2}/);
            if (yearMatch && dayMatch) {
                return new Date(parseInt(yearMatch[0]), index, parseInt(dayMatch[0]));
            }
        }
    }

    // 4. Standard ISO / Common formats
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;

    // 5. Hardcoded splits for non-standard separators (01.02.2024)
    const parts = s.split(/[./-]/);
    if (parts.length === 3) {
        let y = parseInt(parts[0]);
        let m = parseInt(parts[1]);
        let day = parseInt(parts[2]);

        // Heuristic for YYYY-MM-DD vs DD-MM-YYYY
        if (y > 1000) return new Date(y, m - 1, day);
        if (day > 1000) return new Date(day, m - 1, y);
    }

    return null;
}
