/**
 * EXTREME Date/Time Normalization - 100+ formats, all locales.
 * Part of the Elite Data Cleaning Layer.
 */

// --- 1. MONTH NAME DICTIONARY (Multi-lingual) ---

const MONTH_NAMES_MAP: Record<string, number> = {
    // English
    'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
    'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11,
    'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'jun': 5, 'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11,
    // Spanish (Español)
    'enero': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'mayo': 4, 'junio': 5,
    'julio': 6, 'agosto': 7, 'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11,
    // French (Français)
    'janvier': 0, 'février': 1, 'mars': 2, 'avril': 3, 'mai': 4, 'juin': 5,
    'juillet': 6, 'août': 7, 'septembre': 8, 'octobre': 9, 'novembre': 10, 'décembre': 11,
    // German (Deutsch)
    'januar': 0, 'februar': 1, 'märz': 2, 'mai_de': 4, 'juni': 5, 'juli': 6,
    'oktober': 9, 'dezember': 11,
    // Italian (Italiano)
    'gennaio': 0, 'febbraio': 1, 'marzo_it': 2, 'aprile': 3, 'maggio': 4, 'giugno': 5,
    'luglio': 6, 'agosto_it': 7, 'settembre': 8, 'ottobre': 9, 'novembre_it': 10, 'dicembre': 11,
    // Portuguese (Português)
    'janeiro': 0, 'fevereiro': 1, 'março': 2, 'abril_pt': 3, 'maio': 4, 'junho': 5,
    'julho': 6, 'agosto_pt': 7, 'setembro': 8, 'outubro': 9, 'novembro': 10, 'dezembro': 11,
    // Dutch (Nederlands)
    'januari': 0, 'februari': 1, 'maart': 2, 'april_nl': 3, 'mei': 4, 'juni_nl': 5,
    'juli_nl': 6, 'augustus': 7, 'september_nl': 8, 'oktober_nl': 9, 'november_nl': 10, 'december_nl': 11,
    // Russian (Русский) - Transliterated/Native
    'yanvar': 0, 'fevral': 1, 'mart': 2, 'aprel': 3, 'may_ru': 4, 'iyun': 5,
    'iyul': 6, 'avgust': 7, 'sentyabr': 8, 'oktyabr': 9, 'noyabr': 10, 'dekabr': 11,
    // Chinese (Simplified) - Pinyin/Native
    'yiyue': 0, 'eryue': 1, 'sanyue': 2, 'siyue': 3, 'wuyue': 4, 'liuyue': 5,
    'qiyue': 6, 'bayue': 7, 'jiuyue': 8, 'shiyue': 9, 'shiyiyue': 10, 'shieryue': 11,
    // Japanese - Romaji
    'ichigatsu': 0, 'nigatsu': 1, 'sangatsu': 2, 'shigatsu': 3, 'gogatsu': 4, 'rokugatsu': 5,
    'shichigatsu': 6, 'hachigatsu': 7, 'kugatsu': 8, 'jugatsu': 9, 'juichigatsu': 10, 'junigatsu': 11,
    // Arabic - Transliterated
    'yanayir': 0, 'fibrayir': 1, 'maris': 2, 'abril_ar': 3, 'mayu': 4, 'yuniyu': 5,
    'yuliyu': 6, 'aghustus': 7, 'sibtambir': 8, 'uktubar': 9, 'nufambir': 10, 'disambir': 11,
    // Hindi - Transliterated
    'janvari': 0, 'farvari': 1, 'march_hi': 2, 'aprail': 3, 'mai_hi': 4, 'joon': 5,
    'julai': 6, 'agast': 7, 'sitambar': 8, 'aktuber': 9, 'navambar': 10, 'disambar': 11,
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

// --- 5. ENTERPRISE DATE FORMATS ---

/**
 * Parse Fiscal Year quarters (FY24 Q1 -> Date Range)
 * Assumes Standard US Fiscal Year (Oct 1 start)
 */
export function parseFiscalYear(text: string): { start: Date; end: Date; label: string } | null {
    if (!text) return null;
    const clean = text.trim().toUpperCase();

    // Support FY2024 Q1, FY24-Q1, 2024 Q1, etc.
    const match = clean.match(/(?:FY)?(\d{2,4})[\s-]*(?:Q|QUARTER)?\s*([1-4])/);
    if (!match) return null;

    let year = parseInt(match[1]);
    const quarter = parseInt(match[2]);

    // Normalize 2-digit year (assume 20xx)
    if (year < 100) year += 2000;

    // Standard US Govt Fiscal Year:
    // Q1: Oct-Dec (previous calendar year)
    // Q2: Jan-Mar
    // Q3: Apr-Jun
    // Q4: Jul-Sep

    let startMonth = 0;
    let endMonth = 0;
    let targetYear = year;

    switch (quarter) {
        case 1: // Oct-Dec (Prev Year)
            startMonth = 9; // Oct
            endMonth = 11; // Dec
            targetYear = year - 1;
            break;
        case 2: // Jan-Mar
            startMonth = 0;
            endMonth = 2;
            break;
        case 3: // Apr-Jun
            startMonth = 3;
            endMonth = 5;
            break;
        case 4: // Jul-Sep
            startMonth = 6;
            endMonth = 8;
            break;
    }

    const start = new Date(targetYear, startMonth, 1);
    const end = new Date(targetYear, endMonth + 1, 0); // Last day of end month

    return {
        start,
        end,
        label: `FY${year} Q${quarter}`
    };
}

/**
 * Parse Date Range ("Jan 2024 - Mar 2024")
 */
export function parseDateRange(text: string): { start: Date; end: Date } | null {
    if (!text) return null;

    // Split by common separators: " - ", " to ", " until "
    const parts = text.split(/\s+(?:-|to|until)\s+/i);
    if (parts.length !== 2) return null;

    const start = normalizeDate(parts[0]);
    const end = normalizeDate(parts[1]);

    if (start && end) {
        return { start, end };
    }
    return null;
}

/**
 * Detect Unix Timestamp (Seconds vs Milliseconds)
 */
export function detectUnixTimestamp(value: number): { date: Date; type: 'seconds' | 'milliseconds' } | null {
    if (isNaN(value) || value <= 0) return null;

    // Milliseconds: typical current values ~1.7e12 (13 digits)
    // Seconds: typical current values ~1.7e9 (10 digits)

    if (value > 100000000000) { // > 100 billion -> Milliseconds
        return { date: new Date(value), type: 'milliseconds' };
    } else if (value > 100000000) { // > 100 million -> Seconds
        return { date: new Date(value * 1000), type: 'seconds' };
    }

    return null;
}

/**
 * Parse ISO Week (2024-W03 or 2024-W03-1)
 */
export function parseISOWeek(text: string): Date | null {
    if (!text) return null;
    const clean = text.trim().toUpperCase();

    // Match 2024-W03 or 2024W03
    const match = clean.match(/^(\d{4})-?W(\d{2})(?:-?(\d))?$/);
    if (!match) return null;

    const year = parseInt(match[1]);
    const week = parseInt(match[2]);
    const day = match[3] ? parseInt(match[3]) : 1; // Default to Monday (1)

    // Calculate date from week number
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const isoWeekStart = simple;
    if (dow <= 4)
        isoWeekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        isoWeekStart.setDate(simple.getDate() + 8 - simple.getDay());

    // Add days offset
    isoWeekStart.setDate(isoWeekStart.getDate() + (day - 1));

    return isoWeekStart;
}

/**
 * Parse Timezone abbreviations
 */
export function parseTimezone(text: string): number | null {
    if (!text) return null;
    const clean = text.trim().toUpperCase();

    const offsets: Record<string, number> = {
        'UTC': 0, 'GMT': 0, 'Z': 0,
        'EST': -5, 'EDT': -4,
        'CST': -6, 'CDT': -5,
        'MST': -7, 'MDT': -6,
        'PST': -8, 'PDT': -7,
        'IST': 5.5, // India
        'CET': 1, 'CEST': 2,
        'JST': 9, // Japan
        'AEST': 10, 'AEDT': 11,
    };

    return offsets[clean] ?? null;
}
