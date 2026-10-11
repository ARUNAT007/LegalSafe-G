import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Sparkles, ShieldCheck, FileText, CheckCircle2, ArrowRight,
  Scale, Network, Lock, Cpu, Eye, Check, ChevronRight
} from 'lucide-react';

const Home = () => {
  const navigate = useNavigate();

  const handleScrollToWorkflow = () => {
    const el = document.getElementById('how-it-works');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      
      {/* ── HERO SECTION ────────────────────────────────────────────────── */}
      <section style={{ padding: '3.5rem 0 4rem', position: 'relative', overflow: 'hidden' }}>
        <div className="container" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3.5rem', alignItems: 'center' }}>
          
          {/* Hero Left Column */}
          <div style={{ textAlign: 'center', maxWidth: '820px', margin: '0 auto' }}>
            
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}
            >
              <span className="badge badge-brand" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }}>
                <Sparkles size={13} />
                Constraint-Aware AI Architecture
              </span>
            </motion.div>

            <motion.h1
              className="heading-xl"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={{ marginBottom: '1.25rem' }}
            >
              Understand Legal Documents.<br />
              <span style={{ color: 'var(--brand-600)' }}>Without the Legal Complexity.</span>
            </motion.h1>

            <motion.p
              className="subheading"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              style={{ marginBottom: '2.25rem', maxWidth: '680px', margin: '0 auto 2.25rem' }}
            >
              LegalSafe-G uses AI to simplify complex legal documents while verifying that the simplified version preserves the original legal meaning.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}
            >
              <Link to="/analyzer" className="btn btn-brand btn-lg">
                <Sparkles size={18} />
                Analyze a Document
              </Link>
              <button onClick={handleScrollToWorkflow} className="btn btn-secondary btn-lg">
                How It Works
              </button>
            </motion.div>

            {/* Quick Stats Bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '2.5rem',
                marginTop: '3rem',
                paddingTop: '2rem',
                borderTop: '1px solid var(--border-subtle)',
                flexWrap: 'wrap'
              }}
            >
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary-900)' }}>100%</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fact Traceability</div>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--brand-600)' }}>FLAN-T5</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Constraint Transformer</div>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>NetworkX</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Fact Graph Audit</div>
              </div>
            </motion.div>

          </div>

          {/* Hero Right Column: Interactive Card Preview */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="saas-card"
            style={{
              maxWidth: '920px',
              margin: '0 auto',
              width: '100%',
              padding: '0',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-medium)'
            }}
          >
            {/* Card Header Bar */}
            <div style={{
              backgroundColor: 'var(--primary-900)',
              padding: '0.85rem 1.5rem',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.85rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <FileText size={16} color="var(--brand-400)" />
                <span style={{ fontWeight: 600 }}>Non_Disclosure_Agreement_India.pdf</span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>• 9 pages</span>
              </div>
              <div className="badge badge-verified">
                <ShieldCheck size={12} />
                VERIFIED MATCH (100% PRESERVED)
              </div>
            </div>

            {/* Split Visual Body */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border-subtle)' }}>
              
              {/* Original Clause */}
              <div style={{ padding: '1.5rem', borderRight: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-app)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.04em' }}>
                  Original Legal Text (Clause 2)
                </div>
                <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-body)', fontStyle: 'italic' }}>
                  "The Receiving Party shall hold in strictest confidence and shall not, without the prior written consent of the Disclosing Party, disclose any Confidential Information to any third party, subject to a penalty of ₹50,000."
                </p>
              </div>

              {/* Simplified Clause */}
              <div style={{ padding: '1.5rem', backgroundColor: '#ffffff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-600)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Plain-Language Version (LegalSafe-G)
                  </div>
                  <CheckCircle2 size={15} color="var(--success)" />
                </div>
                <p style={{ fontSize: '0.925rem', lineHeight: 1.6, color: 'var(--text-heading)', fontWeight: 600 }}>
                  You must keep all company information secret. You cannot share it without written permission from the company. If broken, the penalty is ₹50,000.
                </p>
              </div>

            </div>

            {/* Card Footer Bar */}
            <div style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--bg-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div style={{ display: 'flex', gap: '1.5rem' }}>
                <span>✓ Amount Preserved: ₹50,000</span>
                <span>✓ Modality Preserved: MUST NOT</span>
                <span>✓ Fact Graph Verified</span>
              </div>
              <Link to="/analyzer" style={{ color: 'var(--brand-600)', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                Try your own document <ChevronRight size={14} />
              </Link>
            </div>

          </motion.div>

        </div>
      </section>

      {/* ── TRUST & VALUE CARDS ─────────────────────────────────────────── */}
      <section style={{ padding: '4rem 0', backgroundColor: '#ffffff', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="container">
          
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 3rem' }}>
            <h2 className="heading-lg" style={{ marginBottom: '0.75rem' }}>
              Why LegalSafe-G?
            </h2>
            <p className="subheading">
              Standard LLMs often hallucinate or omit critical numbers and conditions. LegalSafe-G uses a dual-stage fact verification framework to guarantee fidelity.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            
            <div className="saas-card">
              <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--brand-50)', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Cpu size={20} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                AI-Powered Simplification
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Uses fine-tuned FLAN-T5 Transformer models with constraint guidance to translate legal legalese into clear, plain English.
              </p>
            </div>

            <div className="saas-card">
              <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Network size={20} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Legal Fact Verification
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Constructs a NetworkX Legal Fact Graph from extracted entities, amounts, and dates to verify graph alignment.
              </p>
            </div>

            <div className="saas-card">
              <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--accent-cyan-subtle)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <ShieldCheck size={20} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Meaning Preservation
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Guarantees zero dropped financial values, dates, parties, or negations. Re-generates automatically if mismatch occurs.
              </p>
            </div>

            <div className="saas-card">
              <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--bg-subtle)', color: 'var(--primary-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Eye size={20} />
              </div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Transparent Traceability
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Every extracted legal fact links directly back to its exact source sentence in your uploaded document for 100% auditability.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ── HOW LEGALSAFE-G WORKS (5 STEPS) ───────────────────────────── */}
      <section id="how-it-works" style={{ padding: '5rem 0 4rem' }}>
        <div className="container">
          
          <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 3.5rem' }}>
            <span className="badge badge-brand" style={{ marginBottom: '0.75rem' }}>Workflow</span>
            <h2 className="heading-lg" style={{ marginBottom: '0.75rem' }}>
              How LegalSafe-G Works
            </h2>
            <p className="subheading">
              A 5-step constraint-aware pipeline ensuring simplification never compromises legal correctness.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', position: 'relative' }}>
            
            {[
              { num: '01', title: 'Upload', desc: 'Drop your PDF, DOCX, or TXT legal document into the analyzer.' },
              { num: '02', title: 'Extract', desc: 'spaCy & PyMuPDF extract structured legal facts, entities, and clauses.' },
              { num: '03', title: 'Fact Graph', desc: 'Builds a NetworkX graph connecting parties, obligations, and penalties.' },
              { num: '04', title: 'Simplify', desc: 'FLAN-T5 generates plain language guided by strict fact constraints.' },
              { num: '05', title: 'Verify', desc: 'Compares graph nodes to verify zero fact loss. Highlights any diffs.' },
            ].map((step, idx) => (
              <div key={idx} className="saas-card" style={{ position: 'relative' }}>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  color: 'var(--brand-600)',
                  marginBottom: '0.75rem',
                  letterSpacing: '-0.02em'
                }}>
                  {step.num}
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {step.desc}
                </p>
              </div>
            ))}

          </div>

        </div>
      </section>

      {/* ── FINAL CTA SECTION ─────────────────────────────────────────── */}
      <section style={{ padding: '4rem 0' }}>
        <div className="container">
          <div style={{
            backgroundColor: 'var(--primary-900)',
            borderRadius: 'var(--radius-xl)',
            padding: '3.5rem 2rem',
            textAlign: 'center',
            color: '#ffffff',
            boxShadow: 'var(--shadow-xl)',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div style={{ maxWidth: '640px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginBottom: '1rem', letterSpacing: '-0.02em' }}>
                Ready to Analyze Your Legal Document?
              </h2>
              <p style={{ color: '#94a3b8', fontSize: '1.05rem', marginBottom: '2rem', lineHeight: 1.6 }}>
                Upload any rental agreement, employment contract, non-disclosure agreement, or policy document to see LegalSafe-G in action.
              </p>
              <Link to="/analyzer" className="btn btn-brand btn-lg">
                <Sparkles size={18} />
                Analyze Your Document Now
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;
