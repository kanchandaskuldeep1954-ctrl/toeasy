import * as XLSX from 'xlsx';
import { Dataset } from '../../types';

export class ExcelService {
    /**
     * Parse an Excel file into raw data objects
     * Returns an array of sheets, each with name and data
     */
    static async parseExcel(file: File): Promise<{ sheetName: string; data: any[]; headers: string[] }[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = e.target?.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    const result: { sheetName: string; data: any[]; headers: string[] }[] = [];

                    workbook.SheetNames.forEach(sheetName => {
                        const worksheet = workbook.Sheets[sheetName];
                        // Convert to JSON, but keep raw values to avoid date parsing issues initially
                        const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: null });

                        if (rawData.length > 0) {
                            const headers = Object.keys(rawData[0] as object);
                            result.push({
                                sheetName,
                                data: rawData,
                                headers
                            });
                        }
                    });

                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = (error) => reject(error);
            reader.readAsBinaryString(file);
        });
    }

    /**
     * Export datasets to a single Excel file (each dataset as a sheet)
     */
    static exportToExcel(datasets: Dataset[], filename: string) {
        const workbook = XLSX.utils.book_new();

        datasets.forEach(dataset => {
            if (!dataset.data || dataset.data.length === 0) return;

            // Create worksheet from data
            const worksheet = XLSX.utils.json_to_sheet(dataset.data);

            // Auto-width columns (simple heuristic)
            const objectMaxLength: number[] = [];
            dataset.data.forEach(row => {
                Object.values(row).forEach((val, i) => {
                    const len = String(val).length;
                    objectMaxLength[i] = objectMaxLength[i] ? Math.max(objectMaxLength[i], len) : len;
                });
            });
            const wscols = objectMaxLength.map(w => ({ width: Math.min(w + 2, 50) }));
            worksheet['!cols'] = wscols;

            // Append sheet
            // Sheet names max 31 chars
            const safeSheetName = (dataset.name || 'Sheet').replace(/[\\/?*[\]]/g, '').slice(0, 31);
            XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
        });

        // Write file
        XLSX.writeFile(workbook, `${filename}.xlsx`);
    }

    /**
     * Download a single dataset as Excel
     */
    static exportDatasetToExcel(dataset: Dataset) {
        this.exportToExcel([dataset], dataset.name || 'Export');
    }
}
