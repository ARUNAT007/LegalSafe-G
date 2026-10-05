"""
RegenerationService — targeted clause-level regeneration loop.

When a clause fails verification, this service:
1. Builds an enhanced prompt that explicitly states what was wrong.
2. Calls TransformerService for regeneration.
3. Re-extracts legal facts from the new text.
4. Rebuilds the Legal Fact Graph.
5. Re-compares graphs.
6. Repeats up to MAX_RETRIES times.
7. Returns HUMAN_REVIEW_REQUIRED if still failing after all retries.
"""

import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


class RegenerationService:
    """
    Targeted regeneration service for clauses that fail verification.

    Takes injected service instances to avoid circular imports and
    allow independent testing.
    """

    def __init__(
        self,
        transformer_service,
        extraction_service,
        graph_service,
        verification_service,
        constraint_service,
        max_retries: int = MAX_RETRIES,
    ):
        self.transformer = transformer_service
        self.extractor = extraction_service
        self.graph_svc = graph_service
        self.verifier = verification_service
        self.constraint_svc = constraint_service
        self.max_retries = max_retries

    # ── Public API ────────────────────────────────────────────────────────────

    def regenerate_clause(
        self,
        original_clause: Dict[str, Any],
        failed_fact,
        failed_constraints: List,
        mismatches: List[Dict],
    ) -> Dict[str, Any]:
        """
        Attempt to regenerate a clause that failed verification.

        Args:
            original_clause:     The original clause dict {clause_id, text, ...}.
            failed_fact:         LegalFact extracted from the original clause.
            failed_constraints:  List of LegalConstraint for this clause.
            mismatches:          List of mismatch dicts from the failed verification.

        Returns:
            {
                status:          'SUCCESS' | 'HUMAN_REVIEW_REQUIRED',
                simplified_text: best text produced,
                attempts:        number of attempts made,
                final_verification: final verification dict,
                mismatches:      remaining mismatches (empty on SUCCESS),
            }
        """
        clause_id = original_clause['clause_id']
        clause_text = original_clause['text']

        # Rebuild original graph for comparison
        orig_graph = self.graph_svc.build_graph([failed_fact])

        best_text = clause_text
        best_score = 0.0
        best_verification: Dict = {}
        current_mismatches = mismatches

        for attempt in range(1, self.max_retries + 1):
            logger.info(f'[{clause_id}] Regeneration attempt {attempt}/{self.max_retries}')

            prompt = self._build_regeneration_prompt(
                clause_text=clause_text,
                failed_fact=failed_fact,
                constraints=failed_constraints,
                mismatches=current_mismatches,
                attempt=attempt,
            )

            try:
                new_text = self.transformer._generate(prompt, max_new_tokens=256)
            except Exception as exc:
                logger.error(f'[{clause_id}] Generation error on attempt {attempt}: {exc}')
                continue

            # Re-extract facts and rebuild graph
            new_fact = self.extractor.extract(clause_id, new_text)
            new_graph = self.graph_svc.build_graph([new_fact])

            # Re-verify
            verification = self.verifier.compare_graphs(
                orig_graph, failed_fact, new_graph, new_fact
            )

            score = verification.get('score', 0.0)
            logger.info(
                f'[{clause_id}] Attempt {attempt}: score={score:.3f} '
                f'status={verification.get("status")}'
            )

            if score > best_score:
                best_score = score
                best_text = new_text
                best_verification = verification

            if verification.get('status') == 'PASS':
                logger.info(f'[{clause_id}] Regeneration SUCCESS on attempt {attempt}')
                return {
                    'status': 'SUCCESS',
                    'simplified_text': new_text,
                    'attempts': attempt,
                    'final_verification': verification,
                    'mismatches': [],
                }

            current_mismatches = verification.get('mismatches', [])

        # All retries exhausted
        logger.warning(
            f'[{clause_id}] All {self.max_retries} regeneration attempts failed. '
            f'Best score: {best_score:.3f}. Marking HUMAN_REVIEW_REQUIRED.'
        )
        return {
            'status': 'HUMAN_REVIEW_REQUIRED',
            'simplified_text': best_text,
            'attempts': self.max_retries,
            'final_verification': best_verification,
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

    def _build_regeneration_prompt(
        self,
        clause_text: str,
        failed_fact,
        constraints: List,
        mismatches: List[Dict],
        attempt: int,
    ) -> str:
        """
        Build an enhanced prompt that explicitly states what went wrong.

        The prompt becomes progressively more explicit on each retry.
        """
        constraint_svc = self.constraint_svc
        constraint_fragment = constraint_svc.constraints_to_prompt_fragment(constraints)

        mismatch_lines = []
        for m in mismatches:
            mtype = m.get('type', 'UNKNOWN')
            orig = m.get('original', 'N/A')
            gen = m.get('generated', 'N/A')
            mismatch_lines.append(
                f'  - {mtype}: expected "{orig}", but got "{gen}"'
            )
        mismatch_text = '\n'.join(mismatch_lines) if mismatch_lines else '  (No details available)'

        emphasis = '⚠️ ' * min(attempt, 3)  # More emphasis on later retries

        prompt = f"""{emphasis}REGENERATION ATTEMPT {attempt} — Previous simplification failed legal verification.

The following problems were detected in the previous version:
{mismatch_text}

You are a legal document simplification assistant.
Simplify the following legal clause into plain, simple language that an ordinary citizen can easily understand.

MANDATORY RULES (you MUST follow ALL of these):
- Use simple everyday words instead of complex legal terminology
- Keep sentences short and clear
- Do NOT add any information not in the original text
- Do NOT remove any legally significant facts
- Correct ALL the errors listed above

{constraint_fragment}

Original legal clause to simplify:
{clause_text}

Corrected simplified version:"""

        return prompt
