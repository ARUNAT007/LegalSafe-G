"""
Simplification routes — orchestrates the full LegalSafe-G research pipeline.

Pipeline (with new Step 7.5 — Simplification Quality Check):

USER
 │
 ▼
Upload Legal Document (PDF / DOCX / TXT)
 │
 ▼
Step 1: Document Processing
         ├── Text Extraction
         └── OCR (if scanned)
 │
 ▼
Step 2: Text Preprocessing
         • Remove noise
         • Normalize text
         • Preserve legal terms
 │
 ▼
Step 3: Legal Clause Segmentation
         Document → Sections → Clauses
 │
 ▼
Step 4: Legal Information Extraction (per clause)
         ├── Entities
         ├── Actions
         └── Conditions
 │
 ▼
Step 5: Legal Fact Graph
         ├── Legal Entities (nodes)
         └── Relationships (edges)
 │
 ▼
Step 6: Legal Constraints
         • Rights            • Obligations
         • Dates             • Amounts
         • Conditions        • Prohibitions
         • Penalties         • Consequences
 │
 ▼
Step 7: Constraint-Guided Transformer (FLAN-T5 / T5)
 │
 ▼
Candidate Simplified Text
 │
 ▼
Step 7.5: SIMPLIFICATION QUALITY CHECK  ← NEW
          ├── Copy / Insufficient Simplification Detection
          ├── Over-Compression / Omission Detection
          ├── Modality Flip Detection
          └── Quality Score
          │
          ├── PASS → Continue to Step 8
          └── FAIL → Skip to Targeted Regeneration (Step 10)
 │
 ▼
Step 8: Generate–Verify Stage
         Re-extract legal facts from simplified text
         → Generated Legal Fact Graph
 │
 ▼
Step 9: Graph Comparison
         Original Graph VS Generated Graph
         │
         ├── MATCH   → Accept → Step 11 (Final Output)
         │
         └── MISMATCH → Step 10: Identify Error
                              │
                              ▼
                         Targeted Regeneration (max retries)
                              │
                              ▼
                         Verify Again (Quality + Graph)
                              │
                         (loops back to Comparison)
                              │
                         Final Verification
                              │
                              ▼
Step 11: Citizen-Friendly Output
         ├── Simplified Legal Text
         ├── Important Legal Facts
         ├── Easy-Term Explanations
         └── Quality & Verification Breakdown
"""

import json
import logging
import uuid
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app

from database import get_db
from services.document_service import DocumentService
from services.preprocessing_service import PreprocessingService
from services.clause_service import ClauseService
from services.extraction_service import ExtractionService
from services.graph_service import GraphService
from services.constraint_service import ConstraintService
from services.transformer_service import TransformerService
from services.verification_service import VerificationService
from services.explanation_service import ExplanationService
from services.quality_service import SimplificationQualityService

logger = logging.getLogger(__name__)
simplify_bp = Blueprint('simplify', __name__)

# ── Lazy-init shared service singletons ─────────────────────────────────────
_doc_svc      = DocumentService()
_pre_svc      = PreprocessingService()
_clause_svc   = ClauseService()
_extract_svc  = ExtractionService()
_graph_svc    = GraphService()
_constraint_svc = ConstraintService()
_verify_svc   = VerificationService()
_explain_svc  = ExplanationService()
_transformer_svc = None   # heavy — lazy init on first request
_quality_svc  = None      # lazy init


def _get_transformer() -> TransformerService:
    """Lazily load FLAN-T5 on first request to avoid slowing startup."""
    global _transformer_svc
    if _transformer_svc is None:
        model_name = current_app.config.get('MODEL_NAME', 'google/flan-t5-small')
        _transformer_svc = TransformerService(
            model_name=model_name,
            config=current_app.config,
        )
    return _transformer_svc


def _get_quality_svc() -> SimplificationQualityService:
    """Lazily create quality service with app config."""
    global _quality_svc
    if _quality_svc is None:
        _quality_svc = SimplificationQualityService(config=current_app.config)
    return _quality_svc


# ─────────────────────────────────────────────────────────────────────────────
# STEP 9 HELPER: Graph Comparison
# Returns verification dict with MATCH / MISMATCH status
# ─────────────────────────────────────────────────────────────────────────────

def _graph_comparison(orig_graph, orig_fact, gen_graph, gen_fact) -> dict:
    """
    Step 9: Compare Original Graph vs Generated Graph.

    Returns:
        {status: 'MATCH'|'MISMATCH', score, mismatches, checks_performed, checks_passed}
    """
    result = _verify_svc.compare_graphs(
        orig_graph, orig_fact, gen_graph, gen_fact
    )
    # Map PASS/FAIL to MATCH/MISMATCH for clarity matching the flowchart
    result['graph_comparison_status'] = (
        'MATCH' if result['status'] == 'PASS' else 'MISMATCH'
    )
    return result


# ─────────────────────────────────────────────────────────────────────────────
# STEP 10 HELPER: Targeted Regeneration Loop
# Now uses quality check + graph comparison on each retry
# ─────────────────────────────────────────────────────────────────────────────

def _targeted_regeneration_loop(
    original_clause: dict,
    orig_fact,
    orig_graph,
    constraints: list,
    initial_mismatches: list,
    quality_reason: str = '',
) -> dict:
    """
    Step 10: Identify Error → Targeted Regeneration → Verify Again → loop.

    This loop:
      1. Builds a mismatch-specific regeneration prompt
      2. Calls FLAN-T5 to regenerate the clause
      3. Runs Quality Check     (Step 7.5 repeat)
      4. Re-extracts legal facts  (Step 8 repeat)
      5. Rebuilds generated graph (Step 8 repeat)
      6. Runs Graph Comparison    (Step 9 repeat)
      7. If quality PASS AND graph MATCH → accept, break
      8. If FAIL → loop back (up to MAX_RETRIES)
      9. If exhausted → HUMAN_REVIEW_REQUIRED (NEVER VERIFIED)

    Returns:
        {
            status:              'SUCCESS' | 'HUMAN_REVIEW_REQUIRED',
            simplified_text:     best text produced,
            attempts:            number of attempts,
            final_verification:  last verification dict,
            final_quality:       last quality dict,
            mismatches:          remaining mismatches (empty on SUCCESS),
        }
    """
    transformer = _get_transformer()
    quality_svc = _get_quality_svc()
    clause_id   = original_clause['clause_id']
    clause_text = original_clause['text']

    max_retries = current_app.config.get('MAX_REGENERATION_RETRIES', 3)

    # Track best result across retries
    best_text         = clause_text
    best_score        = 0.0
    best_verification = {}
    best_quality      = {}
    current_mismatches = initial_mismatches
    current_quality_reason = quality_reason

    for attempt in range(1, max_retries + 1):
        logger.info(
            f"[{clause_id}] REGENERATION attempt {attempt}/{max_retries}"
        )

        # ── Build mismatch-aware reason ──────────────────────────────────────
        regen_reason = _build_mismatch_reason(
            current_mismatches, current_quality_reason
        )

        # ── Generate with targeted prompt ────────────────────────────────────
        try:
            new_text = transformer.simplify_targeted_regen(
                clause_text=clause_text,
                constraints=constraints,
                mismatch_reason=regen_reason,
                attempt=attempt,
            )
        except Exception as exc:
            logger.error(
                f"[{clause_id}] Generation error on attempt {attempt}: {exc}"
            )
            continue

        # ── Step 7.5 (repeat): Quality Check ─────────────────────────────────
        new_fact  = _extract_svc.extract(clause_id, new_text)
        new_graph = _graph_svc.build_graph([new_fact])

        q_result = quality_svc.check_quality(
            original_text=clause_text,
            simplified_text=new_text,
            orig_fact=orig_fact,
            gen_fact=new_fact,
            orig_graph=orig_graph,
            gen_graph=new_graph,
            clause_id=clause_id,
        )

        # ── Step 9 (repeat): Graph Comparison ────────────────────────────────
        verification = _graph_comparison(orig_graph, orig_fact, new_graph, new_fact)

        score = verification.get('score', 0.0)
        logger.info(
            f"[{clause_id}] Attempt {attempt}: "
            f"quality={q_result.overall_quality_status} "
            f"graph={verification.get('graph_comparison_status')} "
            f"score={score:.3f}"
        )

        # Track best result
        if score > best_score:
            best_score        = score
            best_text         = new_text
            best_verification = verification
            best_quality      = q_result.to_dict()

        # ── Accept only if BOTH pass ─────────────────────────────────────────
        quality_ok      = q_result.overall_quality_status == 'PASS'
        verification_ok = verification.get('graph_comparison_status') == 'MATCH'

        if quality_ok and verification_ok:
            logger.info(f"[{clause_id}] Regeneration SUCCESS on attempt {attempt}")
            return {
                'status':             'SUCCESS',
                'simplified_text':    new_text,
                'attempts':           attempt,
                'final_verification': verification,
                'final_quality':      q_result.to_dict(),
                'mismatches':         [],
            }

        # Update for next attempt
        current_mismatches = verification.get('mismatches', [])
        if q_result.overall_quality_status != 'PASS':
            current_quality_reason = q_result.reason

    # ── All retries exhausted — NEVER mark as VERIFIED ───────────────────────
    logger.warning(
        f"[{clause_id}] All {max_retries} regeneration attempts failed. "
        f"Best score: {best_score:.3f} → HUMAN_REVIEW_REQUIRED"
    )
    return {
        'status':             'HUMAN_REVIEW_REQUIRED',
        'simplified_text':    best_text,
        'attempts':           max_retries,
        'final_verification': best_verification,
        'final_quality':      best_quality,
        'mismatches':         current_mismatches,
    }


def _build_mismatch_reason(mismatches: list, quality_reason: str = '') -> str:
    """Build a specific, actionable failure description for the regen prompt."""
    reasons = []

    if quality_reason:
        reasons.append(quality_reason)

    for m in mismatches:
        mtype = m.get('type', 'UNKNOWN')
        orig  = m.get('original', 'N/A')
        gen   = m.get('generated', 'N/A')

        if 'AMOUNT' in mtype and ('OMIT' in mtype or gen in ('N/A', '', None)):
            reasons.append(
                f'The amount "{orig}" was OMITTED. '
                f'You MUST include the exact amount "{orig}".'
            )
        elif 'AMOUNT' in mtype:
            reasons.append(
                f'The amount was CHANGED from "{orig}" to "{gen}". '
                f'You MUST use the exact original amount "{orig}".'
            )
        elif 'DATE' in mtype and ('OMIT' in mtype or gen in ('N/A', '', None)):
            reasons.append(
                f'The deadline/date "{orig}" was OMITTED. '
                f'You MUST include it explicitly.'
            )
        elif 'MODALITY' in mtype:
            reasons.append(
                f'The legal obligation strength was CHANGED from '
                f'"{orig}" to "{gen}". Do NOT change this — '
                f'preserve the original obligation/prohibition.'
            )
        elif 'PENALTY' in mtype:
            reasons.append(
                f'The penalty "{orig}" was omitted or changed. '
                f'You MUST include the penalty "{orig}".'
            )
        elif 'CONDITION' in mtype:
            reasons.append(
                f'The condition "{orig}" was omitted or changed. '
                f'Preserve this condition.'
            )
        elif 'ENTITY' in mtype:
            reasons.append(
                f'The party/entity "{orig}" was changed to "{gen}". '
                f'Use the original name "{orig}".'
            )
        else:
            reasons.append(
                f'{mtype}: expected "{orig}", but got "{gen}".'
            )

    if not reasons:
        reasons.append(
            'General verification failure. Preserve ALL legal facts.'
        )

    return '\n'.join(reasons[:5])


# ─────────────────────────────────────────────────────────────────────────────
# PER-CLAUSE PIPELINE (Steps 4–11)
# ─────────────────────────────────────────────────────────────────────────────

def _process_clause(clause: dict, mode: str) -> dict:
    """
    Run Steps 4–11 of the pipeline for a single legal clause.

    Steps:
      4. Legal Information Extraction (Entities + Actions + Conditions)
      5. Legal Fact Graph
      6. Legal Constraints
      7. Constraint-Guided Transformer
     7.5. Simplification Quality Check  ← NEW
         ↓
      Simplified Legal Text
         ↓
      8. Generate–Verify Stage (re-extract + rebuild graph)
      9. Graph Comparison (MATCH → Step 11 | MISMATCH → Step 10)
     10. Targeted Regeneration (loop with Quality + Verify Again)
     11. Citizen-Friendly Output assembly
    """
    transformer = _get_transformer()
    quality_svc = _get_quality_svc()
    clause_id   = clause['clause_id']
    text        = clause['text']

    # ── Step 4: Legal Information Extraction ─────────────────────────────────
    logger.info(f"[{clause_id}] Step 4: Legal Information Extraction")
    orig_fact = _extract_svc.extract(clause_id, text)

    # ── Step 5: Legal Fact Graph ──────────────────────────────────────────────
    logger.info(f"[{clause_id}] Step 5: Legal Fact Graph")
    orig_graph = _graph_svc.build_graph([orig_fact])

    # ── Step 6: Legal Constraints ─────────────────────────────────────────────
    logger.info(f"[{clause_id}] Step 6: Legal Constraints")
    constraints = _constraint_svc.generate_constraints(orig_graph, [orig_fact])

    # ── Step 7: Constraint-Guided Transformer (FLAN-T5) ───────────────────────
    logger.info(f"[{clause_id}] Step 7: Constraint-Guided Simplification")
    baseline_text     = None
    constrained_text  = None

    if mode in ('baseline', 'both'):
        try:
            baseline_text = transformer.simplify_baseline(text)
        except Exception as exc:
            logger.warning(f"[{clause_id}] Baseline failed: {exc}")
            baseline_text = text

    if mode in ('constrained', 'both'):
        try:
            constrained_text = transformer.simplify_constrained(text, constraints)
        except Exception as exc:
            logger.warning(f"[{clause_id}] Constrained simplification failed: {exc}")
            constrained_text = text

    # Primary simplified text for verification
    simplified_text = constrained_text or baseline_text or text

    # ── Step 7.5: SIMPLIFICATION QUALITY CHECK ───────────────────────────────
    # This is the new step — checks copy detection, omission, modality flips
    # BEFORE running the full graph verification.
    logger.info(f"[{clause_id}] Step 7.5: Simplification Quality Check")

    gen_fact_quality  = _extract_svc.extract(clause_id, simplified_text)
    gen_graph_quality = _graph_svc.build_graph([gen_fact_quality])

    quality_result = quality_svc.check_quality(
        original_text=text,
        simplified_text=simplified_text,
        orig_fact=orig_fact,
        gen_fact=gen_fact_quality,
        orig_graph=orig_graph,
        gen_graph=gen_graph_quality,
        clause_id=clause_id,
    )

    quality_status = quality_result.overall_quality_status
    quality_reason = quality_result.reason
    regen_result   = None
    regeneration_attempts = 0

    if quality_status != 'PASS':
        # Quality check failed — trigger targeted regeneration immediately
        logger.info(
            f"[{clause_id}] Quality FAILED: {quality_status} — {quality_reason}"
        )
        logger.info(f"[{clause_id}] Step 10: Targeted Regeneration (quality failure)")

        if mode in ('constrained', 'both'):
            regen_result = _targeted_regeneration_loop(
                original_clause    = clause,
                orig_fact          = orig_fact,
                orig_graph         = orig_graph,
                constraints        = constraints,
                initial_mismatches = [],
                quality_reason     = quality_reason,
            )

            if regen_result['status'] == 'SUCCESS':
                simplified_text = regen_result['simplified_text']
                regeneration_attempts = regen_result.get('attempts', 0)
                # Continue to Steps 8–9 for final graph verification
            else:
                simplified_text = regen_result['simplified_text']
                regeneration_attempts = regen_result.get('attempts', 0)
                # Still continue — we'll re-verify below and mark appropriately
        else:
            # Baseline mode — no regeneration available
            pass

    # ── Step 8: Generate–Verify Stage ────────────────────────────────────────
    logger.info(f"[{clause_id}] Step 8: Re-extract facts from simplified text")
    gen_fact  = _extract_svc.extract(clause_id, simplified_text)
    gen_graph = _graph_svc.build_graph([gen_fact])

    # ── Step 9: Graph Comparison ──────────────────────────────────────────────
    logger.info(f"[{clause_id}] Step 9: Graph Comparison")
    verification = _graph_comparison(orig_graph, orig_fact, gen_graph, gen_fact)

    # Final quality result for the current simplified text
    final_quality = quality_svc.check_quality(
        original_text=text,
        simplified_text=simplified_text,
        orig_fact=orig_fact,
        gen_fact=gen_fact,
        orig_graph=orig_graph,
        gen_graph=gen_graph,
        clause_id=clause_id,
    )

    if verification['graph_comparison_status'] == 'MATCH' and final_quality.overall_quality_status == 'PASS':
        # ── MATCH + Quality PASS → Accept → proceed to Step 11 ───────────────
        if regen_result and regen_result['status'] == 'SUCCESS':
            final_status = 'REGENERATED_AND_VERIFIED'
        else:
            final_status = 'VERIFIED'
        logger.info(f"[{clause_id}] Graph Comparison: MATCH ✓ + Quality PASS ✓ → {final_status}")

    elif verification['graph_comparison_status'] == 'MATCH' and final_quality.overall_quality_status != 'PASS':
        # Graph matches but quality check flags an issue (e.g. copied text)
        # If it's just INSUFFICIENT_SIMPLIFICATION with graph MATCH, it's borderline OK
        if final_quality.overall_quality_status == 'INSUFFICIENT_SIMPLIFICATION':
            final_status = 'WARNING'
            logger.info(
                f"[{clause_id}] Graph MATCH but quality={final_quality.overall_quality_status} → WARNING"
            )
        else:
            final_status = 'REQUIRES_REVIEW'
            logger.info(
                f"[{clause_id}] Graph MATCH but quality={final_quality.overall_quality_status} → REQUIRES_REVIEW"
            )

    else:
        # ── MISMATCH → Need regeneration (if not already done) ───────────────
        score = verification.get('score', 0)
        logger.info(
            f"[{clause_id}] Graph Comparison: MISMATCH "
            f"(score={score:.3f}, "
            f"mismatches={len(verification.get('mismatches', []))})"
        )

        if regen_result is not None:
            # Already regenerated — use the result
            if regen_result['status'] == 'SUCCESS':
                final_status = 'REGENERATED_AND_VERIFIED'
            else:
                final_status = 'HUMAN_REVIEW_REQUIRED'

        elif mode in ('constrained', 'both'):
            # ── Step 10: Targeted Regeneration ───────────────────────────────
            logger.info(f"[{clause_id}] Step 10: Targeted Regeneration (graph mismatch)")
            regen_result = _targeted_regeneration_loop(
                original_clause    = clause,
                orig_fact          = orig_fact,
                orig_graph         = orig_graph,
                constraints        = constraints,
                initial_mismatches = verification['mismatches'],
                quality_reason     = '',
            )
            regeneration_attempts = regen_result.get('attempts', 0)

            if regen_result['status'] == 'SUCCESS':
                simplified_text = regen_result['simplified_text']
                verification    = regen_result['final_verification']
                final_status    = 'REGENERATED_AND_VERIFIED'
            else:
                simplified_text = regen_result['simplified_text']
                verification    = regen_result['final_verification']
                final_status    = 'HUMAN_REVIEW_REQUIRED'
        else:
            # Baseline mode — no regeneration
            final_status = 'WARNING'


    # ── Step 11: Citizen-Friendly Output ─────────────────────────────────────
    logger.info(f"[{clause_id}] Step 11: Assembling output — final_status={final_status}")

    # Important Legal Facts (structured extraction from final simplified text)
    final_fact   = _extract_svc.extract(clause_id, simplified_text)

    # Easy-Term Explanations for difficult legal terms
    difficult_terms = _explain_svc.find_difficult_terms(simplified_text)

    return {
        # ── Core output ───────────────────────────────────────────────────────
        'clause_id':                    clause_id,
        'section':                      clause.get('section', ''),

        # Step 11, Branch 1: Simplified Legal Text
        'original_text':                text,
        'simplified_text_final':        simplified_text,
        'simplified_text_baseline':     baseline_text,
        'simplified_text_constrained':  constrained_text,

        # Step 11, Branch 2: Important Legal Facts
        'original_facts':               orig_fact.to_dict(),
        'generated_facts':              final_fact.to_dict(),

        # Step 11, Branch 3: Easy-Term Explanations
        'difficult_terms':              difficult_terms,

        # ── Research metadata ─────────────────────────────────────────────────
        'original_graph':               _graph_svc.serialize_graph(orig_graph),
        'generated_graph':              _graph_svc.serialize_graph(gen_graph),
        'constraints':                  _constraint_svc.to_dict_list(constraints),
        'verification':                 verification,

        # ── Quality & status ──────────────────────────────────────────────────
        'simplification_quality':       final_quality.to_dict(),
        'final_status':                 final_status,
        'regeneration_attempts':        regeneration_attempts,
        'regeneration':                 regen_result,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/simplify  — Full Pipeline Entry Point
# ─────────────────────────────────────────────────────────────────────────────

@simplify_bp.route('/simplify', methods=['POST'])
def simplify_document():
    """
    Run the complete LegalSafe-G research pipeline on an uploaded document.

    Steps executed:
      1. Document Processing (text extraction + OCR)
      2. Text Preprocessing
      3. Legal Clause Segmentation
      4–11. Per-clause pipeline (see _process_clause)

    Request JSON:
        document_id  (str, required)
        mode         ('baseline' | 'constrained' | 'both', default 'both')

    Returns:
        Complete result JSON including quality scores and verification breakdown.
    """
    data = request.get_json(silent=True)
    if not data or 'document_id' not in data:
        return jsonify({'error': 'document_id is required'}), 400

    document_id = data['document_id']
    mode = data.get('mode', 'constrained')   # Default: constrained only
    if mode not in ('baseline', 'constrained', 'both'):
        return jsonify({'error': "mode must be 'baseline', 'constrained', or 'both'"}), 400

    # ── Fetch document from DB ───────────────────────────────────────────────
    with get_db(current_app) as db:
        doc_row = db.execute(
            'SELECT * FROM documents WHERE id = ?', (document_id,)
        ).fetchone()

    if not doc_row:
        return jsonify({'error': 'Document not found'}), 404

    file_path = doc_row['file_path']
    filename  = doc_row['filename']

    # ── Guard: uploaded file must physically exist on disk ───────────────────
    import os as _os
    if not _os.path.isfile(file_path):
        logger.error(f"[{document_id}] Uploaded file missing from disk: {file_path}")
        return jsonify({
            'error': (
                f'The uploaded file "{filename}" could not be found on the server. '
                'Please re-upload your document and try again. '
                'The system does NOT fall back to any sample document.'
            )
        }), 422

    try:
        # ────────────────────────────────────────────────────────────────────
        # STEP 1: Document Processing — uses ONLY the user-uploaded file
        # ────────────────────────────────────────────────────────────────────
        logger.info(f"[INPUT] Document received: {filename} (id={document_id})")
        logger.info(f"[EXTRACTION] Step 1: Text Extraction — {filename} (path: {file_path})")
        doc_result = _doc_svc.extract(file_path, filename)

        if not doc_result.get('raw_text', '').strip():
            return jsonify({
                'error': 'Document appears empty or unreadable. '
                         'If this is a scanned PDF, ensure Tesseract OCR is installed.'
            }), 422

        # ────────────────────────────────────────────────────────────────────
        # STEP 2: Text Preprocessing
        # ────────────────────────────────────────────────────────────────────
        logger.info(f"[{document_id}] Step 2: Text Preprocessing")
        clean_text = _pre_svc.preprocess(doc_result['raw_text'])

        # ────────────────────────────────────────────────────────────────────
        # STEP 3: Legal Clause Segmentation
        # ────────────────────────────────────────────────────────────────────
        logger.info(f"[{document_id}] Step 3: Clause Segmentation")
        clauses = _clause_svc.segment(clean_text)
        if not clauses:
            return jsonify({'error': 'No legal clauses could be extracted.'}), 422

        MAX_CLAUSES = 10   # Speed guard: ~10 s per clause × 10 = ~100 s max
        if len(clauses) > MAX_CLAUSES:
            logger.info(f"[{document_id}] Capping {len(clauses)} clauses → {MAX_CLAUSES}")
            clauses = clauses[:MAX_CLAUSES]

        logger.info(f"[{document_id}] Processing {len(clauses)} clauses")

        # ────────────────────────────────────────────────────────────────────
        # STEPS 4–11: Per-clause pipeline
        # ────────────────────────────────────────────────────────────────────
        clause_results = []
        for clause in clauses:
            try:
                logger.info(f"[{document_id}] Processing clause {clause['clause_id']}")
                result = _process_clause(clause, mode)
                clause_results.append(result)
            except Exception as exc:
                logger.error(
                    f"[{document_id}] Clause {clause['clause_id']} failed: {exc}",
                    exc_info=True
                )
                clause_results.append({
                    'clause_id':             clause['clause_id'],
                    'section':               clause.get('section', ''),
                    'original_text':         clause['text'],
                    'simplified_text_final': clause['text'],   # fall back to original
                    'original_facts':        {},
                    'generated_facts':       {},
                    'difficult_terms':       [],
                    'verification':          {'status': 'ERROR', 'score': 0.0,
                                              'mismatches': [], 'graph_comparison_status': 'ERROR'},
                    'simplification_quality': {
                        'copy_score': 0.0,
                        'is_insufficient_simplification': False,
                        'compression_ratio': 1.0,
                        'is_over_compressed': False,
                        'graph_preservation_ratio': 0.0,
                        'has_legal_omission': False,
                        'omission_details': [],
                        'modality_flips': [],
                        'has_modality_flip': False,
                        'overall_quality_status': 'ERROR',
                        'reason': str(exc),
                    },
                    'final_status':          'ERROR',
                    'regeneration_attempts':  0,
                    'error':                 str(exc),
                })

        # ── Aggregate verification summary ────────────────────────────────────
        total        = len(clause_results)
        verified     = sum(1 for r in clause_results if r.get('final_status') in ('VERIFIED', 'REGENERATED_AND_VERIFIED'))
        warnings     = sum(1 for r in clause_results if r.get('final_status') == 'WARNING')
        human_review = sum(1 for r in clause_results if r.get('final_status') in ('HUMAN_REVIEW_REQUIRED', 'REQUIRES_REVIEW'))
        errors       = sum(1 for r in clause_results if r.get('final_status') == 'ERROR')
        regenerated  = sum(1 for r in clause_results if r.get('final_status') == 'REGENERATED_AND_VERIFIED')

        all_mismatches = [
            m
            for r in clause_results
            for m in (r.get('verification') or {}).get('mismatches', [])
        ]

        total_regen_attempts = sum(
            r.get('regeneration_attempts', 0) for r in clause_results
        )

        # Overall status — NEVER show VERIFIED if any clause failed
        if errors > 0 and verified == 0:
            overall_status = 'VERIFICATION_FAILED'
        elif human_review > 0:
            overall_status = 'REQUIRES_REVIEW'
        elif warnings > 0 and verified > 0:
            overall_status = 'PARTIALLY_VERIFIED'
        elif verified == total and total > 0:
            if regenerated > 0:
                overall_status = 'REGENERATED_AND_VERIFIED'
            else:
                overall_status = 'VERIFIED'
        elif warnings > 0:
            overall_status = 'WARNING'
        else:
            overall_status = 'REQUIRES_REVIEW'

        avg_score = (
            sum((r.get('verification') or {}).get('score', 0.0) for r in clause_results) / total
            if total else 0.0
        )

        # Aggregate quality scores
        avg_copy_score = (
            sum((r.get('simplification_quality') or {}).get('copy_score', 0.0) for r in clause_results) / total
            if total else 0.0
        )
        avg_compression = (
            sum((r.get('simplification_quality') or {}).get('compression_ratio', 1.0) for r in clause_results) / total
            if total else 1.0
        )

        # ── Step 11, Branch 3: Full-document glossary ─────────────────────────
        full_simplified = ' '.join(
            r.get('simplified_text_final', '') for r in clause_results
        )
        glossary = _explain_svc.generate_glossary([full_simplified])

        # ── Assemble Step 11 final output payload ─────────────────────────────
        result_id = str(uuid.uuid4())

        logger.info(f"[FINAL] {document_id}: status={overall_status} verified={verified}/{total} "
                    f"review={human_review} regen_attempts={total_regen_attempts}")

        result_payload = {
            # Identifiers
            'result_id':        result_id,
            'document_id':      document_id,
            'filename':         filename,
            'mode':             mode,
            'created_at':       datetime.utcnow().isoformat(),
            'document_metadata': doc_result.get('metadata', {}),
            'has_scanned_pages': doc_result.get('has_scanned_pages', False),

            # Clause count
            'clause_count': total,

            # Final Verification summary (with quality sub-scores)
            'verification_summary': {
                'overall_status':                overall_status,
                'average_score':                 round(avg_score, 4),
                'clauses_verified':              verified,
                'clauses_warning':               warnings,
                'clauses_requiring_human_review': human_review,
                'clauses_error':                 errors,
                'clauses_regenerated':           regenerated,
                'total_mismatches':              len(all_mismatches),
                'total_regeneration_attempts':   total_regen_attempts,
                'average_copy_score':            round(avg_copy_score, 4),
                'average_compression_ratio':     round(avg_compression, 4),
            },

            # Step 11: Citizen-Friendly Output (per clause)
            'clauses': clause_results,

            # All mismatches across the document
            'all_mismatches': all_mismatches,

            # Step 11, Branch 3: Easy-Term Explanations (document-level glossary)
            'glossary': glossary,

            # Disclaimer
            'disclaimer': (
                'DISCLAIMER: LegalSafe-G is a research prototype developed for academic purposes. '
                'The simplified output is for general legal awareness and information only. '
                'It does NOT constitute legal advice and should NOT be relied upon for legal decisions. '
                'Always consult a qualified legal professional for your specific legal matters.'
            ),
        }

        # ── Persist result to SQLite ──────────────────────────────────────────
        with get_db(current_app) as db:
            db.execute(
                'INSERT INTO results (id, document_id, created_at, result_json) '
                'VALUES (?, ?, ?, ?)',
                (result_id, document_id,
                 datetime.utcnow().isoformat(),
                 json.dumps(result_payload, ensure_ascii=False))
            )
            db.execute(
                "UPDATE documents SET status = 'processed' WHERE id = ?",
                (document_id,)
            )
            db.commit()

        logger.info(
            f"[{document_id}] Pipeline complete → result_id={result_id} "
            f"overall_status={overall_status} "
            f"verified={verified}/{total} clauses"
        )
        return jsonify(result_payload), 200

    except Exception as exc:
        logger.exception(f"[{document_id}] Pipeline error: {exc}")
        return jsonify({
            'error':       'Pipeline execution failed',
            'message':     str(exc),
            'document_id': document_id,
        }), 500
