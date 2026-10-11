import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ArrowRight, ShieldCheck, Download } from 'lucide-react';
import { motion } from 'framer-motion';

const MismatchPanel = ({ mismatches }) => {
  const [expandedId, setExpandedId] = useState(null);

  if (!mismatches || mismatches.length === 0) {
    return (
      <div className="saas-card flex-center" style={{ flexDirection: 'column', padding: '3.5rem 2rem', textAlign: 'center' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--success-bg)',
          color: 'var(--success)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '1.25rem',
          border: '1px solid var(--success-border)'
        }}>
          <ShieldCheck size={36} />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--success)', marginBottom: '0.5rem' }}>
          Zero Legal Mismatches Detected
        </h3>
        <p style={{ color: 'var(--text-muted)', maxWidth: '480px', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Every financial amount, date, party, obligation, and negation extracted from the original document is 100% preserved in the plain-language version.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle color="var(--warning)" size={20} />
            Identified Fact Discrepancies ({mismatches.length})
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
            List of facts that were altered or omitted during simplification.
          </p>
        </div>
      </div>

      {/* Mismatch Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {mismatches.map((m, idx) => {
          const id = `m_${idx}`;
          const isHigh = !m.type?.includes('OMISSION') && !m.type?.includes('ADDED');
          const typeName = (m.type || 'UNKNOWN').replace(/_/g, ' ');

          return (
            <div
              key={id}
              className="saas-card"
              style={{
                padding: '0',
                border: expandedId === id ? `1px solid ${isHigh ? 'var(--error)' : 'var(--warning)'}` : '1px solid var(--border-subtle)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  padding: '1rem 1.25rem',
                  backgroundColor: expandedId === id ? (isHigh ? 'var(--error-bg)' : 'var(--warning-bg)') : '#ffffff',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  flexWrap: 'wrap',
                  gap: '1rem'
                }}
                onClick={() => setExpandedId(expandedId === id ? null : id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span className={`badge ${isHigh ? 'badge-review' : 'badge-warning'}`}>
                    {typeName}
                  </span>
                  <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    Clause {m.clause_id}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <span style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success-border)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 600 }}>
                      Original: {m.original || 'None'}
                    </span>
                    <ArrowRight size={14} color="var(--text-muted)" />
                    <span style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error)', border: '1px solid var(--error-border)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontWeight: 600 }}>
                      Generated: {m.generated || 'Omitted'}
                    </span>
                  </div>
                </div>
              </div>

              {expandedId === id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  style={{ padding: '1.25rem 1.5rem', backgroundColor: 'var(--bg-app)', borderTop: '1px solid var(--border-subtle)' }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Original Extracted Fact
                      </h4>
                      <div style={{ fontSize: '0.875rem', lineHeight: 1.5, backgroundColor: '#ffffff', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        {m.original || '(No fact registered)'}
                      </div>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Generated Fact Result
                      </h4>
                      <div style={{ fontSize: '0.875rem', lineHeight: 1.5, backgroundColor: 'var(--error-bg)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--error-border)', color: 'var(--error)' }}>
                        {m.generated || '(Fact was omitted from simplified text)'}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

            </div>
          );
        })}
      </div>

    </div>
  );
};

export default MismatchPanel;
