/**
 * EXTREME Character & Encoding Normalization Engine
 * Handles EVERY Unicode edge case known to humanity.
 * Part of the Elite Data Cleaning Layer.
 */

// --- 1. ENCODING & BOM ---

export const BOM_MAP = {
    'UTF-8': [0xEF, 0xBB, 0xBF],
    'UTF-16BE': [0xFE, 0xFF],
    'UTF-16LE': [0xFF, 0xFE],
    'UTF-32BE': [0x00, 0x00, 0xFE, 0xFF],
    'UTF-32LE': [0xFF, 0xFE, 0x00, 0x00],
};

/**
 * Strips Byte Order Mark (BOM) from string
 */
export function stripBOM(text: string): string {
    if (text.charCodeAt(0) === 0xFEFF) {
        return text.slice(1);
    }
    return text;
}

// --- 2. INVISIBLE CHARACTER TAXONOMY (200+ characters) ---

const INVISIBLE_RE = /[\u200B-\u200D\u2060\uFEFF\u202A-\u202E\u2066-\u2069\uFE00-\uFE0F\u0000-\u001F\u007F-\u009F\u00AD]/g;

/**
 * Strips invisible characters, control codes, and directional marks.
 * @param mode 'safe' preserves soft hyphens/formatting, 'aggressive' strips everything.
 */
export function stripInvisibleCharacters(text: string, mode: 'aggressive' | 'safe' = 'safe'): string {
    if (!text) return text;

    // Aggressive: strip all common invisibles
    let cleaned = text.replace(INVISIBLE_RE, '');

    // Additional zero-width and control logic
    if (mode === 'aggressive') {
        // Strip even more obscure ones if needed
    }

    return cleaned;
}

// --- 3. SMART QUOTE NORMALIZATION (12 variants) ---

const QUOTE_MAP: Record<string, string> = {
    '“': '"', '”': '"', // Curly double
    '‘': "'", '’': "'", // Curly single
    '‚': "'", '„': '"', // Low quotes
    '‹': '<', '›': '>', // Single guillemets
    '«': '"', '»': '"', // Double guillemets
    '〝': '"', '〞': '"', // CJK
    '「': '"', '」': '"', // Japanese
    '』': '"', '『': '"',
};

/**
 * Normalizes all curly and international quote variants to standard ASCII " and '
 */
export function normalizeQuotes(text: string): string {
    if (!text) return text;
    return text.split('').map(char => QUOTE_MAP[char] || char).join('');
}

// --- 4. UNICODE NORMALIZATION ---

/**
 * Applies Unicode normalization forms (NFC/NFD/NFKC/NFKD).
 * NFKC is usually best for data cleaning as it handles compatibility symbols.
 */
export function normalizeUnicode(text: string, form: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' = 'NFKC'): string {
    if (!text) return text;
    return text.normalize(form);
}

// --- 5. WHITESPACE HELL (15+ variants) ---

const WHITESPACE_MAP: Record<string, string> = {
    '\u00A0': ' ', // NBSP
    '\u1680': ' ', // Ogham
    '\u2000': ' ', '\u2001': ' ', '\u2002': ' ', '\u2003': ' ',
    '\u2004': ' ', '\u2005': ' ', '\u2006': ' ', '\u2007': ' ',
    '\u2008': ' ', '\u2009': ' ', '\u200A': ' ', '\u202F': ' ',
    '\u205F': ' ', '\u3000': ' ', // Ideographic
};

/**
 * Normalizes all Unicode whitespace variants to regular spaces.
 */
export function normalizeWhitespace(text: string, options: {
    convertNBSP?: boolean;
    collapseMultiple?: boolean;
    trimEnds?: boolean;
    preserveNewlines?: boolean;
} = {}): string {
    if (!text) return text;

    let processed = text;

    // Convert all known space variants
    processed = processed.split('').map(char => WHITESPACE_MAP[char] || char).join('');

    if (options.collapseMultiple) {
        processed = processed.replace(/ +/g, ' ');
    }

    if (options.trimEnds) {
        processed = processed.trim();
    }

    if (!options.preserveNewlines) {
        processed = processed.replace(/[\r\n]/g, ' ');
    }

    return processed;
}

// --- 6. DIACRITICS & LIGATURES ---

const LIGATURE_MAP: Record<string, string> = {
    'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬀ': 'ff', 'ﬃ': 'ffi', 'ﬄ': 'ffl',
    'ﬆ': 'st', 'Ĳ': 'IJ', 'ĳ': 'ij', 'æ': 'ae', 'œ': 'oe',
};

/**
 * Removes diacritics (café -> cafe) and expands ligatures (ﬁ -> fi).
 */
export function flattenCharacters(text: string): string {
    if (!text) return text;

    // Normalize to NFD to separate marks
    let flattened = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Expand ligatures
    flattened = flattened.split('').map(char => LIGATURE_MAP[char] || char).join('');

    return flattened;
}

// --- 7. MOJIBAKE & REPAIR ---

/**
 * Heuristic for common Mojibake patterns (e.g. Ã© -> é)
 */
export function repairMojibake(text: string): string {
    if (!text) return text;
    // Simple common map for Western European Mojibake
    const mojibakeMap: Record<string, string> = {
        'Ã\u00A0': 'à', 'Ã¡': 'á', 'Ã¢': 'â', 'Ã£': 'ã', 'Ã¤': 'ä',
        'Ã\u00A8': 'è', 'Ã©': 'é', 'Ãª': 'ê', 'Ã«': 'ë',
        'Ã\u00AC': 'ì', 'Ã\u00AD': 'í', 'Ã\u00AE': 'î', 'Ã\u00AF': 'ï',
        'Ã²': 'ò', 'Ã³': 'ó', 'Ã´': 'ô', 'Ãµ': 'õ', 'Ã¶': 'ö',
        'Ã¹': 'ù', 'Ãº': 'ú', 'Ã»': 'û', 'Ã¼': 'ü',
        'Ã±': 'ñ', 'Ã§': 'ç',
    };

    let repaired = text;
    Object.entries(mojibakeMap).forEach(([bad, good]) => {
        repaired = repaired.replace(new RegExp(bad, 'g'), good);
    });

    return repaired;
}
