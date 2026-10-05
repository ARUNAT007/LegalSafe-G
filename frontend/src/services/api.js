/**
 * LegalSafe-G API Client
 *
 * All requests go through the Vite proxy to http://localhost:5000
 * Base URL: /api  →  proxied to  http://localhost:5000/api
 *
 * Endpoints:
 *   POST /api/upload          — upload a document
 *   POST /api/simplify        — run full pipeline
 *   POST /api/verify          — verify a clause
 *   POST /api/regenerate      — regenerate a failed clause
 *   GET  /api/result/:id      — fetch stored result
 *   POST /api/evaluate        — compute evaluation metrics
 *   GET  /api/health          — health check
 */

import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({
  baseURL: '/api',
  timeout: 180000,  // 3 min — pipeline can be slow on first load (model download)
});

// Global error interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred';
    console.error('API error:', message);
    return Promise.reject(new Error(message));
  }
);

// ── Upload ─────────────────────────────────────────────────────────────────

/**
 * Upload a legal document.
 * @param {File} file
 * @param {Function} onProgress  — called with 0-100 percent
 * @returns {{ document_id, filename, status, message }}
 */
export async function uploadDocument(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (evt.total && onProgress) {
        onProgress(Math.round((evt.loaded * 100) / evt.total));
      }
    },
  });
  return response.data;
}

// ── Simplify ───────────────────────────────────────────────────────────────

/**
 * Run the full LegalSafe-G pipeline on an uploaded document.
 * @param {string} documentId
 * @param {'baseline'|'constrained'|'both'} mode
 * @returns Full pipeline result payload
 */
export async function simplifyDocument(documentId, mode = 'both') {
  const response = await api.post('/simplify', { document_id: documentId, mode });
  return response.data;
}

// ── Verify ─────────────────────────────────────────────────────────────────

/**
 * Verify a single clause against its original.
 * @param {string} documentId
 * @param {string} clauseId
 * @param {string} simplifiedText
 * @returns Verification result dict
 */
export async function verifyClause(documentId, clauseId, simplifiedText) {
  const response = await api.post('/verify', {
    document_id: documentId,
    clause_id: clauseId,
    simplified_text: simplifiedText,
  });
  return response.data;
}

// ── Regenerate ─────────────────────────────────────────────────────────────

/**
 * Trigger targeted regeneration for a failed clause.
 * @param {string} documentId
 * @param {string} clauseId
 * @param {Array}  constraintFailures
 * @returns Regeneration result dict
 */
export async function regenerateClause(documentId, clauseId, constraintFailures) {
  const response = await api.post('/regenerate', {
    document_id: documentId,
    clause_id: clauseId,
    constraint_failures: constraintFailures,
  });
  return response.data;
}

// ── Result ─────────────────────────────────────────────────────────────────

/**
 * Fetch a stored pipeline result by its UUID result_id.
 * @param {string} resultId
 * @returns Full result payload
 */
export async function getResult(resultId) {
  const response = await api.get(`/result/${resultId}`);
  return response.data;
}

// ── Evaluate ───────────────────────────────────────────────────────────────

/**
 * Compute evaluation metrics for a processed document result.
 * @param {string} resultId
 * @returns Evaluation metrics dict
 */
export async function evaluateDocument(resultId) {
  const response = await api.post('/evaluate', { result_id: resultId });
  return response.data;
}

// ── Health ─────────────────────────────────────────────────────────────────

/**
 * Check API health.
 * @returns {{ status, version, timestamp }}
 */
export async function healthCheck() {
  const response = await api.get('/health');
  return response.data;
}

// Legacy named export for backward compatibility with components
export const documentService = {
  uploadDocument,
  simplifyDocument,
  verifyClause,
  regenerateClause,
  getResult,
  evaluateDocument,
  healthCheck,
};

export default api;
