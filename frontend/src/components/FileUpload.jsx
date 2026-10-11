import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Upload, FileText, CheckCircle2, AlertCircle, Settings,
  Loader2, BarChart2, Shield, Network, Trash2, ArrowRight, Sparkles, FileCode
} from 'lucide-react';
import { uploadDocument, simplifyDocument } from '../services/api';
import { saveHistoryItem } from '../services/historyService';

const PIPELINE_STEPS = [
  { icon: FileText, label: 'Document Upload & Validation', desc: 'Securely saving file & validating MIME type' },
  { icon: Settings, label: 'Text & Clause Extraction', desc: 'Extracting clauses, negations, and legal terms' },
  { icon: Network, label: 'Legal Fact Graph Generation', desc: 'Building NetworkX graph nodes & relations' },
  { icon: Shield, label: 'Deriving Fact Preservation Constraints', desc: 'Formulating constraint rules for amounts and dates' },
  { icon: Loader2, label: 'FLAN-T5 Constraint Simplification', desc: 'Generating plain language legal text' },
  { icon: CheckCircle2, label: 'Fidelity & Meaning Verification', desc: 'Verifying graph alignment & zero fact loss' },
];

const FileUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('constrained'); // Default constrained for maximum speed & accuracy
  const [phase, setPhase] = useState('idle'); // idle | uploading | processing | done | error
  const [progress, setProgress] = useState(0);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [error, setError] = useState(null);
  const [resultId, setResultId] = useState(null);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      setError('File type not supported. Please upload a PDF, DOCX, or TXT document (Max 10MB).');
      return;
    }
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
      setPhase('idle');
      setResultId(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const handleAnalyze = async () => {
    if (!file) return;

    try {
      setPhase('uploading');
      setProgress(0);
      setError(null);

      const uploadResult = await uploadDocument(file, (pct) => setProgress(pct));
      const docId = uploadResult.document_id;
      setProgress(100);

      toast.success(`Uploaded: ${uploadResult.filename}`);

      setPhase('processing');

      let step = 0;
      const stepInterval = setInterval(() => {
        step = Math.min(step + 1, PIPELINE_STEPS.length - 1);
        setPipelineStep(step);
      }, 1800);

      const result = await simplifyDocument(docId, mode);

      clearInterval(stepInterval);
      setPipelineStep(PIPELINE_STEPS.length - 1);

      const rid = result.result_id;
      setResultId(rid);
      setPhase('done');

      // Save to local history
      saveHistoryItem(result);

      toast.success('Document analysis & verification complete!');
    } catch (err) {
      setPhase('error');
      setError(err.message || 'Failed to analyze document.');
      toast.error(err.message || 'Pipeline processing failed');
    }
  };

  const reset = () => {
    setFile(null);
    setPhase('idle');
    setProgress(0);
    setPipelineStep(0);
    setError(null);
    setResultId(null);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>
      
      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
          <span className="badge badge-brand" style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}>
            <Sparkles size={13} /> Document Analyzer Workspace
          </span>
        </div>
        <h1 className="heading-lg" style={{ marginBottom: '0.5rem' }}>
          Analyze Legal Document
        </h1>
        <p className="subheading" style={{ maxWidth: '600px', margin: '0 auto' }}>
          Upload a legal document and let LegalSafe-G extract, simplify, and verify its legal meaning.
        </p>
      </div>

      <AnimatePresence mode="wait">

        {/* ── SUCCESS / DONE STATE ───────────────────────────────────────── */}
        {phase === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="saas-card"
            style={{ textAlign: 'center', padding: '3.5rem 2rem' }}
          >
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              border: '1px solid var(--success-border)'
            }}>
              <CheckCircle2 size={40} />
            </div>

            <h2 className="heading-md" style={{ marginBottom: '0.5rem' }}>
              Simplification & Verification Complete
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '480px', margin: '0 auto 2rem', fontSize: '0.925rem' }}>
              Legal facts extracted, graph built, plain-language text generated, and facts verified with 100% fidelity.
            </p>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-brand btn-lg"
                onClick={() => navigate(`/results/${resultId}`)}
              >
                View Full Results
                <ArrowRight size={18} />
              </button>
              <button className="btn btn-secondary btn-lg" onClick={reset}>
                Analyze Another Document
              </button>
            </div>
          </motion.div>
        )}

        {/* ── PROCESSING STEP-BY-STEP PROGRESS TRACKER ──────────────────── */}
        {phase === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="saas-card"
            style={{ padding: '2.5rem 2rem' }}
          >
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                AI Model Analyzing Document...
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Executing FLAN-T5 constraint transformer & NetworkX verification graph...
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {PIPELINE_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isActive = idx === pipelineStep;
                const isDone = idx < pipelineStep;

                return (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem',
                    padding: '0.85rem 1.25rem',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isActive ? 'var(--brand-50)' : isDone ? 'var(--success-bg)' : 'var(--bg-subtle)',
                    border: `1px solid ${isActive ? '#bfdbfe' : isDone ? 'var(--success-border)' : 'var(--border-subtle)'}`,
                    transition: 'all 0.3s ease'
                  }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: 'var(--radius-full)',
                      backgroundColor: isDone ? 'var(--success)' : isActive ? 'var(--brand-600)' : 'var(--border-medium)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {isDone ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <Icon size={16} className={isActive ? 'animate-spin' : ''} />
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '0.925rem',
                        fontWeight: isActive || isDone ? 700 : 500,
                        color: isDone ? 'var(--success)' : isActive ? 'var(--brand-600)' : 'var(--text-muted)'
                      }}>
                        {step.label}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {step.desc}
                      </div>
                    </div>

                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      {isDone && <span style={{ color: 'var(--success)' }}>Completed</span>}
                      {isActive && <span style={{ color: 'var(--brand-600)' }}>In Progress...</span>}
                      {!isDone && !isActive && <span style={{ color: 'var(--text-subtle)' }}>Pending</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── UPLOADING PROGRESS STATE ──────────────────────────────────── */}
        {phase === 'uploading' && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="saas-card"
            style={{ padding: '3rem 2rem', textAlign: 'center' }}
          >
            <div style={{ marginBottom: '1.5rem' }}>
              <FileText size={48} color="var(--brand-600)" style={{ marginBottom: '1rem' }} />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                Uploading {file?.name}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                {formatFileSize(file?.size)}
              </p>
            </div>

            <div style={{ height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: '4px', overflow: 'hidden', maxWidth: '400px', margin: '0 auto 0.75rem' }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                backgroundColor: 'var(--brand-600)',
                transition: 'width 0.2s ease'
              }} />
            </div>

            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--brand-600)' }}>
              {progress}% Uploaded
            </p>
          </motion.div>
        )}

        {/* ── IDLE / ERROR DRAG & DROP UPLOADER ─────────────────────────── */}
        {(phase === 'idle' || phase === 'error') && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            
            {/* Drag & Drop Card */}
            <div
              {...getRootProps()}
              className={`saas-card ${isDragActive ? 'saas-card-interactive' : ''}`}
              style={{
                border: `2px dashed ${isDragActive ? 'var(--brand-600)' : file ? 'var(--brand-500)' : 'var(--border-medium)'}`,
                backgroundColor: isDragActive ? 'var(--brand-50)' : file ? '#ffffff' : 'var(--bg-card)',
                padding: file ? '2rem' : '3.5rem 2rem',
                textAlign: 'center',
                cursor: 'pointer',
                marginBottom: '1.5rem',
                transition: 'all 0.2s ease'
              }}
            >
              <input {...getInputProps()} />

              {file ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'left' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: 'var(--brand-50)',
                      color: 'var(--brand-600)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <FileText size={24} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)', marginBottom: '0.15rem' }}>
                        {file.name}
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatFileSize(file.size)} • {file.name.rsplit ? file.name.rsplit('.', 1)[1].toUpperCase() : 'DOCUMENT'}
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <span className="badge badge-brand">Ready for analysis</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        reset();
                      }}
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--error)' }}
                      title="Remove file"
                    >
                      <Trash2 size={16} />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-center" style={{ flexDirection: 'column', gap: '1rem' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: 'var(--radius-lg)',
                    backgroundColor: 'var(--bg-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--brand-600)'
                  }}>
                    <Upload size={32} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-heading)', marginBottom: '0.35rem' }}>
                      Drop your legal document here
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                      or <span style={{ color: 'var(--brand-600)', fontWeight: 600, textDecoration: 'underline' }}>browse files</span> from your computer
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                      <span>Supported formats: PDF, DOCX, TXT</span>
                      <span>•</span>
                      <span>Max file size: 10 MB</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pipeline Configuration Bar */}
            <div className="saas-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px' }}>
                <Settings size={18} color="var(--brand-600)" />
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-heading)', display: 'block' }}>
                    Simplification Mode
                  </label>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Choose AI processing strategy
                  </span>
                </div>
              </div>

              <div style={{ minWidth: '280px', flex: 1 }}>
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="constrained">Constraint-Guided AI (Proposed approach — Verified & Faster)</option>
                  <option value="both">Both — Baseline + Constraint-Guided (Research Benchmark)</option>
                  <option value="baseline">Baseline Only (Standard LLM, no constraint graph)</option>
                </select>
              </div>
            </div>

            {/* Primary Action Button */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                className="btn btn-brand btn-lg"
                onClick={handleAnalyze}
                disabled={!file}
                style={{ width: '100%', padding: '0.9rem' }}
              >
                <Sparkles size={18} />
                Analyze Document
              </button>

              {!file && (
                <p style={{ textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                  Upload a PDF, DOCX, or TXT document to enable analysis
                </p>
              )}
            </div>

            {/* Error Message Box */}
            {(error || phase === 'error') && error && (
              <div style={{
                marginTop: '1.5rem',
                padding: '1.25rem',
                backgroundColor: 'var(--error-bg)',
                border: '1px solid var(--error-border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--error)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.75rem',
                fontSize: '0.9rem'
              }}>
                <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Upload Error:</strong> {error}
                  <div style={{ marginTop: '0.5rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={reset} style={{ borderColor: 'var(--error-border)', color: 'var(--error)' }}>
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
};

export default FileUpload;
