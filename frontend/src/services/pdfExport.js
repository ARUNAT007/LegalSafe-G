/**
 * pdfExport.js — LegalSafe-G
 * Generates a structured Legal Document Analysis Report with:
 *   - Cover Page
 *   - Table of Contents
 *   - Document Overview
 *   - Original vs Simplified (complete text)
 *   - Clause-by-Clause Analysis
 *   - Legal Facts & Entities
 *   - Verification Report
 *   - Glossary of Legal Terms
 *   - Disclaimer
 */

import { jsPDF } from 'jspdf';

// ─── Constants ─────────────────────────────────────────────────────────────────
const PW = 210;   // page width  (mm, A4)
const PH = 297;   // page height (mm, A4)
const ML = 18;    // margin left
const MR = 18;    // margin right
const MT = 20;    // margin top
const MB = 20;    // margin bottom
const TW = PW - ML - MR;  // text width

// Colour palette (RGB arrays)
const CLR = {
  black:   [0,   0,   0  ],
  white:   [255, 255, 255],
  pageB:   [250, 250, 252],  // page background
  accent:  [37,  99,  235],  // blue accent (headings, rules)
  accent2: [99,  102, 241],  // indigo (sub-headings)
  green:   [22,  163, 74 ],
  red:     [220, 38,  38 ],
  amber:   [217, 119, 6  ],
  gray1:   [30,  30,  50 ],  // primary text
  gray2:   [80,  80,  110],  // secondary text
  gray3:   [140, 140, 170],  // muted text
  gray4:   [220, 220, 235],  // light rule / border
  gray5:   [245, 245, 252],  // table alt row
  tblH:    [37,  99,  235],  // table header bg
  tblHtx:  [255, 255, 255],  // table header text
  tblRow:  [255, 255, 255],  // table row bg
  tblAlt:  [245, 247, 255],  // alt row
  coverBg: [15,  23,  42 ],  // cover dark bg
  coverAc: [99,  102, 241],  // cover accent
};

// Yield to keep browser responsive
const yld = () => new Promise(r => setTimeout(r, 0));

// ─── Doc state ─────────────────────────────────────────────────────────────────
let _doc, _page, _y;

function newDoc() {
  _doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  _page = 1;
  _y = MT;
  pageBg();
}

function pageBg() {
  // White page background
  _doc.setFillColor(...CLR.white);
  _doc.rect(0, 0, PW, PH, 'F');
}

function addPage() {
  _doc.addPage();
  _page++;
  _y = MT;
  pageBg();
}

// Check remaining space; add page if needed
function need(h) {
  if (_y + h > PH - MB) { addPage(); }
}

// ─── Typography helpers ────────────────────────────────────────────────────────
function setFont(size, style = 'normal', color = CLR.gray1) {
  _doc.setFont('helvetica', style);
  _doc.setFontSize(size);
  _doc.setTextColor(...color);
}

function text(str, x, y, opts = {}) {
  _doc.text(String(str ?? ''), x, y, opts);
}

// Multi-line wrapped text — returns new Y after text
function para(str, x, y, maxW, size, style = 'normal', color = CLR.gray1, lineH = 5) {
  setFont(size, style, color);
  const lines = _doc.splitTextToSize(String(str ?? '').slice(0, 1000), maxW);
  _doc.text(lines, x, y);
  return y + lines.length * lineH + 1;
}

// Horizontal rule
function rule(y, color = CLR.gray4, lw = 0.3) {
  _doc.setDrawColor(...color);
  _doc.setLineWidth(lw);
  _doc.line(ML, y, PW - MR, y);
}

// Filled rectangle
function fillRect(x, y, w, h, color) {
  _doc.setFillColor(...color);
  _doc.rect(x, y, w, h, 'F');
}

// Outlined rectangle
function strokeRect(x, y, w, h, color, lw = 0.3) {
  _doc.setDrawColor(...color);
  _doc.setLineWidth(lw);
  _doc.rect(x, y, w, h, 'S');
}

// ─── Section header ────────────────────────────────────────────────────────────
function secTitle(num, title, color = CLR.accent) {
  need(16);
  // Left accent bar
  fillRect(ML, _y, 3, 10, color);
  // Number
  setFont(8, 'bold', color);
  text(String(num), ML + 5, _y + 7);
  // Title
  setFont(13, 'bold', CLR.gray1);
  text(title.toUpperCase(), ML + 14, _y + 7);
  rule(_y + 12, CLR.gray4, 0.4);
  _y += 18;
}

// Sub-section title
function subTitle(title) {
  need(10);
  setFont(9, 'bold', CLR.accent2);
  text(title, ML, _y);
  _y += 6;
}

// ─── Table helper ──────────────────────────────────────────────────────────────
function table(headers, rows, colWidths) {
  const ROW_H = 8;
  const HEADER_H = 9;
  const total = colWidths.reduce((a, b) => a + b, 0);
  const scale = TW / total;
  const ws = colWidths.map(w => w * scale);

  // Header row
  need(HEADER_H + ROW_H);
  fillRect(ML, _y, TW, HEADER_H, CLR.tblH);
  let x = ML;
  headers.forEach((h, i) => {
    setFont(7, 'bold', CLR.tblHtx);
    text(String(h), x + 2, _y + 6.2);
    x += ws[i];
  });
  _y += HEADER_H;

  // Data rows
  rows.forEach((row, ri) => {
    need(ROW_H + 2);
    const bg = ri % 2 === 0 ? CLR.tblRow : CLR.tblAlt;
    fillRect(ML, _y, TW, ROW_H, bg);
    strokeRect(ML, _y, TW, ROW_H, CLR.gray4, 0.1);
    x = ML;
    row.forEach((cell, ci) => {
      const maxChars = Math.floor((ws[ci] - 4) / 1.85);
      const s = String(cell ?? '—');
      const disp = s.length > maxChars ? s.slice(0, maxChars - 1) + '…' : s;
      setFont(7, 'normal', CLR.gray1);
      text(disp, x + 2, _y + 5.6);
      x += ws[ci];
    });
    _y += ROW_H;
  });
  _y += 4;
}

// ─── Status badge ──────────────────────────────────────────────────────────────
function statusBadge(status, x, y) {
  const s = (status || '').toUpperCase();
  let bg, label;
  if (['VERIFIED', 'PASS', 'MATCH'].includes(s))   { bg = CLR.green;  label = '✓ VERIFIED'; }
  else if (s === 'WARNING')                          { bg = CLR.amber;  label = '⚠ WARNING';  }
  else if (s.includes('HUMAN') || s === 'FAIL')     { bg = CLR.red;    label = '✗ REVIEW';   }
  else                                               { bg = CLR.gray3;  label = s || 'PENDING'; }
  const w = label.length * 1.6 + 6;
  fillRect(x, y - 3, w, 5.5, bg);
  setFont(5.5, 'bold', CLR.white);
  text(label, x + w / 2, y + 0.5, { align: 'center' });
  return x + w + 3;
}

// ─── Footer ────────────────────────────────────────────────────────────────────
function drawFooter(filename) {
  rule(PH - 14, CLR.gray4, 0.3);
  setFont(6, 'normal', CLR.gray3);
  text(`LegalSafe-G  |  ${String(filename || 'document').slice(0, 40)}`, ML, PH - 10);
  text(`Page ${_page}`, PW - MR, PH - 10, { align: 'right' });
  text('CONFIDENTIAL — For informational purposes only', PW / 2, PH - 10, { align: 'center' });
}

// ─── Data helpers ──────────────────────────────────────────────────────────────
function docTypeName(fn) {
  const f = (fn || '').toLowerCase();
  if (f.includes('nda') || f.includes('non_discl') || f.includes('confidential')) return 'Non-Disclosure Agreement (NDA)';
  if (f.includes('employ'))  return 'Employment Agreement';
  if (f.includes('lease') || f.includes('rent'))  return 'Lease / Rental Agreement';
  if (f.includes('purchase') || f.includes('sale')) return 'Purchase / Sale Agreement';
  if (f.includes('service')) return 'Service Agreement';
  if (f.includes('partner')) return 'Partnership Agreement';
  if (f.includes('loan'))    return 'Loan Agreement';
  return 'Legal Agreement';
}

function aggField(facts, field) {
  const s = new Set();
  facts.forEach(f => {
    const v = f[field];
    if (!v) return;
    Array.isArray(v) ? v.forEach(x => x && s.add(String(x))) : s.add(String(v));
  });
  return [...s].filter(Boolean);
}

function aggParties(facts) {
  const s = new Set();
  facts.forEach(f => {
    if (f.subject)   s.add(String(f.subject));
    (f.parties       || []).forEach(p => p && s.add(String(p)));
    (f.organizations || []).forEach(o => o && s.add(String(o)));
  });
  return [...s].filter(Boolean).slice(0, 8);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════
export async function downloadResultPDF(result) {
  newDoc();

  const clauses     = result?.clauses || [];
  const allFacts    = clauses.map(c => c.original_facts || {});
  const fn          = result?.filename || 'document.pdf';
  const docType     = docTypeName(fn);
  const now         = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
  const nowFull     = new Date().toLocaleString('en-IN');
  const vscore      = result?.verification_summary?.average_score ?? 0;
  const passed      = result?.verification_summary?.passed ?? 0;
  const failed      = result?.verification_summary?.failed ?? 0;
  const glossary    = result?.glossary || [];
  const safeFn      = fn.replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]/gi, '_').slice(0, 30);

  // ════════════════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ════════════════════════════════════════════════════════════
  await yld();

  // Dark cover background
  fillRect(0, 0, PW, PH, CLR.coverBg);

  // Top accent strip
  fillRect(0, 0, PW, 3, CLR.coverAc);

  // Logo / title area
  setFont(22, 'bold', CLR.white);
  text('LegalSafe-G', PW / 2, 55, { align: 'center' });

  setFont(9, 'normal', [160, 170, 210]);
  text('Automated Legal Document Simplification & Verification', PW / 2, 64, { align: 'center' });

  // Horizontal divider
  _doc.setDrawColor(...CLR.coverAc);
  _doc.setLineWidth(0.5);
  _doc.line(ML + 20, 70, PW - MR - 20, 70);

  // Report label
  setFont(12, 'bold', [199, 210, 254]);
  text('LEGAL DOCUMENT ANALYSIS REPORT', PW / 2, 82, { align: 'center' });

  // Document name box
  fillRect(ML + 10, 90, TW - 20, 22, [25, 35, 70]);
  setFont(7, 'normal', [160, 170, 210]);
  text('DOCUMENT', PW / 2, 98, { align: 'center' });
  setFont(10, 'bold', CLR.white);
  text(fn.slice(0, 45), PW / 2, 106, { align: 'center' });

  // Info grid
  const infoY = 122;
  const infos = [
    ['Document Type', docType],
    ['Clauses Analysed', String(clauses.length)],
    ['Analysis Date', now],
    ['Verification Score', `${(vscore * 100).toFixed(1)}%`],
  ];
  const iw = (TW - 10) / 2;
  infos.forEach(([lbl, val], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const bx = ML + col * (iw + 10), by = infoY + row * 22;
    fillRect(bx, by, iw, 18, [25, 35, 70]);
    setFont(6, 'normal', [130, 140, 180]);
    text(lbl.toUpperCase(), bx + iw / 2, by + 6, { align: 'center' });
    setFont(9, 'bold', CLR.white);
    text(String(val), bx + iw / 2, by + 13, { align: 'center' });
  });

  // Verdict banner
  const verdictY = 178;
  const allOk = passed === clauses.length && clauses.length > 0;
  const verdictC = allOk ? [22, 101, 52] : failed > 0 ? [127, 29, 29] : [92, 64, 12];
  const verdictT = allOk ? '✓  ALL CLAUSES VERIFIED' : failed > 0 ? '⚠  HUMAN REVIEW REQUIRED' : '~  MOSTLY VERIFIED';
  fillRect(ML + 10, verdictY, TW - 20, 14, verdictC);
  setFont(9, 'bold', CLR.white);
  text(verdictT, PW / 2, verdictY + 9, { align: 'center' });

  // Bottom disclaimer
  fillRect(0, PH - 35, PW, 35, [10, 15, 35]);
  setFont(6.5, 'bold', [160, 170, 210]);
  text('DISCLAIMER', PW / 2, PH - 27, { align: 'center' });
  setFont(6, 'normal', [120, 130, 170]);
  const discText = 'This report is generated for educational and informational purposes only. It does not constitute legal advice and does not replace the original document or advice from a qualified legal professional.';
  const dLines = _doc.splitTextToSize(discText, TW - 20);
  _doc.text(dLines, PW / 2, PH - 22, { align: 'center' });

  // Bottom accent
  fillRect(0, PH - 3, PW, 3, CLR.coverAc);

  drawFooter(fn);

  // ════════════════════════════════════════════════════════════
  // PAGE 2 — TABLE OF CONTENTS
  // ════════════════════════════════════════════════════════════
  await yld();
  addPage();

  setFont(18, 'bold', CLR.accent);
  text('TABLE OF CONTENTS', ML, _y);
  rule(_y + 4, CLR.accent, 0.6);
  _y += 12;

  const tocItems = [
    ['1.', 'Document Overview', '3'],
    ['2.', 'Full Simplified Document', '4'],
    ['3.', 'Clause-by-Clause Analysis', '5'],
    ['4.', 'Legal Facts & Entities', '—'],
    ['5.', 'Legal Obligations & Rights', '—'],
    ['6.', 'Verification Report', '—'],
    ['7.', 'Mismatch & Attention Points', '—'],
    ['8.', 'Glossary of Legal Terms', '—'],
    ['9.', 'Disclaimer & Notes', '—'],
  ];

  tocItems.forEach(([num, title, pg], i) => {
    need(10);
    if (i % 2 === 0) fillRect(ML, _y - 1, TW, 9, CLR.gray5);
    setFont(8, 'bold', CLR.accent);
    text(num, ML + 2, _y + 5.5);
    setFont(9, 'normal', CLR.gray1);
    text(title, ML + 12, _y + 5.5);
    // Dot leaders
    setFont(8, 'normal', CLR.gray3);
    const dotEnd = PW - MR - 12;
    for (let dx = ML + 12 + title.length * 1.8 + 4; dx < dotEnd; dx += 3) {
      text('.', dx, _y + 5.5);
    }
    setFont(8, 'bold', CLR.accent);
    text(pg, PW - MR, _y + 5.5, { align: 'right' });
    _y += 10;
  });

  _y += 8;
  fillRect(ML, _y, TW, 18, CLR.gray5);
  strokeRect(ML, _y, TW, 18, CLR.gray4);
  setFont(8, 'bold', CLR.gray2);
  text('SUMMARY', ML + 4, _y + 6);
  const sumItems = [
    `Document: ${fn.slice(0, 40)}`,
    `Type: ${docType}`,
    `Clauses: ${clauses.length}   Passed: ${passed}   Failed: ${failed}   Score: ${(vscore*100).toFixed(1)}%`,
  ];
  setFont(7, 'normal', CLR.gray2);
  sumItems.forEach((s, i) => text(s, ML + 4, _y + 11 + i * 4));
  _y += 24;

  drawFooter(fn);

  // ════════════════════════════════════════════════════════════
  // SECTION 1 — DOCUMENT OVERVIEW
  // ════════════════════════════════════════════════════════════
  await yld();
  addPage();

  secTitle('1', 'Document Overview');

  const ovData = [
    ['Document Type',        docType],
    ['File Name',            fn],
    ['Total Clauses',        String(clauses.length)],
    ['Verification Mode',    result?.mode || 'constrained'],
    ['Avg. Verification Score', `${(vscore * 100).toFixed(1)}%`],
    ['Clauses Passed',       String(passed)],
    ['Clauses Failed / Review', String(failed)],
    ['Parties Identified',   aggParties(allFacts).join(', ') || '—'],
    ['Dates Detected',       aggField(allFacts, 'dates').slice(0, 3).join(', ') || '—'],
    ['Amounts Detected',     aggField(allFacts, 'amounts').slice(0, 3).join(', ') || '—'],
    ['Generated On',         nowFull],
    ['AI Model',             'FLAN-T5-Small (Google)'],
    ['NLP Engine',           'spaCy en_core_web_sm'],
  ];

  table(['Field', 'Detail'], ovData, [55, 120]);

  drawFooter(fn);

  // ════════════════════════════════════════════════════════════
  // SECTION 2 — FULL SIMPLIFIED DOCUMENT
  // ════════════════════════════════════════════════════════════
  await yld();
  addPage();

  secTitle('2', 'Full Simplified Document');

  setFont(7, 'italic', CLR.gray3);
  text('The following is the AI-generated plain-language version of the entire document, combining all clauses.', ML, _y);
  _y += 8;
  rule(_y, CLR.gray4);
  _y += 4;

  for (const cl of clauses) {
    await yld();
    need(20);

    // Clause label
    fillRect(ML, _y, TW, 7, CLR.gray5);
    setFont(7.5, 'bold', CLR.accent);
    text(`Clause ${cl.clause_id || ''}`, ML + 2, _y + 5);
    statusBadge(cl.final_status, ML + TW - 40, _y + 1);
    _y += 9;

    const simpText = (cl.simplified_text_final || cl.simplified_text_constrained || cl.original_text || '').trim();
    _y = para(simpText.slice(0, 500), ML, _y, TW, 8, 'normal', CLR.gray1, 5);
    _y += 3;
    rule(_y, CLR.gray4, 0.2);
    _y += 4;
  }

  drawFooter(fn);

  // ════════════════════════════════════════════════════════════
  // SECTION 3 — CLAUSE-BY-CLAUSE ANALYSIS
  // ════════════════════════════════════════════════════════════
  await yld();
  addPage();
  secTitle('3', 'Clause-by-Clause Analysis');

  for (const cl of clauses) {
    await yld();
    need(60);

    // Clause header bar
    fillRect(ML, _y, TW, 9, CLR.accent);
    setFont(8, 'bold', CLR.white);
    text(`CLAUSE ${cl.clause_id || ''}`, ML + 3, _y + 6.3);
    const sc = (cl.verification?.score ?? 0) * 100;
    setFont(7, 'normal', CLR.white);
    text(`Score: ${sc.toFixed(0)}%`, PW - MR - 3, _y + 6.3, { align: 'right' });
    _y += 10;

    // Two column: Original | Simplified
    const colW = (TW - 4) / 2;

    // Column headers
    fillRect(ML, _y, colW, 6.5, [240, 240, 250]);
    fillRect(ML + colW + 4, _y, colW, 6.5, [235, 250, 240]);
    setFont(6.5, 'bold', CLR.accent);
    text('ORIGINAL TEXT', ML + 2, _y + 4.5);
    setFont(6.5, 'bold', CLR.green);
    text('SIMPLIFIED (AI)', ML + colW + 6, _y + 4.5);
    _y += 8;

    const orig  = (cl.original_text || '').slice(0, 350);
    const simp  = (cl.simplified_text_final || cl.simplified_text_constrained || '').slice(0, 350);
    const oLines = _doc.splitTextToSize(orig, colW - 4);
    const sLines = _doc.splitTextToSize(simp, colW - 4);
    const blockH = Math.max(oLines.length, sLines.length) * 4.5 + 5;

    need(blockH + 4);
    strokeRect(ML, _y, colW, blockH, CLR.gray4, 0.2);
    strokeRect(ML + colW + 4, _y, colW, blockH, CLR.green, 0.2);
    setFont(6.5, 'normal', CLR.gray2);
    _doc.text(oLines, ML + 2, _y + 4.5);
    setFont(6.5, 'normal', CLR.gray1);
    _doc.text(sLines, ML + colW + 6, _y + 4.5);
    _y += blockH + 3;

    // Score bar
    need(8);
    setFont(6, 'normal', CLR.gray3);
    text('Fact Preservation Score:', ML, _y + 4);
    fillRect(ML + 42, _y, TW - 42, 5, CLR.gray5);
    fillRect(ML + 42, _y, (TW - 42) * Math.min(sc, 100) / 100, 5, sc >= 70 ? CLR.green : sc >= 40 ? CLR.amber : CLR.red);
    setFont(6, 'bold', CLR.gray1);
    text(`${sc.toFixed(0)}%`, PW - MR - 2, _y + 4, { align: 'right' });
    _y += 9;

    // Extracted facts
    const f = cl.original_facts || {};
    const factRows = [
      ['Subject / Party', f.subject || (f.parties || []).join(', ')],
      ['Action', f.action],
      ['Object', f.obj || f.object],
      ['Modality', f.modality],
      ['Amount', f.amount],
      ['Deadline', f.deadline],
      ['Condition', f.condition],
      ['Exception', f.exception],
      ['Penalty', f.penalty],
    ].filter(r => r[1]);

    if (factRows.length) {
      need(factRows.length * 7 + 12);
      subTitle('Extracted Legal Facts');
      table(['Fact Type', 'Value'], factRows, [40, 135]);
    }

    // Difficult terms
    if (cl.difficult_terms?.length) {
      need(cl.difficult_terms.length * 7 + 12);
      subTitle('Legal Terms in This Clause');
      const termRows = cl.difficult_terms.slice(0, 6).map(t =>
        [t.term || t, t.explanation || '—']
      );
      table(['Term', 'Plain-Language Explanation'], termRows, [40, 135]);
    }

    rule(_y, CLR.gray4, 0.3);
    _y += 6;
  }

  drawFooter(fn);

  // ════════════════════════════════════════════════════════════
  // SECTION 4 — LEGAL FACTS & ENTITIES
  // ════════════════════════════════════════════════════════════
  await yld();
  addPage();
  secTitle('4', 'Legal Facts & Entities');

  const factCategories = [
    { lbl: 'Parties & Organisations', vals: aggParties(allFacts) },
    { lbl: 'Legal Obligations',       vals: aggField(allFacts, 'obligations').slice(0, 8) },
    { lbl: 'Rights & Permissions',    vals: aggField(allFacts, 'rights').slice(0, 6) },
    { lbl: 'Prohibitions',            vals: aggField(allFacts, 'prohibitions').slice(0, 6) },
    { lbl: 'Dates & Deadlines',       vals: aggField(allFacts, 'dates').slice(0, 6) },
    { lbl: 'Amounts & Figures',       vals: aggField(allFacts, 'amounts').slice(0, 6) },
    { lbl: 'Locations',               vals: aggField(allFacts, 'locations').slice(0, 6) },
    { lbl: 'Penalties & Consequences',vals: aggField(allFacts, 'penalties').slice(0, 6) },
    { lbl: 'Exceptions',              vals: aggField(allFacts, 'exceptions').slice(0, 6) },
  ];

  factCategories.forEach(({ lbl, vals }) => {
    if (!vals.length) return;
    need(12 + vals.length * 6);
    subTitle(lbl);
    vals.forEach((v, i) => {
      need(7);
      if (i % 2 === 0) fillRect(ML, _y - 1, TW, 6.5, CLR.gray5);
      setFont(6.5, 'normal', CLR.gray1);
      text(`•  ${String(v).slice(0, 120)}`, ML + 3, _y + 4);
      _y += 6.5;
    });
    _y += 3;
  });

  drawFooter(fn);

  // ════════════════════════════════════════════════════════════
  // SECTION 5 — OBLIGATIONS & RIGHTS
  // ════════════════════════════════════════════════════════════
  await yld();
  addPage();
  secTitle('5', 'Legal Obligations & Rights');

  subTitle('Obligations (Must / Shall)');
  const oblRows = [];
  clauses.forEach(cl => {
    (cl.original_facts?.obligations || []).forEach(ob => {
      if (ob) oblRows.push([`Clause ${cl.clause_id}`, String(ob).slice(0, 110)]);
    });
  });
  if (oblRows.length) {
    table(['Clause', 'Obligation'], oblRows, [25, 150]);
  } else {
    setFont(7.5, 'italic', CLR.gray3);
    text('No specific obligations extracted.', ML, _y); _y += 8;
  }

  _y += 4;
  subTitle('Rights & Permissions');
  const rightRows = [];
  clauses.forEach(cl => {
    (cl.original_facts?.rights || []).forEach(r => {
      if (r) rightRows.push([`Clause ${cl.clause_id}`, String(r).slice(0, 110)]);
    });
    (cl.original_facts?.permissions || []).forEach(p => {
      if (p) rightRows.push([`Clause ${cl.clause_id}`, String(p).slice(0, 110)]);
    });
  });
  if (rightRows.length) {
    table(['Clause', 'Right / Permission'], rightRows, [25, 150]);
  } else {
    setFont(7.5, 'italic', CLR.gray3);
    text('No specific rights extracted.', ML, _y); _y += 8;
  }

  drawFooter(fn);

  // ════════════════════════════════════════════════════════════
  // SECTION 6 — VERIFICATION REPORT
  // ════════════════════════════════════════════════════════════
  await yld();
  addPage();
  secTitle('6', 'Verification Report');

  // Summary box
  const sumBg = allOk ? [235, 252, 240] : failed > 0 ? [254, 236, 236] : [255, 251, 235];
  const sumBd = allOk ? CLR.green : failed > 0 ? CLR.red : CLR.amber;
  fillRect(ML, _y, TW, 20, sumBg);
  strokeRect(ML, _y, TW, 20, sumBd, 0.4);
  fillRect(ML, _y, 4, 20, sumBd);
  setFont(10, 'bold', sumBd);
  text(allOk ? '✓ All Clauses Verified' : failed > 0 ? '⚠ Human Review Required on Some Clauses' : '~ Mostly Verified', ML + 8, _y + 8);
  setFont(7.5, 'normal', CLR.gray2);
  text(`${passed} of ${clauses.length} clauses passed  •  Average score: ${(vscore * 100).toFixed(1)}%  •  ${failed} requiring review`, ML + 8, _y + 15);
  _y += 26;

  subTitle('Clause-Level Verification Summary');
  const verRows = clauses.map(cl => [
    `Clause ${cl.clause_id}`,
    cl.verification?.graph_comparison_status || '—',
    `${((cl.verification?.score ?? 0) * 100).toFixed(0)}%`,
    cl.final_status || '—',
    String(cl.verification?.mismatches?.length || 0),
  ]);
  table(
    ['Clause', 'Graph Status', 'Score', 'Final Status', 'Mismatches'],
    verRows,
    [25, 40, 20, 45, 25]
  );

  drawFooter(fn);

  // ════════════════════════════════════════════════════════════
  // SECTION 7 — MISMATCHES & ATTENTION POINTS
  // ════════════════════════════════════════════════════════════
  await yld();
  addPage();
  secTitle('7', 'Mismatch & Attention Points');

  const allMM = clauses.flatMap(cl =>
    (cl.verification?.mismatches || []).map(m => ({ ...m, clause: cl.clause_id }))
  );

  if (allMM.length) {
    subTitle('Detected Mismatches');
    allMM.slice(0, 20).forEach((mm, i) => {
      need(16);
      fillRect(ML, _y, TW, 13, i % 2 === 0 ? [255, 245, 245] : [255, 240, 240]);
      strokeRect(ML, _y, TW, 13, CLR.red, 0.2);
      fillRect(ML, _y, 3, 13, CLR.red);
      setFont(7, 'bold', CLR.red);
      text(`Clause ${mm.clause}  —  ${mm.type || 'MISMATCH'}`, ML + 5, _y + 5);
      setFont(6.5, 'normal', CLR.gray2);
      text(`Original: ${String(mm.original || '').slice(0, 90)}`, ML + 5, _y + 10);
      setFont(6.5, 'normal', CLR.amber);
      text(`Generated: ${String(mm.generated || '').slice(0, 90)}`, ML + TW / 2, _y + 10);
      _y += 15;
    });
  } else {
    fillRect(ML, _y, TW, 12, [235, 252, 240]);
    strokeRect(ML, _y, TW, 12, CLR.green, 0.3);
    setFont(8, 'bold', CLR.green);
    text('✓  No mismatches detected. All legal facts are preserved in the simplified text.', ML + 5, _y + 8);
    _y += 16;
  }

  _y += 4;
  subTitle('Attention Points');
  const attnRows = clauses.flatMap(cl => {
    const out = [];
    if (cl.final_status?.includes('HUMAN')) out.push([`Clause ${cl.clause_id}`, 'CRITICAL', 'Human review required — facts not fully preserved']);
    else if (cl.final_status === 'WARNING') out.push([`Clause ${cl.clause_id}`, 'WARNING', 'Some facts may not be fully preserved']);
    (cl.original_facts?.obligations || []).slice(0, 1).forEach(ob => {
      out.push([`Clause ${cl.clause_id}`, 'OBLIGATION', String(ob).slice(0, 80)]);
    });
    (cl.original_facts?.penalties || []).slice(0, 1).forEach(pe => {
      out.push([`Clause ${cl.clause_id}`, 'PENALTY', String(pe).slice(0, 80)]);
    });
    return out;
  });
  if (attnRows.length) {
    table(['Clause', 'Level', 'Note'], attnRows.slice(0, 20), [22, 25, 128]);
  }

  drawFooter(fn);

  // ════════════════════════════════════════════════════════════
  // SECTION 8 — GLOSSARY
  // ════════════════════════════════════════════════════════════
  await yld();
  addPage();
  secTitle('8', 'Glossary of Legal Terms');

  setFont(7, 'italic', CLR.gray3);
  text('Plain-language explanations of legal terms identified in this document.', ML, _y);
  _y += 8;

  // Collect all difficult terms
  const termMap = new Map();
  clauses.forEach(cl => {
    (cl.difficult_terms || []).forEach(t => {
      const term = t.term || String(t);
      if (term && !termMap.has(term.toLowerCase())) {
        termMap.set(term.toLowerCase(), { term, explanation: t.explanation || '—' });
      }
    });
  });
  // Also use glossary from result
  (glossary || []).forEach(g => {
    if (g.term && !termMap.has(g.term.toLowerCase())) {
      termMap.set(g.term.toLowerCase(), { term: g.term, explanation: g.explanation || '—' });
    }
  });

  const terms = [...termMap.values()].slice(0, 40);
  if (terms.length) {
    table(
      ['Legal Term', 'Plain-Language Explanation'],
      terms.map(t => [t.term, t.explanation]),
      [45, 130]
    );
  } else {
    setFont(7.5, 'italic', CLR.gray3);
    text('No specific legal terms identified for this document.', ML, _y);
    _y += 8;
  }

  drawFooter(fn);

  // ════════════════════════════════════════════════════════════
  // SECTION 9 — DISCLAIMER & NOTES
  // ════════════════════════════════════════════════════════════
  await yld();
  addPage();
  secTitle('9', 'Disclaimer & Notes');

  const sections9 = [
    {
      title: 'Important Disclaimer',
      body: 'This report is generated automatically by the LegalSafe-G AI system for educational and informational purposes only. It does not constitute legal advice. The simplified text is an AI-generated approximation and may not capture all nuances of the original legal language. Always consult a qualified legal professional before making any decision based on this document.',
      color: CLR.red,
    },
    {
      title: 'Accuracy Notice',
      body: 'While LegalSafe-G uses advanced NLP and transformer models to simplify legal text, AI simplification is imperfect. Clauses marked "Warning" or "Human Review Required" indicate areas where the AI could not fully verify fact preservation. These sections should be reviewed by a legal expert.',
      color: CLR.amber,
    },
    {
      title: 'Original Document',
      body: `The original document ("${fn}") remains the authoritative legal record. This report is a supplementary aid only. All rights, obligations, penalties, and conditions described herein are derived from the original document and should be verified against it.`,
      color: CLR.accent,
    },
    {
      title: 'AI Processing Pipeline',
      body: 'This document was processed using: (1) PyMuPDF text extraction, (2) spaCy NLP preprocessing, (3) Legal clause segmentation, (4) Named entity & fact extraction, (5) NetworkX legal fact graph, (6) FLAN-T5-Small constraint-guided simplification, (7) Graph-comparison verification.',
      color: CLR.green,
    },
    {
      title: 'Data Privacy',
      body: 'Document processing is performed locally on your system. No document content is transmitted to external servers unless explicitly configured. The LegalSafe-G system stores processed results in a local SQLite database for session use only.',
      color: CLR.accent2,
    },
  ];

  sections9.forEach(({ title, body, color }) => {
    need(30);
    fillRect(ML, _y, TW, 8, [245, 245, 255]);
    fillRect(ML, _y, 4, 8, color);
    strokeRect(ML, _y, TW, 8, CLR.gray4, 0.2);
    setFont(8, 'bold', color);
    text(title, ML + 7, _y + 5.5);
    _y += 10;
    _y = para(body, ML, _y, TW, 7.5, 'normal', CLR.gray2, 5);
    _y += 5;
  });

  // Final box
  need(20);
  fillRect(ML, _y, TW, 18, CLR.gray5);
  strokeRect(ML, _y, TW, 18, CLR.accent, 0.3);
  setFont(7, 'bold', CLR.accent);
  text('Report Details', ML + 4, _y + 6);
  setFont(6.5, 'normal', CLR.gray2);
  text(`Generated: ${nowFull}   |   Document: ${fn}   |   Engine: LegalSafe-G v1.0`, ML + 4, _y + 11);
  text(`Clauses: ${clauses.length}   |   Passed: ${passed}   |   Score: ${(vscore * 100).toFixed(1)}%   |   Model: FLAN-T5-Small`, ML + 4, _y + 16);
  _y += 22;

  drawFooter(fn);

  // ════════════════════════════════════════════════════════════
  // SAVE
  // ════════════════════════════════════════════════════════════
  await yld();
  _doc.save(`LegalSafe-G_${safeFn}_Report.pdf`);
}
