import React, { useState } from 'react';
import { Search, Filter, Database } from 'lucide-react';

const LegalFacts = ({ clauses }) => {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Extract facts from clauses
  const facts = [];
  if (clauses && clauses.length > 0) {
    let factId = 0;
    clauses.forEach((c) => {
      const cFacts = c.original_facts || {};
      const sourceText = c.original_text || cFacts.source_text || "";
      
      const addFact = (type, subtype, value, extra = {}) => {
        if (value) {
          facts.push({
            id: `f${++factId}`,
            type,
            subtype,
            value,
            clauseId: c.clause_id,
            sourceText,
            ...extra
          });
        }
      };

      if (cFacts.subject) addFact('ENTITY', 'SUBJECT', cFacts.subject);
      if (cFacts.obj) addFact('ENTITY', 'OBJECT', cFacts.obj);
      if (cFacts.parties && Array.isArray(cFacts.parties)) {
        cFacts.parties.forEach(p => addFact('ENTITY', 'PARTY', p));
      }
      if (cFacts.organizations && Array.isArray(cFacts.organizations)) {
        cFacts.organizations.forEach(o => addFact('ENTITY', 'ORG', o));
      }
      
      if (cFacts.action) addFact('OBLIGATION', 'ACTION', cFacts.action, { agent: cFacts.subject, target: cFacts.obj, modality: cFacts.modality });
      
      if (cFacts.condition) addFact('CONDITION', 'PREREQUISITE', cFacts.condition);
      if (cFacts.conditions && Array.isArray(cFacts.conditions)) {
        cFacts.conditions.forEach(cond => addFact('CONDITION', 'PREREQUISITE', cond));
      }

      if (cFacts.exception) addFact('CONDITION', 'EXCEPTION', cFacts.exception);
      if (cFacts.exceptions && Array.isArray(cFacts.exceptions)) {
        cFacts.exceptions.forEach(exc => addFact('CONDITION', 'EXCEPTION', exc));
      }

      if (cFacts.penalty) addFact('PENALTY', 'PENALTY', cFacts.penalty);
      if (cFacts.amount) addFact('PENALTY', 'AMOUNT', cFacts.amount);
      if (cFacts.percentage) addFact('PENALTY', 'PERCENTAGE', cFacts.percentage);
      if (cFacts.frequency) addFact('OBLIGATION', 'FREQUENCY', cFacts.frequency);
      if (cFacts.deadline) addFact('OBLIGATION', 'DEADLINE', cFacts.deadline);
      if (cFacts.duration) addFact('OBLIGATION', 'DURATION', cFacts.duration);
    });
  }

  const filteredFacts = facts.filter(f => 
    (filter === 'ALL' || f.type === filter) &&
    (f.value.toLowerCase().includes(search.toLowerCase()) || f.subtype.toLowerCase().includes(search.toLowerCase()))
  );

  const getTypeColor = (type) => {
    switch(type) {
      case 'ENTITY': return 'var(--accent-secondary)';
      case 'OBLIGATION': return 'var(--accent-primary)';
      case 'CONDITION': return 'var(--warning)';
      case 'PENALTY': return 'var(--error)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['ALL', 'ENTITY', 'OBLIGATION', 'CONDITION', 'PENALTY'].map(t => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              style={{
                background: filter === t ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: '1px solid var(--surface-border)',
                color: 'white',
                padding: '0.4rem 0.8rem',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              {t}
            </button>
          ))}
        </div>
        
        <div style={{ position: 'relative', width: '250px' }}>
          <Search size={16} color="var(--text-secondary)" style={{ position: 'absolute', left: '10px', top: '10px' }} />
          <input 
            type="text" 
            placeholder="Search facts..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: '100%', paddingLeft: '35px' }}
          />
        </div>
      </div>

      {filteredFacts.length === 0 ? (
        <div className="flex-center" style={{ flexDirection: 'column', padding: '4rem 0', color: 'var(--text-secondary)' }}>
          <Database size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
          <p>No legal facts found matching your criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {filteredFacts.map(fact => (
            <div key={fact.id} style={{ 
              background: 'rgba(0,0,0,0.2)', 
              border: '1px solid var(--surface-border)', 
              borderLeft: `4px solid ${getTypeColor(fact.type)}`,
              borderRadius: 'var(--radius-sm)', 
              padding: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: getTypeColor(fact.type), letterSpacing: '0.05em' }}>
                  {fact.type} • {fact.subtype}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Clause {fact.clauseId}</span>
              </div>
              
              <div style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem', color: 'white' }}>
                "{fact.value}"
              </div>
              
              {(fact.agent || fact.target || fact.modality) && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {fact.modality && <div><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Modality:</span> {fact.modality}</div>}
                  {fact.agent && <div><span>Subject:</span> {fact.agent}</div>}
                  {fact.target && <div><span>Object:</span> {fact.target}</div>}
                </div>
              )}

              {/* Source traceability quote */}
              {fact.sourceText && (
                <div style={{
                  marginTop: '0.85rem',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '4px',
                  borderLeft: '2px solid var(--accent-primary)',
                  fontSize: '0.78rem',
                }}>
                  <span style={{ color: 'var(--accent-primary)', fontWeight: 600, display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                    Source Text
                  </span>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', fontStyle: 'italic', lineHeight: 1.4 }}>
                    "{fact.sourceText}"
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LegalFacts;
