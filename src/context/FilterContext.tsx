import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';

interface FilterState {
    // Global filters that apply to all charts
    globalFilters: Record<string, any>;

    // Per-chart filters for cross-filtering
    chartFilters: Record<string, Record<string, any>>;

    // Current drill-down path
    drillPath: string[];

    // Which chart triggered the current filter
    sourceChartId: string | null;

    // Active date range
    dateRange: { start: Date | null; end: Date | null };
}

type FilterAction =
    | { type: 'SET_GLOBAL_FILTER'; key: string; value: any }
    | { type: 'CLEAR_GLOBAL_FILTER'; key: string }
    | { type: 'SET_CHART_FILTER'; chartId: string; key: string; value: any }
    | { type: 'CLEAR_CHART_FILTER'; chartId: string; key?: string }
    | { type: 'DRILL_DOWN'; value: string }
    | { type: 'DRILL_UP' }
    | { type: 'RESET_DRILL' }
    | { type: 'SET_DATE_RANGE'; start: Date | null; end: Date | null }
    | { type: 'CLEAR_ALL' };

const initialState: FilterState = {
    globalFilters: {},
    chartFilters: {},
    drillPath: [],
    sourceChartId: null,
    dateRange: { start: null, end: null }
};

function filterReducer(state: FilterState, action: FilterAction): FilterState {
    switch (action.type) {
        case 'SET_GLOBAL_FILTER':
            return {
                ...state,
                globalFilters: {
                    ...state.globalFilters,
                    [action.key]: action.value
                }
            };

        case 'CLEAR_GLOBAL_FILTER':
            const { [action.key]: _, ...remainingFilters } = state.globalFilters;
            return {
                ...state,
                globalFilters: remainingFilters
            };

        case 'SET_CHART_FILTER':
            return {
                ...state,
                chartFilters: {
                    ...state.chartFilters,
                    [action.chartId]: {
                        ...(state.chartFilters[action.chartId] || {}),
                        [action.key]: action.value
                    }
                },
                sourceChartId: action.chartId
            };

        case 'CLEAR_CHART_FILTER':
            if (action.key) {
                const chartFilters = { ...(state.chartFilters[action.chartId] || {}) };
                delete chartFilters[action.key];
                return {
                    ...state,
                    chartFilters: {
                        ...state.chartFilters,
                        [action.chartId]: chartFilters
                    }
                };
            }
            const { [action.chartId]: __, ...remainingChartFilters } = state.chartFilters;
            return {
                ...state,
                chartFilters: remainingChartFilters,
                sourceChartId: null
            };

        case 'DRILL_DOWN':
            return {
                ...state,
                drillPath: [...state.drillPath, action.value]
            };

        case 'DRILL_UP':
            return {
                ...state,
                drillPath: state.drillPath.slice(0, -1)
            };

        case 'RESET_DRILL':
            return {
                ...state,
                drillPath: []
            };

        case 'SET_DATE_RANGE':
            return {
                ...state,
                dateRange: { start: action.start, end: action.end }
            };

        case 'CLEAR_ALL':
            return initialState;

        default:
            return state;
    }
}

interface FilterContextValue {
    state: FilterState;

    // Global filter actions
    setGlobalFilter: (key: string, value: any) => void;
    clearGlobalFilter: (key: string) => void;

    // Chart filter actions (cross-filtering)
    setChartFilter: (chartId: string, key: string, value: any) => void;
    clearChartFilter: (chartId: string, key?: string) => void;

    // Drill actions
    drillDown: (value: string) => void;
    drillUp: () => void;
    resetDrill: () => void;

    // Date range
    setDateRange: (start: Date | null, end: Date | null) => void;

    // Utilities
    clearAll: () => void;
    getActiveFilters: () => Record<string, any>;
    isFiltered: boolean;

    // Computed values
    currentDrillLevel: number;
    drillBreadcrumbs: string[];
}

const FilterContext = createContext<FilterContextValue | null>(null);

export const FilterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(filterReducer, initialState);

    const setGlobalFilter = useCallback((key: string, value: any) => {
        dispatch({ type: 'SET_GLOBAL_FILTER', key, value });
    }, []);

    const clearGlobalFilter = useCallback((key: string) => {
        dispatch({ type: 'CLEAR_GLOBAL_FILTER', key });
    }, []);

    const setChartFilter = useCallback((chartId: string, key: string, value: any) => {
        dispatch({ type: 'SET_CHART_FILTER', chartId, key, value });
    }, []);

    const clearChartFilter = useCallback((chartId: string, key?: string) => {
        dispatch({ type: 'CLEAR_CHART_FILTER', chartId, key });
    }, []);

    const drillDown = useCallback((value: string) => {
        dispatch({ type: 'DRILL_DOWN', value });
    }, []);

    const drillUp = useCallback(() => {
        dispatch({ type: 'DRILL_UP' });
    }, []);

    const resetDrill = useCallback(() => {
        dispatch({ type: 'RESET_DRILL' });
    }, []);

    const setDateRange = useCallback((start: Date | null, end: Date | null) => {
        dispatch({ type: 'SET_DATE_RANGE', start, end });
    }, []);

    const clearAll = useCallback(() => {
        dispatch({ type: 'CLEAR_ALL' });
    }, []);

    const getActiveFilters = useCallback(() => {
        // Merge global and all chart filters
        const allChartFilters = Object.values(state.chartFilters).reduce(
            (acc, filters) => ({ ...acc, ...filters }),
            {}
        );
        return { ...state.globalFilters, ...allChartFilters };
    }, [state.globalFilters, state.chartFilters]);

    const isFiltered = useMemo(() => {
        return Object.keys(state.globalFilters).length > 0 ||
            Object.keys(state.chartFilters).length > 0 ||
            state.drillPath.length > 0 ||
            state.dateRange.start !== null ||
            state.dateRange.end !== null;
    }, [state]);

    const currentDrillLevel = state.drillPath.length;
    const drillBreadcrumbs = state.drillPath;

    const value: FilterContextValue = {
        state,
        setGlobalFilter,
        clearGlobalFilter,
        setChartFilter,
        clearChartFilter,
        drillDown,
        drillUp,
        resetDrill,
        setDateRange,
        clearAll,
        getActiveFilters,
        isFiltered,
        currentDrillLevel,
        drillBreadcrumbs
    };

    return (
        <FilterContext.Provider value={value}>
            {children}
        </FilterContext.Provider>
    );
};

export const useFilter = (): FilterContextValue => {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error('useFilter must be used within a FilterProvider');
    }
    return context;
};

// Hook for applying filters to data
export const useFilteredData = <T extends Record<string, any>>(
    data: T[],
    chartId?: string
): T[] => {
    const { state, getActiveFilters } = useFilter();

    return useMemo(() => {
        const activeFilters = getActiveFilters();

        // If this chart is the source, don't self-filter
        if (chartId && state.sourceChartId === chartId) {
            return data;
        }

        if (Object.keys(activeFilters).length === 0) {
            return data;
        }

        return data.filter(row => {
            return Object.entries(activeFilters).every(([key, value]) => {
                if (value === null || value === undefined) return true;

                const rowValue = row[key];

                // Handle arrays (multi-select)
                if (Array.isArray(value)) {
                    return value.includes(rowValue);
                }

                // Handle date ranges
                if (value instanceof Date && rowValue) {
                    const rowDate = new Date(rowValue);
                    return rowDate >= value;
                }

                // Exact match
                return rowValue === value;
            });
        });
    }, [data, getActiveFilters, chartId, state.sourceChartId]);
};

export default FilterContext;
