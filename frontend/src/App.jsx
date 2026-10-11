import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Disclaimer from './components/Disclaimer';

import Home from './pages/Home';
import Analyzer from './pages/Analyzer';
import Results from './pages/Results';
import History from './pages/History';
import Evaluation from './pages/Evaluation';

function App() {
  return (
    <Router>
      <div className="app-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* React Hot Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#ffffff',
              color: 'var(--text-heading)',
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-lg)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              fontWeight: 500,
            },
            success: {
              iconTheme: {
                primary: 'var(--success)',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: 'var(--error)',
                secondary: '#ffffff',
              },
            },
          }}
        />

        {/* Navigation Bar */}
        <Navbar />

        {/* Main Content Area */}
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/analyzer" element={<Analyzer />} />
            <Route path="/results/:documentId" element={<Results />} />
            <Route path="/documents" element={<History />} />
            <Route path="/evaluation" element={<Evaluation />} />
          </Routes>
        </main>

        {/* Footer */}
        <Footer />

        {/* Sticky Legal & Research Disclaimer */}
        <Disclaimer />

      </div>
    </Router>
  );
}

export default App;
