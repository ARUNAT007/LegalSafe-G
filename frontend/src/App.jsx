import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Scale, CheckCircle2 } from 'lucide-react';
import Home from './pages/Home';
import Results from './pages/Results';
import Evaluation from './pages/Evaluation';
import Disclaimer from './components/Disclaimer';

function App() {
  return (
    <Router>
      <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Toaster position="top-right" toastOptions={{
          style: { background: 'var(--surface-color)', color: 'var(--text-primary)', border: '1px solid var(--surface-border)' }
        }}/>
        
        <header style={{ padding: '1rem 0', borderBottom: '1px solid var(--surface-border)', background: 'rgba(10, 15, 30, 0.8)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 50 }}>
          <div className="container flex-between">
            <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', color: 'var(--text-primary)' }}>
              <Scale size={28} color="var(--accent-primary)" />
              <span style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>LegalSafe<span style={{ color: 'var(--accent-secondary)' }}>-G</span></span>
            </Link>
            
            <nav style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
              <Link to="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }} className="nav-link">Home</Link>
              <Link to="/evaluation" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontWeight: 500, transition: 'color 0.2s' }} className="nav-link">Evaluation</Link>
              <div className="badge badge-verified" style={{ marginLeft: '1rem' }}>
                <CheckCircle2 size={14} />
                Research Preview
              </div>
            </nav>
          </div>
        </header>

        <main style={{ flex: 1, padding: '2rem 0' }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/results/:documentId" element={<Results />} />
            <Route path="/evaluation" element={<Evaluation />} />
          </Routes>
        </main>

        <Disclaimer />
      </div>
    </Router>
  );
}

export default App;
