import React, { useState } from 'react';
import { Copy, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

const DocumentViewer = ({ clauses }) => {
  if (!clauses || clauses.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>No document data available.</p>;
  }

  const originalDoc = clauses.map(c => c.original_text).join(' ');
  const simplifiedDoc = clauses.map(c => c.simplified_text_final || c.simplified_text_constrained || c.original_text).join(' ');
  
  const mappedClauses = clauses.map(c => ({
    id: c.clause_id,
    original: c.original_text,
    simplified: c.simplified_text_final || c.simplified_text_constrained || c.original_text
  }));

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
        <Panel title="Original Legalese" text={originalDoc} onCopy={() => handleCopy(originalDoc)} />
        <Panel title="Simplified (LegalSafe-G)" text={simplifiedDoc} onCopy={() => handleCopy(simplifiedDoc)} accent />
      </div>

      <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.5rem' }}>Clause-by-Clause Alignment</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {mappedClauses.map((clause, idx) => (
          <ClauseAccordion key={clause.id || idx} clause={clause} index={idx + 1} onCopy={handleCopy} />
        ))}
      </div>
    </div>
  );
};

const Panel = ({ title, text, onCopy, accent }) => (
  <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', height: '400px' }}>
    <div style={{ padding: '1rem', borderBottom: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: accent ? 'rgba(108, 99, 255, 0.1)' : 'transparent' }}>
      <h3 style={{ fontSize: '1rem', margin: 0, color: accent ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{title}</h3>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {text.split(' ').length} words
        </span>
        <button className="btn btn-secondary" style={{ padding: '0.25rem 0.5rem' }} onClick={onCopy}>
          <Copy size={14} />
        </button>
      </div>
    </div>
    <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, lineHeight: 1.8, fontSize: '0.95rem' }}>
      {text}
    </div>
  </div>
);

const ClauseAccordion = ({ clause, index, onCopy }) => {
  const [open, setOpen] = useState(false);
  
  return (
    <div style={{ border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
      <button 
        style={{ width: '100%', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}
        onClick={() => setOpen(!open)}
      >
        <span style={{ fontWeight: 600 }}>Clause {index} <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '1rem', fontSize: '0.85rem' }}>ID: {clause.id}</span></span>
        {open ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      
      {open && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--surface-border)' }}>
          <div style={{ background: 'var(--bg-color)', padding: '1rem', fontSize: '0.9rem', lineHeight: 1.6 }}>
            {clause.original}
          </div>
          <div style={{ background: 'rgba(108, 99, 255, 0.05)', padding: '1rem', fontSize: '0.9rem', lineHeight: 1.6, position: 'relative' }}>
            {clause.simplified}
            <button 
              style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              onClick={() => onCopy(clause.simplified)}
            >
              <Copy size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;
