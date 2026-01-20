/**
 * ENTERPRISE Fuzzy Duplicate Detection Engine
 * Detects near-duplicates in data using multiple algorithms:
 * - Levenshtein distance
 * - Jaro-Winkler similarity
 * - Soundex phonetic matching
 * - Metaphone phonetic matching
 * - Company/entity normalization
 * - Address/phone/email standardization
 * 
 * Part of the Elite Data Cleaning Layer.
 */

// ============== DUPLICATE RESULT INTERFACES ==============

export interface DuplicateResult {
    index1: number;
    index2: number;
    value1: string;
    value2: string;
    similarity: number;
    method: 'levenshtein' | 'jaro-winkler' | 'soundex' | 'metaphone' | 'exact';
}

export interface DuplicateGroup {
    canonical: string;
    indices: number[];
    values: string[];
}

// ============== STRING SIMILARITY ALGORITHMS ==============

/**
 * Levenshtein distance - minimum edits to transform a into b
 */
export function levenshteinDistance(a: string, b: string): number {
    if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);

    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1,     // insertion
                    matrix[i - 1][j] + 1      // deletion
                );
            }
        }
    }

    return matrix[b.length][a.length];
}

/**
 * Levenshtein similarity as a ratio (0-1)
 */
export function levenshteinSimilarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - levenshteinDistance(a, b) / maxLen;
}

/**
 * Jaro similarity - accounts for character transpositions
 */
export function jaroSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (!s1 || !s2) return 0;

    const len1 = s1.length;
    const len2 = s2.length;
    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;

    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < len1; i++) {
        const start = Math.max(0, i - matchWindow);
        const end = Math.min(i + matchWindow + 1, len2);

        for (let j = start; j < end; j++) {
            if (s2Matches[j] || s1[i] !== s2[j]) continue;
            s1Matches[i] = true;
            s2Matches[j] = true;
            matches++;
            break;
        }
    }

    if (matches === 0) return 0;

    // Count transpositions
    let k = 0;
    for (let i = 0; i < len1; i++) {
        if (!s1Matches[i]) continue;
        while (!s2Matches[k]) k++;
        if (s1[i] !== s2[k]) transpositions++;
        k++;
    }

    return (
        matches / len1 +
        matches / len2 +
        (matches - transpositions / 2) / matches
    ) / 3;
}

/**
 * Jaro-Winkler similarity - adds prefix bonus to Jaro
 * Better for names with common prefixes
 */
export function jaroWinklerSimilarity(s1: string, s2: string, prefixScale: number = 0.1): number {
    const jaroScore = jaroSimilarity(s1, s2);

    // Find common prefix (max 4 characters)
    let prefixLength = 0;
    const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));

    for (let i = 0; i < maxPrefix; i++) {
        if (s1[i] === s2[i]) {
            prefixLength++;
        } else {
            break;
        }
    }

    return jaroScore + prefixLength * prefixScale * (1 - jaroScore);
}

// ============== PHONETIC ALGORITHMS ==============

/**
 * Soundex - phonetic algorithm for English names
 * Returns a 4-character code
 */
export function soundex(word: string): string {
    if (!word) return '0000';

    const chars = word.toUpperCase().split('');
    const first = chars[0];

    const codes: Record<string, string> = {
        'B': '1', 'F': '1', 'P': '1', 'V': '1',
        'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
        'D': '3', 'T': '3',
        'L': '4',
        'M': '5', 'N': '5',
        'R': '6'
    };

    const encoded = chars
        .map(c => codes[c] || '')
        .filter((code, i, arr) => code && (i === 0 || code !== arr[i - 1]))
        .join('');

    return (first + encoded.slice(1) + '000').slice(0, 4);
}

/**
 * Metaphone - more accurate phonetic algorithm than Soundex
 * Based on the original Metaphone algorithm
 */
export function metaphone(word: string): string {
    if (!word) return '';

    let s = word.toUpperCase();
    const vowels = 'AEIOU';
    let result = '';

    // Special first letter handling
    const firstTwo = s.slice(0, 2);
    if (['KN', 'GN', 'PN', 'AE', 'WR'].includes(firstTwo)) {
        s = s.slice(1);
    } else if (s[0] === 'X') {
        s = 'S' + s.slice(1);
    } else if (firstTwo === 'WH') {
        s = 'W' + s.slice(2);
    }

    for (let i = 0; i < s.length && result.length < 6; i++) {
        const c = s[i];
        const prev = s[i - 1] || '';
        const next = s[i + 1] || '';
        const next2 = s[i + 2] || '';

        // Skip duplicate consonants (except C)
        if (c === prev && c !== 'C') continue;

        switch (c) {
            case 'A': case 'E': case 'I': case 'O': case 'U':
                if (i === 0) result += c;
                break;
            case 'B':
                if (prev !== 'M' || i !== s.length - 1) result += 'B';
                break;
            case 'C':
                if (next === 'H') {
                    result += 'X';
                    i++;
                } else if (next === 'I' || next === 'E' || next === 'Y') {
                    result += 'S';
                } else {
                    result += 'K';
                }
                break;
            case 'D':
                if (next === 'G' && (next2 === 'E' || next2 === 'I' || next2 === 'Y')) {
                    result += 'J';
                    i++;
                } else {
                    result += 'T';
                }
                break;
            case 'F': result += 'F'; break;
            case 'G':
                if (next === 'H') {
                    if (!vowels.includes(s[i - 2] || '')) result += 'F';
                    i++;
                } else if (next === 'N' && !s[i + 2]) {
                    // GN at end - silent
                } else if (next === 'I' || next === 'E' || next === 'Y') {
                    result += 'J';
                } else {
                    result += 'K';
                }
                break;
            case 'H':
                if (vowels.includes(prev) || vowels.includes(next)) {
                    if (vowels.includes(next)) result += 'H';
                }
                break;
            case 'J': result += 'J'; break;
            case 'K':
                if (prev !== 'C') result += 'K';
                break;
            case 'L': result += 'L'; break;
            case 'M': result += 'M'; break;
            case 'N': result += 'N'; break;
            case 'P':
                if (next === 'H') {
                    result += 'F';
                    i++;
                } else {
                    result += 'P';
                }
                break;
            case 'Q': result += 'K'; break;
            case 'R': result += 'R'; break;
            case 'S':
                if (next === 'H') {
                    result += 'X';
                    i++;
                } else if (next === 'I' && (next2 === 'O' || next2 === 'A')) {
                    result += 'X';
                } else {
                    result += 'S';
                }
                break;
            case 'T':
                if (next === 'H') {
                    result += '0'; // Represents 'TH' sound
                    i++;
                } else if (next === 'I' && (next2 === 'O' || next2 === 'A')) {
                    result += 'X';
                } else {
                    result += 'T';
                }
                break;
            case 'V': result += 'F'; break;
            case 'W':
                if (vowels.includes(next)) result += 'W';
                break;
            case 'X': result += 'KS'; break;
            case 'Y':
                if (vowels.includes(next)) result += 'Y';
                break;
            case 'Z': result += 'S'; break;
        }
    }

    return result;
}

// ============== ENTITY NORMALIZATION ==============

/**
 * Normalize company names for comparison
 * "ABC Corp." → "abc corporation"
 */
export function normalizeCompanyName(name: string): string {
    if (!name) return '';

    let result = name.toLowerCase().trim();

    // Expand common abbreviations
    const expansions: Record<string, string> = {
        'corp': 'corporation',
        'corp.': 'corporation',
        'inc': 'incorporated',
        'inc.': 'incorporated',
        'ltd': 'limited',
        'ltd.': 'limited',
        'llc': 'limited liability company',
        'l.l.c.': 'limited liability company',
        'llp': 'limited liability partnership',
        'l.l.p.': 'limited liability partnership',
        'plc': 'public limited company',
        'p.l.c.': 'public limited company',
        'co': 'company',
        'co.': 'company',
        'bros': 'brothers',
        'bros.': 'brothers',
        'intl': 'international',
        'intl.': 'international',
        'assoc': 'associates',
        'assoc.': 'associates',
        'mfg': 'manufacturing',
        'mfg.': 'manufacturing',
        'svcs': 'services',
        'svcs.': 'services',
        '&': 'and',
    };

    // Replace abbreviations with expanded forms
    for (const [abbr, full] of Object.entries(expansions)) {
        const regex = new RegExp(`\\b${abbr.replace('.', '\\.')}\\b`, 'gi');
        result = result.replace(regex, full);
    }

    // Remove special characters but keep alphanumeric and spaces
    result = result.replace(/[^\w\s]/g, ' ');

    // Collapse multiple spaces
    result = result.replace(/\s+/g, ' ').trim();

    return result;
}

/**
 * Normalize address for comparison
 * "123 Main St. Suite 5" → "123 main street suite 5"
 */
export function normalizeAddress(address: string): string {
    if (!address) return '';

    let result = address.toLowerCase().trim();

    const expansions: Record<string, string> = {
        'st': 'street', 'st.': 'street',
        'ave': 'avenue', 'ave.': 'avenue',
        'blvd': 'boulevard', 'blvd.': 'boulevard',
        'rd': 'road', 'rd.': 'road',
        'dr': 'drive', 'dr.': 'drive',
        'ln': 'lane', 'ln.': 'lane',
        'ct': 'court', 'ct.': 'court',
        'cir': 'circle', 'cir.': 'circle',
        'pl': 'place', 'pl.': 'place',
        'pkwy': 'parkway', 'pkwy.': 'parkway',
        'hwy': 'highway', 'hwy.': 'highway',
        'apt': 'apartment', 'apt.': 'apartment',
        'ste': 'suite', 'ste.': 'suite',
        'fl': 'floor', 'fl.': 'floor',
        'bldg': 'building', 'bldg.': 'building',
        'n': 'north', 'n.': 'north',
        's': 'south', 's.': 'south',
        'e': 'east', 'e.': 'east',
        'w': 'west', 'w.': 'west',
        'ne': 'northeast', 'nw': 'northwest',
        'se': 'southeast', 'sw': 'southwest',
    };

    // Handle word boundaries for directional abbreviations
    for (const [abbr, full] of Object.entries(expansions)) {
        const regex = new RegExp(`\\b${abbr.replace('.', '\\.')}\\b`, 'gi');
        result = result.replace(regex, full);
    }

    // Remove special characters
    result = result.replace(/[^\w\s]/g, ' ');
    result = result.replace(/\s+/g, ' ').trim();

    return result;
}

/**
 * Normalize phone number to digits only
 * "+1 (555) 123-4567" → "15551234567"
 */
export function normalizePhoneNumber(phone: string): string {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
}

/**
 * Normalize email for comparison (lowercase, remove dots before @)
 * "John.Smith@Gmail.com" → "johnsmith@gmail.com"
 */
export function normalizeEmail(email: string): string {
    if (!email) return '';

    const parts = email.toLowerCase().trim().split('@');
    if (parts.length !== 2) return email.toLowerCase().trim();

    // Remove dots from local part (Gmail ignores them)
    const localPart = parts[0].replace(/\./g, '');

    return `${localPart}@${parts[1]}`;
}

/**
 * Generic text normalization for fuzzy matching
 */
export function normalizeText(text: string): string {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ============== MAIN DUPLICATE DETECTION ==============

/**
 * Find fuzzy duplicates in a data array based on a specific column
 */
export function findFuzzyDuplicates(
    data: any[],
    column: string,
    options: {
        threshold?: number;
        method?: 'auto' | 'levenshtein' | 'jaro-winkler' | 'soundex' | 'metaphone';
        normalize?: 'company' | 'address' | 'phone' | 'email' | 'text' | 'none';
        maxComparisons?: number;
    } = {}
): DuplicateResult[] {
    const {
        threshold = 0.85,
        method = 'auto',
        normalize = 'text',
        maxComparisons = 100000
    } = options;

    const results: DuplicateResult[] = [];

    // Extract and normalize values
    const values: { index: number; original: string; normalized: string }[] = [];

    for (let i = 0; i < data.length; i++) {
        const original = String(data[i][column] || '').trim();
        if (!original) continue;

        let normalized = original;
        switch (normalize) {
            case 'company': normalized = normalizeCompanyName(original); break;
            case 'address': normalized = normalizeAddress(original); break;
            case 'phone': normalized = normalizePhoneNumber(original); break;
            case 'email': normalized = normalizeEmail(original); break;
            case 'text': normalized = normalizeText(original); break;
        }

        values.push({ index: i, original, normalized });
    }

    // Limit comparisons for performance
    let comparisons = 0;

    // Compare all pairs
    for (let i = 0; i < values.length; i++) {
        for (let j = i + 1; j < values.length; j++) {
            if (comparisons++ > maxComparisons) break;

            const v1 = values[i];
            const v2 = values[j];

            // Quick exact match check
            if (v1.normalized === v2.normalized) {
                results.push({
                    index1: v1.index,
                    index2: v2.index,
                    value1: v1.original,
                    value2: v2.original,
                    similarity: 1,
                    method: 'exact'
                });
                continue;
            }

            let similarity = 0;
            let usedMethod: DuplicateResult['method'] = 'levenshtein';

            if (method === 'auto') {
                // Use Jaro-Winkler for names (generally best for names)
                const jwSim = jaroWinklerSimilarity(v1.normalized, v2.normalized);

                // Also check phonetic if Jaro-Winkler is close
                if (jwSim >= threshold * 0.9) {
                    const s1 = soundex(v1.normalized);
                    const s2 = soundex(v2.normalized);
                    if (s1 === s2 && s1 !== '0000') {
                        similarity = Math.max(jwSim, 0.9); // Phonetic match bonus
                        usedMethod = 'soundex';
                    } else {
                        similarity = jwSim;
                        usedMethod = 'jaro-winkler';
                    }
                } else {
                    similarity = jwSim;
                    usedMethod = 'jaro-winkler';
                }
            } else if (method === 'jaro-winkler') {
                similarity = jaroWinklerSimilarity(v1.normalized, v2.normalized);
                usedMethod = 'jaro-winkler';
            } else if (method === 'levenshtein') {
                similarity = levenshteinSimilarity(v1.normalized, v2.normalized);
                usedMethod = 'levenshtein';
            } else if (method === 'soundex') {
                const s1 = soundex(v1.normalized);
                const s2 = soundex(v2.normalized);
                similarity = s1 === s2 ? 1 : 0;
                usedMethod = 'soundex';
            } else if (method === 'metaphone') {
                const m1 = metaphone(v1.normalized);
                const m2 = metaphone(v2.normalized);
                similarity = m1 === m2 ? 1 : 0;
                usedMethod = 'metaphone';
            }

            if (similarity >= threshold) {
                results.push({
                    index1: v1.index,
                    index2: v2.index,
                    value1: v1.original,
                    value2: v2.original,
                    similarity,
                    method: usedMethod
                });
            }
        }

        if (comparisons > maxComparisons) break;
    }

    // Sort by similarity descending
    results.sort((a, b) => b.similarity - a.similarity);

    return results;
}

/**
 * Group duplicates into clusters with a canonical value
 */
export function groupDuplicates(results: DuplicateResult[]): DuplicateGroup[] {
    const groups: Map<number, Set<number>> = new Map();
    const valueMap: Map<number, string> = new Map();

    // Build initial groups from pairs
    for (const result of results) {
        valueMap.set(result.index1, result.value1);
        valueMap.set(result.index2, result.value2);

        // Find existing groups
        let group1 = groups.get(result.index1);
        let group2 = groups.get(result.index2);

        if (!group1 && !group2) {
            // Neither in a group - create new
            const newGroup = new Set([result.index1, result.index2]);
            groups.set(result.index1, newGroup);
            groups.set(result.index2, newGroup);
        } else if (group1 && !group2) {
            // Add index2 to group1
            group1.add(result.index2);
            groups.set(result.index2, group1);
        } else if (!group1 && group2) {
            // Add index1 to group2
            group2.add(result.index1);
            groups.set(result.index1, group2);
        } else if (group1 && group2 && group1 !== group2) {
            // Merge groups
            const merged = new Set(Array.from(group1).concat(Array.from(group2)));
            Array.from(merged).forEach((idx) => {
                groups.set(idx, merged);
            });
        }
    }

    // Convert to unique groups
    const uniqueGroups = new Set<Set<number>>();
    Array.from(groups.values()).forEach((group) => {
        uniqueGroups.add(group);
    });

    // Build result with canonical values (most common or first)
    const result: DuplicateGroup[] = [];
    Array.from(uniqueGroups).forEach((group) => {
        const indices = Array.from(group).sort((a, b) => a - b);
        const values = indices.map(i => valueMap.get(i) || '');

        // Use first value as canonical (could be enhanced to pick most common)
        result.push({
            canonical: values[0],
            indices,
            values
        });
    });

    return result.sort((a, b) => b.indices.length - a.indices.length);
}

/**
 * Quick function to check if two strings are fuzzy matches
 */
export function isFuzzyMatch(
    a: string,
    b: string,
    threshold: number = 0.85
): boolean {
    if (!a || !b) return false;
    if (a === b) return true;

    const normalized1 = normalizeText(a);
    const normalized2 = normalizeText(b);

    if (normalized1 === normalized2) return true;

    return jaroWinklerSimilarity(normalized1, normalized2) >= threshold;
}

/**
 * Find the best match for a value in an array
 */
export function findBestMatch(
    value: string,
    candidates: string[],
    threshold: number = 0.6
): { match: string | null; similarity: number; index: number } {
    const normalized = normalizeText(value);
    let bestMatch: string | null = null;
    let bestScore = 0;
    let bestIndex = -1;

    for (let i = 0; i < candidates.length; i++) {
        const candidateNorm = normalizeText(candidates[i]);
        const score = jaroWinklerSimilarity(normalized, candidateNorm);

        if (score > bestScore) {
            bestScore = score;
            bestMatch = candidates[i];
            bestIndex = i;
        }
    }

    if (bestScore < threshold) {
        return { match: null, similarity: 0, index: -1 };
    }

    return { match: bestMatch, similarity: bestScore, index: bestIndex };
}
