"""
Simplification routes — orchestrates the full LegalSafe-G research pipeline.

Exact pipeline matching the research flowchart:

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
Simplified Legal Text
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
                         Targeted Regeneration (max 3 retries)
                              │
                              ▼
                         Verify Again
                              │
                         (loops back to Graph Comparison)
                              │
                         Final Verification
                              │
                              ▼
Step 11: Citizen-Friendly Output
         ├── Simplified Legal Text
         ├── Important Legal Facts
         └── Easy-Term Explanations
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


def _get_transformer() -> TransformerService:
    """Lazily load FLAN-T5 on first request to avoid slowing startup."""
    global _transformer_svc
    if _transformer_svc is None:
        model_name = current_app.config.get('MODEL_NAME', 'google/flan-t5-small')
        _transformer_svc = TransformerService(model_name=model_name)
    return _transformer_svc


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
# Loops back through Graph Comparison on each retry (as per flowchart)
# ─────────────────────────────────────────────────────────────────────────────

MAX_REGEN_RETRIES = 1   # Speed: was 3 (each retry = extra transformer call)


def _targeted_regeneration_loop(
    original_clause: dict,
    orig_fact,
    orig_graph,
    constraints: list,
    initial_mismatches: list,
) -> dict:
    """
    Step 10: Identify Error → Targeted Regeneration → Verify Again → loop.

    This loop:
      1. Builds a regeneration prompt that explicitly states the mismatch
      2. Calls FLAN-T5 to regenerate the clause
      3. Re-extracts legal facts  (Step 8 repeat)
      4. Rebuilds generated graph (Step 8 repeat)
      5. Runs Graph Comparison    (Step 9 repeat)
      6. If MATCH → accept, break
      7. If MISMATCH → loop back (up to MAX_REGEN_RETRIES)
      8. If exhausted → HUMAN_REVIEW_REQUIRED

    Returns:
        {
            status:              'SUCCESS' | 'HUMAN_REVIEW_REQUIRED',
            simplified_text:     best text produced,
            attempts:            number of attempts,
            final_verification:  last verification dict,
            mismatches:          remaining mismatches (empty on SUCCESS),
        }
    """
    transformer = _get_transformer()
    clause_id   = original_clause['clause_id']
    clause_text = original_clause['text']

    # Track best result across retries
    best_text         = clause_text
    best_score        = 0.0
    best_verification = {}
    current_mismatches = initial_mismatches

    for attempt in range(1, MAX_REGEN_RETRIES + 1):
        logger.info(f"[{clause_id}] Regeneration attempt {attempt}/{MAX_REGEN_RETRIES}")

        # ── Build targeted regeneration prompt ───────────────────────────────
        constraint_fragment = _constraint_svc.constraints_to_prompt_fragment(constraints)

        mismatch_lines = []
        for m in current_mismatches:
            mtype = m.get('type', 'UNKNOWN')
            orig  = m.get('original', 'N/A')
            gen   = m.get('generated', 'N/A')
            mismatch_lines.append(
                f'  - {mtype}: original was "{orig}", generated was "{gen}"'
            )
        mismatch_text = '\n'.join(mismatch_lines) or '  - General fact preservation failure'

        emphasis = '⚠️ ' * min(attempt, 3)
        regen_prompt = (
            f"{emphasis}REGENERATION ATTEMPT {attempt} — "
            f"Previous simplification failed legal graph verification.\n\n"
            f"Problems detected:\n{mismatch_text}\n\n"
            f"You are a legal document simplification assistant.\n"
            f"Simplify the clause below. You MUST fix ALL problems listed above.\n"
            f"Do NOT change any amounts, dates, party names, or legal obligations.\n\n"
            f"{constraint_fragment}\n\n"
            f"Original clause:\n{clause_text}\n\n"
            f"Corrected simplified version:"
        )

        # ── Generate new simplified text ─────────────────────────────────────
        try:
            new_text = transformer._generate(regen_prompt, max_new_tokens=256)
        except Exception as exc:
            logger.error(f"[{clause_id}] Generation error on attempt {attempt}: {exc}")
            continue

        # ── Step 8 (repeat): Re-extract facts from new simplified text ───────
        new_fact  = _extract_svc.extract(clause_id, new_text)
        new_graph = _graph_svc.build_graph([new_fact])

        # ── Step 9 (repeat): Graph Comparison — Verify Again ─────────────────
        verification = _graph_comparison(orig_graph, orig_fact, new_graph, new_fact)

        score = verification.get('score', 0.0)
        logger.info(
            f"[{clause_id}] Attempt {attempt}: "
            f"graph_comparison={verification.get('graph_comparison_status')} "
            f"score={score:.3f}"
        )

        # Keep best result seen across all retries
        if score > best_score:
            best_score        = score
            best_text         = new_text
            best_verification = verification

        # ── MATCH → Accept ────────────────────────────────────────────────────
        if verification.get('graph_comparison_status') == 'MATCH':
            logger.info(f"[{clause_id}] Regeneration SUCCESS on attempt {attempt}")
            return {
                'status':             'SUCCESS',
                'simplified_text':    new_text,
                'attempts':           attempt,
                'final_verification': verification,
                'mismatches':         [],
            }

        # ── Still MISMATCH → loop back ────────────────────────────────────────
        current_mismatches = verification.get('mismatches', [])

    # ── All retries exhausted — Final Verification mark ──────────────────────
    logger.warning(
        f"[{clause_id}] All {MAX_REGEN_RETRIES} regeneration attempts failed. "
        f"Best score: {best_score:.3f} → HUMAN_REVIEW_REQUIRED"
    )
    return {
        'status':             'HUMAN_REVIEW_REQUIRED',
        'simplified_text':    best_text,
        'attempts':           MAX_REGEN_RETRIES,
        'final_verification': best_verification,
        'mismatches':         current_mismatches,
    }


# ─────────────────────────────────────────────────────────────────────────────
# PER-CLAUSE PIPELINE (Steps 4–11)
# ─────────────────────────────────────────────────────────────────────────────

def _process_clause(clause: dict, mode: str) -> dict:
    """
    Run Steps 4–11 of the flowchart for a single legal clause.

    Steps:
      4. Legal Information Extraction (Entities + Actions + Conditions)
      5. Legal Fact Graph
      6. Legal Constraints
      7. Constraint-Guided Transformer
         ↓
      Simplified Legal Text
         ↓
      8. Generate–Verify Stage (re-extract + rebuild graph)
      9. Graph Comparison (MATCH → Step 11 | MISMATCH → Step 10)
     10. Targeted Regeneration (loop with Verify Again)
     11. Citizen-Friendly Output assembly
    """
    transformer = _get_transformer()
    clause_id   = clause['clause_id']
    text        = clause['text']

    # ── Step 4: Legal Information Extraction ─────────────────────────────────
    # Parallel extraction of Entities, Actions, Conditions
    orig_fact = _extract_svc.extract(clause_id, text)

    # ── Step 5: Legal Fact Graph ──────────────────────────────────────────────
    # Build graph with Legal Entities (nodes) + Relationships (edges)
    orig_graph = _graph_svc.build_graph([orig_fact])

    # ── Step 6: Legal Constraints ─────────────────────────────────────────────
    # Derive: Rights, Obligations, Dates, Amounts,
    #         Conditions, Prohibitions, Penalties, Consequences
    constraints = _constraint_svc.generate_constraints(orig_graph, [orig_fact])

    # ── Step 7: Constraint-Guided Transformer (FLAN-T5) ───────────────────────
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

    # Primary simplified text for verification is constrained; baseline is research comparison only
    simplified_text = constrained_text or baseline_text or text

    # ── Step 8: Generate–Verify Stage ────────────────────────────────────────
    # Re-extract legal facts from simplified text
    gen_fact  = _extract_svc.extract(clause_id, simplified_text)
    # Rebuild generated Legal Fact Graph
    gen_graph = _graph_svc.build_graph([gen_fact])

    # ── Step 9: Graph Comparison ──────────────────────────────────────────────
    # Original Graph  VS  Generated Graph
    verification = _graph_comparison(orig_graph, orig_fact, gen_graph, gen_fact)

    regen_result = None

    if verification['graph_comparison_status'] == 'MATCH':
        # ── MATCH → Accept → proceed to Step 11 ──────────────────────────────
        final_status = 'VERIFIED'
        logger.info(f"[{clause_id}] Graph Comparison: MATCH ✓ → Accepted")

    else:
        score = verification.get('score', 0)
        logger.info(
            f"[{clause_id}] Graph Comparison: MISMATCH "
            f"(score={score:.3f}, "
            f"mismatches={len(verification.get('mismatches', []))})"
        )

        # ── Speed optimisation: skip regen if score is already acceptable ────
        # Score ≥ 0.5 means most facts preserved → mark WARNING, save time
        if score >= 0.5:
            logger.info(f"[{clause_id}] Score {score:.2f} ≥ 0.5 → accept as WARNING (skip regen)")
            final_status = 'WARNING'

        elif mode in ('constrained', 'both'):
            # ── MISMATCH with low score → Step 10: Targeted Regeneration ─────
            regen_result = _targeted_regeneration_loop(
                original_clause    = clause,
                orig_fact          = orig_fact,
                orig_graph         = orig_graph,
                constraints        = constraints,
                initial_mismatches = verification['mismatches'],
            )

            if regen_result['status'] == 'SUCCESS':
                simplified_text = regen_result['simplified_text']
                verification    = regen_result['final_verification']
                final_status    = 'VERIFIED'
            else:
                simplified_text = regen_result['simplified_text']
                verification    = regen_result['final_verification']
                final_status    = 'HUMAN_REVIEW_REQUIRED'
        else:
            # Baseline mode — no regeneration, just flag warning
            final_status = 'WARNING'


    # ── Step 11: Citizen-Friendly Output ─────────────────────────────────────
    # Branch 1: Simplified Legal Text            → simplified_text_final
    # Branch 2: Important Legal Facts            → original_facts (structured)
    # Branch 3: Easy-Term Explanations           → difficult_terms

    # Important Legal Facts (structured extraction from simplified text)
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
        'final_status':                 final_status,     # VERIFIED | WARNING | HUMAN_REVIEW_REQUIRED
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
        Complete result JSON:
        {
          result_id, document_id, filename, mode, clause_count,
          verification_summary,
          clauses: [
            {
              clause_id, section,
              original_text,
              simplified_text_final,       # Step 11, Branch 1
              original_facts,              # Step 11, Branch 2
              generated_facts,
              difficult_terms,             # Step 11, Branch 3
              constraints,
              verification,
              final_status,
              regeneration
            }
          ],
          all_mismatches,
          glossary,
          disclaimer
        }
    """
    data = request.get_json(silent=True)
    if not data or 'document_id' not in data:
        return jsonify({'error': 'document_id is required'}), 400

    document_id = data['document_id']
    mode = data.get('mode', 'constrained')   # Default: constrained only (2× faster than 'both')
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
    # This prevents any possibility of falling back to a sample document.
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
        # Text Extraction (PDF / DOCX / TXT) + OCR fallback for scanned PDFs
        # ────────────────────────────────────────────────────────────────────
        logger.info(f"[{document_id}] STEP 1: Document Processing — {filename} (path: {file_path})")
        doc_result = _doc_svc.extract(file_path, filename)


        if not doc_result.get('raw_text', '').strip():
            return jsonify({
                'error': 'Document appears empty or unreadable. '
                         'If this is a scanned PDF, ensure Tesseract OCR is installed.'
            }), 422

        # ────────────────────────────────────────────────────────────────────
        # STEP 2: Text Preprocessing
        # Remove noise, normalize whitespace, preserve legal terms
        # ────────────────────────────────────────────────────────────────────
        logger.info(f"[{document_id}] STEP 2: Text Preprocessing")
        clean_text = _pre_svc.preprocess(doc_result['raw_text'])

        # ────────────────────────────────────────────────────────────────────
        # STEP 3: Legal Clause Segmentation
        # Document → Sections → Clauses
        # Cap at 15 clauses so pipeline finishes within ~2–3 minutes on CPU
        # ────────────────────────────────────────────────────────────────────
        logger.info(f"[{document_id}] STEP 3: Clause Segmentation")
        clauses = _clause_svc.segment(clean_text)
        if not clauses:
            return jsonify({'error': 'No legal clauses could be extracted.'}), 422

        MAX_CLAUSES = 10   # Speed guard: ~7 s per clause × 10 = ~70 s max
        if len(clauses) > MAX_CLAUSES:
            logger.info(f"[{document_id}] Capping {len(clauses)} clauses → {MAX_CLAUSES}")
            clauses = clauses[:MAX_CLAUSES]

        logger.info(f"[{document_id}] Processing {len(clauses)} clauses")

        # ────────────────────────────────────────────────────────────────────
        # STEPS 4–11: Per-clause pipeline
        # (Extraction → Graph → Constraints → Simplify → Verify → Regenerate → Output)
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
                    'final_status':          'ERROR',
                    'error':                 str(exc),
                })

        # ── Aggregate verification summary ────────────────────────────────────
        total        = len(clause_results)
        verified     = sum(1 for r in clause_results if r.get('final_status') == 'VERIFIED')
        warnings     = sum(1 for r in clause_results if r.get('final_status') == 'WARNING')
        human_review = sum(1 for r in clause_results if r.get('final_status') == 'HUMAN_REVIEW_REQUIRED')
        errors       = sum(1 for r in clause_results if r.get('final_status') == 'ERROR')

        all_mismatches = [
            m
            for r in clause_results
            for m in (r.get('verification') or {}).get('mismatches', [])
        ]

        overall_status = (
            'VERIFIED'              if human_review == 0 and warnings == 0 and errors == 0
            else 'HUMAN_REVIEW_REQUIRED' if human_review > 0
            else 'WARNING'
        )

        avg_score = (
            sum((r.get('verification') or {}).get('score', 0.0) for r in clause_results) / total
            if total else 0.0
        )

        # ── Step 11, Branch 3: Full-document glossary ─────────────────────────
        full_simplified = ' '.join(
            r.get('simplified_text_final', '') for r in clause_results
        )
        glossary = _explain_svc.generate_glossary([full_simplified])

        # ── Assemble Step 11 final output payload ─────────────────────────────
        result_id = str(uuid.uuid4())
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

            # Final Verification summary
            'verification_summary': {
                'overall_status':                overall_status,
                'average_score':                 round(avg_score, 4),
                'clauses_verified':              verified,
                'clauses_warning':               warnings,
                'clauses_requiring_human_review': human_review,
                'clauses_error':                 errors,
                'total_mismatches':              len(all_mismatches),
            },

            # Step 11: Citizen-Friendly Output (per clause)
            # Each clause contains all 3 output branches
            'clauses': clause_results,

            # All mismatches across the document
            'all_mismatches': all_mismatches,

            # Step 11, Branch 3: Easy-Term Explanations (document-level glossary)
            'glossary': glossary,

            # Disclaimer (always present)
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
