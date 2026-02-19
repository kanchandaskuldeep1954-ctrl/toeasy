/**
 * Journey Configuration
 *
 * Studio-first route map used for optional guidance during upload and onboarding.
 */

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
    icon: string;
    route: string;
    isOptional?: boolean;
    requiredTier?: 'basic' | 'pro' | 'enterprise';
}

export interface Journey {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    steps: JourneyStep[];
    suggestedFor: SourceType[];
}

export const JOURNEY_STEPS: Record<JourneyStepId, JourneyStep> = {
    review: {
        id: 'review',
        label: 'Review Data',
        description: 'Preview uploaded data in sheets mode and validate baseline quality.',
        icon: 'review',
        route: '/app/studio?panel=sheets'
    },
    classify: {
        id: 'classify',
        label: 'Classify',
        description: 'Optional AI-based dataset classification metadata.',
        icon: 'classify',
        route: '/app/studio?panel=sheets'
    },
    clean: {
        id: 'clean',
        label: 'Fix Issues',
        description: 'Resolve quality issues in sheets/query flows. AI suggestions are assistive only.',
        icon: 'quality',
        route: '/app/studio?panel=sheets'
    },
    analyze: {
        id: 'analyze',
        label: 'Analyze',
        description: 'Run SQL/NL analysis and persist evidence artifacts.',
        icon: 'analyze',
        route: '/app/studio?panel=query'
    },
    dashboard: {
        id: 'dashboard',
        label: 'Visualize',
        description: 'Create and drill visual artifacts from query and pivot outputs.',
        icon: 'visuals',
        route: '/app/studio?panel=visuals'
    },
    report: {
        id: 'report',
        label: 'Generate Report',
        description: 'Create evidence-first reporting bundles and briefs.',
        icon: 'report',
        route: '/app/studio?panel=report'
    },
    export: {
        id: 'export',
        label: 'Export',
        description: 'Prepare downstream sync/export actions and status updates.',
        icon: 'export',
        route: '/app/studio?panel=actions',
        isOptional: true
    },
    share: {
        id: 'share',
        label: 'Share',
        description: 'Share insights and approvals with collaborators.',
        icon: 'share',
        route: '/app/studio?panel=comms',
        isOptional: true,
        requiredTier: 'pro'
    }
};

export const JOURNEYS: Record<string, Journey> = {
    financial_analysis: {
        id: 'financial_analysis',
        name: 'Financial Analysis',
        description: 'Analyze invoices, transactions, and financial reports.',
        icon: 'financial',
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
        description: 'Uncover revenue trends and customer patterns.',
        icon: 'sales',
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
        description: 'Analyze workforce data and organizational patterns.',
        icon: 'hr',
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
        description: 'Analyze customer data for segmentation and insights.',
        icon: 'customer',
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
        description: 'Track stock levels and optimize inventory.',
        icon: 'inventory',
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
        description: 'Analyze logs and system events for issues.',
        icon: 'operations',
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
        description: 'General-purpose data exploration workflow.',
        icon: 'explore',
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

export function getJourneyForSourceType(sourceType: SourceType): Journey {
    for (const journey of Object.values(JOURNEYS)) {
        if (journey.suggestedFor.includes(sourceType)) {
            return journey;
        }
    }
    return JOURNEYS.quick_exploration;
}

export function getAllJourneys(): Journey[] {
    return Object.values(JOURNEYS);
}

export function getJourneyById(id: string): Journey | undefined {
    return JOURNEYS[id];
}

export function calculateJourneyProgress(
    journey: Journey,
    completedSteps: JourneyStepId[]
): number {
    const requiredSteps = journey.steps.filter((step) => !step.isOptional);
    const completedRequired = requiredSteps.filter((step) => completedSteps.includes(step.id));
    return Math.round((completedRequired.length / requiredSteps.length) * 100);
}

export function getNextStep(
    journey: Journey,
    currentStep: JourneyStepId
): JourneyStep | null {
    const currentIndex = journey.steps.findIndex((step) => step.id === currentStep);
    if (currentIndex === -1 || currentIndex >= journey.steps.length - 1) {
        return null;
    }
    return journey.steps[currentIndex + 1];
}

export function isStepAccessible(
    journey: Journey,
    stepId: JourneyStepId,
    completedSteps: JourneyStepId[]
): boolean {
    const stepIndex = journey.steps.findIndex((step) => step.id === stepId);
    if (stepIndex === -1) return false;
    if (stepIndex === 0) return true;

    for (let i = 0; i < stepIndex; i += 1) {
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
