import React from 'react';
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const ErrorState = ({
  title = "Processing Error Encountered",
  message = "Unable to complete the analysis. Please verify your document format and try again.",
  onRetry = null,
  showHomeButton = true
}) => {
  return (
    <div className="saas-card" style={{
      border: '1px solid var(--error-border)',
      backgroundColor: 'var(--error-bg)',
      padding: '2rem',
      borderRadius: 'var(--radius-md)'
    }}>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: 'var(--radius-sm)',
          backgroundColor: '#fee2e2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: 'var(--error)'
        }}>
          <AlertTriangle size={22} />
        </div>

        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--error)', marginBottom: '0.35rem' }}>
            {title}
          </h4>

          <p style={{ color: '#991b1b', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
            {message}
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {onRetry && (
              <button onClick={onRetry} className="btn btn-sm" style={{ backgroundColor: '#dc2626', color: '#ffffff' }}>
                <RefreshCw size={14} />
                Try Again
              </button>
            )}

            {showHomeButton && (
              <Link to="/analyzer" className="btn btn-secondary btn-sm" style={{ borderColor: '#fca5a5', color: '#7f1d1d' }}>
                <ArrowLeft size={14} />
                Back to Analyzer
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorState;
