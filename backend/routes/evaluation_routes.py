"""
Evaluation routes — metrics, result retrieval, and health check.

POST /api/evaluate      — compute evaluation metrics for a document result
GET  /api/result/<id>   — retrieve a stored pipeline result by result_id
GET  /api/health        — health check
"""

import json
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from database import get_db

logger = logging.getLogger(__name__)
evaluate_bp = Blueprint('evaluate', __name__)


@evaluate_bp.route('/evaluate', methods=['POST'])
def evaluate_metrics():
    """
    Compute evaluation metrics for a processed document.

    Request JSON:
        result_id  (str, required) — the pipeline result to evaluate

    Returns:
        JSON dict containing readability, semantic similarity, ROUGE,
        legal_fact_preservation_rate, and comparison metrics.
    """
    data = request.get_json(silent=True)
    if not data or 'result_id' not in data:
        return jsonify({'error': 'result_id is required'}), 400

    result_id = data['result_id']

    # Fetch stored result
    with get_db(current_app) as db:
        row = db.execute(
            'SELECT result_json FROM results WHERE id = ?', (result_id,)
        ).fetchone()

    if not row:
        return jsonify({'error': 'Result not found'}), 404

    try:
        result = json.loads(row['result_json'])
    except (json.JSONDecodeError, KeyError) as exc:
        return jsonify({'error': f'Failed to parse stored result: {exc}'}), 500

    # Lazy-import evaluator to avoid slowing startup
    try:
        import sys
        import os
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'evaluation'))
        from metrics import LegalEvaluator
        evaluator = LegalEvaluator()
    except ImportError:
        logger.warning('LegalEvaluator not available — returning placeholder metrics')
        evaluator = None

    clauses = result.get('clauses', [])
    verification_summary = result.get('verification_summary', {})

    if evaluator is not None:
        # Compute per-clause metrics
        original_texts = [c.get('original_text', '') for c in clauses]
        simplified_texts = [c.get('simplified_text_final', '') for c in clauses]
        original_facts = [c.get('original_facts', {}) for c in clauses]
        generated_facts = [c.get('generated_facts', {}) for c in clauses]

        full_original = ' '.join(original_texts)
        full_simplified = ' '.join(simplified_texts)

        metrics = {
            'readability_original': evaluator.readability_score(full_original),
            'readability_simplified': evaluator.readability_score(full_simplified),
            'semantic_similarity': evaluator.semantic_similarity(full_original, full_simplified),
            'rouge_scores': evaluator.rouge_scores(full_original, full_simplified),
            'legal_fact_preservation_rate': evaluator.legal_fact_preservation_rate(
                original_facts, generated_facts
            ),
            'entity_preservation_rate': evaluator.entity_preservation_rate(
                original_facts, generated_facts
            ),
            'amount_preservation_rate': evaluator.amount_preservation_rate(
                original_facts, generated_facts
            ),
            'date_preservation_rate': evaluator.date_preservation_rate(
                original_facts, generated_facts
            ),
            'modality_preservation_rate': evaluator.modality_preservation_rate(
                original_facts, generated_facts
            ),
            'simplification_success_rate': evaluator.simplification_success_rate(clauses),
            'mismatch_rate': evaluator.mismatch_rate(clauses),
        }
    else:
        metrics = {'note': 'Evaluation module not available. Run pip install textstat rouge-score sentence-transformers'}

    response = {
        'result_id': result_id,
        'document_id': result.get('document_id'),
        'evaluated_at': datetime.utcnow().isoformat(),
        'verification_summary': verification_summary,
        'metrics': metrics,
        'disclaimer': (
            'These metrics are computed on a research prototype using synthetic or '
            'user-provided documents. Results do NOT constitute evidence of real-world '
            'legal correctness or production readiness.'
        ),
    }

    return jsonify(response), 200


@evaluate_bp.route('/result/<string:result_id>', methods=['GET'])
def get_result(result_id: str):
    """
    Retrieve a stored pipeline result by its UUID result_id.

    Returns:
        Full result JSON as stored by the simplification pipeline.
    """
    with get_db(current_app) as db:
        row = db.execute(
            'SELECT result_json, created_at FROM results WHERE id = ?',
            (result_id,)
        ).fetchone()

    if not row:
        return jsonify({'error': 'Result not found', 'result_id': result_id}), 404

    try:
        result = json.loads(row['result_json'])
    except (json.JSONDecodeError, KeyError) as exc:
        return jsonify({'error': f'Failed to parse result: {exc}'}), 500

    return jsonify(result), 200


@evaluate_bp.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'service': 'LegalSafe-G API',
        'version': '1.0.0',
        'timestamp': datetime.utcnow().isoformat(),
        'disclaimer': (
            'Research prototype — not for production legal use.'
        ),
    }), 200
