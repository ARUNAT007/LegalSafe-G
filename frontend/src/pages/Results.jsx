import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Download, AlertCircle, FileText, ArrowLeft,
  BookOpen, BarChart2, Network, ShieldCheck, AlertTriangle, BookMarked,
  Sparkles, CheckCircle2, Copy, Layers, Cpu
} from 'lucide-react';

import { getResult } from '../services/api';
import { downloadResultPDF } from '../services/pdfExport';
import VerificationStatus from '../components/VerificationStatus';
import DocumentViewer from '../components/DocumentViewer';
import SimplifiedText from '../components/SimplifiedText';
import LegalFacts from '../components/LegalFacts';
import FactGraph from '../components/FactGraph';
import MismatchPanel from '../components/MismatchPanel';
import LoadingDashboard from '../components/common/LoadingSkeleton';
import ErrorState from '../components/common/ErrorState';

const TABS = [
  { id: 'simplified',   label: 'Plain Language',   Icon: BookOpen },
  { id: 'original',     label: 'Original vs Simplified', Icon: BookMarked },
  { id: 'facts',        label: 'Extracted Legal Facts', Icon: BarChart2 },
  { id: 'graph',        label: 'Legal Fact Graph', Icon: Network },
  { id: 'verification', label: 'Verification Audit', Icon: ShieldCheck },
  { id: 'mismatches',   label: 'Fact Mismatches', Icon: AlertTriangle },
  { id: 'terms',        label: 'Legal Glossary', Icon: BookOpen },
];

const Results = () => {
  const { documentId: resultId } = useParams();
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
      { loading: 'Generating structured PDF report...', success: 'PDF downloaded!', error: 'PDF generation failed' }
    );
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '2rem 1.5rem' }}>
        <LoadingDashboard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: '3rem 1.5rem', maxWidth: '640px', margin: '0 auto' }}>
        <ErrorState
          title="Result Not Found"
          message={error}
          onRetry={fetchResult}
        />
      </div>
    );
  }

  if (!result) return null;

  const verSummary = result.verification_summary || {};
  const clauses = result.clauses || [];
  const allMismatches = result.all_mismatches || [];
  const glossary = result.glossary || [];

  // Derive metrics
  const score = verSummary.average_score ? Math.round(verSummary.average_score * 100) : 100;
  const factCount = clauses.reduce((acc, c) => {
    const orig = c.original_facts || {};
    return acc + (orig.parties?.length || 0) + (orig.subject ? 1 : 0) + (orig.action ? 1 : 0) + (orig.amount ? 1 : 0) + (orig.deadline ? 1 : 0);
  }, 0);

  return (
    <motion.div
      className="container animate-slide-up"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{ padding: '2rem 1.5rem 5rem' }}
    >
      
      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Link to="/analyzer" className="btn btn-secondary btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
              <ArrowLeft size={14} /> Back
            </Link>
            <span className="badge badge-brand">Analysis Results</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              ID: {result.result_id}
            </span>
          </div>

          <h1 className="heading-lg" style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <FileText color="var(--brand-600)" size={28} />
            {result.filename || 'Document_Analysis.pdf'}
          </h1>

          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Analyzed {clauses.length} clause{clauses.length !== 1 ? 's' : ''} • Processing Mode: <strong style={{ color: 'var(--text-heading)', textTransform: 'capitalize' }}>{result.mode}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-brand" onClick={handleExport}>
            <Download size={16} /> Export PDF Report
          </button>
        </div>
      </div>

      {/* Top Summary Metrics Cards (4 Stat Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
        
        <div className="saas-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.04em' }}>
            Extracted Legal Facts
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--brand-600)' }}>
            {factCount} Facts
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Entities, obligations, deadlines
          </div>
        </div>

        <div className="saas-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.04em' }}>
            Verification Status
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: allMismatches.length === 0 ? 'var(--success)' : 'var(--warning)' }}>
            {allMismatches.length === 0 ? 'VERIFIED' : 'WARNINGS'}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {allMismatches.length === 0 ? '0 fact mismatches detected' : `${allMismatches.length} potential fact mismatch(es)`}
          </div>
        </div>

        <div className="saas-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.04em' }}>
            Meaning Preservation
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)' }}>
            {score}%
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            NetworkX graph alignment score
          </div>
        </div>

        <div className="saas-card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem', letterSpacing: '0.04em' }}>
            Clauses Processed
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-heading)' }}>
            {clauses.length} Clauses
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Constraint-guided LLM
          </div>
        </div>

      </div>

      {/* Main Tabbed Container */}
      <div className="saas-card" style={{ padding: 0, overflow: 'hidden' }}>
        
        {/* Tab Navigation Header */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--bg-subtle)',
          borderBottom: '1px solid var(--border-subtle)',
          overflowX: 'auto'
        }}>
          {TABS.map(({ id, label, Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  padding: '1rem 1.35rem',
                  border: 'none',
                  borderBottom: isActive ? '3px solid var(--brand-600)' : '3px solid transparent',
                  backgroundColor: isActive ? '#ffffff' : 'transparent',
                  color: isActive ? 'var(--brand-600)' : 'var(--text-muted)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={16} color={isActive ? 'var(--brand-600)' : 'var(--text-muted)'} />
                {label}
                {id === 'mismatches' && allMismatches.length > 0 && (
                  <span style={{
                    backgroundColor: 'var(--error)',
                    color: '#ffffff',
                    borderRadius: '9999px',
                    padding: '0.1rem 0.45rem',
                    fontSize: '0.7rem',
                    fontWeight: 700
                  }}>
                    {allMismatches.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Panels */}
        <div style={{ padding: '2rem 1.75rem' }}>
          {activeTab === 'simplified'   && <SimplifiedText clauses={clauses} />}
          {activeTab === 'original'     && <DocumentViewer clauses={clauses} />}
          {activeTab === 'facts'        && <LegalFacts clauses={clauses} />}
          {activeTab === 'graph'        && <FactGraph clauses={clauses} />}
          {activeTab === 'verification' && <VerificationStatus summary={verSummary} clauses={clauses} expanded />}
          {activeTab === 'mismatches'   && <MismatchPanel mismatches={allMismatches} />}
          {activeTab === 'terms'        && <GlossaryPanel glossary={glossary} />}
        </div>

      </div>

    </motion.div>
  );
};

// Inline Glossary Panel
const GlossaryPanel = ({ glossary = [] }) => {
  if (glossary.length === 0) {
    return (
      <div className="flex-center" style={{ flexDirection: 'column', gap: '1rem', padding: '3rem 0', textAlign: 'center' }}>
        <BookOpen size={40} color="var(--text-muted)" />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No complex legal jargon detected requiring glossary explanations.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-heading)' }}>
        Easy-Term Explanations
      </h3>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Legal terms extracted from the document with plain English definitions:
      </p>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {glossary.map((item, idx) => (
          <div key={idx} className="saas-card" style={{ padding: '1.25rem' }}>
            <h4 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.35rem', color: 'var(--brand-600)' }}>
              {item.term}
            </h4>
            <p style={{ color: 'var(--text-body)', fontSize: '0.875rem', lineHeight: 1.5, margin: 0 }}>
              {item.explanation}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Results;
