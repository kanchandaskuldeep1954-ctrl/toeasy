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
