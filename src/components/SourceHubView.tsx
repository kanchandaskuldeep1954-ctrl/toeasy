import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import {
    Database,
    FileText,
    Cloud,
    ShoppingCart,
    BarChart3,
    MessageSquare,
    Layout,
    Search,
    Plus,
    ArrowRight,
    Shield,
    Zap,
    Globe,
    Lock,
    CreditCard,
    Briefcase
} from 'lucide-react';

interface ConnectorSource {
    id: string;
    name: string;
    category: 'files' | 'databases' | 'saas' | 'marketing' | 'finance' | 'storage';
    icon: React.ReactNode;
    description: string;
    status: 'active' | 'beta' | 'coming_soon';
    color: string;
    tags?: string[];
}

const SourceHubView: React.FC = () => {
    const navigate = useNavigate();
    const { token } = useAuth();
    const [searchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspace') || '';
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [existingIntegrations, setExistingIntegrations] = useState<any[]>([]);
    const [isLoadingIntegrations, setIsLoadingIntegrations] = useState(true);

    const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3000/api';

    React.useEffect(() => {
        const fetchIntegrations = async () => {
            if (!workspaceId || !token) return;
            try {
                const response = await axios.get(`${backendUrl}/integrations?workspaceId=${workspaceId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setExistingIntegrations(response.data);
            } catch (err) {
                console.error('Failed to fetch integrations');
            } finally {
                setIsLoadingIntegrations(false);
            }
        };
        fetchIntegrations();
    }, [workspaceId, token, backendUrl]);

    const sources: ConnectorSource[] = [
        // Files
        { id: 'csv', name: 'CSV File', category: 'files', icon: <FileText size={24} />, description: 'Upload standard comma-separated files', status: 'active', color: 'bg-emerald-500', tags: ['upload', 'local', 'sheet'] },
        { id: 'json', name: 'JSON Data', category: 'files', icon: <FileText size={24} />, description: 'Import structured JSON documents', status: 'active', color: 'bg-amber-500', tags: ['api', 'no-sql', 'document'] },
        { id: 'excel', name: 'Excel', category: 'files', icon: <FileText size={24} />, description: 'Microsoft Excel spreadsheets (.xlsx)', status: 'beta', color: 'bg-green-600', tags: ['spreadsheet', 'microsoft', 'office'] },
        { id: 'parquet', name: 'Apache Parquet', category: 'files', icon: <FileText size={24} />, description: 'Optimized columnar data format', status: 'coming_soon', color: 'bg-blue-400', tags: ['big-data', 'hadoop', 'performance'] },

        // Databases & Warehouses
        { id: 'postgres', name: 'PostgreSQL', category: 'databases', icon: <Database size={24} />, description: 'Connect to live Postgres instances', status: 'active', color: 'bg-indigo-500', tags: ['sql', 'relational', 'db', 'production'] },
        { id: 'mysql', name: 'MySQL', category: 'databases', icon: <Database size={24} />, description: 'Amazon RDS, DigitalOcean or local MySQL', status: 'active', color: 'bg-blue-500', tags: ['sql', 'relational', 'db', 'web'] },
        { id: 'snowflake', name: 'Snowflake', category: 'databases', icon: <Cloud size={24} />, description: 'Enterprise Data Warehouse', status: 'active', color: 'bg-cyan-400', tags: ['warehouse', 'cloud', 'analytics'] },
        { id: 'mongodb', name: 'MongoDB', category: 'databases', icon: <Database size={24} />, description: 'NoSQL collections from Atlas', status: 'active', color: 'bg-green-500', tags: ['nosql', 'json', 'document'] },
        { id: 'bigquery', name: 'Google BigQuery', category: 'databases', icon: <Database size={24} />, description: 'Google Cloud multi-cloud warehouse', status: 'active', color: 'bg-blue-600', tags: ['warehouse', 'gcp', 'google'] },
        { id: 'redshift', name: 'AWS Redshift', category: 'databases', icon: <Database size={24} />, description: 'Amazon cloud-native data warehouse', status: 'active', color: 'bg-orange-500', tags: ['warehouse', 'aws', 'amazon'] },

        // Vector Databases (AI)
        { id: 'pinecone', name: 'Pinecone', category: 'databases', icon: <Zap size={24} />, description: 'Managed vector DB for AI embeddings', status: 'active', color: 'bg-blue-300', tags: ['vector', 'ai', 'rag'] },
        { id: 'weaviate', name: 'Weaviate', category: 'databases', icon: <Zap size={24} />, description: 'Open-source vector search engine', status: 'active', color: 'bg-green-400', tags: ['vector', 'ai', 'search'] },

        // SaaS & CRM
        { id: 'salesforce', name: 'Salesforce', category: 'saas', icon: <Briefcase size={24} />, description: 'CRM leads, accounts and opportunities', status: 'active', color: 'bg-sky-500', tags: ['crm', 'sales', 'deals'] },
        { id: 'hubspot', name: 'HubSpot', category: 'saas', icon: <Briefcase size={24} />, description: 'Marketing and sales funnel data', status: 'active', color: 'bg-orange-500', tags: ['crm', 'marketing', 'funnel'] },
        { id: 'zoho', name: 'Zoho CRM', category: 'saas', icon: <Briefcase size={24} />, description: 'Unified customer lifecycle data', status: 'active', color: 'bg-red-600', tags: ['crm', 'customer'] },
        { id: 'notion', name: 'Notion', category: 'saas', icon: <FileText size={24} />, description: 'Connect to Notion pages and tables', status: 'active', color: 'bg-slate-900', tags: ['doc', 'wiki', 'pm'] },
        { id: 'jira', name: 'Jira', category: 'saas', icon: <Layout size={24} />, description: 'Issue tracking and project velocity', status: 'active', color: 'bg-blue-700', tags: ['pm', 'agile', 'engineering'] },

        // ERP & Business
        { id: 'netsuite', name: 'NetSuite', category: 'saas', icon: <Briefcase size={24} />, description: 'Enterprise resource planning (ERP)', status: 'active', color: 'bg-indigo-900', tags: ['erp', 'financials', 'oracle'] },
        { id: 'sap', name: 'SAP S/4HANA', category: 'saas', icon: <Briefcase size={24} />, description: 'Enterprise business suite', status: 'active', color: 'bg-blue-400', tags: ['erp', 'enterprise'] },
        { id: 'workday', name: 'Workday', category: 'saas', icon: <Briefcase size={24} />, description: 'Human capital management (HCM)', status: 'active', color: 'bg-orange-600', tags: ['hr', 'payroll', 'people'] },

        // Marketing & Ads
        { id: 'meta-ads', name: 'Meta Ads', category: 'marketing', icon: <BarChart3 size={24} />, description: 'Facebook and Instagram performance', status: 'active', color: 'bg-blue-600', tags: ['facebook', 'instagram', 'ads'] },
        { id: 'google-ads', name: 'Google Ads', category: 'marketing', icon: <BarChart3 size={24} />, description: 'Search and display campaign metrics', status: 'active', color: 'bg-red-500', tags: ['google', 'search', 'ppc'] },
        { id: 'ga4', name: 'Google Analytics 4', category: 'marketing', icon: <BarChart3 size={24} />, description: 'Web and app behavioral analytics', status: 'active', color: 'bg-yellow-500', tags: ['web', 'traffic', 'google'] },
        { id: 'linkedin-ads', name: 'LinkedIn Ads', category: 'marketing', icon: <BarChart3 size={24} />, description: 'Professional network marketing', status: 'active', color: 'bg-blue-800', tags: ['b2b', 'ads', 'pro'] },
        { id: 'tiktok-ads', name: 'TikTok Ads', category: 'marketing', icon: <BarChart3 size={24} />, description: 'Short-form video marketing spend', status: 'active', color: 'bg-black', tags: ['video', 'social'] },
        { id: 'mailchimp', name: 'Mailchimp', category: 'marketing', icon: <Zap size={24} />, description: 'Email marketing and list stats', status: 'active', color: 'bg-yellow-400', tags: ['email', 'newsletters'] },

        // Finance
        { id: 'stripe', name: 'Stripe', category: 'finance', icon: <CreditCard size={24} />, description: 'Revenue and payment transactions', status: 'active', color: 'bg-indigo-600', tags: ['payments', 'revenue', 'saas'] },
        { id: 'paypal', name: 'PayPal', category: 'finance', icon: <CreditCard size={24} />, description: 'Global payment processing data', status: 'active', color: 'bg-blue-900', tags: ['payments', 'checkout'] },
        { id: 'shopify', name: 'Shopify', category: 'finance', icon: <ShoppingCart size={24} />, description: 'Store orders and inventory', status: 'active', color: 'bg-green-600', tags: ['ecommerce', 'shop'] },
        { id: 'plaid', name: 'Plaid', category: 'finance', icon: <CreditCard size={24} />, description: 'Connect to 12,000+ banks', status: 'active', color: 'bg-black', tags: ['banking', 'open-finance'] },
        { id: 'quickbooks', name: 'QuickBooks', category: 'finance', icon: <CreditCard size={24} />, description: 'Cloud accounting and auditing', status: 'active', color: 'bg-emerald-600', tags: ['accounting', 'tax'] },

        // Cloud Storage
        { id: 'aws-s3', name: 'Amazon S3', category: 'storage', icon: <Cloud size={24} />, description: 'Object storage for datasets', status: 'active', color: 'bg-orange-400', tags: ['aws', 's3', 'buckets'] },
        { id: 'gcs', name: 'Google Storage', category: 'storage', icon: <Cloud size={24} />, description: 'GCP Cloud Storage buckets', status: 'active', color: 'bg-blue-500', tags: ['gcp', 'google'] },
        { id: 'dropbox', name: 'Dropbox', category: 'storage', icon: <Cloud size={24} />, description: 'Shared cloud drives', status: 'active', color: 'bg-blue-600', tags: ['files', 'sharing'] },

        // Universal
        { id: 'scraper', name: 'Web Scraper', category: 'storage', icon: <Globe size={24} />, description: 'AI data extraction from URLs', status: 'active', color: 'bg-indigo-400', tags: ['scrape', 'web'] },
        { id: 'rest-api', name: 'Generic API', category: 'storage', icon: <Zap size={24} />, description: 'Connect to any JSON endpoint', status: 'active', color: 'bg-violet-500', tags: ['api', 'rest', 'json'] },
    ];

    const categories = [
        { id: 'all', name: 'All Sources', icon: <Globe size={16} /> },
        { id: 'files', name: 'Files', icon: <FileText size={16} /> },
        { id: 'databases', name: 'Databases', icon: <Database size={16} /> },
        { id: 'saas', name: 'SaaS / ERP', icon: <Briefcase size={16} /> },
        { id: 'marketing', name: 'Marketing', icon: <BarChart3 size={16} /> },
        { id: 'finance', name: 'Finance', icon: <CreditCard size={16} /> },
        { id: 'storage', name: 'Cloud Storage', icon: <Cloud size={16} /> },
    ];

    const filteredSources = sources.filter(s => {
        const query = searchQuery.toLowerCase();
        const matchesSearch = s.name.toLowerCase().includes(query) ||
            s.description.toLowerCase().includes(query) ||
            (s.tags && s.tags.some(tag => tag.toLowerCase().includes(query)));
        const matchesCategory = activeCategory === 'all' || s.category === activeCategory;
        return matchesSearch && matchesCategory;
    });

    const handleConnect = (source: ConnectorSource) => {
        if (source.status === 'active' || source.status === 'beta') {
            if (source.id === 'csv' || source.id === 'json') {
                navigate(`/app/upload-file?workspace=${workspaceId}&type=${source.id}`);
            } else {
                navigate(`/app/connect/${source.id}?workspace=${workspaceId}`);
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 uppercase">
            {/* Header Area */}
            <div className="border-b border-white/5 bg-white/[0.02] backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-2 flex items-center gap-3">
                                <Zap className="text-indigo-500" fill="currentColor" />
                                Data Catalyst Hub
                            </h1>
                            <p className="text-slate-500 font-medium tracking-wide normal-case italic">Connect any data source to the ToEasy OS</p>
                        </div>

                        <div className="relative w-full md:w-96 group">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                                <Search size={20} />
                            </div>
                            <input
                                type="text"
                                placeholder="Search connectors..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-12">

                {/* Active Pipelines Section */}
                {existingIntegrations.length > 0 && (
                    <div className="mb-16">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400">Live Data Pipelines</h2>
                            <span className="bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full text-[10px] font-bold border border-indigo-500/20">
                                {existingIntegrations.length} Active Connections
                            </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            {existingIntegrations.map((ext: any) => (
                                <div
                                    key={ext.id}
                                    onClick={() => navigate(`/app/explore-connection/${ext.id}?workspace=${workspaceId}`)}
                                    className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/[0.06] transition-all cursor-pointer group"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center text-indigo-400">
                                        <Database size={20} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="text-sm font-bold text-white truncate uppercase tracking-tight">{ext.name}</h4>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">Sync Active</p>
                                        </div>
                                    </div>
                                    <ArrowRight size={14} className="text-slate-600 group-hover:text-white transition-colors" />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex flex-col lg:flex-row gap-12">

                    {/* Sidebar Filters */}
                    <div className="w-full lg:w-64 shrink-0">
                        <div className="sticky top-32 space-y-8">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4 px-4">Categories</h3>
                                <nav className="space-y-1">
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setActiveCategory(cat.id)}
                                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${activeCategory === cat.id
                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                                : 'text-slate-400 hover:bg-white/5 hover:text-white'
                                                }`}
                                        >
                                            {cat.icon}
                                            {cat.name}
                                        </button>
                                    ))}
                                </nav>
                            </div>

                            <div className="bg-gradient-to-br from-indigo-600/20 to-purple-600/20 border border-indigo-500/20 rounded-2xl p-6">
                                <Shield className="text-indigo-400 mb-3" size={24} />
                                <h4 className="text-white font-bold text-sm mb-2">Secure Ingestion</h4>
                                <p className="text-[11px] text-slate-400 leading-relaxed normal-case">
                                    All credentials are encrypted with AES-256 at rest. We never store your raw source passwords.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Main Grid */}
                    <div className="flex-1">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {filteredSources.map(source => (
                                <div
                                    key={source.id}
                                    onClick={() => handleConnect(source)}
                                    className={`group relative bg-white/[0.03] border border-white/10 rounded-3xl p-6 transition-all hover:bg-white/[0.05] hover:border-white/20 hover:-translate-y-1 cursor-pointer ${source.status === 'coming_soon' ? 'opacity-50 grayscale pointer-events-none' : ''
                                        }`}
                                >
                                    {/* Connectivity Icon */}
                                    <div className={`w-12 h-12 rounded-2xl ${source.color} flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                                        {source.icon}
                                    </div>

                                    {/* Info */}
                                    <div className="mb-8">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="text-lg font-black text-white uppercase tracking-tight">{source.name}</h3>
                                            {source.status === 'beta' && (
                                                <span className="text-[9px] font-black bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest">Beta</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-500 font-medium leading-relaxed normal-case line-clamp-2">{source.description}</p>
                                    </div>

                                    {/* Action Foot */}
                                    <div className="flex items-center justify-between pt-6 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Establish Connection</span>
                                        <ArrowRight size={16} className="text-indigo-400" />
                                    </div>

                                    {/* Hover Sparkle */}
                                    <div className="absolute top-4 right-4 text-white/5 group-hover:text-white/20 transition-colors">
                                        <Plus size={20} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {filteredSources.length === 0 && (
                            <div className="text-center py-20 bg-white/[0.02] border border-dashed border-white/10 rounded-3xl">
                                <p className="text-slate-500 font-bold mb-4 italic text-lg opacity-50">"WE COULDN'T FIND A CONNECTOR FOR THAT... YET!"</p>
                                <button className="px-6 py-3 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-indigo-600/20 transition-all">
                                    Request custom connector
                                </button>
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );
};

export default SourceHubView;
