/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);

        this.setState({ errorInfo });

        // Call optional error handler
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    public render() {
        if (this.state.hasError) {
            // Custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default fallback UI
            return (
                <div className="flex flex-col items-center justify-center min-h-[200px] p-8 bg-slate-900/50 rounded-2xl border border-red-500/30">
                    <div className="text-red-400 mb-4">
                        <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
                    <p className="text-slate-400 text-sm text-center mb-4 max-w-md">
                        {this.state.error?.message || 'An unexpected error occurred in this component.'}
                    </p>
                    <button
                        onClick={this.handleRetry}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        Try Again
                    </button>
                    {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                        <details className="mt-4 text-xs text-slate-500 max-w-full overflow-auto">
                            <summary className="cursor-pointer hover:text-slate-300">Stack Trace</summary>
                            <pre className="mt-2 p-2 bg-slate-800 rounded text-left whitespace-pre-wrap">
                                {this.state.errorInfo.componentStack}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
