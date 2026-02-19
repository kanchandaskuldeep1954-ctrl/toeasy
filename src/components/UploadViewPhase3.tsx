import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { classificationAPI, datasetAPI, getErrorMessage, studioAPI } from '../services/api';
import { ExcelService } from '../services/excelService';
import { getJourneyForSourceType, SourceType } from '../config/journeys';

type UploadStep = 'select' | 'processing' | 'review' | 'uploading' | 'complete';

interface ClassificationResult {
  sourceType: SourceType;
  confidence: number;
  reasoning: string;
  detectedEntities: Array<{ name: string; column: string; confidence: number; examples: string[] }>;
  keyInsights: string[];
}

const SOURCE_TYPE_INFO: Record<string, { label: string }> = {
  invoice: { label: 'Invoice Data' },
  sales_data: { label: 'Sales Data' },
  financial_report: { label: 'Financial Report' },
  employee_roster: { label: 'Employee Roster' },
  customer_list: { label: 'Customer List' },
  inventory: { label: 'Inventory' },
  survey_results: { label: 'Survey Results' },
  log_file: { label: 'Log File' },
  time_series: { label: 'Time Series' },
  transaction_log: { label: 'Transaction Log' },
  product_catalog: { label: 'Product Catalog' },
  generic_dataset: { label: 'General Dataset' }
};

const parseCsvLine = (line: string) => line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''));

export const UploadViewPhase3: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace') || '';

  const [step, setStep] = useState<UploadStep>('select');
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [recommendedWorkflowId, setRecommendedWorkflowId] = useState<string>('quick_exploration');

  useEffect(() => {
    if (!workspaceId) {
      setError('No workspace selected. Open upload from a workspace context.');
    }
  }, [workspaceId]);

  const confidenceColor = useMemo(() => {
    const value = classification?.confidence || 0;
    if (value >= 80) return 'text-emerald-500';
    if (value >= 60) return 'text-amber-500';
    return 'text-rose-500';
  }, [classification]);

  const resetUpload = () => {
    setStep('select');
    setError(null);
    setFile(null);
    setDatasetName('');
    setParsedData([]);
    setHeaders([]);
    setClassification(null);
    setRecommendedWorkflowId('quick_exploration');
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') setDragActive(true);
    if (event.type === 'dragleave') setDragActive(false);
  };

  const parseInputFile = async (selectedFile: File) => {
    const isExcel = selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls');
    const isCsv = selectedFile.type.includes('csv') || selectedFile.name.endsWith('.csv');
    const isJson = selectedFile.type.includes('json') || selectedFile.name.endsWith('.json');

    if (!isExcel && !isCsv && !isJson) {
      throw new Error('Upload CSV, JSON, XLSX, or XLS files only.');
    }

    let nextRows: any[] = [];
    let nextHeaders: string[] = [];
    let nextName = selectedFile.name.replace(/\.[^.]+$/, '');

    if (isExcel) {
      const sheets = await ExcelService.parseExcel(selectedFile);
      if (!sheets.length) throw new Error('Excel file has no parseable sheets.');
      const firstSheet = sheets[0];
      nextRows = firstSheet.data;
      nextHeaders = firstSheet.headers;
      if (sheets.length > 1) {
        nextName = `${nextName} - ${firstSheet.sheetName}`;
      }
    } else if (isCsv) {
      const text = await selectedFile.text();
      const lines = text.trim().split('\n').filter(Boolean);
      if (!lines.length) throw new Error('CSV file is empty.');
      nextHeaders = parseCsvLine(lines[0]);
      nextRows = lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        const record: Record<string, any> = {};
        nextHeaders.forEach((header, index) => {
          record[header] = values[index] ?? null;
        });
        return record;
      });
    } else {
      const text = await selectedFile.text();
      const json = JSON.parse(text);
      nextRows = Array.isArray(json) ? json : [json];
      nextHeaders = nextRows.length > 0 ? Object.keys(nextRows[0]) : [];
    }

    if (!nextRows.length) throw new Error('The uploaded file has no data rows.');
    return { nextRows, nextHeaders, nextName };
  };

  const classifyData = async (nextHeaders: string[], nextRows: any[]) => {
    try {
      const response = await classificationAPI.classify(nextHeaders, nextRows.slice(0, 50), true);
      const result = response.data?.classification as ClassificationResult;
      return result || null;
    } catch (err) {
      console.warn('Classification unavailable, continuing without blocking upload:', err);
      return null;
    }
  };

  const handleFileSelect = async (selectedFile: File) => {
    setError(null);
    setDragActive(false);
    setFile(selectedFile);
    setStep('processing');

    try {
      const { nextRows, nextHeaders, nextName } = await parseInputFile(selectedFile);
      setParsedData(nextRows);
      setHeaders(nextHeaders);
      setDatasetName(nextName);

      const classificationResult = await classifyData(nextHeaders, nextRows);
      setClassification(classificationResult);
      if (classificationResult?.sourceType) {
        setRecommendedWorkflowId(getJourneyForSourceType(classificationResult.sourceType).id);
      }
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Failed to process file.');
      setStep('select');
    }
  };

  const handleUpload = async () => {
    if (!workspaceId) {
      setError('Workspace context missing.');
      return;
    }
    if (!parsedData.length || !headers.length || !datasetName.trim()) {
      setError('Dataset name and parsed data are required.');
      return;
    }

    setError(null);
    setStep('uploading');

    try {
      const createResponse = await datasetAPI.create(workspaceId, {
        name: datasetName.trim(),
        data: parsedData,
        headers
      });

      const datasetId = Number(createResponse.data?.id);
      if (!Number.isFinite(datasetId)) throw new Error('Dataset created but ID is missing.');

      if (classification) {
        await classificationAPI.update(workspaceId, String(datasetId), {
          sourceType: classification.sourceType,
          confidence: classification.confidence,
          detectedEntities: classification.detectedEntities,
          keyInsights: classification.keyInsights,
          classificationReasoning: classification.reasoning,
          suggestedWorkflow: recommendedWorkflowId
        });
      }

      setStep('complete');
      const bootstrapResponse = await studioAPI.bootstrap(workspaceId, {
        datasetId,
        source: 'upload',
        preferredPanel: 'sheets'
      });

      const route = bootstrapResponse.data?.route || `/app/studio?workspace=${workspaceId}&dataset=${datasetId}&panel=sheets`;
      setTimeout(() => navigate(route), 700);
    } catch (err: any) {
      setError(getErrorMessage(err));
      setStep('review');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 transition-colors">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/20 mb-4">
            <span className="text-xs font-black text-indigo-600 dark:text-indigo-300">UPLOAD</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Data Upload</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
            Upload once, then continue directly in Decision Room Studio.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-500 flex items-center justify-between gap-3">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-500">x</button>
          </div>
        )}

        {step === 'select' && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const nextFile = event.dataTransfer.files?.[0];
              if (nextFile) handleFileSelect(nextFile);
            }}
            className={`relative border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 cursor-pointer ${
              dragActive
                ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]'
                : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/50'
            }`}
          >
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <span className="text-white text-sm font-black">FILE</span>
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">Drop your file here</p>
              <p className="text-slate-500 dark:text-slate-400">CSV, JSON, XLSX, XLS</p>
            </div>
            <input
              type="file"
              accept=".csv,.json,.xlsx,.xls"
              onChange={(event) => {
                const nextFile = event.target.files?.[0];
                if (nextFile) handleFileSelect(nextFile);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        )}

        {step === 'processing' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">Processing file...</p>
            <p className="text-slate-500 dark:text-slate-400">Parsing rows and profiling columns.</p>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-6">
            {classification && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-xs font-black text-indigo-600 dark:text-indigo-300">
                    AI
                  </div>
                  <div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      {SOURCE_TYPE_INFO[classification.sourceType]?.label || 'Dataset'}
                    </div>
                    <div className={`text-sm font-semibold ${confidenceColor}`}>
                      {classification.confidence}% confidence
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">{classification.reasoning}</p>
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                  Suggested workflow: <span className="font-semibold">{recommendedWorkflowId}</span> (optional guidance only)
                </p>
              </div>
            )}

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <label className="text-sm text-slate-500 dark:text-slate-400 mb-2 block font-bold uppercase tracking-wider text-[10px]">
                Dataset Name
              </label>
              <input
                type="text"
                value={datasetName}
                onChange={(event) => setDatasetName(event.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 text-lg font-medium"
                placeholder="Enter dataset name"
              />
              <p className="mt-2 text-xs text-slate-500">
                {parsedData.length.toLocaleString()} rows x {headers.length} columns
              </p>
              {file && (
                <p className="mt-1 text-xs text-slate-400">Source file: {file.name}</p>
              )}
            </div>

            <button
              onClick={handleUpload}
              disabled={!datasetName.trim()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-lg font-bold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-indigo-600/20"
            >
              Open in Studio
            </button>
          </div>
        )}

        {step === 'uploading' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">Uploading dataset...</p>
            <p className="text-slate-500 dark:text-slate-400">Creating artifacts and preparing Studio context.</p>
          </div>
        )}

        {step === 'complete' && (
          <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-2xl p-12 text-center shadow-lg shadow-emerald-500/10">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-300">READY</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Data Ready</p>
            <p className="text-slate-500 dark:text-slate-400">Redirecting to Decision Room Studio...</p>
          </div>
        )}

        {(step === 'review' || step === 'complete') && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={resetUpload}
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            >
              Start over
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadViewPhase3;
