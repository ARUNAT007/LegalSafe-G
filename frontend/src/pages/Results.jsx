/**
 * Results page — displays the full LegalSafe-G pipeline output.
 *
 * Route: /results/:resultId
 *
 * Fetches the stored result from GET /api/result/:resultId,
 * then renders tabbed panels for all output sections.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Download, AlertCircle, FileText, ArrowLeft,
  BookOpen, BarChart2, Network, ShieldCheck, AlertTriangle, BookMarked,
} from 'lucide-react';

import { getResult } from '../services/api';
import { downloadResultPDF } from '../services/pdfExport';
import VerificationStatus from '../components/VerificationStatus';
import DocumentViewer from '../components/DocumentViewer';
import SimplifiedText from '../components/SimplifiedText';
import LegalFacts from '../components/LegalFacts';
import FactGraph from '../components/FactGraph';
import MismatchPanel from '../components/MismatchPanel';

const TABS = [
  { id: 'simplified',  label: 'Simplified',     Icon: BookOpen },
  { id: 'original',    label: 'Original vs Simplified', Icon: BookMarked },
  { id: 'facts',       label: 'Legal Facts',    Icon: BarChart2 },
  { id: 'graph',       label: 'Fact Graph',     Icon: Network },
  { id: 'verification',label: 'Verification',   Icon: ShieldCheck },
  { id: 'mismatches',  label: 'Mismatches',     Icon: AlertTriangle },
  { id: 'terms',       label: 'Legal Terms',    Icon: BookOpen },
];

const Results = () => {
  const { documentId: resultId } = useParams(); // URL param is named documentId but holds resultId
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('simplified');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const fetchResult = useCallback(async () => {
    if (!resultId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getResult(resultId);
      setResult(data);
    } catch (err) {
      setError(err.message || 'Failed to load results.');
      toast.error('Failed to load results');
    } finally {
      setLoading(false);
    }
  }, [resultId]);

  useEffect(() => { fetchResult(); }, [fetchResult]);

  const handleExport = async () => {
    if (!result) return;
    toast.promise(
      downloadResultPDF(result),
      { loading: 'Generating PDF…', success: 'PDF downloaded!', error: 'PDF generation failed' }
    );
  };

  // ── Loading skeleton ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="container" style={{ padding: '2rem 0' }}>
        <div className="skeleton" style={{ height: '48px', width: '200px', marginBottom: '2rem' }} />
        <div className="skeleton" style={{ height: '160px', marginBottom: '1.5rem' }} />
        <div className="skeleton" style={{ height: '56px', marginBottom: '1.5rem' }} />
        <div className="skeleton" style={{ height: '400px' }} />
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="container flex-center" style={{ height: '60vh', flexDirection: 'column', gap: '1.5rem' }}>
        <AlertCircle size={56} color="var(--error)" />
        <h2 style={{ textAlign: 'center' }}>{error}</h2>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn btn-primary" onClick={fetchResult}>Retry</button>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            <ArrowLeft size={16} /> Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (!result) return null;

  // ── Build summary for VerificationStatus ────────────────────────────────
  const verSummary = result.verification_summary || {};
  const clauses = result.clauses || [];
  const allMismatches = result.all_mismatches || [];
  const glossary = result.glossary || [];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      className="container animate-slide-up"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <button
            className="btn btn-secondary"
            onClick={() => navigate('/')}
            style={{ marginBottom: '0.75rem', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
          >
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="section-title" style={{ margin: 0 }}>
            <FileText color="var(--accent-primary)" />
            Analysis Results
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            {result.filename} · {clauses.length} clause{clauses.length !== 1 ? 's' : ''}
            · Mode: <strong>{result.mode}</strong>
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleExport}>
          <Download size={16} /> Download PDF
        </button>
      </div>

      {/* Verification status always visible at top */}
      <VerificationStatus summary={verSummary} />

      {/* Tabbed content */}
      <div className="glass-card" style={{ marginTop: '2rem', padding: 0, overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap',
          borderBottom: '1px solid var(--surface-border)',
          background: 'rgba(0,0,0,0.2)',
          overflowX: 'auto',
        }}>
          {TABS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  padding: '0.9rem 1.25rem',
                  background: isActive ? 'rgba(108,99,255,0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--accent-primary)' : '2px solid transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: '0.875rem',
                  transition: 'all 0.2s',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon size={14} />
                {label}
                {id === 'mismatches' && allMismatches.length > 0 && (
                  <span style={{
                    background: 'var(--error)', color: 'white',
                    borderRadius: '9999px', padding: '0 6px', fontSize: '0.7rem',
                  }}>
                    {allMismatches.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab panels */}
        <div style={{ padding: '1.5rem' }}>
          {activeTab === 'simplified'   && <SimplifiedText clauses={clauses} />}
          {activeTab === 'original'     && <DocumentViewer clauses={clauses} />}
          {activeTab === 'facts'        && <LegalFacts clauses={clauses} />}
          {activeTab === 'graph'        && <FactGraph clauses={clauses} />}
          {activeTab === 'verification' && <VerificationStatus summary={verSummary} clauses={clauses} expanded />}
          {activeTab === 'mismatches'   && <MismatchPanel mismatches={allMismatches} />}
          {activeTab === 'terms'        && <GlossaryPanel glossary={glossary} />}
        </div>
      </div>

      {/* Disclaimer footer */}
      <div style={{
        marginTop: '2rem', padding: '1rem',
        background: 'rgba(255,179,71,0.08)',
        border: '1px solid rgba(255,179,71,0.2)',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.8rem',
        color: 'var(--text-secondary)',
      }}>
        ⚠️ {result.disclaimer}
      </div>
    </motion.div>
  );
};

// ── Glossary panel (inline for simplicity) ─────────────────────────────────

const GlossaryPanel = ({ glossary = [] }) => {
  if (glossary.length === 0) {
    return (
      <div className="flex-center" style={{ flexDirection: 'column', gap: '1rem', padding: '3rem' }}>
        <BookOpen size={40} color="var(--text-secondary)" />
        <p style={{ color: 'var(--text-secondary)' }}>No difficult legal terms detected in the simplified output.</p>
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        The following legal terms were detected in the simplified text and may need further clarification:
      </p>
      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {glossary.map((item, idx) => (
          <div key={idx} className="glass-card" style={{ padding: '1rem' }}>
            <p style={{ fontWeight: 700, marginBottom: '0.5rem', color: 'var(--accent-secondary)' }}>
              {item.term}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              {item.explanation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Results;
