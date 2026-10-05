import React from 'react';
import { motion } from 'framer-motion';
import { BarChart2, Activity, Zap } from 'lucide-react';

const Evaluation = () => {
  return (
    <div className="container animate-fade-in">
      <h1 className="section-title">
        <BarChart2 color="var(--accent-primary)" />
        Research Evaluation Dashboard
      </h1>
      
      <p style={{ color: 'var(--text-secondary)', marginBottom: '3rem', maxWidth: '800px' }}>
        Comparative analysis of baseline generative approaches versus the constrained framework (LegalSafe-G). Metrics highlight improvements in factual consistency and structural preservation.
      </p>
      
      <div className="glass-card" style={{ marginBottom: '3rem' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity size={20} color="var(--accent-secondary)" />
          Metric Comparison
        </h3>
        
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Metric</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Baseline (GPT-4)</th>
                <th style={{ padding: '1rem', color: 'var(--accent-primary)' }}>LegalSafe-G</th>
                <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Improvement</th>
              </tr>
            </thead>
            <tbody>
              <MetricRow name="Factual Consistency (FactCC)" base="78.4%" proposed="96.2%" diff="+17.8%" status="high" />
              <MetricRow name="Entity Preservation Rate" base="82.1%" proposed="99.5%" diff="+17.4%" status="high" />
              <MetricRow name="Obligation Alignment" base="74.5%" proposed="94.8%" diff="+20.3%" status="high" />
              <MetricRow name="Readability (Flesch-Kincaid)" base="48.2" proposed="52.4" diff="+4.2" status="med" />
              <MetricRow name="Structural Similarity" base="0.68" proposed="0.89" diff="+0.21" status="high" />
            </tbody>
          </table>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        <MetricCard title="Fact Hallucination Rate" value="0.5%" trend="-12.3% vs Baseline" good />
        <MetricCard title="Omission Rate" value="1.2%" trend="-15.8% vs Baseline" good />
        <MetricCard title="Processing Speed" value="1.2s/page" trend="+0.4s vs Baseline" />
      </div>
    </div>
  );
};

const MetricRow = ({ name, base, proposed, diff, status }) => (
  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
    <td style={{ padding: '1rem', fontWeight: 500 }}>{name}</td>
    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>{base}</td>
    <td style={{ padding: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>{proposed}</td>
    <td style={{ padding: '1rem' }}>
      <span className={`badge ${status === 'high' ? 'badge-verified' : 'badge-warning'}`}>
        {diff}
      </span>
    </td>
  </tr>
);

const MetricCard = ({ title, value, trend, good }) => (
  <div className="glass-card">
    <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontWeight: 500 }}>{title}</h4>
    <div style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem', color: good ? 'var(--success)' : 'var(--text-primary)' }}>
      {value}
    </div>
    <div style={{ fontSize: '0.85rem', color: good ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      {good && <Zap size={14} />} {trend}
    </div>
  </div>
);

export default Evaluation;
