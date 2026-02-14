/**
 * JourneyProgressBar Component
 * 
 * A horizontal stepper that shows the user where they are in their data journey.
 * Part of Phase 1: Intelligent Core Loop
 * 
 * Features:
 * - Shows all steps in the current journey
 * - Highlights completed, current, and upcoming steps
 * - Allows navigation to completed steps
 * - Shows step descriptions on hover
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Journey,
    JourneyStep,
    JourneyStepId,
    isStepAccessible,
    calculateJourneyProgress
} from '../config/journeys';

// Tailwind can't safely generate dynamic class names like `bg-${color}-500` in production builds.
// Keep an explicit mapping so styles are always included.
const JOURNEY_COLOR_CLASSES: Record<string, {
    bg500: string;
    border500: string;
    text500: string;
    textLabelCompleted: string;
    shadow500_30: string;
}> = {
    indigo: {
        bg500: 'bg-indigo-500',
        border500: 'border-indigo-500',
        text500: 'text-indigo-500',
        textLabelCompleted: 'text-indigo-600 dark:text-indigo-400',
        shadow500_30: 'shadow-indigo-500/30',
    },
    emerald: {
        bg500: 'bg-emerald-500',
        border500: 'border-emerald-500',
        text500: 'text-emerald-500',
        textLabelCompleted: 'text-emerald-600 dark:text-emerald-400',
        shadow500_30: 'shadow-emerald-500/30',
    },
    blue: {
        bg500: 'bg-blue-500',
        border500: 'border-blue-500',
        text500: 'text-blue-500',
        textLabelCompleted: 'text-blue-600 dark:text-blue-400',
        shadow500_30: 'shadow-blue-500/30',
    },
    purple: {
        bg500: 'bg-purple-500',
        border500: 'border-purple-500',
        text500: 'text-purple-500',
        textLabelCompleted: 'text-purple-600 dark:text-purple-400',
        shadow500_30: 'shadow-purple-500/30',
    },
    orange: {
        bg500: 'bg-orange-500',
        border500: 'border-orange-500',
        text500: 'text-orange-500',
        textLabelCompleted: 'text-orange-600 dark:text-orange-400',
        shadow500_30: 'shadow-orange-500/30',
    },
    amber: {
        bg500: 'bg-amber-500',
        border500: 'border-amber-500',
        text500: 'text-amber-500',
        textLabelCompleted: 'text-amber-600 dark:text-amber-400',
        shadow500_30: 'shadow-amber-500/30',
    },
    slate: {
        bg500: 'bg-slate-500',
        border500: 'border-slate-500',
        text500: 'text-slate-500',
        textLabelCompleted: 'text-slate-600 dark:text-slate-400',
        shadow500_30: 'shadow-slate-500/30',
    },
};

interface JourneyProgressBarProps {
    journey: Journey;
    currentStep: JourneyStepId;
    completedSteps: JourneyStepId[];
    datasetId: string;
    workspaceId: string;
    onStepClick?: (step: JourneyStep) => void;
}

export const JourneyProgressBar: React.FC<JourneyProgressBarProps> = ({
    journey,
    currentStep,
    completedSteps,
    datasetId,
    workspaceId,
    onStepClick
}) => {
    const navigate = useNavigate();
    const location = useLocation();

    const color = JOURNEY_COLOR_CLASSES[journey.color] || JOURNEY_COLOR_CLASSES.indigo;
    const progress = calculateJourneyProgress(journey, completedSteps);
    const currentIndex = journey.steps.findIndex(s => s.id === currentStep);

    const handleStepClick = (step: JourneyStep) => {
        if (onStepClick) {
            onStepClick(step);
            return;
        }

        // Check if step is accessible
        if (!isStepAccessible(journey, step.id, completedSteps)) {
            return;
        }

        // Navigate to the step's route with query params
        const url = `${step.route}?workspace=${workspaceId}&dataset=${datasetId}`;
        navigate(url);
    };

    const getStepStatus = (step: JourneyStep, index: number): 'completed' | 'current' | 'upcoming' | 'locked' => {
        if (completedSteps.includes(step.id)) return 'completed';
        if (step.id === currentStep) return 'current';
        if (!isStepAccessible(journey, step.id, completedSteps)) return 'locked';
        return 'upcoming';
    };

    return (
        <div className="w-full bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
            {/* Journey Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{journey.icon}</span>
                    <div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                            {journey.name}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {journey.description}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        {progress}% Complete
                    </div>
                    <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full ${color.bg500} transition-all duration-500`}
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Step Progress */}
            <div className="flex items-center justify-between relative">
                {/* Connecting line */}
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700 -z-10" />
                <div
                    className={`absolute top-5 left-0 h-0.5 ${color.bg500} transition-all duration-500 -z-10`}
                    style={{ width: `${(currentIndex / (journey.steps.length - 1)) * 100}%` }}
                />

                {journey.steps.map((step, index) => {
                    const status = getStepStatus(step, index);
                    const isClickable = status === 'completed' || status === 'current';

                    return (
                        <div
                            key={step.id}
                            className="flex flex-col items-center group"
                        >
                            {/* Step Circle */}
                            <button
                                onClick={() => handleStepClick(step)}
                                disabled={!isClickable}
                                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-lg
                  transition-all duration-300 relative
                  ${status === 'completed'
                                        ? `${color.bg500} text-white shadow-lg ${color.shadow500_30}`
                                        : status === 'current'
                                            ? `bg-white dark:bg-slate-800 border-2 ${color.border500} ${color.text500} shadow-lg animate-pulse`
                                            : status === 'locked'
                                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer'
                                    }
                `}
                            >
                                {status === 'completed' ? (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <span>{step.icon}</span>
                                )}

                                {/* Tooltip */}
                                <div className={`
                  absolute -bottom-16 left-1/2 transform -translate-x-1/2
                  bg-slate-900 dark:bg-slate-700 text-white text-xs rounded-lg
                  px-3 py-2 whitespace-nowrap opacity-0 group-hover:opacity-100
                  transition-opacity pointer-events-none z-20
                  ${status === 'locked' ? 'text-slate-400' : ''}
                `}>
                                    <div className="font-bold">{step.label}</div>
                                    <div className="text-slate-300 text-[10px]">{step.description}</div>
                                    {status === 'locked' && (
                                        <div className="text-amber-400 text-[10px] mt-1">Complete previous steps first</div>
                                    )}
                                    {step.isOptional && (
                                        <div className="text-slate-400 text-[10px] mt-1">Optional</div>
                                    )}
                                    <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 
                    border-4 border-transparent border-b-slate-900 dark:border-b-slate-700" />
                                </div>
                            </button>

                            {/* Step Label */}
                            <span className={`
                                mt-2 text-xs font-medium text-center max-w-[80px]
                ${status === 'completed'
                                    ? `${color.textLabelCompleted}`
                                    : status === 'current'
                                        ? 'text-slate-900 dark:text-white font-bold'
                                        : 'text-slate-400 dark:text-slate-500'
                                }
              `}>
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

/**
 * Minimal version for sidebar or compact views
 */
export const JourneyProgressMini: React.FC<{
    journey: Journey;
    completedSteps: JourneyStepId[];
}> = ({ journey, completedSteps }) => {
    const progress = calculateJourneyProgress(journey, completedSteps);
    const color = JOURNEY_COLOR_CLASSES[journey.color] || JOURNEY_COLOR_CLASSES.indigo;

    return (
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <span className="text-lg">{journey.icon}</span>
            <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {journey.name}
                    </span>
                    <span className="text-xs text-slate-500">{progress}%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${color.bg500}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default JourneyProgressBar;
