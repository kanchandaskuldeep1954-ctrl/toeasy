
import { Dataset, StrategicReport } from '../../types';
import { ExcelService } from './excelService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export class ExportService {

    /**
     * Trigger browser print for PDF export
     * Relies on CSS @media print rules
     */
    static async exportToPDF(elementId: string, filename: string) {
        const element = document.getElementById(elementId);
        if (!element) {
            console.error(`Element not found: ${elementId}`);
            return;
        }

        try {
            const canvas = await html2canvas(element, {
                scale: 2, // High resolution
                useCORS: true,
                logging: false
                // ignoreElements: (el) => el.classList.contains('no-print')
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
            const imgX = (pdfWidth - imgWidth * ratio) / 2;
            const imgY = 30;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`${filename}.pdf`);
        } catch (error) {
            console.error('PDF export failed:', error);
            // Fallback
            window.print();
        }
    }

    /**
     * Export report to Word (.doc) using HTML-to-Word compliance
     */
    static exportToWord(report: StrategicReport, datasetName: string) {
        const title = `${datasetName}_Report_${report.version}`;
        const content = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset='utf-8'>
                <title>${report.title}</title>
                <style>
                    body { font-family: 'Calibri', sans-serif; line-height: 1.5; color: #333; }
                    h1 { font-size: 24pt; color: #2c3e50; margin-bottom: 24px; }
                    h2 { font-size: 18pt; color: #34495e; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
                    h3 { font-size: 14pt; color: #7f8c8d; }
                    p { font-size: 11pt; margin-bottom: 12px; text-align: justify; }
                    .kpi-container { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
                    .kpi-card { border: 1px solid #ddd; padding: 10px; border-radius: 8px; background: #f9f9f9; width: 150px; }
                    .kpi-label { font-size: 8pt; color: #7f8c8d; text-transform: uppercase; }
                    .kpi-value { font-size: 14pt; font-weight: bold; color: #2c3e50; }
                    .footer { font-size: 9pt; color: #aaa; text-align: center; margin-top: 40px; border-top: 1px solid #eee; padding-top: 10px; }
                </style>
            </head>
            <body>
                <h1>${report.title}</h1>
                <p><strong>Date:</strong> ${new Date(report.generatedAt).toLocaleDateString()}</p>
                <p><strong>Dataset:</strong> ${datasetName}</p>
                
                <h2>Executive Summary</h2>
                <div style="background-color: #f8f9fa; padding: 20px; border-left: 4px solid #4f46e5; border-radius: 4px;">
                    <p style="font-size: 12pt; font-style: italic;">${report.executiveSummary}</p>
                </div>

                ${report.sections.map(s => `
                    <div class="section">
                        <h2>${s.title}</h2>
                        
                        ${s.keyTakeaways && s.keyTakeaways.length > 0 ? `
                        <div style="background: #eef2ff; padding: 10px; margin-bottom: 15px; border-radius: 6px;">
                            <strong>Key Takeaways:</strong>
                            <ul style="margin: 5px 0 0 20px;">
                                ${s.keyTakeaways.map(t => `<li>${t}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}

                        ${s.kpis && s.kpis.length > 0 ? `
                        <div class="kpi-container">
                            ${s.kpis.map(k => `
                            <div class="kpi-card">
                                <div class="kpi-label">${k.label}</div>
                                <div class="kpi-value">${k.value}</div>
                            </div>
                            `).join('')}
                        </div>
                        ` : ''}
                        
                        <div>${s.content.replace(/\n/g, '<br/>')}</div>
                        
                        ${s.charts && s.charts.length > 0 ? `
                        <div style="margin-top: 20px; padding: 10px; border: 1px dashed #ccc; text-align: center; color: #666;">
                            [Charts Included: ${s.charts.map(c => c.title).join(', ')} - See PDF for full visuals]
                        </div>
                        ` : ''}
                    </div>
                `).join('')}
                
                <div class='footer'>
                    <p>Generated by Toeasy AI Data OS • Confidential</p>
                </div>
            </body>
            </html>
        `;

        this.downloadFile(`${title}.doc`, content, 'application/msword');
    }

    /**
     * Export raw data to Excel (or CSV fallback)
     */
    static exportToExcel(dataset: Dataset, filenameSuffix: string = 'data') {
        if (!dataset.data || dataset.data.length === 0) return;

        // Use ExcelService for real .xlsx
        try {
            ExcelService.exportDatasetToExcel(dataset);
        } catch (e) {
            console.error("Excel export failed, falling back to CSV", e);
            this.exportToCSV(dataset, filenameSuffix);
        }
    }

    /**
     * Export raw data to CSV (Fallback)
     */
    static exportToCSV(dataset: Dataset, filenameSuffix: string = 'data') {
        if (!dataset.data || dataset.data.length === 0) return;

        const headers = dataset.headers.join(',');
        const rows = dataset.data.map(r => dataset.headers.map(h =>
            // Handle quotes and commas in CSV
            `"${String(r[h] ?? '').replace(/"/g, '""')}"`
        ).join(',')).join('\n');

        const csvContent = `${headers}\n${rows}`;
        // Add BOM for Excel compatibility
        const bom = '\uFEFF';

        this.downloadFile(`${dataset.name || 'Dataset'}_${filenameSuffix}.csv`, bom + csvContent, 'text/csv;charset=utf-8;');
    }

    /**
     * Helper to trigger download
     */
    private static downloadFile(filename: string, content: string, type: string) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
