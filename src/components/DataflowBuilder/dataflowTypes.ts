/**
 * Dataflow Types
 * Types for the visual pipeline builder
 */

export type DataflowNodeType =
    | 'upload'
    | 'clean'
    | 'validate'
    | 'transform'
    | 'analyze'
    | 'dashboard'
    | 'report'
    | 'export'
    | 'dataset_creator'
    | 'ai_creator'
    | 'if'
    | 'loop'
    | 'merge'
    | 'filter'
    | 'webhook'
    | 'error'
    | 'custom';

export interface DataflowNode {
    id: string;
    type: DataflowNodeType;
    name: string;
    description: string;
    config: Record<string, any>;
    position: { x: number; y: number };
    status: 'pending' | 'running' | 'completed' | 'failed';
    result?: any;
}

export interface DataflowConnection {
    id: string;
    sourceId: string;
    targetId: string;
    sourceHandle?: string;
    targetHandle?: string;
}

export interface Dataflow {
    id?: number;
    name: string;
    description: string;
    nodes: DataflowNode[];
    connections: DataflowConnection[];
    isTemplate: boolean;
    isActive: boolean;
    schedule?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface DataflowTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    dataflow: Omit<Dataflow, 'id'>;
}

// Node configuration schemas
export const NODE_CONFIGS: Record<DataflowNodeType, {
    name: string;
    icon: string;
    color: string;
    description: string;
    inputs: Array<{ id: string; label: string; type: string }>;
    outputs: Array<{ id: string; label: string; type: string }>;
    configFields: Array<{ key: string; label: string; type: 'text' | 'select' | 'number' | 'boolean' | 'code'; options?: string[] }>;
}> = {
    dataset_creator: {
        name: 'Web Scraper',
        icon: '🌐',
        color: '#f43f5e',
        description: 'Create dataset from web URL',
        inputs: [],
        outputs: [{ id: 'data', label: 'Dataset', type: 'dataset' }],
        configFields: [
            { key: 'url', label: 'Target URL', type: 'text' },
            { key: 'depth', label: 'Crawl Depth', type: 'number' },
            { key: 'selector', label: 'CSS Selector (Optional)', type: 'text' }
        ],
    },
    ai_creator: {
        name: 'AI Data Generator',
        icon: '✨',
        color: '#8b5cf6',
        description: 'Generate synthetic dataset from topic',
        inputs: [],
        outputs: [{ id: 'data', label: 'Dataset', type: 'dataset' }],
        configFields: [
            { key: 'topic', label: 'Topic (e.g., "Miami Real Estate")', type: 'text' },
            { key: 'fields', label: 'Fields (comma separated)', type: 'text' },
            { key: 'rowCount', label: 'Row Count', type: 'number' }
        ],
    },
    upload: {
        name: 'Upload Data',
        icon: '📤',
        color: '#3b82f6',
        description: 'Upload or load a dataset',
        inputs: [],
        outputs: [{ id: 'data', label: 'Dataset', type: 'dataset' }],
        configFields: [
            { key: 'source', label: 'Source', type: 'select', options: ['file', 'existing_dataset', 'api'] },
        ],
    },
    clean: {
        name: 'Clean Data',
        icon: '🧹',
        color: '#10b981',
        description: 'Apply cleaning rules and recovery scripts',
        inputs: [{ id: 'input', label: 'Data', type: 'dataset' }],
        outputs: [{ id: 'output', label: 'Cleaned', type: 'dataset' }],
        configFields: [
            { key: 'mode', label: 'Mode', type: 'select', options: ['auto', 'custom', 'template'] },
            { key: 'autoApprove', label: 'Auto-approve', type: 'boolean' },
        ],
    },
    validate: {
        name: 'Validate',
        icon: '✅',
        color: '#f59e0b',
        description: 'Run validation rules and quality checks',
        inputs: [{ id: 'input', label: 'Data', type: 'dataset' }],
        outputs: [
            { id: 'valid', label: 'Valid', type: 'dataset' },
            { id: 'invalid', label: 'Invalid', type: 'dataset' }
        ],
        configFields: [
            { key: 'strictMode', label: 'Strict Mode', type: 'boolean' },
            { key: 'quarantineInvalid', label: 'Quarantine Invalid', type: 'boolean' },
        ],
    },
    transform: {
        name: 'Transform',
        icon: '🔄',
        color: '#8b5cf6',
        description: 'Apply data transformations',
        inputs: [{ id: 'input', label: 'Data', type: 'dataset' }],
        outputs: [{ id: 'output', label: 'Transformed', type: 'dataset' }],
        configFields: [
            { key: 'operations', label: 'Operations', type: 'text' },
        ],
    },
    analyze: {
        name: 'Analyze',
        icon: '🔍',
        color: '#06b6d4',
        description: 'Run AI-powered deep analysis',
        inputs: [{ id: 'input', label: 'Data', type: 'dataset' }],
        outputs: [{ id: 'insight', label: 'Insights', type: 'analysis' }],
        configFields: [
            { key: 'depth', label: 'Depth', type: 'select', options: ['quick', 'standard', 'deep'] },
        ],
    },
    dashboard: {
        name: 'Dashboard',
        icon: '📊',
        color: '#6366f1',
        description: 'Generate interactive dashboard',
        inputs: [{ id: 'input', label: 'Data', type: 'dataset' }],
        outputs: [{ id: 'dashboard', label: 'Dashboard', type: 'ui' }],
        configFields: [
            { key: 'chartTypes', label: 'Chart Types', type: 'text' },
            { key: 'autoGenerate', label: 'Auto Generate', type: 'boolean' },
        ],
    },
    report: {
        name: 'Report',
        icon: '📄',
        color: '#ec4899',
        description: 'Generate automated report',
        inputs: [{ id: 'input', label: 'Data', type: 'dataset' }],
        outputs: [{ id: 'report', label: 'Report', type: 'document' }],
        configFields: [
            { key: 'template', label: 'Template', type: 'select', options: ['executive', 'quality', 'audit', 'custom'] },
        ],
    },
    export: {
        name: 'Export',
        icon: '💾',
        color: '#14b8a6',
        description: 'Export data or reports',
        inputs: [{ id: 'input', label: 'Any', type: 'any' }],
        outputs: [{ id: 'file', label: 'File', type: 'binary' }],
        configFields: [
            { key: 'format', label: 'Format', type: 'select', options: ['csv', 'json', 'excel', 'pdf', 'powerbi', 'tableau'] },
            { key: 'includeMetadata', label: 'Include Metadata', type: 'boolean' },
        ],
    },
    custom: {
        name: 'Custom Script',
        icon: '⚡',
        color: '#808080',
        description: 'Run custom Python/JS script',
        inputs: [{ id: 'input', label: 'Data', type: 'dataset' }],
        outputs: [{ id: 'output', label: 'Result', type: 'any' }],
        configFields: [
            { key: 'runtime', label: 'Runtime', type: 'select', options: ['python', 'nodejs'] },
            { key: 'script', label: 'Script Code', type: 'code' },
        ],
    },
    if: {
        name: 'Condition (If/Else)',
        icon: '❓',
        color: '#f97316',
        description: 'Split flow based on condition',
        inputs: [{ id: 'input', label: 'Data', type: 'dataset' }],
        outputs: [
            { id: 'true', label: 'True', type: 'dataset' },
            { id: 'false', label: 'False', type: 'dataset' }
        ],
        configFields: [
            { key: 'condition', label: 'Condition Expression (JS)', type: 'text' },
        ],
    },
    loop: {
        name: 'Loop / Iterator',
        icon: '🔁',
        color: '#8b5cf6',
        description: 'Iterate over list or range',
        inputs: [{ id: 'input', label: 'Array', type: 'array' }],
        outputs: [
            { id: 'item', label: 'Item', type: 'any' },
            { id: 'done', label: 'Done', type: 'signal' }
        ],
        configFields: [
            { key: 'target', label: 'Target Array Field', type: 'text' },
        ],
    },
    merge: {
        name: 'Merge Flows',
        icon: '⛙',
        color: '#64748b',
        description: 'Merge multiple branches',
        inputs: [
            { id: 'in1', label: 'In 1', type: 'any' },
            { id: 'in2', label: 'In 2', type: 'any' }
        ],
        outputs: [{ id: 'output', label: 'Merged', type: 'any' }],
        configFields: [
            { key: 'strategy', label: 'Strategy', type: 'select', options: ['wait_all', 'first_wins'] },
        ],
    },
    error: {
        name: 'Error Handler',
        icon: '🛡️',
        color: '#ef4444',
        description: 'Catch errors from connected nodes',
        inputs: [{ id: 'error', label: 'Error', type: 'error' }],
        outputs: [{ id: 'out', label: 'Resume', type: 'any' }],
        configFields: [
            { key: 'action', label: 'Action', type: 'select', options: ['retry', 'notify', 'skip'] },
            { key: 'retries', label: 'Max Retries', type: 'number' },
        ],
    },
    filter: {
        name: 'Filter Data',
        icon: '🧪',
        color: '#f97316',
        description: 'Filter rows based on rules',
        inputs: [{ id: 'input', label: 'Data', type: 'dataset' }],
        outputs: [{ id: 'output', label: 'Filtered', type: 'dataset' }],
        configFields: [
            { key: 'rules', label: 'Rules (JSON)', type: 'text' },
        ],
    },
    webhook: {
        name: 'Webhook',
        icon: '🔗',
        color: '#3b82f6',
        description: 'Trigger from external HTTP request',
        inputs: [],
        outputs: [{ id: 'data', label: 'Body', type: 'any' }],
        configFields: [
            { key: 'method', label: 'Method', type: 'select', options: ['POST', 'GET'] },
            { key: 'apiKey', label: 'API Key (Optional)', type: 'text' },
        ],
    },
};

// Pre-built templates
export const DATAFLOW_TEMPLATES: DataflowTemplate[] = [
    {
        id: 'quick-clean',
        name: 'Quick Clean & Analyze',
        description: 'Upload → Auto-Clean → Dashboard (One-click workflow)',
        icon: '⚡',
        dataflow: {
            name: 'Quick Clean & Analyze',
            description: 'One-click data processing',
            isTemplate: true,
            isActive: true,
            nodes: [
                { id: 'n1', type: 'upload', name: 'Upload', description: 'Load dataset', config: { source: 'file' }, position: { x: 50, y: 100 }, status: 'pending' },
                { id: 'n2', type: 'clean', name: 'Auto Clean', description: 'AI-powered cleaning', config: { mode: 'auto', autoApprove: true }, position: { x: 200, y: 100 }, status: 'pending' },
                { id: 'n3', type: 'analyze', name: 'Analyze', description: 'Deep analysis', config: { depth: 'standard' }, position: { x: 350, y: 100 }, status: 'pending' },
                { id: 'n4', type: 'dashboard', name: 'Dashboard', description: 'Generate dashboard', config: { autoGenerate: true }, position: { x: 500, y: 100 }, status: 'pending' },
            ],
            connections: [
                { id: 'c1', sourceId: 'n1', targetId: 'n2', sourceHandle: 'data', targetHandle: 'input' },
                { id: 'c2', sourceId: 'n2', targetId: 'n3', sourceHandle: 'output', targetHandle: 'input' },
                { id: 'c3', sourceId: 'n3', targetId: 'n4', sourceHandle: 'insight', targetHandle: 'input' },
            ],
        },
    },
    {
        id: 'quality-audit',
        name: 'Quality Audit',
        description: 'Upload → Validate → Quality Report',
        icon: '🔍',
        dataflow: {
            name: 'Quality Audit',
            description: 'Data quality assessment',
            isTemplate: true,
            isActive: true,
            nodes: [
                { id: 'n1', type: 'upload', name: 'Upload', description: 'Load dataset', config: { source: 'file' }, position: { x: 50, y: 100 }, status: 'pending' },
                { id: 'n2', type: 'validate', name: 'Validate', description: 'Run validation', config: { strictMode: true, quarantineInvalid: true }, position: { x: 200, y: 100 }, status: 'pending' },
                { id: 'n3', type: 'report', name: 'Quality Report', description: 'Generate report', config: { template: 'quality' }, position: { x: 350, y: 100 }, status: 'pending' },
            ],
            connections: [
                { id: 'c1', sourceId: 'n1', targetId: 'n2', sourceHandle: 'data', targetHandle: 'input' },
                { id: 'c2', sourceId: 'n2', targetId: 'n3', sourceHandle: 'valid', targetHandle: 'input' },
            ],
        },
    },
    {
        id: 'full-pipeline',
        name: 'Full Pipeline',
        description: 'Complete workflow: Upload → Clean → Validate → Analyze → Dashboard → Report → Export',
        icon: '🚀',
        dataflow: {
            name: 'Full Pipeline',
            description: 'Complete data processing pipeline',
            isTemplate: true,
            isActive: true,
            nodes: [
                { id: 'n1', type: 'upload', name: 'Upload', description: 'Load dataset', config: { source: 'file' }, position: { x: 50, y: 100 }, status: 'pending' },
                { id: 'n2', type: 'clean', name: 'Clean', description: 'Clean data', config: { mode: 'auto' }, position: { x: 150, y: 100 }, status: 'pending' },
                { id: 'n3', type: 'validate', name: 'Validate', description: 'Validate data', config: { strictMode: false }, position: { x: 250, y: 100 }, status: 'pending' },
                { id: 'n4', type: 'analyze', name: 'Analyze', description: 'AI analysis', config: { depth: 'deep' }, position: { x: 350, y: 100 }, status: 'pending' },
                { id: 'n5', type: 'dashboard', name: 'Dashboard', description: 'Generate dashboard', config: { autoGenerate: true }, position: { x: 450, y: 100 }, status: 'pending' },
                { id: 'n6', type: 'report', name: 'Report', description: 'Generate report', config: { template: 'executive' }, position: { x: 550, y: 100 }, status: 'pending' },
                { id: 'n7', type: 'export', name: 'Export', description: 'Export results', config: { format: 'excel' }, position: { x: 650, y: 100 }, status: 'pending' },
            ],
            connections: [
                { id: 'c1', sourceId: 'n1', targetId: 'n2', sourceHandle: 'data', targetHandle: 'input' },
                { id: 'c2', sourceId: 'n2', targetId: 'n3', sourceHandle: 'output', targetHandle: 'input' },
                { id: 'c3', sourceId: 'n3', targetId: 'n4', sourceHandle: 'valid', targetHandle: 'input' },
                { id: 'c4', sourceId: 'n4', targetId: 'n5', sourceHandle: 'insight', targetHandle: 'input' },
                { id: 'c5', sourceId: 'n5', targetId: 'n6', sourceHandle: 'dashboard', targetHandle: 'input' },
                { id: 'c6', sourceId: 'n6', targetId: 'n7', sourceHandle: 'report', targetHandle: 'input' },
            ],
        },
    },
];
