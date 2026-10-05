import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ShieldCheck, Network, ArrowRight } from 'lucide-react';
import FileUpload from '../components/FileUpload';

const Home = () => {
  return (
    <div className="container animate-fade-in">
      <section style={{ textAlign: 'center', margin: '4rem 0', position: 'relative' }}>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          style={{ 
            fontSize: '4rem', 
            fontWeight: 800, 
            marginBottom: '1rem',
            background: 'linear-gradient(135deg, var(--text-primary), var(--accent-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.03em'
          }}
        >
          LegalSafe-G
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 2rem' }}
        >
          Constraint-Guided Transformer Framework for verifiable legal document simplification.
        </motion.p>
        
        <div className="glass-card" style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'left' }}>
          <FileUpload />
        </div>
      </section>

      <section style={{ margin: '6rem 0' }}>
        <h2 className="section-title flex-center" style={{ marginBottom: '3rem' }}>Core Innovations</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          <FeatureCard 
            icon={<FileText size={32} color="var(--accent-primary)" />}
            title="AI Simplification"
            desc="State-of-the-art transformer models simplify complex legalese into plain language while maintaining structural integrity."
          />
          <FeatureCard 
            icon={<ShieldCheck size={32} color="var(--success)" />}
            title="Legal Fact Preservation"
            desc="Rigorous extraction and verification of entities, obligations, conditions, and penalties ensures zero information loss."
          />
          <FeatureCard 
            icon={<Network size={32} color="var(--accent-secondary)" />}
            title="Graph Verification"
            desc="Constructs a factual knowledge graph to mathematically verify alignment between original and simplified texts."
          />
        </div>
      </section>
      
      <section style={{ margin: '6rem 0', background: 'rgba(255,255,255,0.02)', padding: '4rem 2rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--surface-border)' }}>
        <h2 className="section-title flex-center" style={{ marginBottom: '3rem' }}>Pipeline Architecture</h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
          <Step number="1" title="Ingestion" desc="Parse complex legal documents" />
          <ArrowRight color="var(--surface-border)" />
          <Step number="2" title="Fact Extraction" desc="Build structural knowledge graph" />
          <ArrowRight color="var(--surface-border)" />
          <Step number="3" title="Constrained Gen" desc="Draft plain-text equivalents" />
          <ArrowRight color="var(--surface-border)" />
          <Step number="4" title="Verification" desc="Cross-reference with original graph" />
        </div>
      </section>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }) => (
  <motion.div 
    whileHover={{ y: -5, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}
    className="glass-card"
    style={{ transition: 'all 0.3s ease' }}
  >
    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: 'var(--radius-md)', display: 'inline-block', marginBottom: '1.5rem' }}>
      {icon}
    </div>
    <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>{title}</h3>
    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{desc}</p>
  </motion.div>
);

const Step = ({ number, title, desc }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '200px' }}>
    <div style={{ 
      width: '40px', height: '40px', borderRadius: '50%', 
      background: 'var(--accent-primary)', color: 'white', 
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 'bold', marginBottom: '1rem',
      boxShadow: '0 0 15px rgba(108, 99, 255, 0.5)'
    }}>
      {number}
    </div>
    <h4 style={{ marginBottom: '0.5rem' }}>{title}</h4>
    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{desc}</p>
  </div>
);

export default Home;
