/**
 * reportBuilder.js — LegalSafe-G
 *
 * Normalisation layer between the raw pipeline API result and the PDF generator.
 * The PDF generator must ONLY consume the ReportModel produced here — never
 * access raw API fields directly.
 *
 * Responsibilities:
 *  - Fix mismatched field names (e.g. clauses_verified vs. passed)
 *  - Derive ONE authoritative verification status used everywhere
 *  - Filter and deduplicate NLP extraction noise (URLs, fragments, etc.)
 *  - Sanitise all strings (encoding artefacts, control chars)
 *  - Track which clause each glossary term appeared in
 *  - Build an honest "limitations" list based on real analysis coverage
 */

// ─── String helpers ────────────────────────────────────────────────────────────

/**
 * Remove control characters, normalise Unicode quotes, strip zero-width chars.
 * Safe to call on every string before writing it to the PDF.
 */
export function sanitize(str) {
  if (str == null) return '';
  return String(str)
    // Zero-width / invisible chars
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
    // Replacement character (encoding failure marker)
    .replace(/\uFFFD/g, '')
    // Control characters (except newline / tab)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalise curly quotes to straight
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    // Collapse excessive whitespace
    .replace(/\s{3,}/g, '  ')
    .trim();
}

/**
 * Sanitize and truncate a string for display-only use (e.g. table cells).
 * Does NOT truncate for paragraph text — use sanitize() + splitTextToSize() there.
 */
export function sanitizeCell(str, maxLen = 200) {
  const s = sanitize(str);
  if (s.length <= maxLen) return s;
  // Find a word boundary near maxLen
  const cut = s.lastIndexOf(' ', maxLen);
  return (cut > maxLen - 40 ? s.slice(0, cut) : s.slice(0, maxLen)) + '…';
}

// ─── Entity noise filter ────────────────────────────────────────────────────────

const URL_RE = /https?:\/\/\S+|www\.\S+/i;
const MEANINGLESS_RE = /^\d+$|^\W+$|^[a-z]{1,2}$/i;

/**
 * Return true if a string looks like a genuine legal entity rather than NLP noise.
 */
function isValidEntity(val) {
  if (!val) return false;
  const s = sanitize(val);
  if (s.length < 2) return false;
  if (URL_RE.test(s)) return false;
  if (MEANINGLESS_RE.test(s)) return false;
  return true;
}

/**
 * Deduplicate and filter an array of entity strings.
 */
function cleanEntities(arr) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    const s = sanitize(v);
    if (!isValidEntity(s)) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

// ─── Verification status derivation ────────────────────────────────────────────

/**
 * ONE authoritative status calculation.
 * This is the only place status is derived — used everywhere in the PDF.
 *
 * @param {object} s - summary fields: clausesAnalyzed, clausesVerified,
 *                     clausesWarning, clausesReview, clausesFailed, clausesError
 */
export function deriveVerificationStatus(s) {
  const { clausesAnalyzed, clausesVerified, clausesWarning, clausesReview, clausesFailed, clausesError } = s;

  if (!clausesAnalyzed || clausesAnalyzed === 0) return 'ANALYSIS_INCOMPLETE';

  // Any hard-fail clauses → failed
  if (clausesFailed > 0) return 'VERIFICATION_FAILED';

  // Any requiring human review → review required
  if (clausesReview > 0) return 'REVIEW_REQUIRED';

  // Any warnings but no failures/review → partially verified
  if (clausesWarning > 0) return 'PARTIALLY_VERIFIED';

  // All analyzed successfully
  if (clausesVerified === clausesAnalyzed) return 'VERIFIED';

  // Mixed / error state
  if (clausesError > 0) return 'ANALYSIS_INCOMPLETE';

  return 'PARTIALLY_VERIFIED';
}

/**
 * Human-readable label + colour key for a verification status string.
 */
export function statusLabel(status) {
  switch (status) {
    case 'VERIFIED':             return { text: '✓  VERIFIED',              color: 'green'  };
    case 'PARTIALLY_VERIFIED':   return { text: '~  PARTIALLY VERIFIED',    color: 'amber'  };
    case 'REVIEW_REQUIRED':      return { text: '⚠  REVIEW REQUIRED',       color: 'amber'  };
    case 'VERIFICATION_FAILED':  return { text: '✕  VERIFICATION FAILED',   color: 'red'    };
    case 'ANALYSIS_INCOMPLETE':  return { text: '◌  ANALYSIS INCOMPLETE',   color: 'gray'   };
    default:                     return { text: status || 'UNKNOWN',         color: 'gray'   };
  }
}

/** Map a clause-level final_status string to a normalised status key. */
function normalizeClauseStatus(raw) {
  if (!raw) return 'NOT_ANALYZED';
  const u = raw.toUpperCase();
  if (u === 'VERIFIED')                          return 'VERIFIED';
  if (u === 'WARNING')                           return 'WARNING';
  if (u.includes('HUMAN') || u === 'REVIEW')     return 'REVIEW_REQUIRED';
  if (u === 'ERROR')                             return 'ERROR';
  return 'NOT_ANALYZED';
}

// ─── Fact normalisation ─────────────────────────────────────────────────────────

/**
 * Normalise a raw original_facts dict from the API.
 * Filters noise, sanitises strings, returns structured object.
 */
function normalizeFacts(raw) {
  if (!raw || typeof raw !== 'object') return {};

  const clean = (v) => {
    if (!v) return null;
    const s = sanitize(String(v));
    return s.length >= 2 && !URL_RE.test(s) ? s : null;
  };
  const cleanArr = (arr) => cleanEntities(Array.isArray(arr) ? arr : []);

  return {
    subject:       clean(raw.subject),
    action:        clean(raw.action),
    object:        clean(raw.obj ?? raw.object),
    modality:      clean(raw.modality),
    amount:        clean(raw.amount),
    currency:      clean(raw.currency),
    deadline:      clean(raw.deadline),
    condition:     clean(raw.condition),
    exception:     clean(raw.exception),
    penalty:       clean(raw.penalty),
    consequence:   clean(raw.consequence),
    parties:       cleanArr(raw.parties),
    organizations: cleanArr(raw.organizations),
    obligations:   cleanArr(raw.obligations),
    rights:        cleanArr(raw.rights),
    prohibitions:  cleanArr(raw.prohibitions),
    permissions:   cleanArr(raw.permissions),
    dates:         cleanArr(raw.dates),
    amounts:       cleanArr(raw.amounts),
    locations:     cleanArr(raw.locations),
    penalties:     cleanArr(raw.penalties),
    exceptions:    cleanArr(raw.exceptions),
  };
}

// ─── Clause title inference ─────────────────────────────────────────────────────

const TOPIC_PATTERNS = [
  [/confiden|non.?discl|nda/i,                      'Confidentiality'],
  [/terminat|cancell/i,                             'Termination'],
  [/payment|rent|fee|amount|₹|\$|€/i,              'Payment / Financial Terms'],
  [/intellectu|ip\b|copyright|patent|trademark/i,   'Intellectual Property'],
  [/employ|salary|wage|compens/i,                   'Employment & Compensation'],
  [/indemnif|liabilit/i,                            'Indemnification & Liability'],
  [/dispute|arbitrat|jurisdiction|litigation/i,     'Dispute Resolution'],
  [/govern|law|jurisdiction/i,                      'Governing Law'],
  [/oblig|must|shall|duty/i,                        'Obligations'],
  [/right|entitl|permit|may\b/i,                    'Rights & Permissions'],
  [/prohibit|shall not|must not|restrict/i,         'Restrictions & Prohibitions'],
  [/notice|notif/i,                                 'Notices'],
  [/force maj|act of god/i,                         'Force Majeure'],
  [/amend|modif|change|revise/i,                    'Amendments'],
  [/warrant|represent/i,                            'Warranties & Representations'],
  [/assign|transfer/i,                              'Assignment'],
  [/breach|default|fail/i,                          'Breach & Default'],
  [/rent|lease|tenant|landlord|premises/i,          'Tenancy Terms'],
];

function inferClauseTitle(clause) {
  // Use section header if it looks meaningful
  if (clause.section && clause.section.trim().length > 3 && !/^clause\s*\d+$/i.test(clause.section)) {
    return sanitize(clause.section);
  }
  // Try topic pattern matching on original text
  const text = clause.original_text || clause.text || '';
  for (const [re, label] of TOPIC_PATTERNS) {
    if (re.test(text)) return label;
  }
  return `Clause ${clause.clause_id || ''}`;
}

// ─── Clause normalisation ───────────────────────────────────────────────────────

function normalizeClause(cl, index) {
  const verRaw = cl.verification || {};
  const score = typeof verRaw.score === 'number' ? Math.round(verRaw.score * 100) : null;
  const clauseStatus = normalizeClauseStatus(cl.final_status);

  // Mismatches: clean and annotate
  const mismatches = (verRaw.mismatches || []).map(m => ({
    type:        sanitize(m.type || 'MISMATCH'),
    original:    sanitize(m.original),
    generated:   sanitize(m.generated),
    clauseId:    cl.clause_id || String(index + 1),
    severity:    /AMOUNT|PENALTY|MODALITY/.test(m.type || '') ? 'CRITICAL'
                 : /DATE|ENTITY/.test(m.type || '')           ? 'WARNING'
                 :                                              'MINOR',
  }));

  // Difficult terms: attach source clause reference
  const difficultTerms = (cl.difficult_terms || []).map(t => ({
    term:        sanitize(t.term || String(t)),
    explanation: sanitize(t.explanation || ''),
    sourceClause: cl.clause_id || String(index + 1),
  }));

  // Attention points derived consistently from same data
  const attentionPoints = [];
  if (clauseStatus === 'REVIEW_REQUIRED') {
    attentionPoints.push({
      level: 'CRITICAL',
      note: 'AI verification could not fully confirm that all legal facts are preserved in the simplified version. Human review is required for this clause.',
    });
  } else if (clauseStatus === 'WARNING') {
    attentionPoints.push({
      level: 'WARNING',
      note: 'Some legal facts in this clause may not be perfectly preserved in the simplified version. Review recommended.',
    });
  } else if (clauseStatus === 'ERROR') {
    attentionPoints.push({
      level: 'WARNING',
      note: 'This clause encountered a processing error and could not be fully analyzed.',
    });
  }
  mismatches.forEach(m => {
    if (m.severity === 'CRITICAL') {
      attentionPoints.push({
        level: 'CRITICAL',
        note: `${m.type}: Original value "${m.original || 'N/A'}" differs from simplified value "${m.generated || 'missing'}".`,
      });
    }
  });

  return {
    id:             cl.clause_id || String(index + 1),
    index:          index + 1,
    title:          inferClauseTitle(cl),
    originalText:   sanitize(cl.original_text || ''),
    simplifiedText: sanitize(cl.simplified_text_final || cl.simplified_text_constrained || cl.original_text || ''),
    facts:          normalizeFacts(cl.original_facts),
    verification: {
      score,          // null = not measured, 0–100 = actual
      status:         clauseStatus,
      mismatches,
      checksPerformed: verRaw.checks_performed ?? null,
      checksPassed:    verRaw.checks_passed ?? null,
      graphStatus:     sanitize(verRaw.graph_comparison_status),
    },
    attentionPoints,
    difficultTerms,
    hasError:    clauseStatus === 'ERROR',
    errorMessage: sanitize(cl.error),
  };
}

// ─── Global entities aggregation ───────────────────────────────────────────────

function aggregateEntities(clauses) {
  const parties   = new Set();
  const dates     = new Set();
  const amounts   = new Set();
  const locations = new Set();
  const orgs      = new Set();

  clauses.forEach(cl => {
    const f = cl.facts;
    if (f.subject) parties.add(f.subject);
    f.parties.forEach(p => parties.add(p));
    f.organizations.forEach(o => orgs.add(o));
    f.dates.forEach(d => dates.add(d));
    f.amounts.forEach(a => amounts.add(a));
    if (f.amount) amounts.add(f.amount);
    f.locations.forEach(l => locations.add(l));
  });

  return {
    parties:   [...parties].filter(Boolean).slice(0, 12),
    dates:     [...dates].filter(Boolean).slice(0, 10),
    amounts:   [...amounts].filter(Boolean).slice(0, 10),
    locations: [...locations].filter(Boolean).slice(0, 8),
    organizations: [...orgs].filter(Boolean).slice(0, 8),
  };
}

// ─── Glossary normalisation ─────────────────────────────────────────────────────

function normalizeGlossary(rawGlossary, clauses) {
  // Build a map from term → list of clauses it appeared in
  const termClauseMap = new Map();

  // Collect from per-clause difficult_terms (already source-tagged)
  clauses.forEach(cl => {
    cl.difficultTerms.forEach(t => {
      const key = t.term.toLowerCase();
      if (!termClauseMap.has(key)) termClauseMap.set(key, { term: t.term, explanation: t.explanation, sourceClauses: [] });
      const entry = termClauseMap.get(key);
      if (!entry.sourceClauses.includes(cl.id)) entry.sourceClauses.push(cl.id);
      if (!entry.explanation && t.explanation) entry.explanation = t.explanation;
    });
  });

  // Supplement with document-level glossary from API
  (rawGlossary || []).forEach(g => {
    if (!g.term) return;
    const key = g.term.toLowerCase();
    if (!termClauseMap.has(key)) {
      termClauseMap.set(key, { term: sanitize(g.term), explanation: sanitize(g.explanation || ''), sourceClauses: [] });
    }
  });

  return [...termClauseMap.values()]
    .filter(g => g.term && g.explanation && g.explanation !== '—')
    .sort((a, b) => a.term.localeCompare(b.term));
}

// ─── Limitations builder ────────────────────────────────────────────────────────

function buildLimitations(rawResult, summary) {
  const lims = [];

  if (summary.clausesAnalyzed < summary.clausesDetected) {
    lims.push(`Only ${summary.clausesAnalyzed} of ${summary.clausesDetected} detected clauses were fully processed due to pipeline limits.`);
  }
  if (rawResult.has_scanned_pages) {
    lims.push('One or more pages appeared to be scanned images. OCR text extraction may have introduced inaccuracies.');
  }
  if (summary.clausesError > 0) {
    lims.push(`${summary.clausesError} clause(s) encountered processing errors and could not be fully analyzed.`);
  }
  if (summary.clausesReview > 0) {
    lims.push('Some clauses are marked "Review Required" because the AI could not confirm that all legal facts were preserved in the simplified version.');
  }
  lims.push('AI-generated simplification may omit subtle legal nuances. Always consult the original document and a qualified legal professional.');
  lims.push('Legal fact extraction uses NLP heuristics. Not all legal relationships can be automatically identified.');
  lims.push('Verification is graph-based and compares structural legal facts — it does not validate legal correctness or jurisdiction-specific requirements.');

  return lims;
}

// ─── Document type inference ────────────────────────────────────────────────────

export function inferDocType(filename) {
  const f = (filename || '').toLowerCase();
  if (/nda|non.?discl|confidential/.test(f))     return 'Non-Disclosure Agreement (NDA)';
  if (/employ/.test(f))                           return 'Employment Agreement';
  if (/lease|rent/.test(f))                       return 'Lease / Rental Agreement';
  if (/purchase|sale|buy/.test(f))                return 'Purchase / Sale Agreement';
  if (/service|sow/.test(f))                      return 'Service Agreement';
  if (/partner/.test(f))                          return 'Partnership Agreement';
  if (/loan|credit/.test(f))                      return 'Loan Agreement';
  if (/terms|tos/.test(f))                        return 'Terms of Service';
  if (/privacy|gdpr/.test(f))                     return 'Privacy Policy';
  if (/consult/.test(f))                          return 'Consulting Agreement';
  if (/vendor|supply/.test(f))                    return 'Vendor / Supply Agreement';
  if (/ip|patent|copyright/.test(f))              return 'Intellectual Property Agreement';
  return 'Legal Agreement';
}

// ─── Safe filename for PDF save ─────────────────────────────────────────────────

export function safePdfFilename(filename) {
  const base = (filename || 'document').replace(/\.[^.]+$/, '');
  const safe = base.replace(/[^a-z0-9_\-]/gi, '_').slice(0, 40);
  return `LegalSafe-G_${safe}_Analysis_Report.pdf`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT: buildReportModel
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert a raw LegalSafe-G API result into a clean, validated ReportModel.
 *
 * @param {object} rawResult - The full JSON result from the /api/result/:id endpoint
 * @returns {ReportModel}
 */
export function buildReportModel(rawResult) {
  const r = rawResult || {};

  // ── 1. Metadata ──────────────────────────────────────────────────────────────
  const filename = sanitize(r.filename || 'document');
  const now = new Date();
  const analysisDate = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const analysisDateTime = now.toLocaleString('en-IN');

  const meta = {
    filename,
    docType:      inferDocType(filename),
    analysisDate,
    analysisDateTime,
    resultId:     sanitize(r.result_id || ''),
    documentId:   sanitize(r.document_id || ''),
    mode:         sanitize(r.mode || 'constrained'),
    aiModel:      'FLAN-T5-Small (Google)',
    nlpEngine:    'spaCy en_core_web_sm',
    verificationMethod: 'NetworkX Legal Fact Graph Comparison',
    createdAt:    sanitize(r.created_at || ''),
    pdfFilename:  safePdfFilename(filename),
  };

  // ── 2. Raw summary fields — using CORRECT field names from the backend ────────
  const vs = r.verification_summary || {};
  const clausesDetected  = Number(r.clause_count || (r.clauses || []).length || 0);
  const clausesAnalyzed  = Number((r.clauses || []).length || 0);
  const clausesVerified  = Number(vs.clauses_verified || 0);
  const clausesWarning   = Number(vs.clauses_warning || 0);
  const clausesReview    = Number(vs.clauses_requiring_human_review || 0);
  const clausesError     = Number(vs.clauses_error || 0);
  // Clauses failed = those requiring human review (the strongest negative outcome)
  const clausesFailed    = clausesReview;
  const verificationScore = Math.round((vs.average_score || 0) * 100);
  const totalMismatches  = Number(vs.total_mismatches || 0);

  // ── 3. Single authoritative status ───────────────────────────────────────────
  const summaryInput = { clausesAnalyzed, clausesVerified, clausesWarning, clausesReview, clausesFailed, clausesError };
  const verificationStatus = deriveVerificationStatus(summaryInput);

  const summary = {
    clausesDetected,
    clausesAnalyzed,
    clausesVerified,
    clausesWarning,
    clausesReview,
    clausesFailed,
    clausesError,
    verificationScore,
    verificationStatus,   // ← THE single status used everywhere
    totalMismatches,
    analysisComplete: clausesAnalyzed > 0 && clausesError < clausesAnalyzed,
  };

  // ── 4. Clauses ───────────────────────────────────────────────────────────────
  const rawClauses = Array.isArray(r.clauses) ? r.clauses : [];
  const clauses = rawClauses.map((cl, i) => normalizeClause(cl, i));

  // ── 5. Entities ──────────────────────────────────────────────────────────────
  const entities = aggregateEntities(clauses);

  // ── 6. All mismatches (flat, classified by severity) ─────────────────────────
  const mismatches = clauses.flatMap(cl =>
    cl.verification.mismatches.map(m => ({ ...m, clauseId: cl.id, clauseTitle: cl.title }))
  );

  // ── 7. Glossary with source clause references ────────────────────────────────
  const glossary = normalizeGlossary(r.glossary, clauses);

  // ── 8. Limitations ───────────────────────────────────────────────────────────
  const limitations = buildLimitations(r, summary);

  // ── 9. Graph availability ────────────────────────────────────────────────────
  const graphAvailable = clauses.some(cl => {
    const g = (rawClauses.find(rc => rc.clause_id === cl.id) || {});
    try {
      const og = typeof g.original_graph === 'string' ? JSON.parse(g.original_graph) : g.original_graph;
      return og && og.nodes && og.nodes.length > 0;
    } catch { return false; }
  });

  // ── 10. Graph node/edge summary (text representation for PDF) ─────────────────
  const graphSummary = buildGraphSummary(rawClauses, clauses);

  // ── 11. Technical details ────────────────────────────────────────────────────
  const technicalDetails = {
    pipeline: [
      'Text extraction (PyMuPDF / python-docx / plain text)',
      'NLP preprocessing (spaCy — whitespace normalisation, legal term preservation)',
      'Legal clause segmentation (rule-based + heading detection)',
      'Named entity & fact extraction (spaCy NER + regex patterns)',
      'Legal fact graph construction (NetworkX DiGraph)',
      'Legal constraint derivation (obligations, amounts, dates, modalities)',
      'Constraint-guided simplification (FLAN-T5-Small, Google)',
      'Re-extraction of facts from simplified text',
      'Graph-comparison verification (original vs. generated graph)',
      'Targeted regeneration loop (max 1 retry on MISMATCH)',
    ],
    technology: [
      { name: 'PyMuPDF',               role: 'PDF text extraction' },
      { name: 'python-docx',            role: 'DOCX text extraction' },
      { name: 'spaCy en_core_web_sm',   role: 'NLP / Named Entity Recognition' },
      { name: 'NetworkX',               role: 'Legal Fact Graph construction & comparison' },
      { name: 'FLAN-T5-Small (Google)', role: 'Constraint-guided text simplification' },
      { name: 'Sentence Transformers',  role: 'Semantic similarity evaluation' },
      { name: 'Flask',                  role: 'Backend API server' },
      { name: 'SQLite',                 role: 'Result persistence' },
    ],
  };

  return {
    meta,
    summary,
    clauses,
    entities,
    mismatches,
    glossary,
    limitations,
    graphAvailable,
    graphSummary,
    technicalDetails,
    disclaimer: sanitize(r.disclaimer || ''),
  };
}

// ─── Graph text summary builder ─────────────────────────────────────────────────

function buildGraphSummary(rawClauses, normClauses) {
  const nodeTypes = new Set();
  const relationships = [];
  let totalNodes = 0;
  let totalEdges = 0;

  rawClauses.forEach((rc, i) => {
    try {
      const og = typeof rc.original_graph === 'string'
        ? JSON.parse(rc.original_graph) : rc.original_graph;
      if (!og) return;
      const nodes = og.nodes || [];
      const edges = og.links || og.edges || [];
      totalNodes += nodes.length;
      totalEdges += edges.length;
      nodes.forEach(n => { if (n.type) nodeTypes.add(sanitize(n.type)); });
      edges.slice(0, 3).forEach(e => {
        const src = e.source || e.from || '';
        const tgt = e.target || e.to || '';
        const rel = e.relation || e.label || e.type || '';
        if (src && tgt && rel && relationships.length < 12) {
          relationships.push({
            source:    sanitize(String(src).slice(0, 30)),
            relation:  sanitize(rel),
            target:    sanitize(String(tgt).slice(0, 30)),
            clauseId:  normClauses[i]?.id || String(i + 1),
          });
        }
      });
    } catch { /* skip malformed graph */ }
  });

  return {
    totalNodes,
    totalEdges,
    nodeTypes: [...nodeTypes],
    relationships,
    available: totalNodes > 0,
  };
}
