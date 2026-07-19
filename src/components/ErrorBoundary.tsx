import React, { Component } from 'react';

interface Props {
  children: React.ReactNode;
  /** Optional label for the wrapped section, shown in the fallback (e.g. the tab name). */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto my-12 p-6 bg-rose-50 border border-rose-200 rounded-2xl shadow-sm text-center">
          <p className="text-[10px] uppercase tracking-wider text-rose-500 font-bold mb-2">
            Something went wrong{this.props.section ? ` in ${this.props.section}` : ''}
          </p>
          <h2 className="text-lg font-bold text-rose-900 mb-2">This section hit an unexpected error</h2>
          <p className="text-xs text-rose-700/80 mb-5 break-words">
            {this.state.error?.message || 'An unknown error occurred.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-white border border-rose-200 rounded-lg font-bold hover:bg-rose-100 uppercase text-[10px] tracking-wider cursor-pointer transition text-rose-800"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#856637] text-white rounded-lg font-bold hover:opacity-90 uppercase text-[10px] tracking-wider cursor-pointer transition"
            >
              Reload app
            </button>
          </div>
          <p className="text-[10px] text-rose-600/60 mt-4">You can also switch to another tab and come back.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
