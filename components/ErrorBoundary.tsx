import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary class component to catch and handle runtime errors gracefully.
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render(): ReactNode {
    const { hasError, error } = this.state;
    // Access props directly as they are inherited from Component<Props, State>
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center text-3xl mb-4">
                ⚠️
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">System Interruption</h1>
            <p className="text-slate-400 mb-6 max-w-md">
                The Data OS encountered an unexpected state. Your data is persisted in local storage.
            </p>
            <div className="bg-slate-800 p-4 rounded-lg text-left text-xs font-mono text-red-300 mb-8 max-w-lg w-full overflow-auto border border-slate-700">
                {error?.message}
            </div>
            <button 
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
            >
                Reboot System
            </button>
        </div>
      );
    }

    return children || null;
  }
}