import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, Scale, Menu, X, FileText, BarChart3, Clock, Sparkles } from 'lucide-react';

const Navbar = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const navLinks = [
    { label: 'Analyzer', path: '/analyzer', icon: FileText },
    { label: 'Documents', path: '/documents', icon: Clock },
    { label: 'Evaluation', path: '/evaluation', icon: BarChart3 },
  ];

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backgroundColor: 'rgba(255, 255, 255, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
        
        {/* Brand Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: 'var(--primary-900)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-xs)'
          }}>
            <Scale size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary-900)', letterSpacing: '-0.02em' }}>
                LEGALSAFE<span style={{ color: 'var(--brand-600)' }}>-G</span>
              </span>
              <span className="badge badge-brand" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>
                AI 2.0
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'none' }}>
              Verified Legal Simplification
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav style={{ display: 'none', alignItems: 'center', gap: '0.5rem' }} className="desktop-nav">
          <Link
            to="/"
            style={{
              padding: '0.5rem 0.9rem',
              borderRadius: 'var(--radius-sm)',
              color: isActive('/') && location.pathname === '/' ? 'var(--brand-600)' : 'var(--text-body)',
              fontWeight: isActive('/') && location.pathname === '/' ? 700 : 500,
              fontSize: '0.875rem',
              textDecoration: 'none',
              transition: 'all 0.15s',
              backgroundColor: isActive('/') && location.pathname === '/' ? 'var(--brand-50)' : 'transparent',
            }}
          >
            Home
          </Link>
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.5rem 0.9rem',
                  borderRadius: 'var(--radius-sm)',
                  color: active ? 'var(--brand-600)' : 'var(--text-body)',
                  fontWeight: active ? 700 : 500,
                  fontSize: '0.875rem',
                  textDecoration: 'none',
                  transition: 'all 0.15s',
                  backgroundColor: active ? 'var(--brand-50)' : 'transparent',
                }}
              >
                <Icon size={15} color={active ? 'var(--brand-600)' : 'var(--text-muted)'} />
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Action Button & AI Indicator */}
        <div style={{ display: 'none', alignItems: 'center', gap: '1rem' }} className="desktop-nav">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, backgroundColor: 'var(--success-bg)', padding: '0.3rem 0.65rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--success-border)' }}>
            <ShieldCheck size={14} />
            Constraint-Aware AI Active
          </div>

          <Link to="/analyzer" className="btn btn-brand btn-sm">
            <Sparkles size={14} />
            Analyze Document
          </Link>
        </div>

        {/* Mobile Hamburger Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="btn btn-ghost btn-sm"
          style={{ padding: '0.5rem' }}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid var(--border-subtle)',
          padding: '1rem 1.5rem 1.5rem',
          boxShadow: 'var(--shadow-lg)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-heading)', textDecoration: 'none', fontWeight: 600 }}
            >
              Home
            </Link>
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', color: 'var(--text-heading)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <link.icon size={18} color="var(--brand-600)" />
                {link.label}
              </Link>
            ))}
            <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
              <Link to="/analyzer" onClick={() => setMobileMenuOpen(false)} className="btn btn-brand" style={{ width: '100%' }}>
                <Sparkles size={16} />
                Analyze Document
              </Link>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
          header button[aria-label="Toggle navigation menu"] {
            display: none !important;
          }
        }
      `}</style>
    </header>
  );
};

export default Navbar;
