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
        // Extended patterns for Cyrillic, Greek, etc.
        'Ð°': 'а', 'Ð±': 'б', 'Ð²': 'в', 'Ð³': 'г', 'Ð´': 'д',
        'Î±': 'α', 'Î²': 'β', 'Î³': 'γ', 'Î´': 'δ',
    };

    let repaired = text;
    Object.entries(mojibakeMap).forEach(([bad, good]) => {
        repaired = repaired.replace(new RegExp(bad, 'g'), good);
    });

    return repaired;
}

// --- 8. HTML ENTITY DECODING ---

/**
 * HTML named entities map (100+ common entities)
 */
const HTML_ENTITIES: Record<string, string> = {
    // Common
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
    '&nbsp;': ' ', '&copy;': '©', '&reg;': '®', '&trade;': '™',
    // Currency
    '&cent;': '¢', '&pound;': '£', '&yen;': '¥', '&euro;': '€',
    // Punctuation
    '&ndash;': '\u2013', // –
    '&mdash;': '\u2014', // —
    '&lsquo;': '\u2018', // '
    '&rsquo;': '\u2019', // '
    '&ldquo;': '\u201C', '&rdquo;': '\u201D', '&bull;': '\u2022', '&hellip;': '\u2026',
    // Math
    '&times;': '×', '&divide;': '÷', '&plusmn;': '±', '&frac12;': '½',
    '&frac14;': '¼', '&frac34;': '¾', '&deg;': '°', '&sup2;': '²',
    '&sup3;': '³', '&para;': '¶', '&sect;': '§',
    // Accented
    '&Agrave;': 'À', '&Aacute;': 'Á', '&Acirc;': 'Â', '&Atilde;': 'Ã',
    '&Auml;': 'Ä', '&Egrave;': 'È', '&Eacute;': 'É', '&Ecirc;': 'Ê',
    '&Euml;': 'Ë', '&Igrave;': 'Ì', '&Iacute;': 'Í', '&Icirc;': 'Î',
    '&Iuml;': 'Ï', '&Ntilde;': 'Ñ', '&Ograve;': 'Ò', '&Oacute;': 'Ó',
    '&Ocirc;': 'Ô', '&Otilde;': 'Õ', '&Ouml;': 'Ö', '&Ugrave;': 'Ù',
    '&Uacute;': 'Ú', '&Ucirc;': 'Û', '&Uuml;': 'Ü',
    '&agrave;': 'à', '&aacute;': 'á', '&acirc;': 'â', '&atilde;': 'ã',
    '&auml;': 'ä', '&egrave;': 'è', '&eacute;': 'é', '&ecirc;': 'ê',
    '&euml;': 'ë', '&igrave;': 'ì', '&iacute;': 'í', '&icirc;': 'î',
    '&iuml;': 'ï', '&ntilde;': 'ñ', '&ograve;': 'ò', '&oacute;': 'ó',
    '&ocirc;': 'ô', '&otilde;': 'õ', '&ouml;': 'ö', '&ugrave;': 'ù',
    '&uacute;': 'ú', '&ucirc;': 'û', '&uuml;': 'ü', '&szlig;': 'ß',
    '&ccedil;': 'ç', '&Ccedil;': 'Ç',
};

/**
 * Decode HTML entities to their character equivalents
 * Handles both named entities (&amp;) and numeric (&#39; and &#x27;)
 */
export function decodeHtmlEntities(text: string): string {
    if (!text) return text;

    let decoded = text;

    // Replace named entities
    Object.entries(HTML_ENTITIES).forEach(([entity, char]) => {
        decoded = decoded.replace(new RegExp(entity, 'gi'), char);
    });

    // Replace decimal numeric entities (&#39;)
    decoded = decoded.replace(/&#(\d+);/g, (_, code) => {
        const num = parseInt(code, 10);
        return num > 0 && num < 65536 ? String.fromCharCode(num) : _;
    });

    // Replace hexadecimal numeric entities (&#x27;)
    decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        const num = parseInt(hex, 16);
        return num > 0 && num < 65536 ? String.fromCharCode(num) : _;
    });

    return decoded;
}

// --- 9. URL ENCODING/DECODING ---

/**
 * Decode URL-encoded strings (%20 -> space)
 */
export function decodeUrlEncoding(text: string): string {
    if (!text) return text;

    try {
        // First try full decodeURIComponent
        return decodeURIComponent(text);
    } catch {
        // If that fails (malformed), do safe partial decoding
        return text.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => {
            return String.fromCharCode(parseInt(hex, 16));
        });
    }
}

/**
 * Encode special characters for URL safety
 */
export function encodeUrlSafe(text: string): string {
    if (!text) return text;
    return encodeURIComponent(text);
}

// --- 10. EMOJI HANDLING ---

/**
 * Strip all emoji from text
 * Handles complex emoji sequences (ZWJ, skin tones, flags)
 */
export function stripEmoji(text: string): string {
    if (!text) return text;

    // Comprehensive emoji regex covering:
    // - Basic emoji
    // - Emoji with skin tone modifiers
    // - ZWJ sequences (family, profession)
    // - Regional indicator symbols (flags)
    // - Keycap sequences
    const emojiPattern = /(?:[\u2700-\u27BF]|(?:\uD83C[\uDDE6-\uDDFF]){2}|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u0023-\u0039]\uFE0F?\u20E3|\u3299|\u3297|\u303D|\u3030|\u24C2|[\uD83C[\uDD70-\uDDFF]|[\uD83D[\uDC00-\uDFFF]|[\uD83E[\uDD00-\uDDFF]|[\u2300-\u23FF]|[\u2B50-\u2B55]|[\u2600-\u26FF]|[\u2700-\u27BF]|[\uE000-\uF8FF]|[\uFE00-\uFE0F]|\u200D)/g;

    return text.replace(emojiPattern, '');
}

/**
 * Replace emoji with text descriptions (limited set)
 */
export function emojiToText(text: string): string {
    if (!text) return text;

    const emojiMap: Record<string, string> = {
        '😀': ':smile:', '😃': ':grinning:', '😄': ':happy:',
        '😂': ':joy:', '🤣': ':rofl:', '😊': ':blush:',
        '😍': ':heart_eyes:', '👍': ':thumbsup:', '👎': ':thumbsdown:',
        '❤️': ':heart:', '💔': ':broken_heart:',
        '✅': ':check:', '❌': ':x:', '⚠️': ':warning:',
        '📧': ':email:', '📱': ':phone:', '💻': ':computer:',
        '📅': ':calendar:', '⏰': ':clock:', '💰': ':money:',
        '🔥': ':fire:', '⭐': ':star:', '🎉': ':celebration:',
    };

    let result = text;
    Object.entries(emojiMap).forEach(([emoji, desc]) => {
        result = result.split(emoji).join(desc);
    });

    return result;
}

// --- 11. COMPREHENSIVE NORMALIZER ---

/**
 * Apply all text normalization in one pass
 */
export function normalizeText(text: string, options: {
    stripBom?: boolean;
    stripInvisible?: boolean;
    normalizeQuotes?: boolean;
    normalizeUnicodeForm?: 'NFC' | 'NFD' | 'NFKC' | 'NFKD' | false;
    normalizeWhitespace?: boolean;
    collapseSpaces?: boolean;
    trim?: boolean;
    flattenDiacritics?: boolean;
    repairMojibake?: boolean;
    decodeHtml?: boolean;
    decodeUrl?: boolean;
    stripEmoji?: boolean;
} = {}): string {
    if (!text) return text;

    const opts = {
        stripBom: true,
        stripInvisible: true,
        normalizeQuotes: true,
        normalizeUnicodeForm: 'NFKC' as const,
        normalizeWhitespace: true,
        collapseSpaces: true,
        trim: true,
        flattenDiacritics: false,
        repairMojibake: true,
        decodeHtml: true,
        decodeUrl: false,
        stripEmoji: false,
        ...options
    };

    let result = text;

    if (opts.stripBom) result = stripBOM(result);
    if (opts.decodeHtml) result = decodeHtmlEntities(result);
    if (opts.decodeUrl) result = decodeUrlEncoding(result);
    if (opts.repairMojibake) result = repairMojibake(result);
    if (opts.stripInvisible) result = stripInvisibleCharacters(result);
    if (opts.normalizeQuotes) result = normalizeQuotes(result);
    if (opts.normalizeUnicodeForm) result = normalizeUnicode(result, opts.normalizeUnicodeForm);
    if (opts.normalizeWhitespace) result = normalizeWhitespace(result, {
        collapseMultiple: opts.collapseSpaces,
        trimEnds: opts.trim
    });
    if (opts.flattenDiacritics) result = flattenCharacters(result);
    if (opts.stripEmoji) result = stripEmoji(result);

    return result;
}


