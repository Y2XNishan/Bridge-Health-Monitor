import React from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught an error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoDashboard = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onNavigateDashboard) {
      this.props.onNavigateDashboard();
    } else {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 max-w-lg mx-auto text-center space-y-4">
          <div 
            className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ background: '#FDF2F2', border: '1px solid #FECACA', color: '#991B1B' }}
          >
            <AlertTriangle size={28} />
          </div>
          
          <div className="space-y-1">
            <h2 className="text-base font-bold tracking-tight" style={{ color: 'var(--text-primary, #0F172A)' }}>
              Component crashed
            </h2>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary, #64748B)' }}>
              An unexpected error occurred while rendering this view.
            </p>
          </div>

          {this.state.error?.message && (
            <div 
              className="p-3 rounded-xl text-left text-xs font-mono max-w-full overflow-x-auto w-full"
              style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#B91C1C' }}
            >
              <span className="font-semibold block mb-0.5">Error details:</span>
              <span className="text-[11px] leading-relaxed break-words">{this.state.error.message}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleGoDashboard}
              className="h-9 px-4 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition cursor-pointer shadow-sm hover:opacity-95"
              style={{ background: '#0F6E56' }}
            >
              <Home size={14} />
              <span>Back to dashboard</span>
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              className="h-9 px-3.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer hover:bg-slate-100"
              style={{ background: 'var(--bg-card, #FFFFFF)', border: '1px solid var(--border-subtle, #E2E8F0)', color: 'var(--text-primary, #0F172A)' }}
            >
              <RotateCcw size={13} />
              <span>Try again</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
