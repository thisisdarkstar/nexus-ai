import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ModuleErrorBoundaryProps {
  moduleName: string;
  children: React.ReactNode;
}

interface ModuleErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

/**
 * Isolates rendering errors within an individual Workbench module or overlay so
 * a single failure never unmounts the surrounding application shell.
 */
export class ModuleErrorBoundary extends React.Component<
  ModuleErrorBoundaryProps,
  ModuleErrorBoundaryState
> {
  constructor(props: ModuleErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ModuleErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected rendering failure',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[ModuleErrorBoundary:${this.props.moduleName}]`, error, info.componentStack);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            padding: '2rem',
            height: '100%',
            width: '100%',
            boxSizing: 'border-box',
            color: 'var(--text-primary, #f8fafc)',
            textAlign: 'center',
          }}
        >
          <AlertTriangle size={28} color="#f59e0b" />
          <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
            {this.props.moduleName} encountered an error
          </div>
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-secondary, #94a3b8)',
              maxWidth: '460px',
              wordBreak: 'break-word',
            }}
          >
            {this.state.errorMessage}
          </div>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.45rem 0.9rem',
              borderRadius: '7px',
              border: '1px solid rgba(16, 185, 129, 0.45)',
              background: 'rgba(16, 185, 129, 0.14)',
              color: '#34d399',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RotateCcw size={13} /> Retry Module
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ModuleErrorBoundary;
