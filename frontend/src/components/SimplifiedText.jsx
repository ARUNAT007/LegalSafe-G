import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, ShieldAlert, Copy, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';

const SimplifiedText = ({ clauses }) => {
  const handleRegenerate = (id) => {
    toast.error(`Regeneration currently only available in backend API.`);
  };

  if (!clauses || clauses.length === 0) {
    return <p style={{ color: 'var(--text-secondary)' }}>No clauses available.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Verified Simplification</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <span className="badge badge-verified"><CheckCircle2 size={12}/> VERIFIED</span>
          <span className="badge badge-warning"><AlertTriangle size={12}/> WARNING</span>
          <span className="badge badge-review"><ShieldAlert size={12}/> REVIEW</span>
        </div>
      </div>
      
      {clauses.map((clause, idx) => {
        // Map backend API keys to component expected keys
        const mappedClause = {
          id: clause.clause_id,
          status: clause.final_status || (clause.verification?.graph_comparison_status === 'MATCH' ? 'VERIFIED' : 'PENDING'),
          simplified: clause.simplified_text_final || clause.simplified_text_constrained || clause.original_text,
          original: clause.original_text,
          regenCount: 0,
          warningMsg: clause.verification?.mismatches?.length > 0 
            ? `Detected ${clause.verification.mismatches.length} potential mismatches.` 
            : null
        };
        return (
          <ClauseCard 
            key={mappedClause.id || idx} 
            clause={mappedClause} 
            index={idx + 1} 
            onRegenerate={() => handleRegenerate(mappedClause.id)} 
          />
        );
      })}
    </div>
  );
};

const ClauseCard = ({ clause, index, onRegenerate }) => {
  const [expanded, setExpanded] = useState(false);
  
  const getStatusColor = (status) => {
    if (status === 'VERIFIED') return 'var(--success)';
    if (status === 'WARNING') return 'var(--warning)';
    if (status === 'REVIEW') return 'var(--error)';
    return 'var(--text-secondary)';
  };

  const getStatusIcon = (status) => {
    if (status === 'VERIFIED') return <CheckCircle2 size={16} color={getStatusColor(status)} />;
    if (status === 'WARNING') return <AlertTriangle size={16} color={getStatusColor(status)} />;
    if (status === 'REVIEW') return <ShieldAlert size={16} color={getStatusColor(status)} />;
    return null;
  };

  return (
    <div style={{ 
      background: 'rgba(0,0,0,0.2)', 
      border: `1px solid ${getStatusColor(clause.status)}`, 
      borderRadius: 'var(--radius-md)', 
      padding: '1.5rem',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            width: '28px', height: '28px', borderRadius: '50%', 
            background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.85rem', fontWeight: 'bold'
          }}>
            {index}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {getStatusIcon(clause.status)}
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: getStatusColor(clause.status) }}>{clause.status}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>ID: {clause.id}</span>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {clause.regenCount > 0 && (
            <span className="tag" style={{ background: 'rgba(108, 99, 255, 0.1)', color: 'var(--accent-primary)' }}>
              Regen: {clause.regenCount}
            </span>
          )}
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
            onClick={() => {
              navigator.clipboard.writeText(clause.simplified);
              toast.success('Copied to clipboard');
            }}
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      <div style={{ fontSize: '1.1rem', lineHeight: 1.6, marginBottom: '1rem' }}>
        {clause.simplified}
      </div>

      {clause.warningMsg && (
        <div style={{ background: 'rgba(255, 179, 71, 0.1)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--warning)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertTriangle size={14} /> {clause.warningMsg}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
        <button 
          style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'Hide Original' : 'Show Original'}
        </button>
        
        {clause.status !== 'VERIFIED' && (
          <button 
            className="btn btn-secondary" 
            style={{ padding: '0.25rem 0.75rem', fontSize: '0.85rem', borderColor: 'var(--accent-primary)', color: 'var(--accent-primary)' }}
            onClick={onRegenerate}
          >
            <RefreshCw size={14} /> Regenerate
          </button>
        )}
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          {clause.original}
        </div>
      )}
    </div>
  );
};

export default SimplifiedText;
