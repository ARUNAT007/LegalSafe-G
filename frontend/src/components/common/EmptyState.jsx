import React from 'react';
import { FolderOpen, Upload, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const EmptyState = ({
  title = "No documents found",
  description = "Upload a legal document to begin constraint-guided simplification and verification.",
  icon: Icon = FolderOpen,
  actionLabel = "Upload Document",
  actionLink = "/analyzer",
  onAction = null
}) => {
  return (
    <div className="saas-card flex-center" style={{ flexDirection: 'column', padding: '4rem 2rem', textAlign: 'center' }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: 'var(--radius-lg)',
        backgroundColor: 'var(--bg-subtle)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '1.25rem',
        color: 'var(--brand-600)'
      }}>
        <Icon size={32} />
      </div>

      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-heading)' }}>
        {title}
      </h3>

      <p style={{ color: 'var(--text-muted)', maxWidth: '460px', marginBottom: '1.75rem', fontSize: '0.925rem' }}>
        {description}
      </p>

      {onAction ? (
        <button onClick={onAction} className="btn btn-brand">
          <Upload size={16} />
          {actionLabel}
        </button>
      ) : actionLink ? (
        <Link to={actionLink} className="btn btn-brand">
          {actionLabel}
          <ArrowRight size={16} />
        </Link>
      ) : null}
    </div>
  );
};

export default EmptyState;
