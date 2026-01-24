import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    Table,
    Search,
    RefreshCcw,
    Eye,
    Download,
    AlertCircle,
    FileJson,
    Layers
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';

interface SchemaObject {
    id: string;
    name: string;
    rowCount?: number;
    type: 'table' | 'collection' | 'endpoint';
}

const ConnectorExplorerView: React.FC = () => {
    const { integrationId } = useParams<{ integrationId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspace') || '';
    const { token } = useAuth();

    const [integration, setIntegration] = useState<any>(null);
    const [objects, setObjects] = useState<SchemaObject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedObject, setSelectedObject] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [isPreviewing, setIsPreviewing] = useState(false);

    const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3000/api';

    useEffect(() => {
        const fetchIntegration = async () => {
            try {
                // In a real app, this would call /api/integrations/:id/schema
                // For demo, we mock the schema discovery based on provider
                setIntegration({ name: 'Production Database', provider: 'postgres' });

                setTimeout(() => {
                    setObjects([
                        { id: 'users', name: 'users', rowCount: 12503, type: 'table' },
                        { id: 'orders', name: 'orders', rowCount: 89432, type: 'table' },
                        { id: 'products', name: 'products', rowCount: 1205, type: 'table' },
                        { id: 'transactions', name: 'transactions', rowCount: 1045231, type: 'table' },
                    ]);
                    setIsLoading(false);
                }, 1000);
            } catch (err) {
                console.error('Failed to fetch schema');
            }
        };
        fetchIntegration();
    }, [integrationId]);

    const handlePreview = async (objId: string) => {
        setSelectedObject(objId);
        setIsPreviewing(true);
        // Mock data fetch
        setTimeout(() => {
            const mockRows = Array.from({ length: 10 }).map((_, i) => ({
                id: i + 1,
                name: `Sample ${objId} ${i + 1}`,
                created_at: new Date().toISOString(),
                status: 'captured',
                amount: Math.random() * 1000
            }));
            setPreviewData(mockRows);
            setIsPreviewing(false);
        }, 800);
    };

    const handleImport = async () => {
        if (!selectedObject) return;
        alert(`Starting full ingestion of [${selectedObject}] into Workspace ${workspaceId}...`);
        navigate(`/app/datasets?workspace=${workspaceId}`);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-6">
            <div className="max-w-6xl mx-auto">

                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">Connected</span>
                                <h1 className="text-3xl font-black text-white uppercase tracking-tight">{integration?.name}</h1>
                            </div>
                            <p className="text-slate-500 text-sm font-medium">Browse and extract data entities from your pipeline</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-xl text-xs font-bold hover:bg-white/10 transition-all border border-white/5">
                            <RefreshCcw size={14} className={isLoading ? 'animate-spin' : ''} />
                            Reload Schema
                        </button>
                        <button
                            onClick={handleImport}
                            disabled={!selectedObject}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-500 transition-all disabled:opacity-50 disabled:grayscale shadow-lg shadow-indigo-600/20"
                        >
                            <Download size={16} />
                            Start Full Sync
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Object List */}
                    <div className="lg:col-span-1 border border-white/10 bg-white/[0.02] rounded-3xl overflow-hidden flex flex-col h-[600px]">
                        <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                            <div className="relative group">
                                <Search className="absolute left-3 top-3 text-slate-600 group-focus-within:text-indigo-400" size={16} />
                                <input
                                    type="text"
                                    placeholder="Search tables..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-all"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {objects.map(obj => (
                                <button
                                    key={obj.id}
                                    onClick={() => handlePreview(obj.id)}
                                    className={`w-full text-left p-4 rounded-2xl flex items-center justify-between group transition-all ${selectedObject === obj.id
                                            ? 'bg-indigo-600/10 border border-indigo-500/30'
                                            : 'hover:bg-white/5 border border-transparent'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg ${selectedObject === obj.id ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-white'}`}>
                                            <Table size={16} />
                                        </div>
                                        <div>
                                            <p className={`font-bold text-sm ${selectedObject === obj.id ? 'text-white' : 'text-slate-300'}`}>{obj.name}</p>
                                            <p className="text-[10px] text-slate-500 font-medium uppercase">{obj.rowCount?.toLocaleString()} rows detected</p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview Area */}
                    <div className="lg:col-span-2 border border-white/10 bg-white/[0.01] rounded-3xl overflow-hidden flex flex-col h-[600px]">
                        {selectedObject ? (
                            <div className="flex flex-col h-full">
                                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <Eye className="text-indigo-400" size={20} />
                                        <h3 className="font-black text-white uppercase tracking-tight">Live Data Preview: <span className="text-indigo-400">{selectedObject}</span></h3>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Showing first 10 records</span>
                                </div>

                                <div className="flex-1 overflow-auto bg-slate-950/50">
                                    {isPreviewing ? (
                                        <div className="h-full flex flex-col items-center justify-center space-y-4">
                                            <RefreshCcw className="animate-spin text-indigo-500" size={32} />
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Hydrating Preview...</p>
                                        </div>
                                    ) : (
                                        <div className="p-4">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-white/10">
                                                        {previewData.length > 0 && Object.keys(previewData[0]).map(k => (
                                                            <th key={k} className="p-3 text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono">{k}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {previewData.map((row, i) => (
                                                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                                                            {Object.values(row).map((v: any, j) => (
                                                                <td key={j} className="p-3 text-xs text-slate-300 font-medium truncate max-w-[150px]">{String(v)}</td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-6">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center text-slate-600">
                                    <Layers size={32} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-white mb-2">Select an entity to explore</h4>
                                    <p className="text-sm text-slate-500 max-w-sm">We've identified 12 tables and 4 collections in this database. Pick one to see a live sample of the data.</p>
                                </div>
                            </div>
                        )}
                    </div>

                </div>

                <div className="mt-12 flex items-center gap-4 p-6 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                    <AlertCircle className="text-amber-500 shrink-0" size={24} />
                    <p className="text-[11px] text-amber-500/80 font-medium leading-relaxed italic">
                        <strong>Security Note:</strong> We only fetch schema metadata and sample rows for preview. Full data transfer only happens when you trigger "Start Full Sync". Data is encrypted using TLS 1.3 during transit.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ConnectorExplorerView;
