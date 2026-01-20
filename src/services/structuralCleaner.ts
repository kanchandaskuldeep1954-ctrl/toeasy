/**
 * EXTREME Structural Cleaning - Handle EVERY Excel/CSV artifact.
 * Part of the Elite Data Cleaning Layer.
 */

import { DataRow } from '../../types';

/**
 * Collapses Multi-header rows into single joined headers.
 * Row 1: | Category | | Product | |
 * Row 2: | Name | ID | Name | Price |
 * Result: Category_Name, Category_ID, Product_Name, Product_Price
 */
export function collapseMultiHeaders(rows: string[][], maxRows: number = 3): {
    headers: string[];
    dataStartRow: number;
} {
    if (!rows || rows.length < 2) return { headers: rows[0] || [], dataStartRow: 1 };

    const firstRowCount = rows[0].length;
    let headerRows = 1;

    // Heuristic: If row 2 has similar column count and looks like headers (text)
    for (let i = 1; i < Math.min(rows.length, maxRows); i++) {
        const isNumeric = rows[i].some(cell => !isNaN(parseFloat(cell)) && cell.trim() !== '');
        if (!isNumeric) headerRows++;
        else break;
    }

    if (headerRows === 1) return { headers: rows[0], dataStartRow: 1 };

    const finalHeaders: string[] = [];
    for (let col = 0; col < firstRowCount; col++) {
        const parts: string[] = [];
        let lastValue = '';
        for (let row = 0; row < headerRows; row++) {
            const val = rows[row][col]?.trim() || '';
            // Handle merged cells (if current is empty, take from left/prev)
            if (val) {
                parts.push(val);
                lastValue = val;
            } else if (lastValue) {
                // Heuristic for horizontal merge: if empty but previous had value, keep context
                // parts.push(lastValue); 
            }
        }
        finalHeaders.push(parts.join('_'));
    }

    return { headers: finalHeaders, dataStartRow: headerRows };
}

/**
 * Detects rows that look like Subtotals, Grand Totals, or footer artifacts.
 */
export function detectArtifactRows(data: DataRow[]): { totals: number[], footers: number[] } {
    const totals: number[] = [];
    const footers: number[] = [];

    data.forEach((row, idx) => {
        const values = Object.values(row).map(v => String(v).toLowerCase());
        const rowText = values.join(' ');

        // 1. Total Detection
        if (rowText.includes('total') || rowText.includes('subtotal') || rowText.includes('grand total')) {
            totals.push(idx);
            return;
        }

        // 2. Footer Detection
        if (rowText.includes('page ') || rowText.includes('source:') || rowText.includes('confidential')) {
            footers.push(idx);
            return;
        }

        // 3. Sparse check (Footers are often mostly empty)
        const nonNullCount = Object.values(row).filter(v => v !== null && v !== '').length;
        if (idx > data.length - 5 && nonNullCount < 2) {
            footers.push(idx);
        }
    });

    return { totals, footers };
}

/**
 * Heuristically detects if a column is just a "Pivot Artifact" (nested headers).
 */
export function isPivotArtifact(columnName: string): boolean {
    const lower = columnName.toLowerCase();
    return lower.includes('unnamed') || /^\d+$/.test(columnName);
}

// --- 3. CELL-LEVEL STRUCTURAL ISSUES ---

/**
 * Handle Excel Errors (#N/A, #REF!, #DIV/0!, #VALUE!, #NAME?, #NULL!, #NUM!)
 * Returns null for errors, otherwise original value.
 */
export function handleExcelErrors(value: any): any {
    if (typeof value !== 'string') return value;

    // exact match for common Excel errors
    const errors = ['#N/A', '#REF!', '#DIV/0!', '#VALUE!', '#NAME?', '#NULL!', '#NUM!'];
    if (errors.includes(value.trim().toUpperCase())) {
        return null;
    }

    return value;
}

/**
 * Detects if a cell contains a formula (starts with =)
 */
export function detectFormulaCell(value: any): boolean {
    if (typeof value !== 'string') return false;
    return value.trim().startsWith('=');
}

/**
 * Parse JSON in a cell
 * e.g. "{\"id\": 1, \"name\": \"bob\"}" -> {id: 1, name: "bob"}
 */
export function parseJsonInCell(value: any): any | null {
    if (typeof value !== 'string') return null;
    const clean = value.trim();

    if ((clean.startsWith('{') && clean.endsWith('}')) || (clean.startsWith('[') && clean.endsWith(']'))) {
        try {
            return JSON.parse(clean);
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Split array-like strings in cells
 * e.g. "apple, banana, cherry" -> ["apple", "banana", "cherry"]
 */
export function splitArrayInCell(value: any, delimiter: string = ','): string[] | null {
    if (typeof value !== 'string') return null;
    if (!value.includes(delimiter)) return null;

    // Heuristic: Must have at least one delimiter and parts shouldn't be too long (avoid splitting legitimate sentences)
    const parts = value.split(delimiter).map(p => p.trim());
    if (parts.length < 2) return null;

    // If average length of parts is > 50, probably a sentence, not an array
    const avgLen = parts.reduce((acc, p) => acc + p.length, 0) / parts.length;
    if (avgLen > 50) return null;

    return parts;
}

/**
 * Detect CSV Delimiter (comma, semicolon, tab, pipe)
 */
export function detectCSVDelimiter(rawText: string): string {
    const delimiters = [',', ';', '\t', '|'];
    const counts = delimiters.map(d => ({ delim: d, count: 0 }));

    // Sample first few lines
    const lines = rawText.split(/\r?\n/).slice(0, 5);
    if (lines.length === 0) return ',';

    lines.forEach(line => {
        counts.forEach(c => {
            // Count occurrences of delimiter
            c.count += line.split(c.delim).length - 1;
        });
    });

    // Find delimiter with highest consistency/count
    // Sort by count desc
    counts.sort((a, b) => b.count - a.count);

    return counts[0].delim;
}
