/**
 * Smart Upload View
 * 
 * A completely redesigned upload experience with:
 * 1. Beautiful drag-and-drop interface
 * 2. AI-powered source classification
 * 3. Journey selection based on data type
 * 4. Animated transitions and feedback
 * 
 * Part of Phase 1: Intelligent Core Loop
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { datasetAPI, classificationAPI } from '../services/api';
import { getJourneyForSourceType, JOURNEYS, Journey, SourceType } from '../config/journeys';

// Type definitions
interface ClassificationResult {
  sourceType: SourceType;
  confidence: number;
  reasoning: string;
  suggestedWorkflow: string;
  detectedEntities: { name: string; column: string; confidence: number; examples: string[] }[];
  keyInsights: string[];
  alternativeTypes: { type: SourceType; confidence: number }[];
}

type UploadStep = 'select' | 'parsing' | 'classifying' | 'review' | 'uploading' | 'complete';

// Source type display info
const SOURCE_TYPE_INFO: Record<string, { icon: string; label: string; color: string }> = {
  invoice: { icon: '🧾', label: 'Invoice Data', color: 'emerald' },
  sales_data: { icon: '📈', label: 'Sales Data', color: 'blue' },
  financial_report: { icon: '💰', label: 'Financial Report', color: 'green' },
  employee_roster: { icon: '👥', label: 'Employee Roster', color: 'purple' },
  customer_list: { icon: '🎯', label: 'Customer List', color: 'orange' },
  inventory: { icon: '📦', label: 'Inventory', color: 'amber' },
  survey_results: { icon: '📊', label: 'Survey Results', color: 'pink' },
  log_file: { icon: '🖥️', label: 'Log File', color: 'slate' },
  time_series: { icon: '📉', label: 'Time Series', color: 'cyan' },
  transaction_log: { icon: '💳', label: 'Transaction Log', color: 'indigo' },
  product_catalog: { icon: '🛍️', label: 'Product Catalog', color: 'rose' },
  generic_dataset: { icon: '📄', label: 'General Dataset', color: 'gray' },
};

export const UploadViewPhase3: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const workspaceId = searchParams.get('workspace') || '';

  // State
  const [file, setFile] = useState<File | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [step, setStep] = useState<UploadStep>('select');
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Parsed data
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  // Classification
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setError('No workspace selected. Please select a workspace first.');
    }
  }, [workspaceId]);

  // Reset to start
  const handleReset = () => {
    setFile(null);
    setDatasetName('');
    setStep('select');
    setParsedData([]);
    setHeaders([]);
    setClassification(null);
    setSelectedJourney(null);
    setError(null);
  };

  // Handle file selection
  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile.type.includes('csv') && !selectedFile.type.includes('json') &&
      !selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.json')) {
      setError('Please upload a CSV or JSON file');
      return;
    }

    setFile(selectedFile);
    setDatasetName(selectedFile.name.replace(/\.[^.]+$/, ''));
    setError(null);
    setStep('parsing');

    try {
      // Parse file
      const fileText = await selectedFile.text();
      let data: any[] = [];
      let hdrs: string[] = [];

      if (selectedFile.type.includes('csv') || selectedFile.name.endsWith('.csv')) {
        const lines = fileText.trim().split('\n');
        if (lines.length === 0) throw new Error('CSV file is empty');

        hdrs = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const obj: any = {};
          hdrs.forEach((header, i) => { obj[header] = values[i] || null; });
          return obj;
        });
      } else {
        data = JSON.parse(fileText);
        if (!Array.isArray(data)) data = [data];
        if (data.length > 0) hdrs = Object.keys(data[0]);
      }

      if (data.length === 0) throw new Error('File contains no data');

      setParsedData(data);
      setHeaders(hdrs);
      setStep('classifying');

      // Classify with AI
      const response = await classificationAPI.classify(hdrs, data.slice(0, 50), true);
      const classResult = response.data.classification as ClassificationResult;
      setClassification(classResult);

      // Set suggested journey
      const journey = getJourneyForSourceType(classResult.sourceType);
      setSelectedJourney(journey);

      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Failed to process file');
      setStep('select');
    }
  };

  // Handle drag events
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
  };

  // Handle final upload
  const handleUpload = async () => {
    if (!file || !classification || !selectedJourney) return;

    setStep('uploading');

    try {
      const response = await datasetAPI.create(workspaceId, {
        name: datasetName,
        data: parsedData,
        headers: headers
      });

      const datasetId = response.data.id;

      // Save classification to dataset
      await classificationAPI.update(workspaceId, datasetId, {
        sourceType: classification.sourceType,
        suggestedWorkflow: selectedJourney.id,
        confidence: classification.confidence,
        detectedEntities: classification.detectedEntities,
        keyInsights: classification.keyInsights,
        classificationReasoning: classification.reasoning
      });

      setStep('complete');

      // Navigate to datasets list showing the newly uploaded dataset
      setTimeout(() => {
        navigate(`/app/datasets?workspace=${workspaceId}&new=${datasetId}`);
      }, 1500);

    } catch (err: any) {
      const { getErrorMessage } = await import('../services/api');
      setError(getErrorMessage(err));
      setStep('review');
    }
  };

  // Get confidence color
  const getConfidenceColor = (conf: number) => {
    if (conf >= 80) return 'text-emerald-500';
    if (conf >= 60) return 'text-amber-500';
    return 'text-red-500';
  };

  // Render based on step
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 transition-colors">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/20 mb-4">
            <span className="text-3xl">🧠</span>
          </div>
          <h1 className="text-4xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Smart Upload</h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg font-medium">
            Drop your data — AI will understand it
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 flex items-center gap-3">
            <span className="text-xl">⚠️</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-300">✕</button>
          </div>
        )}

        {/* Step: Select File */}
        {step === 'select' && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 cursor-pointer
              ${dragActive
                ? 'border-indigo-500 bg-indigo-500/10 scale-[1.02]'
                : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
          >
            <div className="space-y-4">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">Drop your file here</p>
                <p className="text-slate-500 dark:text-slate-400 mt-1">or click to browse</p>
              </div>
              <div className="flex justify-center gap-3">
                <span className="px-3 py-1 bg-slate-700 rounded-full text-xs text-slate-300">CSV</span>
                <span className="px-3 py-1 bg-slate-700 rounded-full text-xs text-slate-300">JSON</span>
                <span className="px-3 py-1 bg-slate-700 rounded-full text-xs text-slate-300">Up to 500MB</span>
              </div>
            </div>
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        )}

        {/* Step: Parsing / Classifying */}
        {(step === 'parsing' || step === 'classifying') && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
              <span className="absolute inset-0 flex items-center justify-center text-3xl">
                {step === 'parsing' ? '📄' : '🧠'}
              </span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              {step === 'parsing' ? 'Reading your data...' : 'AI is analyzing...'}
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              {step === 'parsing'
                ? `Processing ${file?.name}`
                : 'Detecting patterns, entities, and data type'}
            </p>
          </div>
        )}

        {/* Step: Review Classification */}
        {step === 'review' && classification && (
          <div className="space-y-6">
            {/* Classification Result Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-4xl text-indigo-600 dark:text-indigo-400">
                      {SOURCE_TYPE_INFO[classification.sourceType]?.icon || '📄'}
                    </div>
                    <div>
                      <p className="text-sm text-slate-400 mb-1">AI Classification</p>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {SOURCE_TYPE_INFO[classification.sourceType]?.label || 'Dataset'}
                      </h2>
                      <p className={`text-sm font-medium ${getConfidenceColor(classification.confidence)}`}>
                        {classification.confidence}% Confidence
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleReset}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* AI Reasoning */}
              <div className="p-6 bg-slate-50 dark:bg-slate-900/50">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Why I think this:</p>
                <p className="text-slate-700 dark:text-slate-300">{classification.reasoning}</p>
              </div>

              {/* Key Insights */}
              {classification.keyInsights.length > 0 && (
                <div className="p-6 border-t border-slate-700">
                  <p className="text-sm text-slate-400 mb-3">Key Insights</p>
                  <div className="space-y-2">
                    {classification.keyInsights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2 text-slate-300">
                        <span className="text-indigo-400 mt-0.5">💡</span>
                        <span>{insight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detected Entities */}
              {classification.detectedEntities.length > 0 && (
                <div className="p-6 border-t border-slate-700">
                  <p className="text-sm text-slate-400 mb-3">Detected Entities</p>
                  <div className="flex flex-wrap gap-2">
                    {classification.detectedEntities.map((entity, i) => (
                      <span key={i} className="px-3 py-1 bg-slate-700 rounded-full text-sm text-slate-300">
                        {entity.column}: {entity.name.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dataset Name */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <label className="text-sm text-slate-500 dark:text-slate-400 mb-2 block font-bold uppercase tracking-wider text-[10px]">Dataset Name</label>
              <input
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 text-lg font-medium"
                placeholder="Enter a name for your dataset"
              />
            </div>

            {/* Journey Selection */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-bold uppercase tracking-wider text-[10px]">Recommended Workflow</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.values(JOURNEYS).map((journey) => (
                  <button
                    key={journey.id}
                    onClick={() => setSelectedJourney(journey)}
                    className={`p-4 rounded-xl text-left transition-all ${selectedJourney?.id === journey.id
                      ? 'bg-indigo-500/20 border-2 border-indigo-500'
                      : 'bg-slate-50 dark:bg-slate-800 border-2 border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{journey.icon}</span>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{journey.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{journey.steps.length} steps</p>
                      </div>
                      {selectedJourney?.id === journey.id && (
                        <span className="ml-auto text-indigo-400">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <button
              onClick={handleUpload}
              disabled={!datasetName.trim()}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white text-lg font-bold rounded-xl transition-all transform hover:scale-[1.02] shadow-lg shadow-indigo-600/20"
            >
              🚀 Start {selectedJourney?.name || 'Analysis'}
            </button>
          </div>
        )}

        {/* Step: Uploading */}
        {step === 'uploading' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
              <span className="absolute inset-0 flex items-center justify-center text-3xl">☁️</span>
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">Uploading to cloud...</p>
            <p className="text-slate-500 dark:text-slate-400">This will only take a moment</p>
          </div>
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-2xl p-12 text-center shadow-lg shadow-emerald-500/10">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <span className="text-5xl">✨</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Data Ready!</p>
            <p className="text-slate-500 dark:text-slate-400">Redirecting to your {selectedJourney?.name}...</p>
          </div>
        )}

        {/* Data Preview */}
        {step === 'review' && parsedData.length > 0 && (
          <div className="mt-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">Data Preview</p>
              <span className="text-xs text-slate-500">{parsedData.length.toLocaleString()} rows × {headers.length} columns</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    {headers.slice(0, 6).map((h, i) => (
                      <th key={i} className="px-4 py-2 text-left text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-wider">{h}</th>
                    ))}
                    {headers.length > 6 && (
                      <th className="px-4 py-2 text-left text-slate-400">+{headers.length - 6} more</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {parsedData.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      {headers.slice(0, 6).map((h, j) => (
                        <td key={j} className="px-4 py-2 text-slate-600 dark:text-slate-300 truncate max-w-[150px] font-medium">
                          {row[h] || <span className="text-slate-600">null</span>}
                        </td>
                      ))}
                      {headers.length > 6 && <td className="px-4 py-2 text-slate-600">...</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsedData.length > 5 && (
              <div className="p-3 text-center text-xs text-slate-500 border-t border-slate-800">
                Showing first 5 of {parsedData.length.toLocaleString()} rows
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadViewPhase3;
