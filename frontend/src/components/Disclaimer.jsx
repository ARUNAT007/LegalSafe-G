import React, { useState } from 'react';
import { AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Disclaimer = () => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: 0, 
      left: 0, 
      right: 0, 
      zIndex: 100,
      background: 'rgba(255, 179, 71, 0.15)',
      backdropFilter: 'blur(10px)',
      borderTop: '1px solid rgba(255, 179, 71, 0.3)',
      boxShadow: '0 -4px 20px rgba(0,0,0,0.5)'
    }}>
      <div className="container" style={{ position: 'relative' }}>
        <button 
          onClick={() => setExpanded(!expanded)}
          style={{
            position: 'absolute',
            top: expanded ? '1rem' : '50%',
            right: '1.5rem',
            transform: expanded ? 'none' : 'translateY(-50%)',
            background: 'rgba(0,0,0,0.2)',
            border: 'none',
            color: 'var(--warning)',
            width: '28px', height: '28px',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>

        <div style={{ display: 'flex', gap: '1rem', padding: expanded ? '1.5rem 3rem 1.5rem 0' : '0.75rem 3rem 0.75rem 0', alignItems: expanded ? 'flex-start' : 'center' }}>
          <AlertTriangle color="var(--warning)" style={{ flexShrink: 0, marginTop: expanded ? '2px' : '0' }} />
          
          <div style={{ flex: 1 }}>
            <h4 style={{ color: 'var(--warning)', margin: 0, fontSize: expanded ? '1rem' : '0.9rem', fontWeight: 600 }}>
              Research Prototype Warning
            </h4>
            
            <AnimatePresence>
              {expanded && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <p style={{ color: 'var(--text-primary)', fontSize: '0.85rem', lineHeight: 1.5, marginTop: '0.5rem', opacity: 0.9 }}>
                    LegalSafe-G is an experimental research framework designed to evaluate constraint-guided transformer architectures. 
                    It is <strong>NOT</strong> a substitute for professional legal advice. AI-generated simplifications may contain inaccuracies, 
                    omissions, or misinterpretations of law. Always consult a qualified attorney before signing or relying on any legal document.
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
