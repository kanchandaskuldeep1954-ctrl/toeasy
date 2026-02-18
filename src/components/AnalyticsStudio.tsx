import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChartSpec } from '../../types';
import { useWorkspace } from '../hooks/useWorkspace';
import { useDataset } from '../hooks/useDataset';
import { datasetAPI, studioAPI } from '../services/api';
import { DataGridWidget } from './Widgets/DataGridWidget';
import { PivotConfig, PivotWidget } from './Widgets/PivotWidget';
import { ChartWidget } from './Widgets/ChartWidget';

type StudioPanel = 'sheets' | 'query' | 'script' | 'pivot' | 'visuals' | 'report' | 'actions';

interface StudioProject {
  id: number;
  name: string;
  description?: string;
}

interface StudioRoom {
  id: number;
  project_id: number;
  name: string;
  stage: string;
}

interface StudioArtifact {
  id: number;
  artifact_type: string;
  title: string;
  payload?: any;
  created_at: string;
}

const PANELS: StudioPanel[] = ['sheets', 'query', 'script', 'pivot', 'visuals', 'report', 'actions'];

const parseDatasetRows = (rawData: any, headers?: string[]) => {
  if (!rawData) return [];
  const parsed = typeof rawData === 'string' ? (() => {
    try { return JSON.parse(rawData); } catch { return []; }
  })() : rawData;
  if (!Array.isArray(parsed)) return [];
  if (parsed.length === 0) return [];
  if (Array.isArray(parsed[0])) {
    const sourceHeaders = (headers && headers.length ? headers : parsed[0]) as string[];
    const startIndex = headers && headers.length ? 0 : 1;
    return parsed.slice(startIndex).map((row: any[]) => {
      const mapped: Record<string, any> = {};
      sourceHeaders.forEach((h, idx) => {
        mapped[h] = row[idx];
      });
      return mapped;
    });
  }
  return parsed;
};

const AnalyticsStudio: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeWorkspace } = useWorkspace();
  const { activeDataset, setActiveDataset } = useDataset();

  const workspaceId = searchParams.get('workspace') || String(activeWorkspace?.id || '');
  const datasetId = searchParams.get('dataset') || String(activeDataset?.id || '');
  const panel = (searchParams.get('panel') as StudioPanel) || 'sheets';

  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [rooms, setRooms] = useState<StudioRoom[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(searchParams.get('project') || '');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(searchParams.get('room') || '');

  const [artifacts, setArtifacts] = useState<StudioArtifact[]>([]);
  const [lineage, setLineage] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const [sqlInput, setSqlInput] = useState('SELECT * FROM dataset LIMIT 50');
  const [nlInput, setNlInput] = useState('Show top trends in this dataset');
  const [scriptInput, setScriptInput] = useState('return data.slice(0, 100);');
  const [runRows, setRunRows] = useState<any[]>([]);
  const [runInfo, setRunInfo] = useState<{ executionMs?: number; generatedSql?: string; explanation?: string }>({});

  const [sheetField, setSheetField] = useState('');
  const [sheetValue, setSheetValue] = useState('');
  const [sheetOperator, setSheetOperator] = useState<'eq' | 'contains' | 'gt' | 'lt'>('eq');

  const [pivotConfig, setPivotConfig] = useState<PivotConfig>({ rows: [], columns: [], values: [] });

  const [chartType, setChartType] = useState('bar');
  const [chartX, setChartX] = useState('');
  const [chartY, setChartY] = useState('');
  const [reportText, setReportText] = useState('');

  const [actionTitle, setActionTitle] = useState('');
  const [actionDescription, setActionDescription] = useState('');

  const datasetRows = useMemo(() => {
    const rows = (activeDataset as any)?.data || (activeDataset as any)?.raw_data || [];
    return parseDatasetRows(rows, (activeDataset as any)?.headers || []);
  }, [activeDataset]);

  const currentRows = runRows.length ? runRows : datasetRows;
  const fields = useMemo(() => {
    if (!currentRows.length) return [];
    const keys = new Set<string>();
    currentRows.slice(0, 20).forEach((row) => Object.keys(row || {}).forEach((k) => keys.add(k)));
    return Array.from(keys);
  }, [currentRows]);

  const visualChart: ChartSpec = useMemo(() => ({
    id: `studio-chart-${Date.now()}`,
    type: chartType,
    title: 'Studio Visual',
    xAxis: chartX || fields[0],
    yAxis: chartY || fields.find((f) => typeof currentRows?.[0]?.[f] === 'number') || fields[1] || fields[0],
    color: '#3b82f6',
    sourceModule: 'playground'
  }), [chartType, chartX, chartY, fields, currentRows]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (workspaceId && !searchParams.get('workspace')) next.set('workspace', workspaceId);
    if (datasetId && !searchParams.get('dataset')) next.set('dataset', datasetId);
    if (!PANELS.includes(panel)) next.set('panel', 'sheets');
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [workspaceId, datasetId, panel, searchParams, setSearchParams]);

  useEffect(() => {
    const hydrateDataset = async () => {
      if (!workspaceId || !datasetId) return;
      if (activeDataset && String((activeDataset as any).id) === datasetId) return;
      try {
        const res = await datasetAPI.get(workspaceId, datasetId);
        const data = res.data?.data || res.data;
        const rows = parseDatasetRows(data.raw_data || data.data, data.headers || []);
        setActiveDataset({
          ...data,
          data: rows,
          raw_data: rows,
          headers: data.headers || (rows[0] ? Object.keys(rows[0]) : [])
        });
      } catch (error) {
        console.error('Failed to hydrate dataset for studio:', error);
      }
    };
    hydrateDataset();
  }, [workspaceId, datasetId, activeDataset, setActiveDataset]);

  useEffect(() => {
    const loadProjects = async () => {
      if (!workspaceId) return;
      try {
        const response = await studioAPI.listProjects(workspaceId);
        const list = response.data?.data || [];
        setProjects(list);
        if (!selectedProjectId && list.length) {
          setSelectedProjectId(String(list[0].id));
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
      }
    };
    loadProjects();
  }, [workspaceId, selectedProjectId]);

  useEffect(() => {
    const loadRooms = async () => {
      if (!workspaceId || !selectedProjectId) return;
      try {
        const response = await studioAPI.listRooms(workspaceId, selectedProjectId);
        const list = response.data?.data || [];
        setRooms(list);
        if (!selectedRoomId && list.length) {
          setSelectedRoomId(String(list[0].id));
        }
      } catch (error) {
        console.error('Failed to load rooms:', error);
      }
    };
    loadRooms();
  }, [workspaceId, selectedProjectId, selectedRoomId]);

  useEffect(() => {
    const loadRoomState = async () => {
      if (!workspaceId || !selectedRoomId) return;
      try {
        const response = await studioAPI.getRoomState(workspaceId, selectedRoomId);
        const roomArtifacts = response.data?.artifacts || [];
        setArtifacts(roomArtifacts);
      } catch (error) {
        console.error('Failed to load room state:', error);
      }
    };
    loadRoomState();
  }, [workspaceId, selectedRoomId]);

  const setPanel = (nextPanel: StudioPanel) => {
    const next = new URLSearchParams(searchParams);
    next.set('panel', nextPanel);
    if (selectedProjectId) next.set('project', selectedProjectId);
    if (selectedRoomId) next.set('room', selectedRoomId);
    setSearchParams(next);
  };

  const createProject = async () => {
    if (!workspaceId) return;
    const name = window.prompt('Project name');
    if (!name) return;
    const result = await studioAPI.createProject(workspaceId, { name });
    const created = result.data?.data;
    setProjects((prev) => [created, ...prev]);
    setSelectedProjectId(String(created.id));
    setStatusMessage(`Project "${created.name}" created.`);
  };

  const createRoom = async () => {
    if (!workspaceId || !selectedProjectId) return;
    const name = window.prompt('Analysis Room name');
    if (!name) return;
    const result = await studioAPI.createRoom(workspaceId, selectedProjectId, {
      name,
      stage: 'analyze',
      runContext: { datasetId: datasetId ? Number(datasetId) : null }
    });
    const created = result.data?.data;
    setRooms((prev) => [created, ...prev]);
    setSelectedRoomId(String(created.id));
    setStatusMessage(`Room "${created.name}" created.`);
  };

  const runExecution = async (mode: 'sql' | 'nl' | 'script_js' | 'sheet_op', payload: any) => {
    if (!workspaceId || !selectedRoomId) return;
    setLoading(true);
    try {
      const result = await studioAPI.run(workspaceId, selectedRoomId, {
        mode,
        payload: {
          datasetId: datasetId ? Number(datasetId) : undefined,
          ...payload
        },
        persistPolicy: 'persist'
      });
      setRunRows(result.data?.rows || []);
      setRunInfo({
        executionMs: result.data?.executionMs,
        generatedSql: result.data?.generatedSql,
        explanation: result.data?.explanation
      });
      setStatusMessage(`Run completed in ${result.data?.executionMs || 0}ms.`);
      const state = await studioAPI.getRoomState(workspaceId, selectedRoomId);
      setArtifacts(state.data?.artifacts || []);
    } catch (error: any) {
      setStatusMessage(error?.message || 'Run failed');
    } finally {
      setLoading(false);
    }
  };

  const saveChartArtifact = async () => {
    if (!workspaceId || !selectedRoomId) return;
    await studioAPI.createArtifact(workspaceId, selectedRoomId, {
      artifactType: 'chart',
      title: `Chart - ${visualChart.type}`,
      payload: {
        chart: visualChart,
        sampleRows: currentRows.slice(0, 300)
      }
    });
    const state = await studioAPI.getRoomState(workspaceId, selectedRoomId);
    setArtifacts(state.data?.artifacts || []);
    setStatusMessage('Chart artifact saved.');
  };

  const generateBrief = async () => {
    if (!workspaceId || !selectedRoomId) return;
    const result = await studioAPI.generateBrief(workspaceId, selectedRoomId, {
      title: `Decision Brief - ${new Date().toLocaleDateString()}`
    });
    setReportText(result.data?.brief || '');
    const state = await studioAPI.getRoomState(workspaceId, selectedRoomId);
    setArtifacts(state.data?.artifacts || []);
    setStatusMessage('Decision brief generated.');
  };

  const saveReportBlock = async () => {
    if (!workspaceId || !selectedRoomId || !reportText.trim()) return;
    await studioAPI.createArtifact(workspaceId, selectedRoomId, {
      artifactType: 'report_block',
      title: 'Report Block',
      payload: { markdown: reportText }
    });
    const state = await studioAPI.getRoomState(workspaceId, selectedRoomId);
    setArtifacts(state.data?.artifacts || []);
    setStatusMessage('Report block saved.');
  };

  const createAction = async () => {
    if (!workspaceId || !selectedRoomId || !actionTitle.trim()) return;
    await studioAPI.createArtifact(workspaceId, selectedRoomId, {
      artifactType: 'action_item',
      title: actionTitle,
      description: actionDescription,
      payload: {
        description: actionDescription,
        status: 'todo',
        priority: 'medium'
      }
    });
    setActionTitle('');
    setActionDescription('');
    const state = await studioAPI.getRoomState(workspaceId, selectedRoomId);
    setArtifacts(state.data?.artifacts || []);
    setStatusMessage('Action item created.');
  };

  const syncActions = async () => {
    if (!workspaceId || !selectedRoomId) return;
    const response = await studioAPI.syncActions(workspaceId, selectedRoomId, {
      channel: 'slack',
      createTasks: true
    });
    setStatusMessage(response.data?.message || 'Actions synced.');
  };

  const openLineage = async (artifactId: number) => {
    if (!workspaceId || !selectedRoomId) return;
    const response = await studioAPI.getLineage(workspaceId, selectedRoomId, artifactId);
    setLineage(response.data);
  };

  if (!workspaceId || !datasetId) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
        Select a workspace and dataset to start Studio.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase text-slate-500">Analytics Studio</span>
        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
        >
          <option value="">Select Project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>{project.name}</option>
          ))}
        </select>
        <button onClick={createProject} className="px-2 py-1 text-xs rounded bg-blue-600 text-white">+ Project</button>
        <select
          value={selectedRoomId}
          onChange={(e) => setSelectedRoomId(e.target.value)}
          className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
        >
          <option value="">Select Room</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>{room.name}</option>
          ))}
        </select>
        <button onClick={createRoom} disabled={!selectedProjectId} className="px-2 py-1 text-xs rounded bg-indigo-600 text-white disabled:opacity-50">+ Room</button>
        <span className="ml-auto text-xs text-slate-500">{statusMessage}</span>
      </div>

      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 overflow-x-auto">
        {PANELS.map((tab) => (
          <button
            key={tab}
            onClick={() => setPanel(tab)}
            className={`px-3 py-1.5 text-xs rounded-md font-semibold transition-colors ${
              panel === tab
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_280px]">
        <div className="min-h-0 p-4 overflow-auto">
          {panel === 'sheets' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <select value={sheetField} onChange={(e) => setSheetField(e.target.value)} className="px-2 py-1 text-xs rounded border">
                  <option value="">Field</option>
                  {fields.map((field) => <option key={field} value={field}>{field}</option>)}
                </select>
                <select value={sheetOperator} onChange={(e) => setSheetOperator(e.target.value as any)} className="px-2 py-1 text-xs rounded border">
                  <option value="eq">equals</option>
                  <option value="contains">contains</option>
                  <option value="gt">greater than</option>
                  <option value="lt">less than</option>
                </select>
                <input value={sheetValue} onChange={(e) => setSheetValue(e.target.value)} placeholder="Value" className="px-2 py-1 text-xs rounded border" />
                <button
                  disabled={!selectedRoomId || !sheetField || loading}
                  onClick={() => runExecution('sheet_op', { operation: 'filter', field: sheetField, operator: sheetOperator, value: sheetValue })}
                  className="px-3 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-50"
                >
                  Apply Filter
                </button>
              </div>
              <DataGridWidget data={currentRows} height={520} title={`Rows (${currentRows.length})`} />
            </div>
          )}

          {panel === 'query' && (
            <div className="space-y-3">
              <textarea value={sqlInput} onChange={(e) => setSqlInput(e.target.value)} className="w-full h-28 p-3 text-sm rounded border font-mono" />
              <button disabled={!selectedRoomId || loading} onClick={() => runExecution('sql', { sql: sqlInput })} className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white disabled:opacity-50">
                Run SQL
              </button>
              <textarea value={nlInput} onChange={(e) => setNlInput(e.target.value)} className="w-full h-20 p-3 text-sm rounded border" />
              <button disabled={!selectedRoomId || loading} onClick={() => runExecution('nl', { prompt: nlInput })} className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white disabled:opacity-50">
                Run NL Query
              </button>
              <DataGridWidget data={currentRows} height={400} title={`Run Results (${currentRows.length})`} />
            </div>
          )}

          {panel === 'script' && (
            <div className="space-y-3">
              <textarea value={scriptInput} onChange={(e) => setScriptInput(e.target.value)} className="w-full h-40 p-3 text-sm rounded border font-mono" />
              <button disabled={!selectedRoomId || loading} onClick={() => runExecution('script_js', { script: scriptInput })} className="px-3 py-1.5 text-xs rounded bg-violet-600 text-white disabled:opacity-50">
                Run Script
              </button>
              <DataGridWidget data={currentRows} height={400} title={`Script Output (${currentRows.length})`} />
            </div>
          )}

          {panel === 'pivot' && (
            <PivotWidget
              data={currentRows}
              fields={fields}
              config={pivotConfig}
              onConfigChange={setPivotConfig}
              height={560}
            />
          )}

          {panel === 'visuals' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <select value={chartType} onChange={(e) => setChartType(e.target.value)} className="px-2 py-1 text-xs rounded border">
                  <option value="bar">Bar</option>
                  <option value="line">Line</option>
                  <option value="area">Area</option>
                  <option value="pie">Pie</option>
                </select>
                <select value={chartX} onChange={(e) => setChartX(e.target.value)} className="px-2 py-1 text-xs rounded border">
                  <option value="">X Field</option>
                  {fields.map((field) => <option key={field} value={field}>{field}</option>)}
                </select>
                <select value={chartY} onChange={(e) => setChartY(e.target.value)} className="px-2 py-1 text-xs rounded border">
                  <option value="">Y Field</option>
                  {fields.map((field) => <option key={field} value={field}>{field}</option>)}
                </select>
                <button onClick={saveChartArtifact} disabled={!selectedRoomId} className="px-3 py-1 text-xs rounded bg-emerald-600 text-white disabled:opacity-50">
                  Save Chart Artifact
                </button>
              </div>
              <div className="h-[480px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <ChartWidget chart={visualChart} data={currentRows} height="100%" />
              </div>
            </div>
          )}

          {panel === 'report' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button onClick={generateBrief} disabled={!selectedRoomId} className="px-3 py-1.5 text-xs rounded bg-indigo-600 text-white disabled:opacity-50">
                  Generate Decision Brief
                </button>
                <button onClick={saveReportBlock} disabled={!selectedRoomId || !reportText.trim()} className="px-3 py-1.5 text-xs rounded bg-slate-800 text-white disabled:opacity-50">
                  Save Report Block
                </button>
              </div>
              <textarea value={reportText} onChange={(e) => setReportText(e.target.value)} className="w-full h-[520px] p-3 text-sm rounded border font-mono" />
            </div>
          )}

          {panel === 'actions' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} placeholder="Action title" className="px-2 py-1 text-xs rounded border w-48" />
                <input value={actionDescription} onChange={(e) => setActionDescription(e.target.value)} placeholder="Action description" className="px-2 py-1 text-xs rounded border w-64" />
                <button onClick={createAction} disabled={!selectedRoomId || !actionTitle.trim()} className="px-3 py-1 text-xs rounded bg-emerald-600 text-white disabled:opacity-50">
                  Add Action
                </button>
                <button onClick={syncActions} disabled={!selectedRoomId} className="px-3 py-1 text-xs rounded bg-blue-600 text-white disabled:opacity-50">
                  Sync Actions
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => studioAPI.connectSlack(workspaceId, { name: 'Slack Workspace', credentials: { channel: '#general' } })} className="px-3 py-1 text-xs rounded border">
                  Connect Slack
                </button>
                <button onClick={() => studioAPI.connectSheets(workspaceId, { name: 'Google Sheets', credentials: { mode: 'oauth' } })} className="px-3 py-1 text-xs rounded border">
                  Connect Sheets
                </button>
                <button onClick={() => studioAPI.connectSQL(workspaceId, { provider: 'postgres', name: 'Postgres', credentials: { host: 'localhost' } })} className="px-3 py-1 text-xs rounded border">
                  Connect SQL
                </button>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Action Items</h3>
                <div className="space-y-2">
                  {artifacts.filter((artifact) => artifact.artifact_type === 'action_item').map((artifact) => (
                    <div key={artifact.id} className="text-xs rounded border border-slate-200 dark:border-slate-700 px-2 py-2 flex items-center justify-between">
                      <span>{artifact.title}</span>
                      <button onClick={() => openLineage(artifact.id)} className="text-blue-600">Lineage</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 overflow-auto">
          <h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Run Context</h3>
          <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <div>Rows: {currentRows.length}</div>
            <div>Fields: {fields.length}</div>
            <div>Execution: {runInfo.executionMs || 0}ms</div>
            {runInfo.generatedSql && <pre className="text-[10px] whitespace-pre-wrap bg-slate-50 dark:bg-slate-800 rounded p-2">{runInfo.generatedSql}</pre>}
            {runInfo.explanation && <p className="text-[10px]">{runInfo.explanation}</p>}
          </div>
          <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Artifacts</h3>
          <div className="space-y-2">
            {artifacts.slice(0, 20).map((artifact) => (
              <div key={artifact.id} className="text-xs border rounded p-2">
                <div className="font-semibold">{artifact.title}</div>
                <div className="text-[10px] text-slate-500">{artifact.artifact_type}</div>
                <button onClick={() => openLineage(artifact.id)} className="mt-1 text-[10px] text-blue-600">View Lineage</button>
              </div>
            ))}
          </div>
          {lineage && (
            <>
              <h3 className="text-xs font-bold uppercase text-slate-500 mt-4 mb-2">Lineage Detail</h3>
              <div className="text-[10px] bg-slate-50 dark:bg-slate-800 rounded p-2 whitespace-pre-wrap">
                {JSON.stringify({
                  artifact: lineage.artifact?.title,
                  edgeCount: lineage.edges?.length || 0
                }, null, 2)}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default AnalyticsStudio;
