import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Copy, RefreshCw, ChevronDown, ChevronUp, Check, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

const SimplifiedText = ({ clauses }) => {
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopyAll = () => {
    if (!clauses) return;
    const fullText = clauses
      .map((c, i) => `Clause ${i + 1}:\n${c.simplified_text_final || c.simplified_text_constrained || c.original_text}`)
      .join('\n\n');
    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    toast.success('Copied full simplified document to clipboard');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  if (!clauses || clauses.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>No simplified clauses available.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Panel Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)' }}>
            Plain-Language Version
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            Simplified legal clauses verified for legal fact preservation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button onClick={handleCopyAll} className="btn btn-secondary btn-sm">
            {copiedAll ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
            {copiedAll ? 'Copied' : 'Copy All Clauses'}
          </button>
        </div>
      </div>

      {/* Clause Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {clauses.map((clause, idx) => {
          const status = clause.final_status || (clause.verification?.graph_comparison_status === 'MATCH' ? 'VERIFIED' : 'WARNING');
          const simplified = clause.simplified_text_final || clause.simplified_text_constrained || clause.original_text;
          const original = clause.original_text;
          const warningMsg = clause.verification?.mismatches?.length > 0
            ? `Detected ${clause.verification.mismatches.length} potential fact mismatches.`
            : null;

          return (
            <ClauseCard
              key={clause.clause_id || idx}
              clause={{ id: clause.clause_id, status, simplified, original, warningMsg }}
              index={idx + 1}
            />
          );
        })}
      </div>
    </div>
  );
};

const ClauseCard = ({ clause, index }) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const getStatusBadge = (status) => {
    if (status === 'REGENERATED_AND_VERIFIED') return <span className="badge badge-verified"><RefreshCw size={12} className="spin-slow" /> REGENERATED & VERIFIED</span>;
    if (status === 'VERIFIED') return <span className="badge badge-verified"><CheckCircle2 size={12} /> VERIFIED</span>;
    if (status === 'WARNING') return <span className="badge badge-warning"><AlertTriangle size={12} /> WARNING</span>;
    return <span className="badge badge-review"><ShieldAlert size={12} /> HUMAN REVIEW</span>;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(clause.simplified);
    setCopied(true);
    toast.success(`Copied Clause ${index}`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="saas-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Header info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: 'var(--brand-50)',
            color: 'var(--brand-600)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            fontWeight: 800
          }}>
            {index}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {getStatusBadge(clause.status)}
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Clause {clause.id}</span>
          </div>
        </div>

        <button onClick={handleCopy} className="btn btn-ghost btn-sm" title="Copy clause text">
          {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
          <span style={{ fontSize: '0.8rem' }}>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Main Simplified Text */}
      <div style={{
        fontSize: '1.05rem',
        lineHeight: 1.6,
        fontWeight: 600,
        color: 'var(--text-heading)',
        backgroundColor: 'var(--bg-subtle)',
        padding: '1.15rem 1.25rem',
        borderRadius: 'var(--radius-sm)',
        borderLeft: '4px solid var(--brand-600)'
      }}>
        {clause.simplified}
      </div>

      {/* Warning Alert if Mismatches */}
      {clause.warningMsg && (
        <div style={{
          backgroundColor: 'var(--warning-bg)',
          border: '1px solid var(--warning-border)',
          padding: '0.65rem 0.9rem',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          color: 'var(--warning)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertTriangle size={15} />
          {clause.warningMsg}
        </div>
      )}

      {/* Toggle Original Text */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          className="btn btn-ghost btn-sm"
          style={{ padding: '0.25rem 0.5rem' }}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Hide Original Clause' : 'Compare Original Legal Clause'}
        </button>
      </div>

      {expanded && (
        <div style={{
          padding: '1rem 1.15rem',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.875rem',
          color: 'var(--text-muted)',
          fontStyle: 'italic',
          lineHeight: 1.5
        }}>
          <span style={{ fontWeight: 700, fontStyle: 'normal', color: 'var(--text-heading)', display: 'block', fontSize: '0.75rem', uppercase: 'true', marginBottom: '0.25rem' }}>
            Original Text:
          </span>
          "{clause.original}"
        </div>
      )}

    </div>
  );
};

export default SimplifiedText;
