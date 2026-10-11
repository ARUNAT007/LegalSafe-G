import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getHistory, removeHistoryItem } from '../services/historyService';
import EmptyState from '../components/common/EmptyState';
import { Clock, FileText, Trash2, ArrowRight, ShieldCheck, Search, Filter } from 'lucide-react';

const History = () => {
  const [documents, setDocuments] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setDocuments(getHistory());
  }, []);

  const handleDelete = (id, e) => {
    e.preventDefault();
    e.stopPropagation();
    removeHistoryItem(id);
    setDocuments(getHistory());
  };

  const filtered = documents.filter(doc =>
    doc.filename.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container animate-fade-in" style={{ padding: '2rem 1.5rem 4rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <span className="badge badge-brand">Document Archive</span>
          </div>
          <h1 className="heading-lg" style={{ marginBottom: '0.35rem' }}>
            Analyzed Documents
          </h1>
          <p className="subheading">
            View stored simplification results and verification audit logs.
          </p>
        </div>

        {documents.length > 0 && (
          <div style={{ width: '280px' }}>
            <input
              type="text"
              placeholder="Search documents by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* History Grid or Empty State */}
      {filtered.length === 0 ? (
        <EmptyState
          title={documents.length === 0 ? "No analyzed documents yet" : "No matching documents"}
          description={documents.length === 0 ? "Upload your first legal document to begin constraint-aware simplification and fact verification." : "No documents match your search query."}
          actionLabel="Analyze Document"
          actionLink="/analyzer"
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filtered.map((doc) => {
            const dateStr = doc.created_at
              ? new Date(doc.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Recently analyzed';

            return (
              <div key={doc.result_id} className="saas-card saas-card-interactive" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--brand-50)',
                      color: 'var(--brand-600)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FileText size={20} />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="badge badge-verified">VERIFIED</span>
                      <button
                        onClick={(e) => handleDelete(doc.result_id, e)}
                        className="btn btn-ghost btn-sm"
                        style={{ padding: '0.25rem', color: 'var(--text-muted)' }}
                        title="Delete record"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.35rem', color: 'var(--text-heading)' }}>
                    {doc.filename}
                  </h3>

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    <span>{dateStr}</span>
                    <span>•</span>
                    <span>{doc.clause_count || 1} Clauses</span>
                    <span>•</span>
                    <span style={{ textTransform: 'capitalize' }}>{doc.mode || 'constrained'} Mode</span>
                  </div>
                </div>

                <Link
                  to={`/results/${doc.result_id}`}
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  View Analysis Results
                  <ArrowRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default History;
