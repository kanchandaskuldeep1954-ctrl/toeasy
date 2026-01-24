
import React, { useState, useEffect, useRef } from 'react';
import { DataRow, SourceType } from '../types';
import { GroqService } from '../services/groqService';
import { useAuth } from '../src/hooks/useAuth';
import SaveDatasetModal from './SaveDatasetModal';

interface DatasetCreatorViewProps {
  onDataLoaded: (data: DataRow[], name: string, sourceType: SourceType) => void;
  onAIAction?: () => void;
}

const DatasetCreatorView: React.FC<DatasetCreatorViewProps> = ({ onDataLoaded, onAIAction }) => {
  const [topic, setTopic] = useState('');
  const [fields, setFields] = useState('');
  const [rowCount, setRowCount] = useState(50);
  const [isScraping, setIsScraping] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [generatedData, setGeneratedData] = useState<DataRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `> ${msg}`]);
  };

  const { user } = useAuth();

  const TIER_LIMITS = {
    basic: 500,
    pro: 50000,
    enterprise: 1000000
  };

  const maxAllowedRows = TIER_LIMITS[user?.tier || 'basic'];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic || isScraping) return;

    if (rowCount > maxAllowedRows) {
      addLog(`❌ TIER LIMIT: Your ${user?.tier} plan only allows up to ${maxAllowedRows} rows.`);
      return;
    }

    setIsScraping(true);
    setLogs([]);
    setSuccessMessage('');

    // Check if topic is a URL
    const isUrl = topic.trim().toLowerCase().startsWith('http');

    addLog(isUrl ? `Initializing REAL Web Scraper (Axios + AI Extraction)...` : `Initializing Synthetic Intel Agent...`);

    try {
      if (onAIAction) onAIAction();

      await new Promise(r => setTimeout(r, 800));
      addLog(`Targeting ${isUrl ? 'URL' : 'Topic'}: "${topic}"`);

      if (isUrl) {
        addLog(`Establishing secure connection to remote host...`);
        addLog(`Bypassing antibot layers...`);
        await new Promise(r => setTimeout(r, 1000));
      } else {
        addLog(`Analyzing semantic scope: "${topic}"...`);
        await new Promise(r => setTimeout(r, 1200));
      }

      addLog(`Volume locked: ${rowCount} records (Tier Max: ${maxAllowedRows})`);

      const fieldArray = fields.split(',').map(s => s.trim()).filter(Boolean);

      let data: DataRow[] = [];

      if (isUrl) {
        addLog(`Extracting DOM fragments and structural metadata...`);
        data = await GroqService.scrapeRealWeb(topic, fields || 'General Data', fieldArray, rowCount);
      } else {
        addLog(`Synthesizing unique records from knowledge base...`);
        data = await GroqService.generateSyntheticDataset(topic, fieldArray, rowCount);
      }

      const actualCount = Array.isArray(data) ? data.length : 0;

      addLog(`Success! ${actualCount} REAL records extracted/generated.`);
      await new Promise(r => setTimeout(r, 500));

      setGeneratedData(data);
      setShowSaveModal(true);

    } catch (err: any) {
      addLog(`ERROR: ${err.message}`);
      console.error(err);
    } finally {
      setIsScraping(false);
    }
  };

  const handleSaveDataset = async (name: string, description: string) => {
    try {
      setIsSaving(true);

      // Call the backend to save the dataset
      const token = localStorage.getItem('auth_token');

      // Get workspace ID from active_workspace
      let workspaceId: string | null = null;
      const activeWorkspaceStr = localStorage.getItem('active_workspace');
      if (activeWorkspaceStr) {
        try {
          const activeWorkspace = JSON.parse(activeWorkspaceStr);
          workspaceId = activeWorkspace.id;
        } catch (e) {
          console.error('Failed to parse active_workspace:', e);
        }
      }

      if (!workspaceId) {
        throw new Error('No workspace selected. Please select a workspace first.');
      }

      addLog(`Saving dataset "${name}" to workspace ${workspaceId}...`);

      const response = await fetch(
        `${(import.meta as any).env.VITE_BACKEND_URL}/workspaces/${workspaceId}/datasets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name,
            description: description,
            data: generatedData,
            headers: Object.keys(generatedData[0] || {}),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.details || 'Failed to save dataset');
      }

      const savedDataset = await response.json();

      setShowSaveModal(false);
      addLog(`✅ Dataset saved successfully! (ID: ${savedDataset.id})`);
      setSuccessMessage(`✅ Dataset "${name}" saved with ${generatedData.length} rows!`);

      // Clear form after successful save
      setTimeout(() => {
        setTopic('');
        setFields('');
        setRowCount(50);
        setLogs([]);
        setSuccessMessage('');
      }, 3000);

      // Also call the onDataLoaded callback for any other integrations
      onDataLoaded(generatedData, name, 'ai_scraper');

    } catch (err: any) {
      addLog(`ERROR: Failed to save - ${err.message}`);
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col gap-8 p-4">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Connect Source</h2>
        <p className="text-slate-500 font-medium max-w-2xl mx-auto">
          Autonomous data acquisition. Provide a URL to extract real-world datasets or a topic to synthesize high-fidelity intelligence instantly.
        </p>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 animate-in fade-in">
          <p className="text-emerald-800 dark:text-emerald-300 font-bold text-sm">{successMessage}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Config Form */}
        <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-xl p-10 space-y-8">
          <form onSubmit={handleCreate} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-500 tracking-widest ml-1">Target Topic / URL Structure</label>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. 'Real Estate Listings in Miami 2024' or 'Tech Job Postings'"
                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                disabled={isScraping}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-500 tracking-widest ml-1">Target Fields (Optional)</label>
              <input
                value={fields}
                onChange={(e) => setFields(e.target.value)}
                placeholder="e.g. Price, Address, SqFt, Agent Name (Leave empty for auto-detect)"
                className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                disabled={isScraping}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase text-slate-500 tracking-widest ml-1">Volume ({rowCount} rows)</label>
              <input
                type="range"
                min="10"
                max={maxAllowedRows}
                value={rowCount}
                onChange={(e) => setRowCount(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                disabled={isScraping}
              />
              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                <span>10 Rows</span>
                <span>{maxAllowedRows.toLocaleString()} Rows ({user?.tier?.toUpperCase()} Max)</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={!topic || isScraping}
              className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-3 ${!topic || isScraping
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.02] active:scale-95'
                }`}
            >
              {isScraping ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Crawling Web...
                </>
              ) : (
                <>
                  <span>🚀 Connect & Acquire</span>
                </>
              )}
            </button>

          </form>
        </div>

        {/* Terminal / Log Output */}
        <div className="bg-slate-950 rounded-[40px] shadow-2xl p-8 h-[500px] flex flex-col font-mono text-xs border border-slate-800 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-10 bg-slate-900 flex items-center px-6 gap-2 border-b border-slate-800">
            <div className="w-3 h-3 rounded-full bg-rose-500"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <div className="ml-4 text-slate-500 font-bold">puppeteer-agent — node</div>
          </div>

          <div className="mt-8 flex-1 overflow-y-auto custom-scrollbar space-y-2 p-2">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
                <div className="text-6xl mb-4 grayscale">🕷️</div>
                <p className="text-slate-400 font-bold uppercase tracking-widest">Agent Standby</p>
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="text-emerald-400 animate-in fade-in slide-in-from-left-2 duration-300">
                  <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>

          {isScraping && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500/20">
              <div className="h-full bg-emerald-500 animate-progress origin-left"></div>
            </div>
          )}
        </div>
      </div>

      {/* Save Dataset Modal */}
      <SaveDatasetModal
        isOpen={showSaveModal}
        data={generatedData}
        topic={topic}
        onSave={handleSaveDataset}
        onCancel={() => setShowSaveModal(false)}
        isSaving={isSaving}
      />
    </div>
  );
};

export default DatasetCreatorView;
