import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import FileUpload from '../components/FileUpload';
import { getHistory } from '../services/historyService';
import { Clock, FileText, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

const Analyzer = () => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(getHistory().slice(0, 4));
  }, []);

  return (
    <div className="container animate-fade-in" style={{ padding: '2rem 1.5rem 4rem' }}>
      
      {/* Upload Workspace Component */}
      <FileUpload />

      {/* Recent Analyzed Documents Quick Section (if history exists) */}
      {history.length > 0 && (
        <div style={{ maxWidth: '820px', margin: '3.5rem auto 0', paddingTop: '2.5rem', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} color="var(--brand-600)" />
              Recently Analyzed Documents
            </h3>
            <Link to="/documents" style={{ fontSize: '0.85rem', color: 'var(--brand-600)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              View All History <ArrowRight size={14} />
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {history.map((doc) => (
              <Link
                key={doc.result_id}
                to={`/results/${doc.result_id}`}
                className="saas-card saas-card-interactive"
                style={{ padding: '1rem', textDecoration: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                  <FileText size={16} color="var(--brand-600)" />
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.filename}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>{doc.clause_count || 1} Clauses</span>
                  <span className="badge badge-verified" style={{ fontSize: '0.65rem' }}>Verified</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default Analyzer;
