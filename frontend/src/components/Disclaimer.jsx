import React, { useState } from 'react';
import { AlertTriangle, ChevronUp, ChevronDown, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Disclaimer = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 90,
      backgroundColor: '#fffbeb',
      borderTop: '1px solid #fde68a',
      boxShadow: 'var(--shadow-lg)'
    }}>
      <div className="container" style={{ position: 'relative' }}>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            position: 'absolute',
            top: '50%',
            right: '1.5rem',
            transform: 'translateY(-50%)',
            background: '#fef3c7',
            border: 'none',
            color: 'var(--warning)',
            width: '28px',
            height: '28px',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
          aria-label="Toggle Legal Disclaimer"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>

        <div style={{ display: 'flex', gap: '0.75rem', padding: '0.6rem 3rem 0.6rem 0', alignItems: 'center' }}>
          <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0 }} />
          
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: 'var(--warning)', fontSize: '0.825rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                Legal & Research Disclaimer:
              </span>
              <span style={{ color: 'var(--text-heading)', fontSize: '0.825rem' }}>
                LegalSafe-G is an AI research framework. Simplifications are for informational assistance and do not constitute legal advice.
              </span>
            </div>
            
            <AnimatePresence>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <p style={{ color: 'var(--text-body)', fontSize: '0.8rem', lineHeight: 1.5, marginTop: '0.4rem' }}>
                    Always consult a qualified legal professional before executing or relying on legal contracts. The verification graph evaluates fact preservation but does not replace human legal review.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Disclaimer;
