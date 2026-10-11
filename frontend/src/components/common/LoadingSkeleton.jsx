import React from 'react';

export const LoadingCard = () => (
  <div className="saas-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    <div className="skeleton-box" style={{ height: '24px', width: '40%' }} />
    <div className="skeleton-box" style={{ height: '16px', width: '90%' }} />
    <div className="skeleton-box" style={{ height: '16px', width: '75%' }} />
    <div className="skeleton-box" style={{ height: '16px', width: '60%' }} />
  </div>
);

export const LoadingDashboard = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1.5rem 0' }}>
    {/* Summary Cards Skeleton */}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="saas-card" style={{ padding: '1.25rem' }}>
          <div className="skeleton-box" style={{ height: '14px', width: '50%', marginBottom: '0.75rem' }} />
          <div className="skeleton-box" style={{ height: '32px', width: '70%' }} />
        </div>
      ))}
    </div>

    {/* Content Skeleton */}
    <div className="saas-card" style={{ height: '360px', display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center', alignItems: 'center' }}>
      <div className="skeleton-box" style={{ height: '32px', width: '40%' }} />
      <div className="skeleton-box" style={{ height: '16px', width: '60%' }} />
      <div className="skeleton-box" style={{ height: '16px', width: '50%' }} />
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '1rem' }}>
        Analyzing legal structure & verifying facts...
      </p>
    </div>
  </div>
);

export default LoadingDashboard;
