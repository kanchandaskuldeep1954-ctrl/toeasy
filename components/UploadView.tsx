
import React, { useRef, useState } from 'react';
import { DataRow, SourceType, ConnectorDef } from '../types';
import { GeminiService } from '../services/geminiService';

interface UploadViewProps {
  onDataLoaded: (data: DataRow[], name: string, sourceType: SourceType) => void;
}

const connectors: ConnectorDef[] = [
  // Database (DB Connection UI)
  { id: 'postgres', name: 'PostgreSQL', category: 'database', icon: 'P', description: 'Open source relational database', authType: 'db_connection', brandColor: '#336791', fields: ['Host', 'Port', 'Database', 'Username', 'Password'] },
  { id: 'mysql', name: 'MySQL', category: 'database', icon: 'M', description: 'Popular open source database', authType: 'db_connection', brandColor: '#00758F', fields: ['Host', 'Port', 'Database', 'Username', 'Password'] },
  { id: 'sqlserver', name: 'SQL Server', category: 'database', icon: 'S', description: 'Microsoft relational database', authType: 'db_connection', brandColor: '#A91D22', fields: ['Server Address', 'Database', 'Username', 'Password'] },
  { id: 'snowflake', name: 'Snowflake', category: 'database', icon: '❄️', description: 'Cloud data warehouse', authType: 'db_connection', brandColor: '#29B5E8', fields: ['Account URL', 'Warehouse', 'User', 'Password', 'Role'] },
  { id: 'bigquery', name: 'BigQuery', category: 'database', icon: 'BQ', description: 'Google Cloud data warehouse', authType: 'api_key', brandColor: '#4285F4', fields: ['Project ID', 'Service Account JSON'] },
  
  // Finance (OAuth & API Key)
  { id: 'stripe', name: 'Stripe', category: 'finance', icon: 'S', description: 'Payment processing', authType: 'api_key', brandColor: '#635BFF', fields: ['Secret Key (sk_live_...)'] },
  { id: 'quickbooks', name: 'QuickBooks', category: 'finance', icon: 'QB', description: 'Accounting software', authType: 'oauth', brandColor: '#2CA01C', fields: [] },
  { id: 'xero', name: 'Xero', category: 'finance', icon: 'X', description: 'Cloud accounting', authType: 'oauth', brandColor: '#13B5EA', fields: [] },
  { id: 'netsuite', name: 'NetSuite', category: 'finance', icon: 'N', description: 'Oracle ERP', authType: 'db_connection', brandColor: '#000000', fields: ['Account ID', 'Consumer Key', 'Consumer Secret', 'Token ID', 'Token Secret'] },

  // Sales (OAuth mostly)
  { id: 'salesforce', name: 'Salesforce', category: 'sales', icon: '☁️', description: 'CRM platform', authType: 'oauth', brandColor: '#00A1E0', fields: [] },
  { id: 'hubspot', name: 'HubSpot', category: 'sales', icon: 'H', description: 'CRM & marketing', authType: 'oauth', brandColor: '#FF7A59', fields: [] },
  { id: 'zoho', name: 'Zoho CRM', category: 'sales', icon: 'Z', description: 'CRM platform', authType: 'oauth', brandColor: '#C4182D', fields: [] },
  { id: 'shopify', name: 'Shopify', category: 'sales', icon: 'Sh', description: 'E-commerce', authType: 'api_key', brandColor: '#96BF48', fields: ['Shop URL (myshop.shopify.com)', 'Admin API Access Token'] },

  // Marketing (OAuth)
  { id: 'google_ads', name: 'Google Ads', category: 'marketing', icon: 'G', description: 'Search advertising', authType: 'oauth', brandColor: '#4285F4', fields: [] },
  { id: 'facebook_ads', name: 'Meta Ads', category: 'marketing', icon: 'F', description: 'Social advertising', authType: 'oauth', brandColor: '#1877F2', fields: [] },
  { id: 'tiktok_ads', name: 'TikTok Ads', category: 'marketing', icon: 'T', description: 'Video advertising', authType: 'oauth', brandColor: '#000000', fields: [] },
  { id: 'ga4', name: 'Google Analytics', category: 'marketing', icon: 'GA', description: 'Web analytics', authType: 'oauth', brandColor: '#EA4335', fields: [] },

  // Files
  { id: 's3', name: 'Amazon S3', category: 'files', icon: 'S3', description: 'Object storage', authType: 'db_connection', brandColor: '#FF9900', fields: ['Access Key ID', 'Secret Access Key', 'Bucket Name', 'Region'] },
  { id: 'google_drive', name: 'Google Drive', category: 'files', icon: 'GD', description: 'Cloud storage', authType: 'oauth', brandColor: '#1FA463', fields: [] },
  
  // Engineering
  { id: 'github', name: 'GitHub', category: 'engineering', icon: 'GH', description: 'Source code', authType: 'oauth', brandColor: '#181717', fields: [] },
  { id: 'jira', name: 'Jira', category: 'engineering', icon: 'J', description: 'Issue tracking', authType: 'api_key', brandColor: '#0052CC', fields: ['Domain (your-site.atlassian.net)', 'Email', 'API Token'] },
];

const UploadView: React.FC<UploadViewProps> = ({ onDataLoaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConnector, setSelectedConnector] = useState<ConnectorDef | null>(null);
  const [connectingState, setConnectingState] = useState<'idle' | 'authenticating' | 'fetching' | 'normalizing'>('idle');

  const categories = [
    { id: 'all', label: 'All Sources' },
    { id: 'database', label: 'Database' },
    { id: 'sales', label: 'Sales & CRM' },
    { id: 'finance', label: 'Finance' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'engineering', label: 'Engineering' },
    { id: 'files', label: 'Files & Storage' },
  ];

  const filteredConnectors = connectors.filter(c => 
    (activeCategory === 'all' || c.category === activeCategory) &&
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const parseLine = (line: string) => {
      const result = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else current += char;
      }
      result.push(current.trim());
      return result.map(v => v.replace(/^"|"$/g, ''));
    };

    const headers = parseLine(lines[0]);
    return lines.slice(1).map(line => {
      const values = parseLine(line);
      const obj: any = {};
      headers.forEach((header, i) => {
        const val = values[i];
        obj[header] = isNaN(Number(val)) || val === '' ? val : Number(val);
      });
      return obj;
    });
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const data = parseCSV(text);
      if (data.length > 0) onDataLoaded(data, file.name, 'csv');
    };
    reader.readAsText(file);
  };

  const handleConnect = async () => {
    if (!selectedConnector) return;
    setConnectingState('authenticating');
    try {
        await new Promise(resolve => setTimeout(resolve, 1500));
        setConnectingState('fetching');
        const mockData = await GeminiService.generateMockData(selectedConnector.id);
        setConnectingState('normalizing');
        await new Promise(resolve => setTimeout(resolve, 1000));
        onDataLoaded(mockData, `${selectedConnector.name} Export`, selectedConnector.id);
    } catch (e) {
        console.error(e);
        setConnectingState('idle');
        setSelectedConnector(null);
    }
  };

  const handleQuickStart = () => {
      onDataLoaded(
        Array.from({ length: 150 }, (_, i) => ({
            id: 1000 + i,
            date: new Date(Date.now() - Math.floor(Math.random() * 10000000000)).toISOString().split('T')[0],
            sales_rep: ['Alice', 'Bob', 'Charlie', 'Dana'][Math.floor(Math.random() * 4)],
            region: ['North', 'South', 'East', 'West', 'International'][Math.floor(Math.random() * 5)],
            product_line: ['SaaS License', 'Consulting', 'Support Pack', 'Hardware'][Math.floor(Math.random() * 4)],
            contract_value: Math.floor(Math.random() * 15000) + 2000,
            status: ['Closed Won', 'Negotiation', 'Proposal', 'Qualified'][Math.floor(Math.random() * 4)],
            probability: Math.floor(Math.random() * 100)
        })), 'Quick_Start_Sample.csv', 'csv'
      );
  }

  // --- Render Functions for Auth Types ---

  const renderOAuthForm = (connector: ConnectorDef) => (
    <div className="flex flex-col items-center justify-center space-y-8 py-4">
       <div className="flex flex-col items-center text-center space-y-2">
           <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-xl" style={{ backgroundColor: connector.brandColor }}>
             {connector.icon.includes('/') ? <img src={connector.icon} alt="" className="w-8 h-8"/> : connector.icon}
           </div>
           <h3 className="text-xl font-bold text-slate-900 dark:text-white">Connect to {connector.name}</h3>
           <p className="text-sm text-slate-500 max-w-xs">Allow Toeasy AI to import your data for autonomous analysis.</p>
       </div>

       <div className="w-full max-w-xs space-y-4">
           <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-500 space-y-2">
              <p className="font-bold uppercase tracking-wider text-slate-400">Requested Permissions:</p>
              <ul className="list-disc pl-4 space-y-1">
                  <li>Read {connector.category} records</li>
                  <li>View schema definitions</li>
                  <li>Read-only access (No write permissions)</li>
              </ul>
           </div>
           
           <button 
             onClick={handleConnect}
             className="w-full py-3 rounded-xl font-bold text-white shadow-lg flex items-center justify-center gap-3 transition-transform active:scale-95 hover:opacity-90"
             style={{ backgroundColor: connector.brandColor }}
           >
              <span>Sign in with {connector.name}</span>
           </button>
           <p className="text-[10px] text-center text-slate-400">Redirects to {connector.name} secure login</p>
       </div>
    </div>
  );

  const renderDBForm = (connector: ConnectorDef) => (
    <div className="space-y-6">
       <div className="grid grid-cols-2 gap-4">
          {connector.fields.map((field, idx) => {
             const isPassword = field.toLowerCase().includes('password') || field.toLowerCase().includes('secret');
             const isFullWidth = idx === connector.fields.length - 1 && connector.fields.length % 2 !== 0;
             return (
                 <div key={field} className={isFullWidth ? 'col-span-2' : ''}>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{field}</label>
                    <input 
                      type={isPassword ? 'password' : 'text'} 
                      className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono" 
                      placeholder={isPassword ? '••••••••' : `Enter ${field}`}
                    />
                 </div>
             )
          })}
       </div>
       <div className="flex items-center gap-2 text-xs text-slate-500 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800/30">
          <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          <p>Connection is encrypted end-to-end. We do not store your credentials.</p>
       </div>
       <div className="flex gap-3 pt-2">
          <button className="flex-1 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-600 dark:text-slate-300 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">Test Connection</button>
          <button onClick={handleConnect} className="flex-1 py-2.5 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg hover:opacity-90 transition-opacity">Connect Database</button>
       </div>
    </div>
  );

  const renderApiKeyForm = (connector: ConnectorDef) => (
    <div className="space-y-6">
       <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl flex items-start gap-4">
           <div className="p-2 bg-white dark:bg-slate-700 rounded-lg shadow-sm text-2xl">🔑</div>
           <div>
               <h4 className="font-bold text-slate-900 dark:text-white text-sm">API Key Authentication</h4>
               <p className="text-xs text-slate-500 mt-1">Generate a read-only API key from your {connector.name} dashboard settings.</p>
           </div>
       </div>

       <div className="space-y-4">
           {connector.fields.map(field => (
               <div key={field}>
                   <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">{field}</label>
                   <div className="relative">
                       <input 
                         type="password" 
                         className="w-full pl-4 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-mono tracking-wide" 
                         placeholder="Paste key here..."
                       />
                       <div className="absolute right-3 top-3 text-slate-400">
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                       </div>
                   </div>
               </div>
           ))}
       </div>

       <button onClick={handleConnect} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 transition-all">
           Authenticate & Import
       </button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Connect Your Data</h2>
        <p className="text-slate-500 dark:text-slate-400 font-medium">
            Integrate with 30+ sources. Clean, analyze, and report in one place.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 min-h-[600px]">
        {/* Sidebar */}
        <div className="w-full lg:w-64 flex flex-col gap-2 shrink-0">
            <div className="relative mb-4">
                <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search connectors..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border border-transparent focus:bg-white dark:focus:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
            </div>
            {categories.map(cat => (
                <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-between ${
                        activeCategory === cat.id 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' 
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                >
                    {cat.label}
                    {activeCategory === cat.id && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
                </button>
            ))}
        </div>

        {/* Main Grid */}
        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col">
             <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-min">
                {/* Manual Upload Card */}
                <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="group cursor-pointer border-2 border-dashed border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all min-h-[160px]"
                >
                    <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center text-indigo-600 shadow-sm group-hover:scale-110 transition-transform">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    </div>
                    <div className="text-center">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upload File</h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">CSV, Excel, JSON</p>
                    </div>
                </div>

                {filteredConnectors.map(c => (
                    <button
                        key={c.id}
                        onClick={() => setSelectedConnector(c)}
                        className="group flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-xl hover:-translate-y-1 rounded-2xl transition-all min-h-[160px] relative overflow-hidden"
                    >
                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-lg font-bold text-slate-700 dark:text-slate-200 mb-3 group-hover:scale-110 transition-transform z-10" style={{ color: c.brandColor }}>
                            {c.icon.includes('/') ? <img src={c.icon} alt="" className="w-6 h-6"/> : c.icon}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white z-10">{c.name}</h3>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-1 line-clamp-2 z-10">{c.description}</p>
                        
                        {/* Hover Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </button>
                ))}
             </div>
             
             {/* Quick Start Footer */}
             <div className="mt-auto pt-8 flex justify-center">
                 <button onClick={handleQuickStart} className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Just looking? Load sample dataset
                 </button>
             </div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

      {/* Dynamic Config Modal */}
      {selectedConnector && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
                  {connectingState === 'idle' ? (
                      <>
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="opacity-50">Connect</span> 
                                <span>{selectedConnector.name}</span>
                            </h3>
                            <button onClick={() => setSelectedConnector(null)} className="w-8 h-8 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-400 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        
                        <div className="p-8 overflow-y-auto custom-scrollbar">
                           {selectedConnector.authType === 'oauth' && renderOAuthForm(selectedConnector)}
                           {selectedConnector.authType === 'db_connection' && renderDBForm(selectedConnector)}
                           {selectedConnector.authType === 'api_key' && renderApiKeyForm(selectedConnector)}
                        </div>
                      </>
                  ) : (
                      <div className="p-16 flex flex-col items-center text-center space-y-8">
                           <div className="relative">
                               <div className="w-20 h-20 border-4 border-slate-100 dark:border-slate-800 rounded-full"></div>
                               <div className="w-20 h-20 border-4 rounded-full animate-spin absolute inset-0 border-t-transparent" style={{ borderColor: `${selectedConnector.brandColor} transparent transparent transparent` }}></div>
                               <div className="absolute inset-0 flex items-center justify-center font-bold text-xl" style={{ color: selectedConnector.brandColor }}>
                                   {selectedConnector.icon}
                               </div>
                           </div>
                           <div className="space-y-2 animate-pulse">
                               <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                                   {connectingState === 'authenticating' && 'Authenticating...'}
                                   {connectingState === 'fetching' && 'Fetching Schemas...'}
                                   {connectingState === 'normalizing' && 'Normalizing Data...'}
                               </h3>
                               <p className="text-sm text-slate-500">Establishing secure link with {selectedConnector.name}</p>
                           </div>
                      </div>
                  )}
              </div>
          </div>
      )}
    </div>
  );
};

export default UploadView;
