import React, { useState } from 'react';
import { Copy, ChevronDown, ChevronUp, Check, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

const DocumentViewer = ({ clauses }) => {
  const [activeTab, setActiveTab] = useState('both'); // both | original | simplified

  if (!clauses || clauses.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>No document data available.</p>;
  }

  const originalDoc = clauses.map(c => c.original_text).join('\n\n');
  const simplifiedDoc = clauses.map(c => c.simplified_text_final || c.simplified_text_constrained || c.original_text).join('\n\n');
  
  const mappedClauses = clauses.map(c => ({
    id: c.clause_id,
    original: c.original_text,
    simplified: c.simplified_text_final || c.simplified_text_constrained || c.original_text
  }));

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>
            Original vs. Simplified Comparison
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Side-by-side alignment for legal review and auditability.
          </p>
        </div>

        {/* View mode toggle */}
        <div style={{ display: 'flex', backgroundColor: 'var(--bg-subtle)', padding: '0.2rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => setActiveTab('both')}
            style={{
              padding: '0.35rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              backgroundColor: activeTab === 'both' ? '#ffffff' : 'transparent',
              color: activeTab === 'both' ? 'var(--brand-600)' : 'var(--text-muted)',
              boxShadow: activeTab === 'both' ? 'var(--shadow-xs)' : 'none',
              cursor: 'pointer'
            }}
          >
            Side-by-Side
          </button>
          <button
            onClick={() => setActiveTab('original')}
            style={{
              padding: '0.35rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              backgroundColor: activeTab === 'original' ? '#ffffff' : 'transparent',
              color: activeTab === 'original' ? 'var(--brand-600)' : 'var(--text-muted)',
              boxShadow: activeTab === 'original' ? 'var(--shadow-xs)' : 'none',
              cursor: 'pointer'
            }}
          >
            Original Only
          </button>
          <button
            onClick={() => setActiveTab('simplified')}
            style={{
              padding: '0.35rem 0.85rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: '4px',
              backgroundColor: activeTab === 'simplified' ? '#ffffff' : 'transparent',
              color: activeTab === 'simplified' ? 'var(--brand-600)' : 'var(--text-muted)',
              boxShadow: activeTab === 'simplified' ? 'var(--shadow-xs)' : 'none',
              cursor: 'pointer'
            }}
          >
            Simplified Only
          </button>
        </div>
      </div>

      {/* Side-by-Side Split View */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: activeTab === 'both' ? 'repeat(auto-fit, minmax(320px, 1fr))' : '1fr',
        gap: '1.5rem'
      }}>
        
        {(activeTab === 'both' || activeTab === 'original') && (
          <Panel
            title="Original Legalese Document"
            text={originalDoc}
            onCopy={() => handleCopy(originalDoc, 'Original Document')}
            badgeText="Source Document"
          />
        )}

        {(activeTab === 'both' || activeTab === 'simplified') && (
          <Panel
            title="Plain-Language Version (LegalSafe-G)"
            text={simplifiedDoc}
            onCopy={() => handleCopy(simplifiedDoc, 'Simplified Document')}
            accent
            badgeText="Verified Simplification"
          />
        )}

      </div>

      {/* Clause Alignment Accordions */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-heading)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
          Clause-by-Clause Alignment
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {mappedClauses.map((clause, idx) => (
            <ClauseAccordion key={clause.id || idx} clause={clause} index={idx + 1} onCopy={handleCopy} />
          ))}
        </div>
      </div>

    </div>
  );
};

const Panel = ({ title, text, onCopy, accent, badgeText }) => {
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="saas-card" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '480px', border: accent ? '1px solid var(--brand-500)' : '1px solid var(--border-subtle)' }}>
      
      <div style={{
        padding: '1rem 1.25rem',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: accent ? 'var(--brand-50)' : 'var(--bg-subtle)'
      }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: accent ? 'var(--brand-600)' : 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: '0.1rem' }}>
            {badgeText}
          </div>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>
            {title}
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            {wordCount} words
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onCopy} title="Copy full panel text">
            <Copy size={14} />
          </button>
        </div>
      </div>

      <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, lineHeight: 1.7, fontSize: '0.925rem', color: 'var(--text-body)', whiteSpace: 'pre-wrap' }}>
        {text}
      </div>

    </div>
  );
};

const ClauseAccordion = ({ clause, index, onCopy }) => {
  const [open, setOpen] = useState(index === 1);

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', backgroundColor: '#ffffff' }}>
      
      <button
        style={{
          width: '100%',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: open ? 'var(--bg-subtle)' : '#ffffff',
          border: 'none',
          color: 'var(--text-heading)',
          cursor: 'pointer',
          textAlign: 'left'
        }}
        onClick={() => setOpen(!open)}
      >
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
          Clause {index}
          <span style={{ color: 'var(--text-muted)', fontWeight: 500, marginLeft: '0.75rem', fontSize: '0.825rem' }}>
            ID: {clause.id}
          </span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--brand-600)', fontWeight: 600 }}>
            {open ? 'Collapse Alignment' : 'Expand Alignment'}
          </span>
          {open ? <ChevronUp size={18} color="var(--brand-600)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
        </div>
      </button>

      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', borderTop: '1px solid var(--border-subtle)' }}>
          
          <div style={{ padding: '1.25rem', backgroundColor: '#ffffff', borderRight: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
              Original Clause
            </div>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-body)', margin: 0, fontStyle: 'italic' }}>
              "{clause.original}"
            </p>
          </div>

          <div style={{ padding: '1.25rem', backgroundColor: 'var(--brand-50)', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.725rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--brand-600)', letterSpacing: '0.04em' }}>
                Simplified Version
              </div>
              <button
                onClick={() => onCopy(clause.simplified, `Clause ${index}`)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '0.2rem 0.4rem' }}
                title="Copy simplified text"
              >
                <Copy size={13} />
              </button>
            </div>
            <p style={{ fontSize: '0.925rem', lineHeight: 1.6, color: 'var(--text-heading)', fontWeight: 600, margin: 0 }}>
              {clause.simplified}
            </p>
          </div>

        </div>
      )}

    </div>
  );
};

export default DocumentViewer;
