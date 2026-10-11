import logging
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional
from models.legal_fact import LegalFact
from models.legal_graph import LegalGraph

logger = logging.getLogger(__name__)


@dataclass
class LegalConstraint:
    """
    Represents a single preservation constraint derived from a Legal Fact Graph.

    Fields:
        constraint_type: One of the CONSTRAINT_TYPES constants.
        value:           The exact value that must be preserved.
        description:     Human-readable instruction for the LLM prompt.
        clause_id:       The clause this constraint applies to.
        priority:        HIGH | MEDIUM | LOW
    """
    constraint_type: str
    value: str
    description: str
    clause_id: str = ''
    priority: str = 'HIGH'

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


CONSTRAINT_TYPES = [
    'AMOUNT_PRESERVATION',
    'DEADLINE_PRESERVATION',
    'MODALITY_PRESERVATION',
    'PROHIBITION_PRESERVATION',
    'PARTY_PRESERVATION',
    'PENALTY_PRESERVATION',
    'CONDITION_PRESERVATION',
    'EXCEPTION_PRESERVATION',
    'OBLIGATION_PRESERVATION',
    'RIGHT_PRESERVATION',
    'PERMISSION_PRESERVATION',
    'CURRENCY_PRESERVATION',
]


class ConstraintService:
    """Derives LegalConstraints from a LegalGraph and LegalFact list."""

    def generate_constraints(
        self, graph: LegalGraph, facts: List[LegalFact]
    ) -> List[LegalConstraint]:
        """
        Generate clause-specific constraints from extracted facts.

        Args:
            graph:  LegalGraph for the clause set.
            facts:  List of LegalFact objects extracted from clauses.

        Returns:
            Ordered list of LegalConstraint objects (HIGH priority first).
        """
        constraints: List[LegalConstraint] = []

        for fact in facts:
            cid = fact.clause_id

            # Amount
            if fact.amount:
                constraints.append(LegalConstraint(
                    constraint_type='AMOUNT_PRESERVATION',
                    value=fact.amount,
                    description=f'You MUST preserve the exact amount: {fact.amount}',
                    clause_id=cid,
                    priority='HIGH',
                ))

            # Currency
            if fact.currency:
                constraints.append(LegalConstraint(
                    constraint_type='CURRENCY_PRESERVATION',
                    value=fact.currency,
                    description=f'You MUST use the currency: {fact.currency}',
                    clause_id=cid,
                    priority='HIGH',
                ))

            # Deadline
            if fact.deadline:
                constraints.append(LegalConstraint(
                    constraint_type='DEADLINE_PRESERVATION',
                    value=fact.deadline,
                    description=f'You MUST preserve the time limit/deadline: {fact.deadline}',
                    clause_id=cid,
                    priority='HIGH',
                ))

            # Modality — prohibitions are especially critical
            if fact.modality:
                if 'NOT' in fact.modality or fact.modality == 'PROHIBITED':
                    constraints.append(LegalConstraint(
                        constraint_type='PROHIBITION_PRESERVATION',
                        value=fact.modality,
                        description=(
                            f'This clause contains a PROHIBITION ({fact.modality}). '
                            f'You MUST clearly state that this action is NOT allowed.'
                        ),
                        clause_id=cid,
                        priority='HIGH',
                    ))
                else:
                    constraints.append(LegalConstraint(
                        constraint_type='MODALITY_PRESERVATION',
                        value=fact.modality,
                        description=f'Preserve the obligation strength: {fact.modality} (e.g. must/shall/may)',
                        clause_id=cid,
                        priority='HIGH',
                    ))

            # Penalty
            if fact.penalty:
                constraints.append(LegalConstraint(
                    constraint_type='PENALTY_PRESERVATION',
                    value=fact.penalty,
                    description=f'You MUST mention the penalty: {fact.penalty}',
                    clause_id=cid,
                    priority='HIGH',
                ))

            # Condition
            if fact.condition:
                constraints.append(LegalConstraint(
                    constraint_type='CONDITION_PRESERVATION',
                    value=fact.condition,
                    description=f'Preserve the condition (if/when clause): {fact.condition}',
                    clause_id=cid,
                    priority='MEDIUM',
                ))

            # Exception
            if fact.exception:
                constraints.append(LegalConstraint(
                    constraint_type='EXCEPTION_PRESERVATION',
                    value=fact.exception,
                    description=f'Preserve the exception: {fact.exception}',
                    clause_id=cid,
                    priority='MEDIUM',
                ))

            # Parties (deduplicated per clause)
            seen_parties = set()
            for party in fact.parties:
                party_clean = party.strip()
                if party_clean and party_clean.lower() not in seen_parties:
                    seen_parties.add(party_clean.lower())
                    constraints.append(LegalConstraint(
                        constraint_type='PARTY_PRESERVATION',
                        value=party_clean,
                        description=f'You MUST mention the party: {party_clean}',
                        clause_id=cid,
                        priority='MEDIUM',
                    ))

        # Sort: HIGH first
        priority_order = {'HIGH': 0, 'MEDIUM': 1, 'LOW': 2}
        constraints.sort(key=lambda c: priority_order.get(c.priority, 2))
        return constraints

    def constraints_to_prompt_fragment(self, constraints: List[LegalConstraint]) -> str:
        """
        Convert constraints to a clean natural-language instruction block
        for inclusion in the Transformer prompt without machine tag pollution.
        """
        if not constraints:
            return ''
        lines = ['SPECIFIC CONSTRAINTS FOR THIS CLAUSE (you MUST follow all):']
        for i, c in enumerate(constraints, 1):
            lines.append(f'{i}. {c.description}')
        return '\n'.join(lines)

    def to_dict_list(self, constraints: List[LegalConstraint]) -> List[Dict[str, Any]]:
        """Serialise a list of LegalConstraints to JSON-serialisable dicts."""
        return [c.to_dict() for c in constraints]
