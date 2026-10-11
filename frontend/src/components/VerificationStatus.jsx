import React from 'react';
import { ShieldCheck, AlertTriangle, ShieldAlert, RefreshCw, FileCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const VerificationStatus = ({ summary }) => {
  if (!summary) return null;

  const getStatusConfig = (status, score, mismatches) => {
    if (status === 'REGENERATED_AND_VERIFIED') {
      return {
        color: 'var(--success)',
        bg: 'rgba(0, 200, 150, 0.1)',
        border: 'rgba(0, 200, 150, 0.3)',
        icon: <RefreshCw size={36} className="spin-slow" />,
        text: 'REGENERATED & VERIFIED',
        subtext: 'Auto-corrected via constraint feedback'
      };
    }
    if (status === 'VERIFIED' || (score >= 90 && mismatches === 0)) {
      return {
        color: 'var(--success)',
        bg: 'rgba(0, 200, 150, 0.1)',
        border: 'rgba(0, 200, 150, 0.3)',
        icon: <ShieldCheck size={36} />,
        text: 'VERIFIED MATCH',
        subtext: 'Passed quality & fact graph alignment'
      };
    }
    if (status === 'PARTIALLY_VERIFIED' || status === 'WARNING' || mismatches > 0) {
      return {
        color: 'var(--warning)',
        bg: 'rgba(255, 179, 71, 0.1)',
        border: 'rgba(255, 179, 71, 0.3)',
        icon: <AlertTriangle size={36} />,
        text: 'WARNINGS DETECTED',
        subtext: 'Minor mismatches or high structural copy'
      };
    }
    return {
      color: 'var(--error)',
      bg: 'rgba(255, 107, 107, 0.1)',
      border: 'rgba(255, 107, 107, 0.3)',
      icon: <ShieldAlert size={36} />,
      text: 'HUMAN REVIEW REQUIRED',
      subtext: 'Omission or modality flip detected'
    };
  };

  const score = summary.average_score !== undefined ? Math.round(summary.average_score * 100) : 100;
  const verified = summary.clauses_verified ?? summary.passed ?? 0;
  const warnings = summary.clauses_warning ?? 0;
  const review = summary.clauses_requiring_human_review ?? 0;
  const mismatches = summary.total_mismatches ?? 0;
  const regens = summary.total_regeneration_attempts ?? 0;
  const copyScore = summary.average_copy_score !== undefined ? Math.round(summary.average_copy_score * 100) : null;
  const compressionRatio = summary.average_compression_ratio !== undefined ? Math.round(summary.average_compression_ratio * 100) : null;

  const config = getStatusConfig(summary.overall_status, score, mismatches);

  return (
    <div className="saas-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.75rem 2rem' }}>
      
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center' }}>
        {/* Badge Status Box */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem 2rem',
          borderRadius: 'var(--radius-md)',
          backgroundColor: config.bg,
          border: `1px solid ${config.border}`,
          minWidth: '240px',
          textAlign: 'center'
        }}>
          <div style={{ color: config.color, marginBottom: '0.75rem' }}>
            {config.icon}
          </div>
          <div style={{ color: config.color, fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.04em' }}>
            {config.text}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
            {config.subtext}
          </div>
        </div>

        {/* Progress & Core Metrics */}
        <div style={{ flex: 1, minWidth: '280px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-heading)' }}>
              Legal Fact Graph Preservation Score
            </span>
            <span style={{ fontWeight: 800, fontSize: '1.2rem', color: config.color }}>
              {score}%
            </span>
          </div>
          
          {/* Animated Bar */}
          <div style={{ height: '10px', backgroundColor: 'var(--bg-subtle)', borderRadius: '5px', overflow: 'hidden', marginBottom: '1.25rem', border: '1px solid var(--border-subtle)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 0.8, delay: 0.1 }}
              style={{ height: '100%', backgroundColor: config.color }}
            />
          </div>

          {/* Core Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem' }}>
            <StatBox label="Verified Clauses" value={verified} color="var(--success)" />
            <StatBox label="Warnings" value={warnings} color={warnings > 0 ? 'var(--warning)' : 'var(--text-muted)'} />
            <StatBox label="Needs Review" value={review} color={review > 0 ? 'var(--error)' : 'var(--text-muted)'} />
            <StatBox label="Mismatches" value={mismatches} color={mismatches > 0 ? 'var(--warning)' : 'var(--text-muted)'} />
            <StatBox label="Auto Retries" value={regens} color={regens > 0 ? 'var(--accent-secondary)' : 'var(--text-muted)'} />
          </div>
        </div>
      </div>

      {/* Quality Sub-panel if available */}
      {(copyScore !== null || compressionRatio !== null) && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px dashed var(--border-subtle)',
          fontSize: '0.825rem',
          color: 'var(--text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileCheck size={16} color="var(--accent-primary)" />
            <span>Structural Similarity (Copy Index): <strong style={{ color: copyScore > 90 ? 'var(--warning)' : 'var(--text-heading)' }}>{copyScore}%</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--accent-secondary)' }}>📊</span>
            <span>Length Compression: <strong style={{ color: 'var(--text-heading)' }}>{compressionRatio}%</strong> of original</span>
          </div>
        </div>
      )}

    </div>
  );
};

const StatBox = ({ label, value, color = 'var(--text-heading)' }) => (
  <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '0.75rem 0.85rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.03em', fontWeight: 600 }}>
      {label}
    </div>
    <div style={{ fontSize: '1.25rem', fontWeight: 800, color }}>
      {value}
    </div>
  </div>
);

export default VerificationStatus;
