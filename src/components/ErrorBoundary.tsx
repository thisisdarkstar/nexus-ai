import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#020617',
            color: '#e2e8f0',
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <div
            style={{
              textAlign: 'center',
              maxWidth: 440,
              padding: 40,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              <AlertTriangle size={32} color="#ef4444" />
            </div>
            <h2
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: '1.4rem',
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                color: '#94a3b8',
                fontSize: '0.9rem',
                lineHeight: 1.6,
                marginBottom: 24,
              }}
            >
              The app encountered an unexpected error. You can try recovering or reload the page.
            </p>
            {this.state.error && (
              <pre
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  padding: 12,
                  fontSize: '0.75rem',
                  color: '#ef4444',
                  textAlign: 'left',
                  overflow: 'auto',
                  maxHeight: 120,
                  marginBottom: 24,
                  fontFamily: 'monospace',
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={this.handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 20px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: 10,
                  color: '#10b981',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                <RefreshCw size={15} /> Try Again
              </button>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '10px 20px',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
