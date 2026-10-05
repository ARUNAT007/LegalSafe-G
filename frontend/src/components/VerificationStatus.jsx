import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, Loader } from 'lucide-react';
import { motion } from 'framer-motion';

const VerificationStatus = ({ summary }) => {
  if (!summary) return null;

  const getStatusConfig = (score, mismatches) => {
    if (score >= 90 && mismatches === 0) return { color: 'var(--success)', icon: <ShieldCheck size={48} />, text: 'VERIFIED', bg: 'rgba(0, 200, 150, 0.1)' };
    if (mismatches > 0) return { color: 'var(--warning)', icon: <AlertTriangle size={48} />, text: 'WARNINGS FOUND', bg: 'rgba(255, 179, 71, 0.1)' };
    return { color: 'var(--error)', icon: <ShieldAlert size={48} className="animate-pulse" />, text: 'HUMAN REVIEW REQUIRED', bg: 'rgba(255, 107, 107, 0.1)' };
  };

  const score = summary.average_score ? Math.round(summary.average_score * 100) : 100;
  const passed = summary.passed || 0;
  const total = (summary.passed || 0) + (summary.failed || 0);
  const mismatches = summary.total_mismatches || 0;
  const config = getStatusConfig(score, mismatches);

  return (
    <div className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center' }}>
      <div style={{ 
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '2rem', borderRadius: 'var(--radius-md)', background: config.bg,
        border: `1px solid ${config.color}50`, minWidth: '250px'
      }}>
        <div style={{ color: config.color, marginBottom: '1rem' }}>
          {config.icon}
        </div>
        <h2 style={{ color: config.color, margin: 0, fontSize: '1.25rem', letterSpacing: '0.05em' }}>{config.text}</h2>
      </div>

      <div style={{ flex: 1, minWidth: '300px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontWeight: 600 }}>Verification Score</span>
          <span style={{ fontWeight: 700, color: config.color }}>{score}%</span>
        </div>
        
        <div style={{ height: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '6px', overflow: 'hidden', marginBottom: '2rem', border: '1px solid var(--surface-border)' }}>
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, delay: 0.2 }}
            style={{ height: '100%', background: config.color }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <StatBox label="Checks Performed" value={total} />
          <StatBox label="Passed" value={passed} color="var(--success)" />
          <StatBox label="Mismatches" value={mismatches} color={mismatches > 0 ? 'var(--warning)' : 'var(--text-secondary)'} />
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ label, value, color = 'var(--text-primary)' }) => (
  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)' }}>
    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{value}</div>
  </div>
);

export default VerificationStatus;
