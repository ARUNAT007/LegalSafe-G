import React from 'react';
import { Link } from 'react-router-dom';
import { Scale, ShieldCheck, GitBranch, Cpu, ArrowUpRight } from 'lucide-react';

const Footer = () => {
  return (
    <footer style={{
      backgroundColor: 'var(--primary-900)',
      color: 'var(--text-on-dark)',
      padding: '4rem 0 2.5rem',
      borderTop: '1px solid #1e293b',
      marginTop: '4rem'
    }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '3rem',
          marginBottom: '3rem'
        }}>
          
          {/* Column 1: Brand & Subtitle */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--brand-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Scale size={18} color="#ffffff" />
              </div>
              <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>
                LEGALSAFE<span style={{ color: 'var(--brand-400)' }}>-G</span>
              </span>
            </div>

            <p style={{ color: '#94a3b8', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              Constraint-Aware Legal Fact Graph Framework for Verified Transformer-Assisted Document Simplification.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: '#cbd5e1' }}>
              <ShieldCheck size={14} color="#34d399" />
              <span>FLAN-T5 Small + NetworkX Fact Verification</span>
            </div>
          </div>

          {/* Column 2: System Architecture */}
          <div>
            <h4 style={{ color: '#ffffff', fontSize: '0.925rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pipeline Workflow
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem', color: '#94a3b8' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--brand-400)' }}>1.</span> Document Text Extraction
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--brand-400)' }}>2.</span> Legal Fact Extraction & NER
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--brand-400)' }}>3.</span> NetworkX Fact Graph Construction
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--brand-400)' }}>4.</span> Constraint-Guided Simplification
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ color: 'var(--brand-400)' }}>5.</span> Fact Alignment & Verification
              </li>
            </ul>
          </div>

          {/* Column 3: Quick Navigation */}
          <div>
            <h4 style={{ color: '#ffffff', fontSize: '0.925rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quick Navigation
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem' }}>
              <li>
                <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.15s' }}>Home</Link>
              </li>
              <li>
                <Link to="/analyzer" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.15s' }}>Document Analyzer</Link>
              </li>
              <li>
                <Link to="/documents" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.15s' }}>Recent Documents</Link>
              </li>
              <li>
                <Link to="/evaluation" style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.15s' }}>Evaluation Benchmarks</Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Technology Stack */}
          <div>
            <h4 style={{ color: '#ffffff', fontSize: '0.925rem', fontWeight: 700, marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Core Technology
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {['FLAN-T5', 'spaCy', 'NetworkX', 'PyTorch', 'Flask', 'React 18', 'Vite', 'Network Graph'].map(tech => (
                <span key={tech} style={{
                  backgroundColor: '#1e293b',
                  color: '#cbd5e1',
                  border: '1px solid #334155',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 500
                }}>
                  {tech}
                </span>
              ))}
            </div>
          </div>

        </div>

        {/* Bottom Bar */}
        <div style={{
          paddingTop: '2rem',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          fontSize: '0.8rem',
          color: '#64748b'
        }}>
          <div>
            © {new Date().getFullYear()} LegalSafe-G Framework · Research Prototype & Demo Platform
          </div>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            <span>Privacy & Security Guarded</span>
            <span>Local Execution</span>
            <span>Constraint Verification</span>
          </div>
        </div>

      </div>
    </footer>
  );
};

export default Footer;
