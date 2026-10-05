import React, { useState } from 'react';
import { AlertCircle, Download, CheckCircle2, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const MismatchPanel = ({ mismatches }) => {
  const [expandedId, setExpandedId] = useState(null);

  if (!mismatches || mismatches.length === 0) {
    return (
      <div className="flex-center" style={{ flexDirection: 'column', padding: '4rem 0', gap: '1rem' }}>
        <CheckCircle2 size={64} color="var(--success)" />
        <h3 style={{ color: 'var(--success)' }}>Zero Mismatches Found</h3>
        <p style={{ color: 'var(--text-secondary)' }}>The generated simplification perfectly aligns with the extracted legal facts.</p>
      </div>
    );
  }

  const getTypeColor = (severity) => {
    return severity === 'high' ? 'var(--error)' : 'var(--warning)';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <AlertCircle color="var(--warning)" />
          Identified Discrepancies
        </h3>
        <button className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {mismatches.map((m, idx) => {
          const id = `m_${idx}`;
          const severity = m.type?.includes('OMISSION') || m.type?.includes('ADDED') ? 'warning' : 'high';
          const typeName = (m.type || 'UNKNOWN').replace(/_/g, ' ');
          
          return (
          <div 
            key={id} 
            style={{ 
              border: `1px solid ${expandedId === id ? getTypeColor(severity) : 'var(--surface-border)'}`,
              borderRadius: 'var(--radius-sm)',
              overflow: 'hidden',
              transition: 'border-color 0.2s'
            }}
          >
            <div 
              style={{ 
                padding: '1rem 1.5rem', 
                background: expandedId === id ? `rgba(${severity === 'high' ? '255,107,107' : '255,179,71'}, 0.05)` : 'rgba(0,0,0,0.2)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                cursor: 'pointer'
              }}
              onClick={() => setExpandedId(expandedId === id ? null : id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className={`badge ${severity === 'high' ? 'badge-review' : 'badge-warning'}`}>
                  {typeName}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Clause {m.clause_id}</span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ background: 'rgba(0, 200, 150, 0.1)', color: 'var(--success)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>{m.original || 'None'}</span>
                  <ArrowRight size={14} color="var(--text-secondary)" />
                  <span style={{ background: 'rgba(255, 107, 107, 0.1)', color: 'var(--error)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>{m.generated || 'None'}</span>
                </div>
              </div>
            </div>
            
            {expandedId === id && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                style={{ padding: '1.5rem', background: 'var(--bg-color)', borderTop: '1px solid var(--surface-border)' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                  <div>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Original Extraction</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.6, background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                      {m.original || '(No original fact)'}
                    </p>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Generated Extraction</h4>
                    <p style={{ fontSize: '0.9rem', lineHeight: 1.6, background: 'rgba(255,107,107,0.05)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                      {m.generated || '(Omitted in generation)'}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )})}
      </div>
    </div>
  );
};

export default MismatchPanel;
