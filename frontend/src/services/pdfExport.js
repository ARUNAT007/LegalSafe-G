/**
 * pdfExport.js — LegalSafe-G
 *
 * Professional PDF Report Generator.
 * Consumes a clean ReportModel (from reportBuilder.js) — never touches raw API fields.
 *
 * Structure:
 *   Cover Page
 *   Table of Contents  (two-pass — real page numbers)
 *   §1  Executive Summary
 *   §2  Document Overview
 *   §3  Plain-Language Document
 *   §4  Clause-by-Clause Analysis
 *   §5  Legal Facts & Entities
 *   §6  Verification Report
 *   §7  Mismatch & Attention Points
 *   §8  Legal Glossary
 *   §9  Analysis Limitations
 *   §10 Technical Appendix
 *   §11 Final Disclaimer
 */

import { jsPDF } from 'jspdf';
import { buildReportModel, sanitize, sanitizeCell, statusLabel } from './reportBuilder.js';

// ─── Page geometry ─────────────────────────────────────────────────────────────
const PW = 210;   // A4 width  mm
const PH = 297;   // A4 height mm
const ML = 18;    // margin left
const MR = 18;    // margin right
const MT = 22;    // margin top
const MB = 22;    // margin bottom
const TW = PW - ML - MR;   // usable text width

// ─── Colour palette ────────────────────────────────────────────────────────────
const C = {
  // Backgrounds
  white:    [255, 255, 255],
  pageBg:   [250, 250, 252],
  coverBg:  [13,  20,  42 ],
  coverAc:  [79,  70,  229],   // indigo

  // Brand
  navy:     [15,  23,  42 ],
  indigo:   [79,  70,  229],
  blue:     [37,  99,  235],
  blueL:    [219, 234, 254],   // light blue for backgrounds

  // Semantic
  green:    [22,  163, 74 ],
  greenL:   [220, 252, 231],
  amber:    [180, 100, 5  ],
  amberL:   [254, 243, 199],
  red:      [185, 28,  28 ],
  redL:     [254, 226, 226],

  // Text
  textPrimary:   [18,  24,  46 ],
  textSecondary: [70,  80,  110],
  textMuted:     [130, 140, 170],

  // Neutrals
  gray1: [240, 240, 248],
  gray2: [225, 225, 240],
  gray3: [180, 180, 210],
  gray4: [140, 140, 175],

  // Table
  tblHead: [37,  99,  235],
  tblHtxt: [255, 255, 255],
  tblAlt:  [246, 247, 255],
};

// Status → colour mapping (same source as statusLabel)
const STATUS_COLORS = {
  VERIFIED:            C.green,
  PARTIALLY_VERIFIED:  C.amber,
  REVIEW_REQUIRED:     C.amber,
  VERIFICATION_FAILED: C.red,
  ANALYSIS_INCOMPLETE: C.gray4,
  WARNING:             C.amber,
  ERROR:               C.red,
  NOT_ANALYZED:        C.gray4,
};

// ─── State ─────────────────────────────────────────────────────────────────────
let _doc, _page, _y;

function newDoc() {
  _doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  _page = 1;
  _y = MT;
}

function addPage() {
  _doc.addPage();
  _page++;
  _y = MT;
  // White background
  _doc.setFillColor(...C.white);
  _doc.rect(0, 0, PW, PH, 'F');
}

/** Check remaining vertical space; add page if needed. */
function need(h) {
  if (_y + h > PH - MB) addPage();
}

// Yield to keep the browser responsive during long generation
const yld = () => new Promise(r => setTimeout(r, 0));

// ─── Typography ────────────────────────────────────────────────────────────────
function font(size, style = 'normal', color = C.textPrimary) {
  _doc.setFont('helvetica', style);
  _doc.setFontSize(size);
  _doc.setTextColor(...color);
}

/** Write plain text. str is sanitised here automatically. */
function txt(str, x, y, opts = {}) {
  _doc.text(sanitize(str), x, y, opts);
}

/**
 * Multi-line wrapped paragraph.
 * Returns the new Y position after the text block.
 * No length limit — uses splitTextToSize for proper wrapping.
 */
function para(str, x, y, maxW, size = 8, style = 'normal', color = C.textPrimary, lineH = 5) {
  font(size, style, color);
  const safe = sanitize(str);
  if (!safe) return y;
  const lines = _doc.splitTextToSize(safe, maxW);
  // If block overflows page — split across pages
  let curY = y;
  for (const line of lines) {
    if (curY + lineH > PH - MB) {
      addPage();
      curY = _y;
    }
    _doc.text(line, x, curY);
    curY += lineH;
  }
  return curY + 1;
}

// ─── Shapes ────────────────────────────────────────────────────────────────────
function fillRect(x, y, w, h, color) {
  _doc.setFillColor(...color);
  _doc.rect(x, y, w, h, 'F');
}
function strokeRect(x, y, w, h, color, lw = 0.3) {
  _doc.setDrawColor(...color);
  _doc.setLineWidth(lw);
  _doc.rect(x, y, w, h, 'S');
}
function hRule(y, color = C.gray2, lw = 0.3) {
  _doc.setDrawColor(...color);
  _doc.setLineWidth(lw);
  _doc.line(ML, y, PW - MR, y);
}

// ─── Section header ────────────────────────────────────────────────────────────
function sectionHeader(num, title) {
  need(18);
  // Left accent bar
  fillRect(ML, _y, 4, 12, C.indigo);
  // Number chip
  font(7, 'bold', C.indigo);
  txt(String(num), ML + 7, _y + 8.5);
  // Title
  font(13, 'bold', C.textPrimary);
  txt(title.toUpperCase(), ML + 16, _y + 8.5);
  hRule(_y + 14, C.gray2, 0.5);
  _y += 20;
}

function subHeader(title) {
  need(10);
  font(9, 'bold', C.indigo);
  txt(title, ML, _y + 6);
  _y += 8;
}

// ─── Status badge ──────────────────────────────────────────────────────────────
function badge(statusKey, x, y) {
  const info   = statusLabel(statusKey);
  const color  = STATUS_COLORS[statusKey] || C.gray4;
  const label  = info.text;
  const w      = Math.max(label.length * 1.55 + 6, 22);
  fillRect(x, y - 3.5, w, 5.5, color);
  font(5.5, 'bold', C.white);
  txt(label, x + w / 2, y + 0.6, { align: 'center' });
  return x + w + 2;
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function footer(filename, totalPages) {
  hRule(PH - 14, C.gray2, 0.25);
  font(5.5, 'normal', C.gray4);
  txt(`LegalSafe-G  •  AI-Powered Legal Document Simplification & Verification`, ML, PH - 10);
  txt(`Confidential — For informational purposes only`, PW / 2, PH - 10, { align: 'center' });
  const pageStr = totalPages ? `Page ${_page} of ${totalPages}` : `Page ${_page}`;
  txt(pageStr, PW - MR, PH - 10, { align: 'right' });
}

// ─── Multi-line table ──────────────────────────────────────────────────────────
/**
 * Renders a table where each row can span multiple lines.
 * colWidths: proportional weights (will be scaled to TW)
 */
function table(headers, rows, colWeights, opts = {}) {
  const HEADER_H = 8;
  const PAD = 2.5;
  const LINE_H = 4.5;
  const MIN_ROW_H = 8;

  const total = colWeights.reduce((a, b) => a + b, 0);
  const ws = colWeights.map(w => (w / total) * TW);

  // Draw header row
  need(HEADER_H + MIN_ROW_H);
  fillRect(ML, _y, TW, HEADER_H, C.tblHead);
  let x = ML;
  headers.forEach((h, i) => {
    font(6.5, 'bold', C.tblHtxt);
    txt(sanitize(h), x + PAD, _y + 5.5);
    x += ws[i];
  });
  _y += HEADER_H;

  // Draw data rows
  rows.forEach((row, ri) => {
    // Pre-compute all wrapped cell content
    const cellLines = row.map((cell, ci) => {
      font(6.5, 'normal', C.textPrimary);
      return _doc.splitTextToSize(sanitize(String(cell ?? '')), ws[ci] - PAD * 2);
    });
    const rowH = Math.max(MIN_ROW_H, Math.max(...cellLines.map(l => l.length)) * LINE_H + PAD * 2);

    need(rowH);
    const bg = ri % 2 === 0 ? C.white : C.tblAlt;
    fillRect(ML, _y, TW, rowH, bg);

    // Light grid lines
    _doc.setDrawColor(...C.gray2);
    _doc.setLineWidth(0.1);
    _doc.rect(ML, _y, TW, rowH, 'S');

    x = ML;
    cellLines.forEach((lines, ci) => {
      const cellColor = opts.colColors?.[ci] || C.textPrimary;
      const cellStyle = opts.colStyles?.[ci] || 'normal';
      font(6.5, cellStyle, cellColor);
      _doc.text(lines, x + PAD, _y + PAD + LINE_H - 1);
      x += ws[ci];
    });
    _y += rowH;
  });
  _y += 3;
}

// ─── Info row (label: value) ───────────────────────────────────────────────────
function infoRow(label, value, isAlt = false) {
  need(8);
  if (isAlt) fillRect(ML, _y - 1, TW, 8, C.gray1);
  font(6.5, 'bold', C.textSecondary);
  txt(sanitize(label), ML + 2, _y + 4.5);
  font(6.5, 'normal', C.textPrimary);
  const valX = ML + 52;
  const val = sanitize(String(value ?? 'Not available'));
  const lines = _doc.splitTextToSize(val, TW - 54);
  _doc.text(lines, valX, _y + 4.5);
  _y += Math.max(8, lines.length * 5);
}

// ─── Stat card row ─────────────────────────────────────────────────────────────
function statCards(cards) {
  // cards: [{label, value, color?}]
  const n = cards.length;
  const cardW = (TW - (n - 1) * 3) / n;
  need(24);
  cards.forEach((c, i) => {
    const cx = ML + i * (cardW + 3);
    fillRect(cx, _y, cardW, 22, C.gray1);
    strokeRect(cx, _y, cardW, 22, C.gray2, 0.2);
    // Top colour stripe
    fillRect(cx, _y, cardW, 2.5, c.color || C.indigo);
    font(5.5, 'bold', C.textMuted);
    txt(sanitize(c.label).toUpperCase(), cx + cardW / 2, _y + 9, { align: 'center' });
    font(11, 'bold', c.color || C.navy);
    txt(sanitize(String(c.value ?? 'N/A')), cx + cardW / 2, _y + 17, { align: 'center' });
  });
  _y += 26;
}

// ─── Bullet list ───────────────────────────────────────────────────────────────
function bulletList(items, color = C.textPrimary) {
  items.forEach(item => {
    const s = sanitize(String(item));
    need(8);
    font(6.5, 'normal', color);
    const lines = _doc.splitTextToSize(`•  ${s}`, TW - 5);
    _doc.text(lines, ML + 3, _y + 4);
    _y += Math.max(7, lines.length * 5);
  });
}

// ─── Alert box ─────────────────────────────────────────────────────────────────
function alertBox(text, type = 'info') {
  const colorMap = { info: C.blueL, warning: C.amberL, error: C.redL, success: C.greenL };
  const accentMap = { info: C.blue, warning: C.amber, error: C.red, success: C.green };
  const bg = colorMap[type] || C.gray1;
  const ac = accentMap[type] || C.indigo;
  const s = sanitize(text);
  font(7, 'normal', C.textPrimary);
  const lines = _doc.splitTextToSize(s, TW - 10);
  const h = lines.length * 5 + 8;
  need(h);
  fillRect(ML, _y, TW, h, bg);
  fillRect(ML, _y, 3, h, ac);
  strokeRect(ML, _y, TW, h, ac, 0.3);
  _doc.text(lines, ML + 7, _y + 6);
  _y += h + 3;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION RENDERERS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Cover Page ────────────────────────────────────────────────────────────────
function renderCover(model) {
  const { meta, summary } = model;

  // Dark background
  fillRect(0, 0, PW, PH, C.coverBg);

  // Top accent strip
  fillRect(0, 0, PW, 4, C.coverAc);

  // Branding
  font(24, 'bold', C.white);
  txt('LegalSafe-G', PW / 2, 52, { align: 'center' });

  font(8.5, 'normal', [160, 170, 215]);
  txt('Automated Legal Document Simplification & Verification', PW / 2, 62, { align: 'center' });

  // Divider
  _doc.setDrawColor(...C.coverAc);
  _doc.setLineWidth(0.5);
  _doc.line(ML + 15, 68, PW - MR - 15, 68);

  // Report type label
  font(11, 'bold', [199, 210, 254]);
  txt('LEGAL DOCUMENT ANALYSIS REPORT', PW / 2, 78, { align: 'center' });

  // Document box
  fillRect(ML + 8, 85, TW - 16, 24, [22, 33, 75]);
  font(6, 'normal', [140, 155, 200]);
  txt('DOCUMENT', PW / 2, 93, { align: 'center' });
  font(10, 'bold', C.white);
  // Truncate only for display on the cover (long filenames)
  const dispFn = meta.filename.length > 50
    ? meta.filename.slice(0, 48) + '…'
    : meta.filename;
  txt(dispFn, PW / 2, 101, { align: 'center' });
  font(6.5, 'normal', [140, 155, 200]);
  txt(meta.docType, PW / 2, 107, { align: 'center' });

  // Stat cards
  const cards = [
    { l: 'ANALYSIS DATE',    v: meta.analysisDate },
    { l: 'CLAUSES DETECTED', v: String(summary.clausesDetected) },
    { l: 'CLAUSES VERIFIED', v: String(summary.clausesVerified) },
    { l: 'REVIEW REQUIRED',  v: String(summary.clausesReview) },
    { l: 'VERIFICATION',     v: summary.verificationScore + '%' },
  ];
  const cw = (TW - 4 * 3) / 5;
  const cy = 118;
  cards.forEach((c, i) => {
    const cx = ML + i * (cw + 3);
    fillRect(cx, cy, cw, 20, [22, 33, 75]);
    font(5, 'bold', [100, 120, 175]);
    txt(c.l, cx + cw / 2, cy + 7, { align: 'center' });
    font(9, 'bold', C.white);
    txt(c.v, cx + cw / 2, cy + 15, { align: 'center' });
  });

  // Verification banner — uses the SINGLE authoritative status
  const sl = statusLabel(summary.verificationStatus);
  const bannerColor = STATUS_COLORS[summary.verificationStatus] || C.gray4;
  fillRect(ML + 8, 148, TW - 16, 14, bannerColor);
  font(9, 'bold', C.white);
  txt(sl.text, PW / 2, 157.5, { align: 'center' });

  // Key findings (if any clauses)
  if (summary.clausesVerified > 0 || summary.clausesReview > 0) {
    const findingsY = 170;
    font(6, 'bold', [160, 170, 215]);
    txt('ANALYSIS COVERAGE', PW / 2, findingsY, { align: 'center' });
    const findings = [
      summary.clausesVerified  > 0 ? `✓ ${summary.clausesVerified} clause(s) verified`         : null,
      summary.clausesWarning   > 0 ? `~  ${summary.clausesWarning} clause(s) with warnings`     : null,
      summary.clausesReview    > 0 ? `⚠ ${summary.clausesReview} clause(s) require review`      : null,
      summary.clausesError     > 0 ? `✕ ${summary.clausesError} clause(s) could not be analyzed` : null,
    ].filter(Boolean);
    findings.forEach((f, i) => {
      font(7, 'normal', [200, 210, 240]);
      txt(f, PW / 2, findingsY + 8 + i * 7, { align: 'center' });
    });
  }

  // Disclaimer strip
  fillRect(0, PH - 36, PW, 36, [8, 14, 34]);
  font(6, 'bold', [150, 165, 210]);
  txt('DISCLAIMER', PW / 2, PH - 28, { align: 'center' });
  font(5.5, 'normal', [110, 125, 170]);
  const disc = 'This report is generated by LegalSafe-G for educational and informational purposes only. It does not constitute legal advice and does not replace the original legal document or advice from a qualified legal professional.';
  const dLines = _doc.splitTextToSize(disc, TW - 20);
  _doc.text(dLines, PW / 2, PH - 22, { align: 'center' });

  // Bottom accent
  fillRect(0, PH - 3, PW, 3, C.coverAc);
}

// ─── Table of Contents (renders at known page, with page number refs) ──────────
function renderTOC(sections, filename) {
  addPage();
  const tocPage = _page;

  font(16, 'bold', C.navy);
  txt('TABLE OF CONTENTS', ML, _y);
  hRule(_y + 4, C.indigo, 0.6);
  _y += 14;

  sections.forEach(({ num, title, page }, i) => {
    need(10);
    if (i % 2 === 0) fillRect(ML, _y - 1, TW, 9, C.gray1);
    font(7.5, 'bold', C.indigo);
    txt(num, ML + 2, _y + 5.5);
    font(8.5, 'normal', C.textPrimary);
    txt(title, ML + 12, _y + 5.5);
    // Dot leaders
    font(7, 'normal', C.gray3);
    const titleEndX = ML + 12 + title.length * 1.75;
    const dotEndX = PW - MR - 14;
    for (let dx = titleEndX + 4; dx < dotEndX; dx += 3.2) {
      _doc.text('.', dx, _y + 5.5);
    }
    font(8.5, 'bold', C.navy);
    txt(page ? String(page) : '—', PW - MR, _y + 5.5, { align: 'right' });
    _y += 10;
  });

  footer(filename, null);
  return tocPage;
}

// ─── §1 Executive Summary ──────────────────────────────────────────────────────
function renderExecutiveSummary(model) {
  addPage();
  const startPage = _page;
  sectionHeader('1', 'Executive Summary');

  const { meta, summary } = model;

  // Document information row
  subHeader('Document Information');
  infoRow('Document Name', meta.filename, false);
  infoRow('Document Type', meta.docType, true);
  infoRow('Analysis Date', meta.analysisDate, false);
  infoRow('Processing Mode', meta.mode === 'constrained' ? 'Constraint-Guided (Recommended)' : meta.mode, true);
  _y += 4;

  // Metric stat cards
  subHeader('Analysis Summary');
  statCards([
    { label: 'Clauses Detected',  value: summary.clausesDetected, color: C.indigo },
    { label: 'Clauses Analyzed',  value: summary.clausesAnalyzed, color: C.blue   },
    { label: 'Clauses Verified',  value: summary.clausesVerified, color: C.green  },
    { label: 'Review Required',   value: summary.clausesReview,   color: summary.clausesReview > 0 ? C.amber : C.green },
    { label: 'Verification Score',value: summary.verificationScore + '%', color: summary.verificationScore >= 70 ? C.green : summary.verificationScore >= 40 ? C.amber : C.red },
  ]);

  // Authoritative status banner — computed once from summary
  const sl = statusLabel(summary.verificationStatus);
  const bannerColor = STATUS_COLORS[summary.verificationStatus] || C.gray4;
  need(20);
  fillRect(ML, _y, TW, 16, bannerColor);
  font(10, 'bold', C.white);
  txt(sl.text, PW / 2, _y + 10, { align: 'center' });
  font(6, 'normal', C.white);
  txt(`Score: ${summary.verificationScore}%  •  ${summary.clausesVerified} verified  •  ${summary.clausesReview} requiring review`, PW / 2, _y + 14.5, { align: 'center' });
  _y += 20;

  _y += 4;

  // Key findings
  subHeader('Key Findings');
  const findings = [
    `${summary.clausesAnalyzed} clause(s) were analyzed from the uploaded document.`,
    summary.clausesVerified > 0
      ? `${summary.clausesVerified} clause(s) passed graph-based verification — legal facts are preserved in the simplified version.`
      : 'No clauses passed automated verification.',
    summary.clausesReview > 0
      ? `${summary.clausesReview} clause(s) require human review — automated verification could not confirm full fact preservation.`
      : 'No clauses require human review.',
    summary.totalMismatches > 0
      ? `${summary.totalMismatches} potential fact mismatch(es) detected between the original and simplified legal facts.`
      : 'No verified fact mismatches detected in the analyzed clauses.',
    !summary.analysisComplete
      ? 'Analysis coverage may be incomplete — some clauses could not be fully processed.'
      : `Analysis coverage: ${summary.clausesAnalyzed} of ${summary.clausesDetected} detected clause(s) processed.`,
  ];
  bulletList(findings, C.textPrimary);

  _y += 4;

  // Disclaimer (compact)
  need(18);
  fillRect(ML, _y, TW, 14, C.blueL);
  fillRect(ML, _y, 3, 14, C.blue);
  font(6.5, 'italic', C.textSecondary);
  const discText = 'This report is generated by LegalSafe-G for educational and informational purposes only. It does not constitute legal advice and does not replace the original legal document or advice from a qualified legal professional.';
  const discLines = _doc.splitTextToSize(discText, TW - 8);
  _doc.text(discLines, ML + 6, _y + 5);
  _y += 18;

  footer(meta.filename, null);
  return startPage;
}

// ─── §2 Document Overview ──────────────────────────────────────────────────────
function renderDocumentOverview(model) {
  addPage();
  const startPage = _page;
  sectionHeader('2', 'Document Overview');

  const { meta, summary, entities } = model;

  subHeader('Document Information');
  infoRow('File Name',    meta.filename, false);
  infoRow('Document Type', meta.docType, true);
  infoRow('Analysis Date', meta.analysisDate, false);
  infoRow('Result ID',     meta.resultId || 'Not available', true);
  _y += 4;

  subHeader('Processing Information');
  infoRow('AI Model',             meta.aiModel, false);
  infoRow('NLP Engine',           meta.nlpEngine, true);
  infoRow('Verification Method',  meta.verificationMethod, false);
  infoRow('Processing Mode',      meta.mode, true);
  _y += 4;

  subHeader('Document Statistics');
  infoRow('Clauses Detected',    String(summary.clausesDetected), false);
  infoRow('Clauses Analyzed',    String(summary.clausesAnalyzed), true);
  infoRow('Clauses Verified',    String(summary.clausesVerified), false);
  infoRow('Requiring Review',    String(summary.clausesReview), true);
  infoRow('Verification Score',  `${summary.verificationScore}%`, false);
  infoRow('Total Mismatches',    String(summary.totalMismatches), true);
  _y += 4;

  if (entities.parties.length > 0) {
    subHeader('Parties & Entities');
    bulletList(entities.parties, C.textPrimary);
    _y += 2;
  }

  if (entities.dates.length > 0) {
    subHeader('Dates Detected');
    bulletList(entities.dates, C.textPrimary);
    _y += 2;
  }

  if (entities.amounts.length > 0) {
    subHeader('Amounts & Financial Figures');
    bulletList(entities.amounts, C.textPrimary);
    _y += 2;
  }

  if (entities.locations.length > 0) {
    subHeader('Locations');
    bulletList(entities.locations, C.textPrimary);
    _y += 2;
  }

  if (entities.organizations.length > 0) {
    subHeader('Organisations');
    bulletList(entities.organizations, C.textPrimary);
    _y += 2;
  }

  if (entities.parties.length === 0 && entities.dates.length === 0 && entities.amounts.length === 0) {
    font(7.5, 'italic', C.textMuted);
    txt('No distinct entities could be reliably extracted from this document.', ML, _y);
    _y += 8;
  }

  footer(meta.filename, null);
  return startPage;
}

// ─── §3 Plain-Language Document ────────────────────────────────────────────────
async function renderPlainLanguageDocument(model) {
  addPage();
  const startPage = _page;
  sectionHeader('3', 'Plain-Language Document');

  font(7, 'italic', C.textMuted);
  txt('AI-generated plain-language version of the analyzed document.', ML, _y);
  _y += 6;
  alertBox('Each clause below has been simplified by FLAN-T5-Small using constraint-guided prompting to preserve legal facts. This is a simplification aid — always refer to the original document.', 'info');

  for (const cl of model.clauses) {
    await yld();
    need(25);

    // Clause title bar
    fillRect(ML, _y, TW, 8, C.gray1);
    fillRect(ML, _y, 3, 8, C.indigo);
    font(7.5, 'bold', C.navy);
    txt(`Clause ${cl.id}  —  ${cl.title}`, ML + 6, _y + 5.5);
    badge(cl.verification.status, PW - MR - 38, _y + 1.5);
    _y += 11;

    if (cl.simplifiedText) {
      _y = para(cl.simplifiedText, ML + 3, _y, TW - 6, 8, 'normal', C.textPrimary, 5);
    } else {
      font(7, 'italic', C.textMuted);
      txt('Simplified text not available for this clause.', ML + 3, _y);
      _y += 7;
    }

    hRule(_y + 2, C.gray2, 0.2);
    _y += 6;
  }

  footer(model.meta.filename, null);
  return startPage;
}

// ─── §4 Clause-by-Clause Analysis ─────────────────────────────────────────────
async function renderClauseAnalysis(model) {
  addPage();
  const startPage = _page;
  sectionHeader('4', 'Clause-by-Clause Analysis');

  for (const cl of model.clauses) {
    await yld();
    need(50);

    // Clause header
    fillRect(ML, _y, TW, 10, C.navy);
    font(8.5, 'bold', C.white);
    txt(`CLAUSE ${cl.id}`, ML + 4, _y + 7);
    font(7, 'normal', [180, 190, 230]);
    txt(cl.title, ML + 28, _y + 7);
    if (cl.verification.score !== null) {
      font(7, 'bold', C.white);
      txt(`Score: ${cl.verification.score}%`, PW - MR - 3, _y + 7, { align: 'right' });
    }
    _y += 12;

    // Status bar
    need(8);
    const statusColor = STATUS_COLORS[cl.verification.status] || C.gray4;
    fillRect(ML, _y, TW, 7, [...statusColor, 30]);
    font(6.5, 'bold', statusColor);
    const statusTxt = cl.verification.status === 'VERIFIED'       ? '✓  VERIFIED — Legal facts preserved'
                    : cl.verification.status === 'WARNING'         ? '~  PARTIAL — Some facts may differ'
                    : cl.verification.status === 'REVIEW_REQUIRED' ? '⚠  REVIEW REQUIRED — Facts may not be fully preserved'
                    : cl.verification.status === 'ERROR'           ? '✕  ERROR — Could not be analyzed'
                    :                                                  'Not analyzed';
    txt(statusTxt, ML + 4, _y + 4.8);
    if (cl.verification.score !== null) {
      // Score progress bar
      const barX = PW - MR - 55;
      const barW = 52;
      fillRect(barX, _y + 1.5, barW, 4, C.gray2);
      fillRect(barX, _y + 1.5, barW * Math.min(cl.verification.score, 100) / 100, 4, statusColor);
    }
    _y += 10;

    // Two-column: Original | Simplified
    const colW = (TW - 4) / 2;
    need(20);
    fillRect(ML, _y, colW, 6.5, C.gray1);
    fillRect(ML + colW + 4, _y, colW, 6.5, C.greenL);
    font(6.5, 'bold', C.blue);
    txt('ORIGINAL TEXT', ML + 3, _y + 4.5);
    font(6.5, 'bold', C.green);
    txt('SIMPLIFIED (AI)', ML + colW + 7, _y + 4.5);
    _y += 8;

    const origLines  = _doc.splitTextToSize(cl.originalText  || '(not available)', colW - 4);
    const simpLines  = _doc.splitTextToSize(cl.simplifiedText || '(not available)', colW - 4);
    const blockH     = Math.max(origLines.length, simpLines.length) * 4.5 + 6;

    need(blockH + 4);
    strokeRect(ML,           _y, colW, blockH, C.gray2, 0.2);
    strokeRect(ML + colW + 4, _y, colW, blockH, C.greenL, 0.3);
    font(6.5, 'normal', C.textSecondary);
    _doc.text(origLines, ML + 2, _y + 4.5);
    font(6.5, 'normal', C.textPrimary);
    _doc.text(simpLines, ML + colW + 6, _y + 4.5);
    _y += blockH + 4;

    // Extracted Legal Facts
    const f = cl.facts;
    const factRows = [
      ['Party / Subject',  f.subject || f.parties.slice(0, 2).join(', ')],
      ['Action',           f.action],
      ['Object',           f.object],
      ['Obligation',       f.obligations.slice(0, 1)[0]],
      ['Right',            f.rights.slice(0, 1)[0]],
      ['Modality',         f.modality],
      ['Amount',           f.amount ? `${f.currency || ''} ${f.amount}`.trim() : null],
      ['Deadline',         f.deadline],
      ['Condition',        f.condition],
      ['Exception',        f.exception],
      ['Penalty',          f.penalty],
    ].filter(r => r[1]);

    if (factRows.length) {
      need(factRows.length * 8 + 14);
      subHeader('Extracted Legal Facts');
      table(['Fact Type', 'Value'], factRows, [35, 140]);
    } else {
      need(10);
      font(7, 'italic', C.textMuted);
      txt('No structured legal facts could be reliably extracted from this clause.', ML + 2, _y + 4);
      _y += 8;
    }

    // Verification detail
    if (cl.verification.mismatches.length > 0) {
      need(cl.verification.mismatches.length * 8 + 14);
      subHeader('Fact Verification Detail');
      const mmRows = cl.verification.mismatches.map(m => [
        m.type,
        m.original || '—',
        m.generated || '(missing)',
        m.severity,
      ]);
      table(
        ['Mismatch Type', 'Original Value', 'Simplified Value', 'Severity'],
        mmRows,
        [40, 55, 55, 25],
        { colColors: [C.textPrimary, C.textPrimary, C.textPrimary, C.amber] }
      );
    }

    // Difficult terms
    if (cl.difficultTerms.length > 0) {
      need(cl.difficultTerms.length * 8 + 14);
      subHeader('Legal Terms in This Clause');
      table(
        ['Term', 'Plain-Language Meaning'],
        cl.difficultTerms.slice(0, 6).map(t => [t.term, t.explanation]),
        [40, 135]
      );
    }

    // Attention points
    if (cl.attentionPoints.length > 0) {
      cl.attentionPoints.forEach(ap => {
        alertBox(ap.note, ap.level === 'CRITICAL' ? 'error' : 'warning');
      });
    }

    hRule(_y, C.gray2, 0.3);
    _y += 6;
  }

  footer(model.meta.filename, null);
  return startPage;
}

// ─── §5 Legal Facts & Entities ────────────────────────────────────────────────
async function renderLegalFacts(model) {
  addPage();
  const startPage = _page;
  sectionHeader('5', 'Legal Facts & Entities');

  const cats = [
    { label: 'Parties & Organisations', vals: [...new Set([...model.entities.parties, ...model.entities.organizations])] },
    { label: 'Legal Obligations',        vals: model.clauses.flatMap(c => c.facts.obligations).filter(Boolean).slice(0, 10) },
    { label: 'Rights & Permissions',     vals: model.clauses.flatMap(c => [...c.facts.rights, ...c.facts.permissions]).filter(Boolean).slice(0, 8) },
    { label: 'Prohibitions',             vals: model.clauses.flatMap(c => c.facts.prohibitions).filter(Boolean).slice(0, 8) },
    { label: 'Dates & Deadlines',        vals: model.entities.dates },
    { label: 'Amounts & Figures',        vals: model.entities.amounts },
    { label: 'Locations',               vals: model.entities.locations },
    { label: 'Penalties & Consequences', vals: model.clauses.flatMap(c => c.facts.penalties).filter(Boolean).slice(0, 8) },
    { label: 'Exceptions',              vals: model.clauses.flatMap(c => c.facts.exceptions).filter(Boolean).slice(0, 6) },
    { label: 'Conditions',              vals: model.clauses.flatMap(c => c.facts.condition ? [c.facts.condition] : []).slice(0, 6) },
  ];

  let anyContent = false;
  for (const { label, vals } of cats) {
    if (!vals.length) continue;
    await yld();
    anyContent = true;
    subHeader(label);
    const rows = vals.map((v, i) => [`${i + 1}.`, String(v)]);
    table(['#', label], rows, [8, 165]);
    _y += 2;
  }

  if (!anyContent) {
    alertBox('No structured legal facts could be reliably extracted from the analyzed clauses. The document may use non-standard language or the NLP extraction may have been limited.', 'warning');
  }

  footer(model.meta.filename, null);
  return startPage;
}

// ─── §6 Verification Report ────────────────────────────────────────────────────
function renderVerificationReport(model) {
  addPage();
  const startPage = _page;
  sectionHeader('6', 'Verification Report');

  const { summary, clauses } = model;

  // Authoritative overall status — from the SAME summary object used everywhere
  const sl = statusLabel(summary.verificationStatus);
  const bannerColor = STATUS_COLORS[summary.verificationStatus] || C.gray4;
  need(18);
  fillRect(ML, _y, TW, 14, bannerColor);
  font(10, 'bold', C.white);
  txt(sl.text, PW / 2, _y + 9.5, { align: 'center' });
  _y += 18;

  // Summary numbers
  need(22);
  const sumBg = summary.verificationStatus === 'VERIFIED' ? C.greenL
              : summary.verificationStatus === 'VERIFICATION_FAILED' ? C.redL
              : C.amberL;
  fillRect(ML, _y, TW, 16, sumBg);
  strokeRect(ML, _y, TW, 16, bannerColor, 0.3);
  font(7.5, 'normal', C.textSecondary);
  const sumLine = [
    `Clauses analyzed: ${summary.clausesAnalyzed}`,
    `Verified: ${summary.clausesVerified}`,
    summary.clausesWarning > 0 ? `Warnings: ${summary.clausesWarning}` : null,
    summary.clausesReview > 0  ? `Review required: ${summary.clausesReview}` : null,
    summary.clausesError > 0   ? `Errors: ${summary.clausesError}` : null,
    `Average score: ${summary.verificationScore}%`,
    `Mismatches: ${summary.totalMismatches}`,
  ].filter(Boolean).join('   •   ');
  txt(sumLine, ML + 4, _y + 10);
  _y += 20;

  // Visual count summary
  need(14);
  subHeader('Result Breakdown');
  const breakdown = [
    summary.clausesVerified  > 0 ? { sym: '✓', count: summary.clausesVerified,  label: 'Verified',       color: C.green } : null,
    summary.clausesWarning   > 0 ? { sym: '~', count: summary.clausesWarning,   label: 'Warning',        color: C.amber } : null,
    summary.clausesReview    > 0 ? { sym: '⚠', count: summary.clausesReview,    label: 'Review Required', color: C.red   } : null,
    summary.clausesError     > 0 ? { sym: '✕', count: summary.clausesError,     label: 'Error',           color: C.gray4 } : null,
  ].filter(Boolean);

  if (breakdown.length === 0) {
    font(7, 'italic', C.textMuted);
    txt('No clauses were analyzed.', ML, _y);
    _y += 8;
  } else {
    breakdown.forEach(b => {
      need(8);
      fillRect(ML, _y - 1, TW, 7.5, C.gray1);
      font(8, 'bold', b.color);
      txt(`${b.sym}  ${b.count}  ${b.label.toUpperCase()}`, ML + 4, _y + 5);
      _y += 8.5;
    });
    _y += 4;
  }

  // Clause verification table
  subHeader('Clause Verification Table');
  const verRows = clauses.map(cl => [
    `Clause ${cl.id}`,
    cl.title,
    cl.verification.score !== null ? `${cl.verification.score}%` : 'N/A',
    cl.verification.status,
    String(cl.verification.mismatches.length),
    cl.verification.status === 'REVIEW_REQUIRED' ? 'Human review' : cl.verification.status === 'VERIFIED' ? 'None' : 'Review',
  ]);

  table(
    ['Clause', 'Topic', 'Score', 'Status', 'Issues', 'Action'],
    verRows,
    [18, 50, 15, 35, 15, 30],
    {
      colColors: [C.textPrimary, C.textPrimary, C.textPrimary, C.textPrimary, C.amber, C.textPrimary],
    }
  );

  // Score note
  _y += 2;
  font(6.5, 'italic', C.textMuted);
  txt('Score = fraction of verifiable legal facts (amount, modality, deadline, party, condition, etc.) preserved in the simplified version.', ML, _y);
  _y += 7;
  txt('N/A = verification was not performed (e.g. clause encountered a processing error).', ML, _y);
  _y += 8;

  footer(model.meta.filename, null);
  return startPage;
}

// ─── §7 Mismatch & Attention Points ───────────────────────────────────────────
function renderMismatches(model) {
  addPage();
  const startPage = _page;
  sectionHeader('7', 'Mismatch & Attention Points');

  const { mismatches, summary, clauses } = model;

  const critical = mismatches.filter(m => m.severity === 'CRITICAL');
  const warnings  = mismatches.filter(m => m.severity === 'WARNING');
  const minor     = mismatches.filter(m => m.severity === 'MINOR');

  const reviewClauses = clauses.filter(cl => cl.verification.status === 'REVIEW_REQUIRED');

  if (mismatches.length === 0 && reviewClauses.length === 0) {
    alertBox('No verified mismatches detected in the analyzed clauses. All extracted legal facts appear to be preserved in the simplified version.', 'success');

    if (!summary.analysisComplete) {
      alertBox('Note: Analysis coverage may be incomplete. Some document content could not be reliably analyzed and therefore cannot be considered verified. The absence of mismatches above applies only to the clauses that were successfully processed.', 'warning');
    }
  } else {
    // ── Critical
    if (critical.length > 0) {
      subHeader('Critical Issues — Immediate Review Required');
      critical.forEach((m, i) => {
        need(18);
        fillRect(ML, _y, TW, 14, C.redL);
        fillRect(ML, _y, 4, 14, C.red);
        strokeRect(ML, _y, TW, 14, C.red, 0.25);
        font(7, 'bold', C.red);
        txt(`Clause ${m.clauseId}  —  ${m.type}`, ML + 7, _y + 5);
        font(6.5, 'normal', C.textSecondary);
        txt(`Original:    ${sanitizeCell(m.original, 100)}`, ML + 7, _y + 10);
        font(6.5, 'normal', C.amber);
        txt(`Simplified:  ${sanitizeCell(m.generated, 100)}`, ML + TW / 2, _y + 10);
        _y += 17;
      });
      _y += 3;
    }

    // ── Warnings
    if (warnings.length > 0) {
      subHeader('Warning — Review Recommended');
      warnings.forEach(m => {
        need(16);
        fillRect(ML, _y, TW, 12, C.amberL);
        fillRect(ML, _y, 4, 12, C.amber);
        font(6.5, 'bold', C.amber);
        txt(`Clause ${m.clauseId}  —  ${m.type}`, ML + 7, _y + 4.5);
        font(6, 'normal', C.textSecondary);
        txt(`Original: ${sanitizeCell(m.original, 90)}   →   Simplified: ${sanitizeCell(m.generated, 90)}`, ML + 7, _y + 9.5);
        _y += 15;
      });
      _y += 3;
    }

    // ── Minor
    if (minor.length > 0) {
      subHeader('Minor Attention Points');
      const minorRows = minor.map(m => [
        `Clause ${m.clauseId}`, m.type,
        sanitizeCell(m.original, 60), sanitizeCell(m.generated, 60),
      ]);
      table(['Clause', 'Type', 'Original', 'Simplified'], minorRows, [20, 35, 60, 60]);
    }

    // ── Clauses requiring review (no explicit mismatch but HUMAN_REVIEW_REQUIRED)
    if (reviewClauses.length > 0) {
      _y += 4;
      subHeader('Clauses Requiring Human Review');
      // Carefully distinguish: this is different from a detected mismatch
      alertBox(
        `The following clause(s) are marked "Review Required" because the AI regeneration loop could not produce a simplified version that passed graph-based verification within the allowed retries. This does NOT necessarily mean facts are wrong — it means automated verification was inconclusive. A qualified reviewer should compare the original and simplified versions.`,
        'warning'
      );
      reviewClauses.forEach(cl => {
        need(30);
        fillRect(ML, _y, TW, 8, C.amberL);
        fillRect(ML, _y, 4, 8, C.amber);
        font(7, 'bold', C.amber);
        txt(`Clause ${cl.id}  —  ${cl.title}`, ML + 7, _y + 5.5);
        _y += 11;
        font(7, 'normal', C.textSecondary);
        txt('Please compare the original and simplified texts in §4 (Clause-by-Clause Analysis).', ML + 7, _y);
        _y += 8;
      });
    }
  }

  footer(model.meta.filename, null);
  return startPage;
}

// ─── §8 Legal Glossary ────────────────────────────────────────────────────────
function renderGlossary(model) {
  addPage();
  const startPage = _page;
  sectionHeader('8', 'Legal Glossary');

  font(7, 'italic', C.textMuted);
  txt('Plain-language explanations of legal terms identified in this document.', ML, _y);
  _y += 8;

  const { glossary } = model;

  if (!glossary.length) {
    font(7.5, 'italic', C.textMuted);
    txt('No specific legal jargon requiring explanation was identified in this document.', ML, _y);
    _y += 8;
  } else {
    const rows = glossary.map(g => [
      g.term,
      g.explanation,
      g.sourceClauses.length > 0 ? `Clause ${g.sourceClauses.join(', ')}` : '—',
    ]);
    table(
      ['Legal Term', 'Plain-Language Explanation', 'Appears In'],
      rows,
      [40, 115, 20]
    );
  }

  footer(model.meta.filename, null);
  return startPage;
}

// ─── §9 Analysis Limitations ──────────────────────────────────────────────────
function renderLimitations(model) {
  addPage();
  const startPage = _page;
  sectionHeader('9', 'Analysis Limitations');

  font(7.5, 'italic', C.textMuted);
  txt('LegalSafe-G is an AI research prototype. The following limitations apply to this analysis.', ML, _y);
  _y += 10;

  model.limitations.forEach((lim, i) => {
    need(14);
    fillRect(ML, _y, TW, 10, i % 2 === 0 ? C.gray1 : C.white);
    fillRect(ML, _y, 3, 10, C.indigo);
    font(7, 'normal', C.textPrimary);
    const lines = _doc.splitTextToSize(sanitize(lim), TW - 8);
    const h = Math.max(10, lines.length * 5 + 3);
    if (h > 10) { fillRect(ML, _y, TW, h, i % 2 === 0 ? C.gray1 : C.white); fillRect(ML, _y, 3, h, C.indigo); }
    _doc.text(lines, ML + 6, _y + 5);
    _y += h + 2;
  });

  footer(model.meta.filename, null);
  return startPage;
}

// ─── §10 Technical Appendix ───────────────────────────────────────────────────
function renderTechnicalAppendix(model) {
  addPage();
  const startPage = _page;
  sectionHeader('10', 'Technical Appendix');

  const { technicalDetails, meta } = model;

  subHeader('Processing Pipeline');
  technicalDetails.pipeline.forEach((step, i) => {
    need(9);
    fillRect(ML, _y - 1, TW, 8, i % 2 === 0 ? C.gray1 : C.white);
    font(6.5, 'bold', C.indigo);
    txt(`Step ${i + 1}`, ML + 2, _y + 4.5);
    font(6.5, 'normal', C.textPrimary);
    txt(sanitize(step), ML + 18, _y + 4.5);
    _y += 8;
  });

  _y += 6;
  subHeader('Technology Stack');
  const techRows = technicalDetails.technology.map(t => [t.name, t.role]);
  table(['Component', 'Role'], techRows, [60, 115]);

  _y += 6;
  subHeader('Report Information');
  infoRow('Generated',    meta.analysisDateTime, false);
  infoRow('Document',     meta.filename, true);
  infoRow('Result ID',    meta.resultId || 'N/A', false);
  infoRow('Model',        meta.aiModel, true);
  infoRow('NLP Engine',   meta.nlpEngine, false);

  footer(model.meta.filename, null);
  return startPage;
}

// ─── §11 Final Disclaimer ────────────────────────────────────────────────────
function renderFinalDisclaimer(model) {
  addPage();
  const startPage = _page;
  sectionHeader('11', 'Important Legal Disclaimer');

  const blocks = [
    {
      title: 'Original Document is Authoritative',
      body: `The original uploaded file ("${model.meta.filename}") remains the authoritative legal record. This report is a supplementary AI-generated analytical aid and must not be treated as a replacement for the original document.`,
      type: 'error',
    },
    {
      title: 'Not Legal Advice',
      body: 'This report is generated automatically by the LegalSafe-G AI system for educational and informational purposes only. It does not constitute legal advice. Always consult a qualified legal professional before making any legal decision.',
      type: 'error',
    },
    {
      title: 'AI Simplification Limitations',
      body: 'While LegalSafe-G uses advanced NLP and transformer models, AI simplification is imperfect. Clauses marked "Warning" or "Review Required" indicate areas where automated verification could not confirm fact preservation. These require human review.',
      type: 'warning',
    },
    {
      title: 'Verification Scope',
      body: 'Graph-based verification checks whether key legal facts (amounts, modalities, deadlines, parties, conditions) are structurally preserved. It does not validate legal correctness, jurisdiction-specific requirements, or all possible legal nuances.',
      type: 'warning',
    },
    {
      title: 'Data Privacy',
      body: 'Document processing is performed locally on your system. No document content is transmitted to external servers unless explicitly configured. LegalSafe-G stores processed results in a local SQLite database for session use only.',
      type: 'info',
    },
    {
      title: 'Research Prototype',
      body: 'LegalSafe-G is a research prototype developed for academic and educational evaluation. It is not a production legal system and has not been validated for real-world legal practice.',
      type: 'info',
    },
  ];

  blocks.forEach(b => {
    need(30);
    fillRect(ML, _y, TW, 8, C.gray1);
    const ac = b.type === 'error' ? C.red : b.type === 'warning' ? C.amber : C.blue;
    fillRect(ML, _y, 4, 8, ac);
    font(8, 'bold', ac);
    txt(b.title, ML + 7, _y + 5.5);
    _y += 10;
    _y = para(b.body, ML, _y, TW, 7.5, 'normal', C.textSecondary, 5);
    _y += 5;
  });

  // Final box
  need(20);
  fillRect(ML, _y, TW, 16, C.navy);
  font(7, 'bold', C.white);
  txt(`LegalSafe-G  |  Report generated: ${model.meta.analysisDateTime}`, ML + 4, _y + 6);
  font(6.5, 'normal', [160, 170, 215]);
  txt(`Document: ${model.meta.filename}  •  Clauses: ${model.summary.clausesAnalyzed}  •  Score: ${model.summary.verificationScore}%  •  Engine: LegalSafe-G v1.0`, ML + 4, _y + 12);
  _y += 20;

  footer(model.meta.filename, null);
  return startPage;
}

// ─── Legal Fact Graph section ─────────────────────────────────────────────────
function renderFactGraph(model) {
  addPage();
  const startPage = _page;
  sectionHeader('G', 'Legal Fact Graph');

  const { graphSummary } = model;

  font(7.5, 'italic', C.textMuted);
  txt('The legal fact graph represents relationships between parties, actions, obligations,', ML, _y);
  _y += 5;
  txt('rights, conditions, and other legal facts identified in the document.', ML, _y);
  _y += 9;

  if (!graphSummary.available) {
    alertBox('A legal fact graph could not be generated from the available analysis. This may occur when the document contains insufficient structured legal facts for graph construction.', 'warning');
    footer(model.meta.filename, null);
    return startPage;
  }

  // Graph statistics
  subHeader('Graph Statistics');
  need(22);
  statCards([
    { label: 'Total Nodes', value: String(graphSummary.totalNodes), color: C.indigo },
    { label: 'Total Edges', value: String(graphSummary.totalEdges), color: C.blue   },
    { label: 'Node Types',  value: String(graphSummary.nodeTypes.length), color: C.green },
  ]);

  // Node types
  if (graphSummary.nodeTypes.length > 0) {
    subHeader('Node Types Detected');
    bulletList(graphSummary.nodeTypes, C.textPrimary);
    _y += 4;
  }

  // Relationship table
  if (graphSummary.relationships.length > 0) {
    subHeader('Key Relationships (Sample)');
    const relRows = graphSummary.relationships.map(r => [
      r.source, r.relation, r.target, `Clause ${r.clauseId}`,
    ]);
    table(
      ['Source Node', 'Relationship', 'Target Node', 'Clause'],
      relRows,
      [52, 35, 52, 18]
    );
  }

  // Legend
  _y += 4;
  subHeader('Node Type Legend');
  const legend = [
    { type: 'PARTY / ENTITY', desc: 'A person, organisation, or role identified in the document (e.g. Tenant, Employer)' },
    { type: 'OBLIGATION',     desc: 'A duty that must be performed (e.g. must pay rent, must submit report)' },
    { type: 'RIGHT',          desc: 'An entitlement of a party (e.g. right to inspect, right to terminate)' },
    { type: 'CONDITION',      desc: 'A trigger or prerequisite for an obligation or right' },
    { type: 'PROHIBITION',    desc: 'Something that is explicitly forbidden (e.g. shall not sublease)' },
    { type: 'AMOUNT',         desc: 'A monetary value identified in the document' },
    { type: 'DEADLINE',       desc: 'A time limit or due date identified in the document' },
    { type: 'EXCEPTION',      desc: 'A case where a general rule does not apply' },
  ];
  table(
    ['Node Type', 'Meaning'],
    legend.map(l => [l.type, l.desc]),
    [35, 140]
  );

  footer(model.meta.filename, null);
  return startPage;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate and download the professional LegalSafe-G analysis report.
 *
 * @param {object} rawResult — Full JSON result from the /api/result/:id endpoint
 */
export async function downloadResultPDF(rawResult) {
  // ── Step 1: Build clean report model ──────────────────────────────────────
  const model = buildReportModel(rawResult);
  const { meta, summary } = model;

  newDoc();

  // ── Step 2: Cover page (page 1) ───────────────────────────────────────────
  await yld();
  renderCover(model);
  footer(meta.filename, null);

  // ── Step 3: Render all content sections (collecting start pages) ──────────
  // We render TOC placeholder now and come back to fill in page numbers.

  const sectionPages = {};

  // TOC placeholder — we'll fill this in on pass 2
  addPage();
  const tocPageNum = _page;

  // Render sections in order
  await yld();
  sectionPages['exec']       = renderExecutiveSummary(model);

  await yld();
  sectionPages['overview']   = renderDocumentOverview(model);

  await yld();
  sectionPages['plain']      = await renderPlainLanguageDocument(model);

  await yld();
  sectionPages['analysis']   = await renderClauseAnalysis(model);

  await yld();
  sectionPages['facts']      = await renderLegalFacts(model);

  await yld();
  sectionPages['graph']      = renderFactGraph(model);

  await yld();
  sectionPages['verify']     = renderVerificationReport(model);

  await yld();
  sectionPages['mismatch']   = renderMismatches(model);

  await yld();
  sectionPages['glossary']   = renderGlossary(model);

  await yld();
  sectionPages['limits']     = renderLimitations(model);

  await yld();
  sectionPages['appendix']   = renderTechnicalAppendix(model);

  await yld();
  sectionPages['disclaimer'] = renderFinalDisclaimer(model);

  const totalPages = _page;

  // ── Step 4: Re-render footers with total page count ───────────────────────
  // jsPDF doesn't support retroactive edits, so we stamp total pages
  // by adding a transparent text overlay on each page footer.
  // We use the stored _page count and re-generate footer text on pass-2.
  // (In jsPDF this requires going back to each page.)
  for (let p = 2; p <= totalPages; p++) {
    _doc.setPage(p);
    // Overwrite old page number area with white rect, then redraw
    fillRect(PW - MR - 30, PH - 13, 32, 6, C.white);
    font(5.5, 'normal', C.gray4);
    _doc.text(`Page ${p} of ${totalPages}`, PW - MR, PH - 10, { align: 'right' });
  }

  // ── Step 5: Render TOC on page 2 ──────────────────────────────────────────
  _doc.setPage(tocPageNum);
  _y = MT;

  // White out the placeholder page
  fillRect(0, 0, PW, PH, C.white);

  font(16, 'bold', C.navy);
  txt('TABLE OF CONTENTS', ML, _y);
  hRule(_y + 4, C.indigo, 0.6);
  _y += 14;

  const tocSections = [
    { num: '1.',  title: 'Executive Summary',          page: sectionPages['exec'] },
    { num: '2.',  title: 'Document Overview',          page: sectionPages['overview'] },
    { num: '3.',  title: 'Plain-Language Document',    page: sectionPages['plain'] },
    { num: '4.',  title: 'Clause-by-Clause Analysis',  page: sectionPages['analysis'] },
    { num: '5.',  title: 'Legal Facts & Entities',     page: sectionPages['facts'] },
    { num: 'G.',  title: 'Legal Fact Graph',           page: sectionPages['graph'] },
    { num: '6.',  title: 'Verification Report',        page: sectionPages['verify'] },
    { num: '7.',  title: 'Mismatch & Attention Points',page: sectionPages['mismatch'] },
    { num: '8.',  title: 'Legal Glossary',             page: sectionPages['glossary'] },
    { num: '9.',  title: 'Analysis Limitations',       page: sectionPages['limits'] },
    { num: '10.', title: 'Technical Appendix',         page: sectionPages['appendix'] },
    { num: '11.', title: 'Important Disclaimer',       page: sectionPages['disclaimer'] },
  ];

  tocSections.forEach(({ num, title, page }, i) => {
    if (_y + 10 > PH - MB) return; // skip if overflows (shouldn't happen)
    if (i % 2 === 0) fillRect(ML, _y - 1, TW, 9, C.gray1);
    font(7.5, 'bold', C.indigo);
    txt(num, ML + 2, _y + 5.5);
    font(8.5, 'normal', C.textPrimary);
    txt(title, ML + 14, _y + 5.5);
    // Dot leaders
    font(7, 'normal', C.gray3);
    const titleEndX = ML + 14 + title.length * 1.8;
    const dotEndX = PW - MR - 14;
    for (let dx = titleEndX + 4; dx < dotEndX; dx += 3.2) {
      _doc.text('.', dx, _y + 5.5);
    }
    font(8.5, 'bold', C.navy);
    txt(String(page || '—'), PW - MR, _y + 5.5, { align: 'right' });
    _y += 10;
  });

  // Summary box in TOC
  _y += 6;
  fillRect(ML, _y, TW, 22, C.gray1);
  strokeRect(ML, _y, TW, 22, C.gray2);
  font(7, 'bold', C.textSecondary);
  txt('REPORT SUMMARY', ML + 4, _y + 6);
  font(6.5, 'normal', C.textSecondary);
  txt(`Document: ${sanitizeCell(meta.filename, 45)}`, ML + 4, _y + 11);
  txt(`Type: ${meta.docType}`, ML + 4, _y + 15);
  txt(`Clauses: ${summary.clausesAnalyzed}   Verified: ${summary.clausesVerified}   Review: ${summary.clausesReview}   Score: ${summary.verificationScore}%   Status: ${statusLabel(summary.verificationStatus).text}`, ML + 4, _y + 20);
  _y += 26;

  // Footer for TOC page
  hRule(PH - 14, C.gray2, 0.25);
  font(5.5, 'normal', C.gray4);
  txt('LegalSafe-G  •  AI-Powered Legal Document Simplification & Verification', ML, PH - 10);
  txt('Confidential — For informational purposes only', PW / 2, PH - 10, { align: 'center' });
  txt(`Page ${tocPageNum} of ${totalPages}`, PW - MR, PH - 10, { align: 'right' });

  // ── Step 6: Cover page footer with total ──────────────────────────────────
  _doc.setPage(1);
  fillRect(PW - MR - 30, PH - 13, 32, 6, [13, 20, 42]);
  font(5.5, 'normal', [100, 115, 160]);
  _doc.text(`Page 1 of ${totalPages}`, PW - MR, PH - 10, { align: 'right' });

  // ── Step 7: Save ──────────────────────────────────────────────────────────
  await yld();
  _doc.save(meta.pdfFilename);
}
