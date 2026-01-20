/**
 * ENTERPRISE Domain-Specific Validators
 * Industry-standard validation for specialized data types:
 * - Automotive: VIN (Vehicle Identification Number)
 * - Publishing: ISBN-10, ISBN-13
 * - Financial: CUSIP, ISIN, SWIFT, IBAN, ABA Routing
 * - Healthcare: ICD-10, CPT, NDC
 * - Commerce: UPC, EAN, GTIN
 * - Business: DUNS, LEI
 * 
 * Part of the Elite Data Cleaning Layer.
 */

// ============== INTERFACES ==============

export interface ValidationResult {
    isValid: boolean;
    value: string;
    normalizedValue?: string;
    message?: string;
    details?: Record<string, any>;
}

// ============== AUTOMOTIVE ==============

/**
 * Validate Vehicle Identification Number (VIN)
 * 17 alphanumeric characters with check digit at position 9
 */
export function validateVIN(vin: string): ValidationResult {
    if (!vin) return { isValid: false, value: vin, message: 'VIN is empty' };

    const cleaned = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');

    if (cleaned.length !== 17) {
        return {
            isValid: false,
            value: vin,
            message: `VIN must be 17 characters (got ${cleaned.length})`
        };
    }

    // VIN cannot contain I, O, Q
    if (/[IOQ]/.test(cleaned)) {
        return {
            isValid: false,
            value: vin,
            message: 'VIN cannot contain I, O, or Q'
        };
    }

    // Check digit validation (position 9)
    const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
    const transliteration: Record<string, number> = {
        'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5, 'F': 6, 'G': 7, 'H': 8,
        'J': 1, 'K': 2, 'L': 3, 'M': 4, 'N': 5, 'P': 7, 'R': 9,
        'S': 2, 'T': 3, 'U': 4, 'V': 5, 'W': 6, 'X': 7, 'Y': 8, 'Z': 9,
        '0': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9
    };

    let sum = 0;
    for (let i = 0; i < 17; i++) {
        if (i === 8) continue; // Skip check digit position
        const value = transliteration[cleaned[i]];
        if (value === undefined) {
            return { isValid: false, value: vin, message: `Invalid character at position ${i + 1}` };
        }
        sum += value * weights[i];
    }

    const checkDigit = sum % 11;
    const expectedCheck = checkDigit === 10 ? 'X' : String(checkDigit);
    const actualCheck = cleaned[8];

    if (actualCheck !== expectedCheck) {
        return {
            isValid: false,
            value: vin,
            message: `Invalid check digit (expected ${expectedCheck}, got ${actualCheck})`,
            details: { expectedCheckDigit: expectedCheck, actualCheckDigit: actualCheck }
        };
    }

    // Extract year from position 10
    const yearCode = cleaned[9];
    const yearMap: Record<string, number> = {
        'A': 2010, 'B': 2011, 'C': 2012, 'D': 2013, 'E': 2014, 'F': 2015,
        'G': 2016, 'H': 2017, 'J': 2018, 'K': 2019, 'L': 2020, 'M': 2021,
        'N': 2022, 'P': 2023, 'R': 2024, 'S': 2025, 'T': 2026, 'V': 2027,
        'W': 2028, 'X': 2029, 'Y': 2030, '1': 2001, '2': 2002, '3': 2003,
        '4': 2004, '5': 2005, '6': 2006, '7': 2007, '8': 2008, '9': 2009
    };

    return {
        isValid: true,
        value: vin,
        normalizedValue: cleaned,
        details: {
            year: yearMap[yearCode] || 'Unknown',
            manufacturer: cleaned.substring(0, 3),
            serialNumber: cleaned.substring(11)
        }
    };
}

// ============== PUBLISHING ==============

/**
 * Validate ISBN-10
 * 10 digits with check digit using modulo 11
 */
export function validateISBN10(isbn: string): ValidationResult {
    if (!isbn) return { isValid: false, value: isbn, message: 'ISBN is empty' };

    const cleaned = isbn.toUpperCase().replace(/[^0-9X]/g, '');

    if (cleaned.length !== 10) {
        return {
            isValid: false,
            value: isbn,
            message: `ISBN-10 must be 10 characters (got ${cleaned.length})`
        };
    }

    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += parseInt(cleaned[i]) * (10 - i);
    }

    const checkDigit = (11 - (sum % 11)) % 11;
    const expectedCheck = checkDigit === 10 ? 'X' : String(checkDigit);
    const actualCheck = cleaned[9];

    if (actualCheck !== expectedCheck) {
        return {
            isValid: false,
            value: isbn,
            message: `Invalid check digit (expected ${expectedCheck})`
        };
    }

    return {
        isValid: true,
        value: isbn,
        normalizedValue: cleaned,
        details: { format: 'ISBN-10' }
    };
}

/**
 * Validate ISBN-13
 * 13 digits with check digit using modulo 10
 */
export function validateISBN13(isbn: string): ValidationResult {
    if (!isbn) return { isValid: false, value: isbn, message: 'ISBN is empty' };

    const cleaned = isbn.replace(/[^0-9]/g, '');

    if (cleaned.length !== 13) {
        return {
            isValid: false,
            value: isbn,
            message: `ISBN-13 must be 13 digits (got ${cleaned.length})`
        };
    }

    // Must start with 978 or 979
    if (!cleaned.startsWith('978') && !cleaned.startsWith('979')) {
        return {
            isValid: false,
            value: isbn,
            message: 'ISBN-13 must start with 978 or 979'
        };
    }

    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(cleaned[i]) * (i % 2 === 0 ? 1 : 3);
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    const actualCheck = parseInt(cleaned[12]);

    if (actualCheck !== checkDigit) {
        return {
            isValid: false,
            value: isbn,
            message: `Invalid check digit (expected ${checkDigit})`
        };
    }

    return {
        isValid: true,
        value: isbn,
        normalizedValue: cleaned,
        details: { format: 'ISBN-13' }
    };
}

/**
 * Validate ISBN (auto-detect 10 or 13)
 */
export function validateISBN(isbn: string): ValidationResult {
    const cleaned = isbn.replace(/[^0-9X]/gi, '');
    if (cleaned.length === 10) return validateISBN10(isbn);
    if (cleaned.length === 13) return validateISBN13(isbn);
    return {
        isValid: false,
        value: isbn,
        message: `Invalid ISBN length (got ${cleaned.length}, expected 10 or 13)`
    };
}

// ============== FINANCIAL ==============

/**
 * Validate CUSIP (Committee on Uniform Securities Identification Procedures)
 * 9 alphanumeric characters with check digit
 */
export function validateCUSIP(cusip: string): ValidationResult {
    if (!cusip) return { isValid: false, value: cusip, message: 'CUSIP is empty' };

    const cleaned = cusip.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleaned.length !== 9) {
        return {
            isValid: false,
            value: cusip,
            message: `CUSIP must be 9 characters (got ${cleaned.length})`
        };
    }

    let sum = 0;
    for (let i = 0; i < 8; i++) {
        let value: number;
        const char = cleaned[i];

        if (char >= '0' && char <= '9') {
            value = parseInt(char);
        } else if (char >= 'A' && char <= 'Z') {
            value = char.charCodeAt(0) - 55; // A=10, B=11, etc.
        } else {
            return { isValid: false, value: cusip, message: `Invalid character: ${char}` };
        }

        if (i % 2 === 1) {
            value *= 2;
        }

        sum += Math.floor(value / 10) + (value % 10);
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    const actualCheck = parseInt(cleaned[8]);

    if (actualCheck !== checkDigit) {
        return {
            isValid: false,
            value: cusip,
            message: `Invalid check digit (expected ${checkDigit})`
        };
    }

    return { isValid: true, value: cusip, normalizedValue: cleaned };
}

/**
 * Validate ISIN (International Securities Identification Number)
 * 12 characters: 2-letter country code + 9-char NSIN + check digit
 */
export function validateISIN(isin: string): ValidationResult {
    if (!isin) return { isValid: false, value: isin, message: 'ISIN is empty' };

    const cleaned = isin.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleaned.length !== 12) {
        return {
            isValid: false,
            value: isin,
            message: `ISIN must be 12 characters (got ${cleaned.length})`
        };
    }

    // First two must be letters (country code)
    if (!/^[A-Z]{2}/.test(cleaned)) {
        return {
            isValid: false,
            value: isin,
            message: 'ISIN must start with 2-letter country code'
        };
    }

    // Convert letters to numbers (A=10, B=11, ...)
    let digits = '';
    for (const char of cleaned) {
        if (char >= 'A' && char <= 'Z') {
            digits += (char.charCodeAt(0) - 55).toString();
        } else {
            digits += char;
        }
    }

    // Luhn check
    let sum = 0;
    let double = false;
    for (let i = digits.length - 2; i >= 0; i--) {
        let digit = parseInt(digits[i]);
        if (double) {
            digit *= 2;
            if (digit > 9) digit -= 9;
        }
        sum += digit;
        double = !double;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    const actualCheck = parseInt(digits[digits.length - 1]);

    if (actualCheck !== checkDigit) {
        return {
            isValid: false,
            value: isin,
            message: `Invalid check digit (expected ${checkDigit})`
        };
    }

    return {
        isValid: true,
        value: isin,
        normalizedValue: cleaned,
        details: { countryCode: cleaned.substring(0, 2) }
    };
}

/**
 * Validate SWIFT/BIC code
 * 8 or 11 alphanumeric characters
 */
export function validateSWIFT(swift: string): ValidationResult {
    if (!swift) return { isValid: false, value: swift, message: 'SWIFT code is empty' };

    const cleaned = swift.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleaned.length !== 8 && cleaned.length !== 11) {
        return {
            isValid: false,
            value: swift,
            message: `SWIFT must be 8 or 11 characters (got ${cleaned.length})`
        };
    }

    // First 4: bank code (letters only)
    // Next 2: country code (letters only)
    // Next 2: location code (alphanumeric)
    // Last 3 (optional): branch code

    if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(cleaned)) {
        return {
            isValid: false,
            value: swift,
            message: 'Invalid SWIFT format'
        };
    }

    return {
        isValid: true,
        value: swift,
        normalizedValue: cleaned,
        details: {
            bankCode: cleaned.substring(0, 4),
            countryCode: cleaned.substring(4, 6),
            locationCode: cleaned.substring(6, 8),
            branchCode: cleaned.length === 11 ? cleaned.substring(8) : null
        }
    };
}

/**
 * Validate IBAN (International Bank Account Number)
 * Variable length, starts with 2-letter country code
 */
export function validateIBAN(iban: string): ValidationResult {
    if (!iban) return { isValid: false, value: iban, message: 'IBAN is empty' };

    const cleaned = iban.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const countryLengths: Record<string, number> = {
        'AL': 28, 'AD': 24, 'AT': 20, 'AZ': 28, 'BH': 22, 'BY': 28, 'BE': 16,
        'BA': 20, 'BR': 29, 'BG': 22, 'CR': 22, 'HR': 21, 'CY': 28, 'CZ': 24,
        'DK': 18, 'DO': 28, 'EG': 29, 'EE': 20, 'FO': 18, 'FI': 18, 'FR': 27,
        'GE': 22, 'DE': 22, 'GI': 23, 'GR': 27, 'GL': 18, 'GT': 28, 'HU': 28,
        'IS': 26, 'IQ': 23, 'IE': 22, 'IL': 23, 'IT': 27, 'JO': 30, 'KZ': 20,
        'XK': 20, 'KW': 30, 'LV': 21, 'LB': 28, 'LI': 21, 'LT': 20, 'LU': 20,
        'MK': 19, 'MT': 31, 'MR': 27, 'MU': 30, 'MD': 24, 'MC': 27, 'ME': 22,
        'NL': 18, 'NO': 15, 'PK': 24, 'PS': 29, 'PL': 28, 'PT': 25, 'QA': 29,
        'RO': 24, 'LC': 32, 'SM': 27, 'ST': 25, 'SA': 24, 'RS': 22, 'SC': 31,
        'SK': 24, 'SI': 19, 'ES': 24, 'SE': 24, 'CH': 21, 'TL': 23, 'TN': 24,
        'TR': 26, 'UA': 29, 'AE': 23, 'GB': 22, 'VA': 22, 'VG': 24
    };

    const countryCode = cleaned.substring(0, 2);
    const expectedLength = countryLengths[countryCode];

    if (!expectedLength) {
        return {
            isValid: false,
            value: iban,
            message: `Unknown country code: ${countryCode}`
        };
    }

    if (cleaned.length !== expectedLength) {
        return {
            isValid: false,
            value: iban,
            message: `Wrong length for ${countryCode} IBAN (expected ${expectedLength}, got ${cleaned.length})`
        };
    }

    // Mod 97 check
    const rearranged = cleaned.substring(4) + cleaned.substring(0, 4);
    let digits = '';
    for (const char of rearranged) {
        if (char >= 'A' && char <= 'Z') {
            digits += (char.charCodeAt(0) - 55).toString();
        } else {
            digits += char;
        }
    }

    // Calculate mod 97 using string manipulation (to handle large numbers)
    let remainder = 0;
    for (const digit of digits) {
        remainder = (remainder * 10 + parseInt(digit)) % 97;
    }

    if (remainder !== 1) {
        return {
            isValid: false,
            value: iban,
            message: 'Invalid IBAN check digits'
        };
    }

    return {
        isValid: true,
        value: iban,
        normalizedValue: cleaned,
        details: { countryCode }
    };
}

/**
 * Validate ABA Routing Number (US bank routing number)
 * 9 digits with check digit
 */
export function validateABA(routing: string): ValidationResult {
    if (!routing) return { isValid: false, value: routing, message: 'Routing number is empty' };

    const cleaned = routing.replace(/[^0-9]/g, '');

    if (cleaned.length !== 9) {
        return {
            isValid: false,
            value: routing,
            message: `Routing number must be 9 digits (got ${cleaned.length})`
        };
    }

    // Checksum validation
    const digits = cleaned.split('').map(Number);
    const checksum =
        3 * (digits[0] + digits[3] + digits[6]) +
        7 * (digits[1] + digits[4] + digits[7]) +
        1 * (digits[2] + digits[5] + digits[8]);

    if (checksum % 10 !== 0) {
        return {
            isValid: false,
            value: routing,
            message: 'Invalid routing number checksum'
        };
    }

    // First two digits must be valid Federal Reserve routing symbol
    const prefix = parseInt(cleaned.substring(0, 2));
    const validPrefixes = [
        ...Array.from({ length: 12 }, (_, i) => i + 1), // 01-12
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, // More ranges
        61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 80
    ];

    if (!validPrefixes.includes(prefix)) {
        return {
            isValid: false,
            value: routing,
            message: `Invalid Federal Reserve routing symbol: ${prefix}`
        };
    }

    return { isValid: true, value: routing, normalizedValue: cleaned };
}

// ============== HEALTHCARE ==============

/**
 * Validate ICD-10 code (basic format validation)
 * Format: Letter + 2 digits + optional decimal + more alphanumerics
 */
export function validateICD10(code: string): ValidationResult {
    if (!code) return { isValid: false, value: code, message: 'ICD-10 code is empty' };

    const cleaned = code.toUpperCase().replace(/[\s.-]/g, '');

    // Basic format: A00-Z99.XXX
    if (!/^[A-Z][0-9]{2}([A-Z0-9]{0,4})?$/.test(cleaned)) {
        return {
            isValid: false,
            value: code,
            message: 'Invalid ICD-10 format (expected Letter + 2 digits + optional extension)'
        };
    }

    // Format nicely
    const formatted = cleaned.length > 3
        ? cleaned.substring(0, 3) + '.' + cleaned.substring(3)
        : cleaned;

    return {
        isValid: true,
        value: code,
        normalizedValue: formatted,
        details: { category: cleaned.substring(0, 3) }
    };
}

/**
 * Validate CPT code (Current Procedural Terminology)
 * 5 digits, optionally with modifier
 */
export function validateCPT(code: string): ValidationResult {
    if (!code) return { isValid: false, value: code, message: 'CPT code is empty' };

    const cleaned = code.replace(/[\s-]/g, '');

    // Format: 5 digits, optionally followed by modifier (-XX)
    if (!/^[0-9]{5}(-[0-9A-Z]{2})?$/.test(cleaned)) {
        return {
            isValid: false,
            value: code,
            message: 'Invalid CPT format (expected 5 digits, optional -XX modifier)'
        };
    }

    return { isValid: true, value: code, normalizedValue: cleaned };
}

/**
 * Validate NDC code (National Drug Code)
 * Various formats: 4-4-2, 5-3-2, 5-4-1, 5-4-2
 */
export function validateNDC(ndc: string): ValidationResult {
    if (!ndc) return { isValid: false, value: ndc, message: 'NDC is empty' };

    const cleaned = ndc.replace(/[\s-]/g, '');

    // NDC is typically 10 or 11 digits
    if (!/^[0-9]{10,11}$/.test(cleaned)) {
        return {
            isValid: false,
            value: ndc,
            message: 'NDC must be 10-11 digits'
        };
    }

    // Format as 5-4-2 (standard)
    let formatted = cleaned;
    if (cleaned.length === 10) {
        // Could be 4-4-2, 5-3-2, or 5-4-1
        formatted = `${cleaned.substring(0, 5)}-${cleaned.substring(5, 9)}-${cleaned.substring(9)}`;
    } else if (cleaned.length === 11) {
        formatted = `${cleaned.substring(0, 5)}-${cleaned.substring(5, 9)}-${cleaned.substring(9)}`;
    }

    return { isValid: true, value: ndc, normalizedValue: formatted };
}

// ============== COMMERCE ==============

/**
 * Validate UPC-A (Universal Product Code)
 * 12 digits with check digit
 */
export function validateUPC(upc: string): ValidationResult {
    if (!upc) return { isValid: false, value: upc, message: 'UPC is empty' };

    const cleaned = upc.replace(/[^0-9]/g, '');

    if (cleaned.length !== 12) {
        return {
            isValid: false,
            value: upc,
            message: `UPC-A must be 12 digits (got ${cleaned.length})`
        };
    }

    // Calculate check digit
    let sum = 0;
    for (let i = 0; i < 11; i++) {
        sum += parseInt(cleaned[i]) * (i % 2 === 0 ? 3 : 1);
    }
    const checkDigit = (10 - (sum % 10)) % 10;

    if (checkDigit !== parseInt(cleaned[11])) {
        return {
            isValid: false,
            value: upc,
            message: `Invalid check digit (expected ${checkDigit})`
        };
    }

    return { isValid: true, value: upc, normalizedValue: cleaned };
}

/**
 * Validate EAN-13 (European Article Number)
 * 13 digits with check digit
 */
export function validateEAN(ean: string): ValidationResult {
    if (!ean) return { isValid: false, value: ean, message: 'EAN is empty' };

    const cleaned = ean.replace(/[^0-9]/g, '');

    if (cleaned.length !== 13) {
        return {
            isValid: false,
            value: ean,
            message: `EAN-13 must be 13 digits (got ${cleaned.length})`
        };
    }

    // Calculate check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += parseInt(cleaned[i]) * (i % 2 === 0 ? 1 : 3);
    }
    const checkDigit = (10 - (sum % 10)) % 10;

    if (checkDigit !== parseInt(cleaned[12])) {
        return {
            isValid: false,
            value: ean,
            message: `Invalid check digit (expected ${checkDigit})`
        };
    }

    return { isValid: true, value: ean, normalizedValue: cleaned };
}

/**
 * Validate GTIN (Global Trade Item Number)
 * Can be 8, 12, 13, or 14 digits
 */
export function validateGTIN(gtin: string): ValidationResult {
    if (!gtin) return { isValid: false, value: gtin, message: 'GTIN is empty' };

    const cleaned = gtin.replace(/[^0-9]/g, '');

    if (![8, 12, 13, 14].includes(cleaned.length)) {
        return {
            isValid: false,
            value: gtin,
            message: `GTIN must be 8, 12, 13, or 14 digits (got ${cleaned.length})`
        };
    }

    // Pad to 14 digits for uniform check
    const padded = cleaned.padStart(14, '0');

    // Calculate check digit
    let sum = 0;
    for (let i = 0; i < 13; i++) {
        sum += parseInt(padded[i]) * (i % 2 === 0 ? 3 : 1);
    }
    const checkDigit = (10 - (sum % 10)) % 10;

    if (checkDigit !== parseInt(padded[13])) {
        return {
            isValid: false,
            value: gtin,
            message: `Invalid check digit (expected ${checkDigit})`
        };
    }

    return {
        isValid: true,
        value: gtin,
        normalizedValue: cleaned,
        details: { format: `GTIN-${cleaned.length}` }
    };
}

// ============== BUSINESS ==============

/**
 * Validate DUNS number (Data Universal Numbering System)
 * 9 digits
 */
export function validateDUNS(duns: string): ValidationResult {
    if (!duns) return { isValid: false, value: duns, message: 'DUNS is empty' };

    const cleaned = duns.replace(/[^0-9]/g, '');

    if (cleaned.length !== 9) {
        return {
            isValid: false,
            value: duns,
            message: `DUNS must be 9 digits (got ${cleaned.length})`
        };
    }

    // DUNS doesn't have a formal check digit algorithm
    // But we can format it nicely
    const formatted = `${cleaned.substring(0, 2)}-${cleaned.substring(2, 5)}-${cleaned.substring(5)}`;

    return { isValid: true, value: duns, normalizedValue: formatted };
}

/**
 * Validate LEI (Legal Entity Identifier)
 * 20 alphanumeric characters
 */
export function validateLEI(lei: string): ValidationResult {
    if (!lei) return { isValid: false, value: lei, message: 'LEI is empty' };

    const cleaned = lei.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (cleaned.length !== 20) {
        return {
            isValid: false,
            value: lei,
            message: `LEI must be 20 characters (got ${cleaned.length})`
        };
    }

    // Format: 4 char LOU + 14 char entity + 2 check digits
    // Mod 97 validation (similar to IBAN)
    let digits = '';
    for (const char of cleaned) {
        if (char >= 'A' && char <= 'Z') {
            digits += (char.charCodeAt(0) - 55).toString();
        } else {
            digits += char;
        }
    }

    // Calculate mod 97
    let remainder = 0;
    for (const digit of digits) {
        remainder = (remainder * 10 + parseInt(digit)) % 97;
    }

    if (remainder !== 1) {
        return {
            isValid: false,
            value: lei,
            message: 'Invalid LEI check digits'
        };
    }

    return {
        isValid: true,
        value: lei,
        normalizedValue: cleaned,
        details: { lou: cleaned.substring(0, 4) }
    };
}

// ============== AUTO-DETECT & BATCH VALIDATION ==============

/**
 * Auto-detect the type of identifier and validate
 */
export function autoDetectAndValidate(value: string): ValidationResult & { detectedType?: string } {
    const cleaned = value.replace(/[\s-]/g, '');

    // Try to detect based on format
    if (cleaned.length === 17 && /^[A-HJ-NPR-Z0-9]+$/i.test(cleaned)) {
        return { ...validateVIN(value), detectedType: 'VIN' };
    }

    if (cleaned.length === 9 && /^[0-9]+$/.test(cleaned)) {
        // Could be DUNS or ABA
        const aba = validateABA(value);
        if (aba.isValid) return { ...aba, detectedType: 'ABA' };
        return { ...validateDUNS(value), detectedType: 'DUNS' };
    }

    if (cleaned.length === 12 && /^[A-Z]{2}/.test(cleaned)) {
        return { ...validateISIN(value), detectedType: 'ISIN' };
    }

    if (cleaned.length === 20 && /^[A-Z0-9]+$/i.test(cleaned)) {
        return { ...validateLEI(value), detectedType: 'LEI' };
    }

    if ((cleaned.length === 8 || cleaned.length === 11) && /^[A-Z]{4}[A-Z]{2}/.test(cleaned)) {
        return { ...validateSWIFT(value), detectedType: 'SWIFT' };
    }

    if (/^[A-Z]{2}[0-9]{2}/.test(cleaned) && cleaned.length >= 15) {
        return { ...validateIBAN(value), detectedType: 'IBAN' };
    }

    if (cleaned.length === 10 || cleaned.length === 13) {
        const isbn = validateISBN(value);
        if (isbn.isValid) return { ...isbn, detectedType: cleaned.length === 10 ? 'ISBN-10' : 'ISBN-13' };
    }

    if (cleaned.length === 12 && /^[0-9]+$/.test(cleaned)) {
        return { ...validateUPC(value), detectedType: 'UPC' };
    }

    if (cleaned.length === 13 && /^[0-9]+$/.test(cleaned)) {
        return { ...validateEAN(value), detectedType: 'EAN' };
    }

    if (/^[A-Z][0-9]{2}/.test(cleaned)) {
        return { ...validateICD10(value), detectedType: 'ICD-10' };
    }

    return {
        isValid: false,
        value,
        message: 'Unable to detect identifier type'
    };
}

/**
 * Batch validate a column with a specific validator
 */
export function batchValidate(
    values: string[],
    validator: (value: string) => ValidationResult
): { valid: number; invalid: number; issues: Array<{ index: number; result: ValidationResult }> } {
    let valid = 0;
    let invalid = 0;
    const issues: Array<{ index: number; result: ValidationResult }> = [];

    values.forEach((value, index) => {
        const result = validator(value);
        if (result.isValid) {
            valid++;
        } else {
            invalid++;
            issues.push({ index, result });
        }
    });

    return { valid, invalid, issues };
}
