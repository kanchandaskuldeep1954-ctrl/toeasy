/**
 * Journey Configuration
 * 
 * Defines the guided workflows for different source types.
 * Each journey is a sequence of steps that guide the user through
 * the data intelligence process.
 * 
 * Part of Phase 1: Intelligent Core Loop
 */

// ============================================
// Type Definitions
// ============================================

export type SourceType =
    | 'invoice'
    | 'sales_data'
    | 'financial_report'
    | 'employee_roster'
    | 'customer_list'
    | 'inventory'
    | 'survey_results'
    | 'log_file'
    | 'time_series'
    | 'transaction_log'
    | 'product_catalog'
    | 'generic_dataset';

export type JourneyStepId =
    | 'review'
    | 'classify'
    | 'clean'
    | 'analyze'
    | 'dashboard'
    | 'report'
    | 'export'
    | 'share';

export interface JourneyStep {
    id: JourneyStepId;
    label: string;
    description: string;
    icon: string; // Emoji or icon name
    route: string; // React Router path
    isOptional?: boolean;
    requiredTier?: 'basic' | 'pro' | 'enterprise';
}

export interface Journey {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string; // Tailwind color class
    steps: JourneyStep[];
    suggestedFor: SourceType[];
}

// ============================================
// Journey Definitions
// ============================================

export const JOURNEY_STEPS: Record<JourneyStepId, JourneyStep> = {
    review: {
        id: 'review',
        label: 'Review Data',
        description: 'Preview your uploaded data and verify it looks correct',
        icon: '👁️',
        route: '/app/preview'
    },
    classify: {
        id: 'classify',
        label: 'Classify',
        description: 'AI identifies what type of data you uploaded',
        icon: '🧠',
        // Classification currently happens during upload; route to preview until a dedicated view exists.
        route: '/app/preview'
    },
    clean: {
        id: 'clean',
        label: 'Fix Issues',
        description: 'AI detects and fixes data quality issues',
        icon: '🧹',
        route: '/app/clean'
    },
    analyze: {
        id: 'analyze',
        label: 'Analyze',
        description: 'Deep analysis to uncover patterns and insights',
        icon: '🔬',
        route: '/app/playground'
    },
    dashboard: {
        id: 'dashboard',
        label: 'Visualize',
        description: 'Generate charts and dashboards automatically',
        icon: '📊',
        route: '/app/dashboard'
    },
    report: {
        id: 'report',
        label: 'Generate Report',
        description: 'Create an AI-written strategic narrative',
        icon: '📝',
        route: '/app/report'
    },
    export: {
        id: 'export',
        label: 'Export',
        description: 'Download your cleaned data and visualizations',
        icon: '📤',
        // Export is currently surfaced inside the cleaning/report experiences (ExportModal).
        route: '/app/clean',
        isOptional: true
    },
    share: {
        id: 'share',
        label: 'Share',
        description: 'Share insights with your team or stakeholders',
        icon: '🔗',
        // Sharing is currently supported from reports (public share link).
        route: '/app/report',
        isOptional: true,
        requiredTier: 'pro'
    }
};

export const JOURNEYS: Record<string, Journey> = {
    financial_analysis: {
        id: 'financial_analysis',
        name: 'Financial Analysis',
        description: 'Analyze invoices, transactions, and financial reports',
        icon: '💰',
        color: 'emerald',
        steps: [
            JOURNEY_STEPS.review,
            JOURNEY_STEPS.clean,
            JOURNEY_STEPS.dashboard,
            JOURNEY_STEPS.report,
            JOURNEY_STEPS.export
        ],
        suggestedFor: ['invoice', 'financial_report', 'transaction_log']
    },
    sales_insights: {
        id: 'sales_insights',
        name: 'Sales Insights',
        description: 'Uncover revenue trends and customer patterns',
        icon: '📈',
        color: 'blue',
        steps: [
            JOURNEY_STEPS.review,
            JOURNEY_STEPS.clean,
            JOURNEY_STEPS.analyze,
            JOURNEY_STEPS.dashboard,
            JOURNEY_STEPS.report
        ],
        suggestedFor: ['sales_data', 'product_catalog']
    },
    hr_analytics: {
        id: 'hr_analytics',
        name: 'HR Analytics',
        description: 'Analyze workforce data and organizational patterns',
        icon: '👥',
        color: 'purple',
        steps: [
            JOURNEY_STEPS.review,
            JOURNEY_STEPS.clean,
            JOURNEY_STEPS.analyze,
            JOURNEY_STEPS.dashboard,
            JOURNEY_STEPS.report
        ],
        suggestedFor: ['employee_roster']
    },
    customer_intelligence: {
        id: 'customer_intelligence',
        name: 'Customer Intelligence',
        description: 'Analyze customer data for segmentation and insights',
        icon: '🎯',
        color: 'orange',
        steps: [
            JOURNEY_STEPS.review,
            JOURNEY_STEPS.clean,
            JOURNEY_STEPS.analyze,
            JOURNEY_STEPS.dashboard,
            JOURNEY_STEPS.report
        ],
        suggestedFor: ['customer_list', 'survey_results']
    },
    inventory_management: {
        id: 'inventory_management',
        name: 'Inventory Management',
        description: 'Track stock levels and optimize inventory',
        icon: '📦',
        color: 'amber',
        steps: [
            JOURNEY_STEPS.review,
            JOURNEY_STEPS.clean,
            JOURNEY_STEPS.dashboard,
            JOURNEY_STEPS.report,
            JOURNEY_STEPS.export
        ],
        suggestedFor: ['inventory']
    },
    operational_monitoring: {
        id: 'operational_monitoring',
        name: 'Operational Monitoring',
        description: 'Analyze logs and system events for issues',
        icon: '🖥️',
        color: 'slate',
        steps: [
            JOURNEY_STEPS.review,
            JOURNEY_STEPS.clean,
            JOURNEY_STEPS.analyze,
            JOURNEY_STEPS.dashboard
        ],
        suggestedFor: ['log_file', 'time_series']
    },
    quick_exploration: {
        id: 'quick_exploration',
        name: 'Quick Exploration',
        description: 'General-purpose data exploration workflow',
        icon: '🔍',
        color: 'indigo',
        steps: [
            JOURNEY_STEPS.review,
            JOURNEY_STEPS.clean,
            JOURNEY_STEPS.dashboard,
            JOURNEY_STEPS.report
        ],
        suggestedFor: ['generic_dataset']
    }
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get the recommended journey for a source type
 */
export function getJourneyForSourceType(sourceType: SourceType): Journey {
    for (const journey of Object.values(JOURNEYS)) {
        if (journey.suggestedFor.includes(sourceType)) {
            return journey;
        }
    }
    return JOURNEYS.quick_exploration;
}

/**
 * Get all available journeys
 */
export function getAllJourneys(): Journey[] {
    return Object.values(JOURNEYS);
}

/**
 * Get journey by ID
 */
export function getJourneyById(id: string): Journey | undefined {
    return JOURNEYS[id];
}

/**
 * Calculate journey progress percentage
 */
export function calculateJourneyProgress(
    journey: Journey,
    completedSteps: JourneyStepId[]
): number {
    const requiredSteps = journey.steps.filter(s => !s.isOptional);
    const completedRequired = requiredSteps.filter(s => completedSteps.includes(s.id));
    return Math.round((completedRequired.length / requiredSteps.length) * 100);
}

/**
 * Get the next step in the journey
 */
export function getNextStep(
    journey: Journey,
    currentStep: JourneyStepId
): JourneyStep | null {
    const currentIndex = journey.steps.findIndex(s => s.id === currentStep);
    if (currentIndex === -1 || currentIndex >= journey.steps.length - 1) {
        return null;
    }
    return journey.steps[currentIndex + 1];
}

/**
 * Check if a step is accessible (all previous required steps completed)
 */
export function isStepAccessible(
    journey: Journey,
    stepId: JourneyStepId,
    completedSteps: JourneyStepId[]
): boolean {
    const stepIndex = journey.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) return false;
    if (stepIndex === 0) return true;

    // Check all previous required steps are completed
    for (let i = 0; i < stepIndex; i++) {
        const step = journey.steps[i];
        if (!step.isOptional && !completedSteps.includes(step.id)) {
            return false;
        }
    }
    return true;
}

export default {
    JOURNEY_STEPS,
    JOURNEYS,
    getJourneyForSourceType,
    getAllJourneys,
    getJourneyById,
    calculateJourneyProgress,
    getNextStep,
    isStepAccessible
};
