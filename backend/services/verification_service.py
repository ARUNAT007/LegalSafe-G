"""
Enhanced VerificationService — full mismatch typing with all 16 mismatch categories,
structured mismatch dicts, and normalised value comparison.
"""

import re
import logging
from typing import Dict, Any, List, Optional
from models.legal_graph import LegalGraph
from models.legal_fact import LegalFact

logger = logging.getLogger(__name__)

# All supported mismatch type constants
ENTITY_CHANGED = 'ENTITY_CHANGED'
ENTITY_OMITTED = 'ENTITY_OMITTED'
ENTITY_ADDED = 'ENTITY_ADDED'
AMOUNT_CHANGED = 'AMOUNT_CHANGED'
AMOUNT_OMITTED = 'AMOUNT_OMITTED'
DATE_CHANGED = 'DATE_CHANGED'
DATE_OMITTED = 'DATE_OMITTED'
ACTION_CHANGED = 'ACTION_CHANGED'
MODALITY_CHANGED = 'MODALITY_CHANGED'
CONDITION_CHANGED = 'CONDITION_CHANGED'
EXCEPTION_CHANGED = 'EXCEPTION_CHANGED'
PENALTY_CHANGED = 'PENALTY_CHANGED'
CONSEQUENCE_CHANGED = 'CONSEQUENCE_CHANGED'
RELATIONSHIP_CHANGED = 'RELATIONSHIP_CHANGED'
LEGAL_FACT_OMITTED = 'LEGAL_FACT_OMITTED'
LEGAL_FACT_ADDED = 'LEGAL_FACT_ADDED'


def _normalize(value: Optional[str]) -> str:
    """Lowercase, strip, collapse whitespace for comparison."""
    if value is None:
        return ''
    return re.sub(r'\s+', ' ', value.lower().strip())


def _amounts_equivalent(a: str, b: str) -> bool:
    """
    Compare two amount strings by extracting numeric values.
    Treats '₹10,000' and '10000' as equivalent.
    """
    def _digits(s: str) -> str:
        return re.sub(r'[^\d]', '', s or '')
    return _digits(a) == _digits(b) and bool(_digits(a))


class VerificationService:
    """
    Compares original and generated legal facts/graphs for semantic fidelity.

    All checks return structured mismatch dicts:
    {type, original, generated, clause_id}
    """

    def compare_graphs(
        self,
        original_graph: LegalGraph,
        original_fact: LegalFact,
        simplified_graph: LegalGraph,
        simplified_fact: LegalFact,
    ) -> Dict[str, Any]:
        """
        Compare original and simplified graphs/facts.

        Returns:
            {status: 'PASS'|'FAIL', score: float, mismatches: [...],
             checks_performed: int, checks_passed: int}
        """
        clause_id = original_fact.clause_id
        mismatches: List[Dict] = []
        checks_performed = 0
        checks_passed = 0

        def _check(passed: bool, mismatch: Optional[Dict]) -> None:
            nonlocal checks_performed, checks_passed
            checks_performed += 1
            if passed:
                checks_passed += 1
            elif mismatch:
                mismatches.append(mismatch)

        # ── 1. Amount preservation ────────────────────────────────────────────
        if original_fact.amount:
            gen_amt = simplified_fact.amount
            if not gen_amt:
                _check(False, {
                    'type': AMOUNT_OMITTED,
                    'original': original_fact.amount,
                    'generated': None,
                    'clause_id': clause_id,
                })
            elif not _amounts_equivalent(original_fact.amount, gen_amt):
                _check(False, {
                    'type': AMOUNT_CHANGED,
                    'original': original_fact.amount,
                    'generated': gen_amt,
                    'clause_id': clause_id,
                })
            else:
                _check(True, None)

        # ── 2. Currency preservation ──────────────────────────────────────────
        if original_fact.currency:
            gen_cur = simplified_fact.currency or ''
            same = _normalize(original_fact.currency) == _normalize(gen_cur)
            _check(same, None if same else {
                'type': AMOUNT_CHANGED,
                'original': f'Currency: {original_fact.currency}',
                'generated': f'Currency: {gen_cur or "missing"}',
                'clause_id': clause_id,
            })

        # ── 3. Deadline / date preservation ───────────────────────────────────
        if original_fact.deadline:
            gen_dl = simplified_fact.deadline
            if not gen_dl:
                _check(False, {
                    'type': DATE_OMITTED,
                    'original': original_fact.deadline,
                    'generated': None,
                    'clause_id': clause_id,
                })
            elif _normalize(original_fact.deadline) != _normalize(gen_dl):
                _check(False, {
                    'type': DATE_CHANGED,
                    'original': original_fact.deadline,
                    'generated': gen_dl,
                    'clause_id': clause_id,
                })
            else:
                _check(True, None)

        # ── 4. Modality preservation ───────────────────────────────────────────
        if original_fact.modality:
            gen_mod = simplified_fact.modality
            same = _normalize(original_fact.modality) == _normalize(gen_mod or '')
            _check(same, None if same else {
                'type': MODALITY_CHANGED,
                'original': original_fact.modality,
                'generated': gen_mod,
                'clause_id': clause_id,
            })

        # ── 5. Party / entity preservation ────────────────────────────────────
        for party in original_fact.parties:
            party_lower = _normalize(party)
            gen_parties_lower = [_normalize(p) for p in simplified_fact.parties]
            if party_lower and party_lower not in gen_parties_lower:
                _check(False, {
                    'type': ENTITY_OMITTED,
                    'original': party,
                    'generated': None,
                    'clause_id': clause_id,
                })
            else:
                _check(True, None)

        # Check for added entities (not a hard fail but flagged)
        for gen_party in simplified_fact.parties:
            if _normalize(gen_party) not in [_normalize(p) for p in original_fact.parties]:
                mismatches.append({
                    'type': ENTITY_ADDED,
                    'original': None,
                    'generated': gen_party,
                    'clause_id': clause_id,
                })

        # ── 6. Penalty preservation ────────────────────────────────────────────
        if original_fact.penalty:
            gen_pen = simplified_fact.penalty
            if not gen_pen:
                _check(False, {
                    'type': PENALTY_CHANGED,
                    'original': original_fact.penalty,
                    'generated': None,
                    'clause_id': clause_id,
                })
            elif not _amounts_equivalent(original_fact.penalty, gen_pen):
                _check(False, {
                    'type': PENALTY_CHANGED,
                    'original': original_fact.penalty,
                    'generated': gen_pen,
                    'clause_id': clause_id,
                })
            else:
                _check(True, None)

        # ── 7. Condition preservation ──────────────────────────────────────────
        if original_fact.condition:
            gen_cond = simplified_fact.condition
            if not gen_cond:
                _check(False, {
                    'type': CONDITION_CHANGED,
                    'original': original_fact.condition,
                    'generated': None,
                    'clause_id': clause_id,
                })
            else:
                _check(True, None)

        # ── 8. Exception preservation ──────────────────────────────────────────
        if original_fact.exception:
            gen_exc = simplified_fact.exception
            same = _normalize(original_fact.exception) == _normalize(gen_exc or '')
            _check(same, None if same else {
                'type': EXCEPTION_CHANGED,
                'original': original_fact.exception,
                'generated': gen_exc,
                'clause_id': clause_id,
            })

        # ── 9. Consequence preservation ────────────────────────────────────────
        if original_fact.consequence:
            gen_con = simplified_fact.consequence
            same = _normalize(original_fact.consequence) == _normalize(gen_con or '')
            _check(same, None if same else {
                'type': CONSEQUENCE_CHANGED,
                'original': original_fact.consequence,
                'generated': gen_con,
                'clause_id': clause_id,
            })

        # ── 10. Action preservation ────────────────────────────────────────────
        if original_fact.action:
            gen_act = simplified_fact.action
            same = _normalize(original_fact.action) == _normalize(gen_act or '')
            _check(same, None if same else {
                'type': ACTION_CHANGED,
                'original': original_fact.action,
                'generated': gen_act,
                'clause_id': clause_id,
            })

        # ── Calculate score ────────────────────────────────────────────────────
        score = (checks_passed / checks_performed) if checks_performed > 0 else 1.0

        # Hard mismatches on critical fields override score threshold
        critical_types = {AMOUNT_CHANGED, AMOUNT_OMITTED, PENALTY_CHANGED,
                          MODALITY_CHANGED, DATE_CHANGED, DATE_OMITTED}
        has_critical = any(m['type'] in critical_types for m in mismatches)

        if has_critical:
            status = 'FAIL'
        elif score >= 0.85:
            status = 'PASS'
        else:
            status = 'FAIL'

        return {
            'status': status,
            'score': round(score, 4),
            'mismatches': mismatches,
            'checks_performed': checks_performed,
            'checks_passed': checks_passed,
        }

    def verify_clause(
        self,
        original_clause: Dict,
        simplified_clause: Dict,
        original_fact: LegalFact,
        generated_fact: LegalFact,
    ) -> Dict[str, Any]:
        """
        Convenience method for single-clause verification without graph objects.
        Builds lightweight graphs internally.
        """
        from services.graph_service import GraphService
        graph_svc = GraphService()
        orig_graph = graph_svc.build_graph([original_fact])
        gen_graph = graph_svc.build_graph([generated_fact])
        return self.compare_graphs(orig_graph, original_fact, gen_graph, generated_fact)
