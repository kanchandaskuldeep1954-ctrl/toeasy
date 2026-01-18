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
    configFields: Array<{ key: string; label: string; type: 'text' | 'select' | 'number' | 'boolean'; options?: string[] }>;
}> = {
    dataset_creator: {
        name: 'Web Scraper',
        icon: '🌐',
        color: '#f43f5e',
        description: 'Create dataset from web URL',
        configFields: [
            { key: 'url', label: 'Target URL', type: 'text' },
            { key: 'depth', label: 'Crawl Depth', type: 'number' },
            { key: 'selector', label: 'CSS Selector (Optional)', type: 'text' }
        ],
    },
    upload: {
        name: 'Upload Data',
        icon: '📤',
        color: '#3b82f6',
        description: 'Upload or load a dataset',
        configFields: [
            { key: 'source', label: 'Source', type: 'select', options: ['file', 'existing_dataset', 'api'] },
        ],
    },
    clean: {
        name: 'Clean Data',
        icon: '🧹',
        color: '#10b981',
        description: 'Apply cleaning rules and recovery scripts',
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
        configFields: [
            { key: 'operations', label: 'Operations', type: 'text' },
        ],
    },
    analyze: {
        name: 'Analyze',
        icon: '🔍',
        color: '#06b6d4',
        description: 'Run AI-powered deep analysis',
        configFields: [
            { key: 'depth', label: 'Depth', type: 'select', options: ['quick', 'standard', 'deep'] },
        ],
    },
    dashboard: {
        name: 'Dashboard',
        icon: '📊',
        color: '#6366f1',
        description: 'Generate interactive dashboard',
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
        configFields: [
            { key: 'template', label: 'Template', type: 'select', options: ['executive', 'quality', 'audit', 'custom'] },
        ],
    },
    export: {
        name: 'Export',
        icon: '💾',
        color: '#14b8a6',
        description: 'Export data or reports',
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
        configFields: [
            { key: 'runtime', label: 'Runtime', type: 'select', options: ['python', 'nodejs'] },
            { key: 'script', label: 'Script Code', type: 'text' },
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
                { id: 'c1', sourceId: 'n1', targetId: 'n2' },
                { id: 'c2', sourceId: 'n2', targetId: 'n3' },
                { id: 'c3', sourceId: 'n3', targetId: 'n4' },
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
                { id: 'c1', sourceId: 'n1', targetId: 'n2' },
                { id: 'c2', sourceId: 'n2', targetId: 'n3' },
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
                { id: 'c1', sourceId: 'n1', targetId: 'n2' },
                { id: 'c2', sourceId: 'n2', targetId: 'n3' },
                { id: 'c3', sourceId: 'n3', targetId: 'n4' },
                { id: 'c4', sourceId: 'n4', targetId: 'n5' },
                { id: 'c5', sourceId: 'n5', targetId: 'n6' },
                { id: 'c6', sourceId: 'n6', targetId: 'n7' },
            ],
        },
    },
];
