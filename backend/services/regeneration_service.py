"""
RegenerationService — targeted clause-level regeneration loop.

Improvements over original:
 - Builds mismatch-specific regeneration instructions per failure type
 - Uses quality_service to check each regen candidate BEFORE graph verification
 - Reads MAX_REGENERATION_RETRIES from config instead of hardcoded constant
 - Classifies quality failures separately from graph failures in the prompt
"""

import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)


class RegenerationService:
    """
    Targeted regeneration service for clauses that fail verification
    or quality checks.

    Takes injected service instances to avoid circular imports.
    """

    def __init__(
        self,
        transformer_service,
        extraction_service,
        graph_service,
        verification_service,
        constraint_service,
        quality_service=None,
        max_retries: int = 3,
    ):
        self.transformer = transformer_service
        self.extractor = extraction_service
        self.graph_svc = graph_service
        self.verifier = verification_service
        self.constraint_svc = constraint_service
        self.quality_svc = quality_service
        self.max_retries = max_retries

    # ── Public API ────────────────────────────────────────────────────────────

    def regenerate_clause(
        self,
        original_clause: Dict[str, Any],
        failed_fact,
        failed_constraints: List,
        mismatches: List[Dict],
        quality_reason: str = '',
    ) -> Dict[str, Any]:
        """
        Attempt to regenerate a clause that failed verification or quality check.

        Args:
            original_clause:     The original clause dict {clause_id, text, ...}.
            failed_fact:         LegalFact extracted from the original clause.
            failed_constraints:  List of LegalConstraint for this clause.
            mismatches:          List of mismatch dicts from the failed verification.
            quality_reason:      Human-readable quality failure reason (optional).

        Returns:
            {
                status:               'SUCCESS' | 'HUMAN_REVIEW_REQUIRED',
                simplified_text:      best text produced,
                attempts:             number of attempts made,
                final_verification:   final verification dict,
                final_quality:        final quality dict (if quality_svc available),
                mismatches:           remaining mismatches (empty on SUCCESS),
            }
        """
        clause_id = original_clause['clause_id']
        clause_text = original_clause['text']

        # Rebuild original graph for comparison
        orig_graph = self.graph_svc.build_graph([failed_fact])

        best_text = clause_text
        best_score = 0.0
        best_verification: Dict = {}
        best_quality: Dict = {}
        current_mismatches = mismatches

        for attempt in range(1, self.max_retries + 1):
            logger.info(
                f'[{clause_id}] REGENERATION attempt {attempt}/{self.max_retries}'
            )

            # Build mismatch-aware regeneration reason
            regen_reason = self._build_mismatch_reason(
                current_mismatches, quality_reason, attempt
            )

            # Generate with targeted prompt
            try:
                new_text = self.transformer.simplify_targeted_regen(
                    clause_text=clause_text,
                    constraints=failed_constraints,
                    mismatch_reason=regen_reason,
                    attempt=attempt,
                )
            except Exception as exc:
                logger.error(
                    f'[{clause_id}] Generation error on attempt {attempt}: {exc}'
                )
                continue

            # Re-extract facts and rebuild graph
            new_fact = self.extractor.extract(clause_id, new_text)
            new_graph = self.graph_svc.build_graph([new_fact])

            # Quality check (if available)
            quality_result = None
            if self.quality_svc:
                quality_result = self.quality_svc.check_quality(
                    original_text=clause_text,
                    simplified_text=new_text,
                    orig_fact=failed_fact,
                    gen_fact=new_fact,
                    orig_graph=orig_graph,
                    gen_graph=new_graph,
                    clause_id=clause_id,
                )

                if quality_result.overall_quality_status != 'PASS':
                    logger.info(
                        f'[{clause_id}] Attempt {attempt}: quality FAILED — '
                        f'{quality_result.overall_quality_status}: '
                        f'{quality_result.reason}'
                    )
                    # Update quality reason for next attempt's prompt
                    quality_reason = quality_result.reason
                    # Still check verification to track best score
                    # but don't accept this candidate

            # Graph verification
            verification = self.verifier.compare_graphs(
                orig_graph, failed_fact, new_graph, new_fact
            )
            verification['graph_comparison_status'] = (
                'MATCH' if verification['status'] == 'PASS' else 'MISMATCH'
            )

            score = verification.get('score', 0.0)
            logger.info(
                f'[{clause_id}] Attempt {attempt}: score={score:.3f} '
                f'status={verification.get("status")} '
                f'quality={quality_result.overall_quality_status if quality_result else "N/A"}'
            )

            # Track best
            if score > best_score:
                best_score = score
                best_text = new_text
                best_verification = verification
                best_quality = quality_result.to_dict() if quality_result else {}

            # Accept only if BOTH quality and verification pass
            quality_ok = (
                quality_result is None
                or quality_result.overall_quality_status == 'PASS'
            )
            verification_ok = verification.get('status') == 'PASS'

            if quality_ok and verification_ok:
                logger.info(
                    f'[{clause_id}] Regeneration SUCCESS on attempt {attempt}'
                )
                return {
                    'status': 'SUCCESS',
                    'simplified_text': new_text,
                    'attempts': attempt,
                    'final_verification': verification,
                    'final_quality': quality_result.to_dict() if quality_result else {},
                    'mismatches': [],
                }

            # Update mismatches for next attempt
            current_mismatches = verification.get('mismatches', [])
            if quality_result and quality_result.overall_quality_status != 'PASS':
                quality_reason = quality_result.reason

        # All retries exhausted — NEVER mark as VERIFIED
        logger.warning(
            f'[{clause_id}] All {self.max_retries} regeneration attempts failed. '
            f'Best score: {best_score:.3f}. Marking HUMAN_REVIEW_REQUIRED.'
        )
        return {
            'status': 'HUMAN_REVIEW_REQUIRED',
            'simplified_text': best_text,
            'attempts': self.max_retries,
            'final_verification': best_verification,
            'final_quality': best_quality,
            'mismatches': current_mismatches,
        }

    def batch_regenerate(self, failed_clause_results: List[Dict]) -> List[Dict]:
        """
        Regenerate a list of failed clause results.

        Args:
            failed_clause_results: List of clause result dicts that failed verification.

        Returns:
            List of regeneration result dicts.
        """
        results = []
        for item in failed_clause_results:
            result = self.regenerate_clause(
                original_clause={
                    'clause_id': item['clause_id'],
                    'text': item['original_text'],
                },
                failed_fact=item.get('original_facts'),
                failed_constraints=item.get('constraints', []),
                mismatches=item.get('verification', {}).get('mismatches', []),
            )
            results.append(result)
        return results

    # ── Private helpers ───────────────────────────────────────────────────────

    def _build_mismatch_reason(
        self,
        mismatches: List[Dict],
        quality_reason: str,
        attempt: int,
    ) -> str:
        """
        Build a specific, actionable failure description for the regeneration
        prompt. Each mismatch type gets a targeted instruction.
        """
        reasons = []

        if quality_reason:
            reasons.append(quality_reason)

        for m in mismatches:
            mtype = m.get('type', 'UNKNOWN')
            orig = m.get('original', 'N/A')
            gen = m.get('generated', 'N/A')

            if 'AMOUNT' in mtype and 'OMIT' in mtype:
                reasons.append(
                    f'The amount "{orig}" was OMITTED. You MUST include '
                    f'the exact amount "{orig}" in your output.'
                )
            elif 'AMOUNT' in mtype:
                reasons.append(
                    f'The amount was CHANGED from "{orig}" to "{gen}". '
                    f'You MUST use the exact original amount "{orig}".'
                )
            elif 'DATE' in mtype and 'OMIT' in mtype:
                reasons.append(
                    f'The deadline/date "{orig}" was OMITTED. '
                    f'You MUST include it explicitly.'
                )
            elif 'DATE' in mtype:
                reasons.append(
                    f'The deadline/date was CHANGED from "{orig}" to "{gen}". '
                    f'Use the original: "{orig}".'
                )
            elif 'MODALITY' in mtype:
                reasons.append(
                    f'The legal obligation strength was CHANGED from '
                    f'"{orig}" to "{gen}". Do NOT change "{orig}" — '
                    f'preserve the original obligation/prohibition strength.'
                )
            elif 'ENTITY' in mtype and 'OMIT' in mtype:
                reasons.append(
                    f'The party/entity "{orig}" was OMITTED. '
                    f'You MUST mention "{orig}".'
                )
            elif 'ENTITY' in mtype:
                reasons.append(
                    f'The party/entity was CHANGED from "{orig}" to "{gen}". '
                    f'Use the original name "{orig}".'
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
            elif 'EXCEPTION' in mtype:
                reasons.append(
                    f'The exception "{orig}" was omitted or changed. '
                    f'Preserve this exception.'
                )
            elif 'ACTION' in mtype:
                reasons.append(
                    f'The action was changed from "{orig}" to "{gen}". '
                    f'Use the original action "{orig}".'
                )
            else:
                reasons.append(
                    f'{mtype}: expected "{orig}", but got "{gen}".'
                )

        if not reasons:
            # Fallback for unknown failure
            if attempt == 1:
                reasons.append(
                    'General verification failure. Preserve ALL legal facts '
                    'from the original text.'
                )
            else:
                reasons.append(
                    'Repeated verification failure. Carefully preserve every '
                    'party, amount, date, deadline, obligation, and condition '
                    'from the original text.'
                )

        # Cap at 5 reasons to stay within token budget
        return '\n'.join(reasons[:5])
