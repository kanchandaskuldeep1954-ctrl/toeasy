import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft,
    Database,
    ShieldCheck,
    AlertCircle,
    Save,
    Loader2,
    Lock
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';

interface FormField {
    key: string;
    label: string;
    type: 'text' | 'password' | 'number';
    placeholder: string;
}

const CONNECTOR_CONFIGS: Record<string, { name: string, fields: FormField[] }> = {
    postgres: {
        name: 'PostgreSQL',
        fields: [
            { key: 'host', label: 'Host Address', type: 'text', placeholder: 'db.example.com' },
            { key: 'port', label: 'Port', type: 'number', placeholder: '5432' },
            { key: 'database', label: 'Database Name', type: 'text', placeholder: 'production_db' },
            { key: 'username', label: 'Username', type: 'text', placeholder: 'readonly_user' },
            { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
        ]
    },
    mysql: {
        name: 'MySQL',
        fields: [
            { key: 'host', label: 'Host Address', type: 'text', placeholder: '127.0.0.1' },
            { key: 'port', label: 'Port', type: 'number', placeholder: '3306' },
            { key: 'database', label: 'Database Name', type: 'text', placeholder: 'app_data' },
            { key: 'username', label: 'Username', type: 'text', placeholder: 'admin' },
            { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
        ]
    },
    stripe: {
        name: 'Stripe',
        fields: [
            { key: 'apiKey', label: 'Secret API Key', type: 'password', placeholder: 'sk_live_...' },
        ]
    },
    hubspot: {
        name: 'HubSpot',
        fields: [
            { key: 'accessToken', label: 'Private App Access Token', type: 'password', placeholder: 'pat-na1-...' },
        ]
    },
    jira: {
        name: 'Jira',
        fields: [
            { key: 'host', label: 'Jira URL', type: 'text', placeholder: 'company.atlassian.net' },
            { key: 'email', label: 'Admin Email', type: 'text', placeholder: 'admin@company.com' },
            { key: 'apiToken', label: 'Atlassian API Token', type: 'password', placeholder: '••••••••' },
        ]
    },
    shopify: {
        name: 'Shopify',
        fields: [
            { key: 'storeUrl', label: 'Store URL', type: 'text', placeholder: 'your-store.myshopify.com' },
            { key: 'accessToken', label: 'Admin Access Token', type: 'password', placeholder: 'shpat_...' },
        ]
    },
    snowflake: {
        name: 'Snowflake',
        fields: [
            { key: 'account', label: 'Account Identifier', type: 'text', placeholder: 'xy12345.us-east-1' },
            { key: 'warehouse', label: 'Warehouse Name', type: 'text', placeholder: 'COMPUTE_WH' },
            { key: 'database', label: 'Database', type: 'text', placeholder: 'RAW_DATA' },
            { key: 'username', label: 'Username', type: 'text', placeholder: 'service_user' },
            { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
        ]
    },
    redshift: {
        name: 'AWS Redshift',
        fields: [
            { key: 'host', label: 'Cluster Endpoint', type: 'text', placeholder: 'cluster.abc.redshift.amazonaws.com' },
            { key: 'port', label: 'Port', type: 'number', placeholder: '5439' },
            { key: 'database', label: 'DB Name', type: 'text', placeholder: 'dev' },
            { key: 'user', label: 'User', type: 'text', placeholder: 'awsuser' },
            { key: 'pass', label: 'Password', type: 'password', placeholder: '••••••••' },
        ]
    },
    pinecone: {
        name: 'Pinecone',
        fields: [
            { key: 'apiKey', label: 'Pinecone API Key', type: 'password', placeholder: '••••••••' },
            { key: 'environment', label: 'Environment', type: 'text', placeholder: 'us-east1-gcp' },
        ]
    },
    slack: {
        name: 'Slack',
        fields: [
            { key: 'token', label: 'User/Bot OAuth Token', type: 'password', placeholder: 'xoxb-...' },
        ]
    },
    ga4: {
        name: 'Google Analytics 4',
        fields: [
            { key: 'propertyId', label: 'Property ID', type: 'text', placeholder: '123456789' },
            { key: 'credentials', label: 'Service Account JSON', type: 'password', placeholder: '{ "type": "service_account", ... }' },
        ]
    },
    'tiktok-ads': {
        name: 'TikTok Ads',
        fields: [
            { key: 'accessToken', label: 'Marketing API Access Token', type: 'password', placeholder: '••••••••' },
            { key: 'advertiserId', label: 'Advertiser ID', type: 'text', placeholder: '6789...' },
        ]
    },
    netsuite: {
        name: 'Oracle NetSuite',
        fields: [
            { key: 'accountId', label: 'Account ID', type: 'text', placeholder: '1234567_SB1' },
            { key: 'consumerKey', label: 'Consumer Key', type: 'password', placeholder: '••••••••' },
            { key: 'consumerSecret', label: 'Consumer Secret', type: 'password', placeholder: '••••••••' },
            { key: 'tokenId', label: 'Token ID', type: 'password', placeholder: '••••••••' },
            { key: 'tokenSecret', label: 'Token Secret', type: 'password', placeholder: '••••••••' },
        ]
    },
    sap: {
        name: 'SAP S/4HANA',
        fields: [
            { key: 'host', label: 'Application Server', type: 'text', placeholder: 'sap.company.com' },
            { key: 'client', label: 'Client Number', type: 'number', placeholder: '100' },
            { key: 'username', label: 'User', type: 'text', placeholder: 'BASIS_USER' },
            { key: 'password', label: 'Password', type: 'password', placeholder: '••••••••' },
        ]
    },
    'aws-s3': {
        name: 'Amazon S3',
        fields: [
            { key: 'bucket', label: 'Bucket Name', type: 'text', placeholder: 'my-datasets' },
            { key: 'region', label: 'Region', type: 'text', placeholder: 'us-east-1' },
            { key: 'accessKey', label: 'Access Key ID', type: 'text', placeholder: 'AKIA...' },
            { key: 'secretKey', label: 'Secret Access Key', type: 'password', placeholder: '••••••••' },
        ]
    },
    scraper: {
        name: 'AI Connect',
        fields: [
            { key: 'url', label: 'Target Website URL', type: 'text', placeholder: 'https://example.com/products' },
            { key: 'topic', label: 'Data to Extract', type: 'text', placeholder: 'Product names, prices, and descriptions' },
            { key: 'rows', label: 'Target Row Count', type: 'number', placeholder: '100' },
        ]
    },
    webhook: {
        name: 'Incoming Webhook',
        fields: [
            { key: 'name', label: 'Receiver Name', type: 'text', placeholder: 'e.g. Sales Pipeline' },
            { key: 'secret', label: 'Auth Secret (Optional)', type: 'password', placeholder: 'Custom Token' },
        ]
    },
    'rest-api': {
        name: 'REST API',
        fields: [
            { key: 'url', label: 'Endpoint URL', type: 'text', placeholder: 'https://api.service.com/v1/data' },
            { key: 'method', label: 'HTTP Method', type: 'text', placeholder: 'GET or POST' },
            { key: 'headerName', label: 'Auth Header', type: 'text', placeholder: 'Authorization or X-API-Key' },
            { key: 'headerValue', label: 'Auth Value', type: 'password', placeholder: 'Bearer ...' },
        ]
    },
    plaid: {
        name: 'Plaid Business',
        fields: [
            { key: 'clientId', label: 'Client ID', type: 'text', placeholder: '••••••••' },
            { key: 'secret', label: 'Secret Key', type: 'password', placeholder: '••••••••' },
        ]
    },
    workday: {
        name: 'Workday HR',
        fields: [
            { key: 'tenant', label: 'Workday Tenant Name', type: 'text', placeholder: 'company_tenant' },
            { key: 'clientId', label: 'OAuth Client ID', type: 'text', placeholder: '••••••••' },
            { key: 'secret', label: 'OAuth Client Secret', type: 'password', placeholder: '••••••••' },
        ]
    },
    'hl7-epic': {
        name: 'Epic FHIR / HL7',
        fields: [
            { key: 'baseUrl', label: 'FHIR Base URL', type: 'text', placeholder: 'https://fhir.epic.com/interconnect...' },
            { key: 'clientId', label: 'App Client ID', type: 'text', placeholder: '••••••••' },
        ]
    },
    fedex: {
        name: 'FedEx Tracking API',
        fields: [
            { key: 'apiKey', label: 'API Key', type: 'text', placeholder: '••••••••' },
            { key: 'secretKey', label: 'Secret Key', type: 'password', placeholder: '••••••••' },
            { key: 'accountNumber', label: 'Account Number', type: 'number', placeholder: '123456' },
        ]
    }
};

const ConnectorSetupView: React.FC = () => {
    const { providerId } = useParams<{ providerId: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const workspaceId = searchParams.get('workspace') || '';
    const { token } = useAuth();

    const config = providerId ? CONNECTOR_CONFIGS[providerId] : null;
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [connectionName, setConnectionName] = useState('');
    const [isTesting, setIsTesting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    // @ts-ignore
    const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3000/api';

    useEffect(() => {
        if (!config && providerId) {
            navigate('/app/upload');
        }
    }, [config, providerId, navigate]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsTesting(true);
        setStatus('idle');

        try {
            const response = await axios.post(`${backendUrl}/integrations`, {
                provider: providerId,
                name: connectionName || `${config?.name} Connection`,
                credentials: formData,
                workspaceId
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setStatus('success');
            setTimeout(() => {
                navigate(`/app/upload?workspace=${workspaceId}`);
            }, 1500);
        } catch (err: any) {
            setStatus('error');
            setErrorMessage(err.response?.data?.message || 'Failed to establish connection');
        } finally {
            setIsTesting(false);
        }
    };

    if (!config) return null;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 py-12 px-6">
            <div className="max-w-2xl mx-auto">

                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-slate-500 hover:text-white mb-8 transition-colors group"
                >
                    <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-bold uppercase tracking-widest">Back to Hub</span>
                </button>

                <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 lg:p-12 shadow-2xl relative overflow-hidden">
                    {/* Decorative Blur */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl" />

                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                            <Database size={28} />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white uppercase tracking-tight">Connect {config.name}</h1>
                            <p className="text-slate-500 text-sm font-medium">Configure your secure data pipeline</p>
                        </div>
                    </div>

                    <form onSubmit={handleInvite} className="space-y-6">

                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Display Name</label>
                            <input
                                type="text"
                                value={connectionName}
                                onChange={(e) => setConnectionName(e.target.value)}
                                placeholder={`e.g. ${config.name} Production`}
                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-all"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-6 pt-4 border-t border-white/5">
                            {config.fields.map(field => (
                                <div key={field.key}>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">{field.label}</label>
                                    <input
                                        type={field.type}
                                        value={formData[field.key] || ''}
                                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                                        placeholder={field.placeholder}
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
                                        required
                                    />
                                </div>
                            ))}
                        </div>

                        {status === 'error' && (
                            <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
                                <AlertCircle size={18} />
                                <span className="font-medium">{errorMessage}</span>
                            </div>
                        )}

                        {status === 'success' && (
                            <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
                                <ShieldCheck size={18} />
                                <span className="font-medium">Connection Established Successfully!</span>
                            </div>
                        )}

                        <div className="pt-6">
                            <button
                                type="submit"
                                disabled={isTesting || status === 'success'}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3"
                            >
                                {isTesting ? (
                                    <>
                                        <Loader2 className="animate-spin" size={20} />
                                        Testing Socket...
                                    </>
                                ) : (
                                    <>
                                        <Save size={20} />
                                        Authorize & Connect
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 flex items-center justify-center gap-3 text-slate-600">
                        <Lock size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">End-to-End Encrypted Tunnel</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConnectorSetupView;
