/**
 * FileUpload component — drag-and-drop legal document upload with full pipeline execution.
 *
 * States: idle → dragging → uploading → processing → success | error
 *
 * On "Analyze Document":
 *   1. POST /api/upload  → document_id
 *   2. POST /api/simplify { document_id, mode } → result_id
 *   3. Navigate to /results/:result_id
 */

import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Upload, FileText, CheckCircle2, AlertCircle, Settings,
  Loader2, BarChart2, Shield, Network,
} from 'lucide-react';
import { uploadDocument, simplifyDocument } from '../services/api';

// Pipeline steps shown during processing
const PIPELINE_STEPS = [
  { icon: FileText, label: 'Extracting text & metadata' },
  { icon: Settings, label: 'Safe preprocessing' },
  { icon: BarChart2, label: 'Segmenting legal clauses' },
  { icon: Network, label: 'Building Legal Fact Graph' },
  { icon: Shield, label: 'Generating constraints' },
  { icon: Loader2, label: 'Simplifying with FLAN-T5' },
  { icon: CheckCircle2, label: 'Verifying & repairing' },
];

const FileUpload = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState('both');
  const [phase, setPhase] = useState('idle'); // idle | uploading | processing | done | error
  const [progress, setProgress] = useState(0);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [error, setError] = useState(null);
  const [documentId, setDocumentId] = useState(null);
  const [resultId, setResultId] = useState(null);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      setError('File type not accepted. Please upload PDF, DOCX, or TXT.');
      return;
    }
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
      setPhase('idle');
      setResultId(null);
      setDocumentId(null);
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
    maxSize: 10 * 1024 * 1024, // 10 MB
  });

  const handleAnalyze = async () => {
    if (!file) return;

    try {
      // ── Step 1: Upload ───────────────────────────────────────────────────
      setPhase('uploading');
      setProgress(0);
      setError(null);

      const uploadResult = await uploadDocument(file, (pct) => setProgress(pct));
      const docId = uploadResult.document_id;
      setDocumentId(docId);
      setProgress(100);

      toast.success(`Uploaded: ${uploadResult.filename}`);

      // ── Step 2: Run pipeline ─────────────────────────────────────────────
      setPhase('processing');

      // Animate through pipeline steps while waiting
      let step = 0;
      const stepInterval = setInterval(() => {
        step = Math.min(step + 1, PIPELINE_STEPS.length - 1);
        setPipelineStep(step);
      }, 2000);

      const result = await simplifyDocument(docId, mode);

      clearInterval(stepInterval);
      setPipelineStep(PIPELINE_STEPS.length - 1);

      const rid = result.result_id;
      setResultId(rid);
      setPhase('done');

      toast.success('Analysis complete!');
    } catch (err) {
      setPhase('error');
      setError(err.message || 'Failed to process document.');
      toast.error(err.message || 'Pipeline failed');
    }
  };

  const reset = () => {
    setFile(null);
    setPhase('idle');
    setProgress(0);
    setPipelineStep(0);
    setError(null);
    setDocumentId(null);
    setResultId(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '2rem' }}>
      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Upload size={20} color="var(--accent-primary)" />
        Legal Document Analysis
      </h3>

      <AnimatePresence mode="wait">

        {/* ── SUCCESS STATE ─────────────────────────────────────────────── */}
        {phase === 'done' && (
          <motion.div
            key="done"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ textAlign: 'center', padding: '2rem 0' }}
          >
            <CheckCircle2 size={64} color="var(--success)" style={{ margin: '0 auto 1.5rem', display: 'block' }} />
            <h3 style={{ marginBottom: '0.5rem' }}>Simplification Complete</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Legal facts extracted, graph built, and output verified.
            </p>
            <div style={{
              background: 'rgba(0,0,0,0.3)', padding: '0.75rem 1.5rem',
              borderRadius: 'var(--radius-sm)', display: 'inline-block', marginBottom: '2rem',
              border: '1px solid var(--surface-border)',
            }}>
              <span style={{ color: 'var(--text-secondary)', marginRight: '0.75rem', fontSize: '0.85rem' }}>
                Result ID:
              </span>
              <code style={{ color: 'var(--accent-secondary)', fontSize: '0.85rem' }}>{resultId}</code>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-primary"
                onClick={() => navigate(`/results/${resultId}`)}
              >
                View Full Results
              </button>
              <button className="btn btn-secondary" onClick={reset}>
                Analyze Another Document
              </button>
            </div>
          </motion.div>
        )}

        {/* ── PROCESSING STATE ──────────────────────────────────────────── */}
        {phase === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ padding: '1rem 0' }}
          >
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Running LegalSafe-G pipeline… This may take 1-3 minutes on first run
              (model loading). Please wait.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {PIPELINE_STEPS.map((step, idx) => {
                const Icon = step.icon;
                const isActive = idx === pipelineStep;
                const isDone = idx < pipelineStep;
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '0.6rem 1rem',
                    borderRadius: 'var(--radius-sm)',
                    background: isActive ? 'rgba(108,99,255,0.1)' : isDone ? 'rgba(0,200,150,0.07)' : 'transparent',
                    border: isActive ? '1px solid rgba(108,99,255,0.3)' : '1px solid transparent',
                    transition: 'all 0.3s',
                  }}>
                    <Icon
                      size={18}
                      color={isDone ? 'var(--success)' : isActive ? 'var(--accent-primary)' : 'var(--text-secondary)'}
                      style={isActive ? { animation: 'spin 1s linear infinite' } : {}}
                    />
                    <span style={{
                      fontSize: '0.9rem',
                      color: isDone ? 'var(--success)' : isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 600 : 400,
                    }}>
                      {step.label}
                      {isDone && ' ✓'}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── UPLOAD STATE ─────────────────────────────────────────────── */}
        {phase === 'uploading' && (
          <motion.div
            key="uploading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ padding: '1rem 0' }}
          >
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              Uploading {file?.name}…
            </p>
            <div style={{ height: '6px', background: 'var(--surface-border)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
                transition: 'width 0.2s',
              }} />
            </div>
            <p style={{ marginTop: '0.5rem', textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {progress}%
            </p>
          </motion.div>
        )}

        {/* ── IDLE / ERROR STATE ────────────────────────────────────────── */}
        {(phase === 'idle' || phase === 'error') && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Drop zone */}
            <div
              {...getRootProps()}
              style={{
                border: `2px dashed ${isDragActive ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                borderRadius: 'var(--radius-md)',
                padding: '3rem 2rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: isDragActive ? 'rgba(108,99,255,0.07)' : 'rgba(0,0,0,0.15)',
                transition: 'all 0.2s ease',
                marginBottom: '1.5rem',
              }}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="flex-center" style={{ flexDirection: 'column', gap: '1rem' }}>
                  <FileText size={48} color="var(--accent-secondary)" />
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.25rem' }}>{file.name}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                      {' · '}
                      {file.type || 'document'}
                    </p>
                    <p style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                      Click to change file
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex-center" style={{ flexDirection: 'column', gap: '1rem' }}>
                  <Upload size={48} color="var(--text-secondary)" />
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: '0.4rem' }}>
                      Upload a legal document to begin analysis
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                      {isDragActive ? 'Drop your file here…' : 'Drag & drop, or click to select a file'}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      Supports PDF · DOCX · TXT &nbsp;|&nbsp; Max 10 MB
                    </p>
                    <p style={{ color: 'var(--accent-primary)', fontSize: '0.78rem', marginTop: '0.4rem', fontStyle: 'italic' }}>
                      No document is pre-loaded — analysis begins only after you upload your file.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Mode selector + submit */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)',
                }}>
                  <Settings size={14} /> Processing Mode
                </label>
                <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ width: '100%' }}>
                  <option value="both">Both — Baseline + Constraint-Guided (Recommended)</option>
                  <option value="constrained">Constraint-Guided (Proposed approach)</option>
                  <option value="baseline">Baseline (Standard LLM, no constraints)</option>
                </select>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleAnalyze}
                disabled={!file}
                title={!file ? 'Please upload a document first' : 'Analyze the uploaded document'}
                style={{ padding: '0.75rem 2rem', minWidth: '160px', opacity: !file ? 0.5 : 1 }}
              >
                <Upload size={16} />
                Analyze Document
              </button>
            </div>

            {/* "no file" hint shown when button is in disabled state */}
            {!file && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                ⬆ Upload a file to enable analysis
              </p>
            )}

            {/* Error message */}
            {(error || phase === 'error') && error && (
              <div style={{
                marginTop: '1.5rem', padding: '1rem',
                background: 'rgba(255,107,107,0.1)', border: '1px solid var(--error)',
                borderRadius: 'var(--radius-sm)', color: 'var(--error)',
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Error:</strong> {error}
                  {phase === 'error' && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <button className="btn btn-secondary" onClick={reset}
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                        Try Again
                      </button>
                    </div>
                  )}
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
