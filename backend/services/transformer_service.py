"""
TransformerService — FLAN-T5-small simplification with two distinct modes.

Baseline:    Plain prompt without any constraint guidance.
Constrained: Full constraint-guided prompt that explicitly instructs the model
             to preserve all legally significant facts.
"""

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)


class TransformerService:
    """
    Handles legal text simplification using Google FLAN-T5-small.

    Models are lazily loaded on first use to avoid slowing startup.
    Automatically uses CUDA if available, otherwise CPU.
    """

    def __init__(self, model_name: str = 'google/flan-t5-small'):
        self.model_name = model_name
        self._tokenizer = None
        self._model = None
        self.device: str = 'cpu'

    # ── Model management ──────────────────────────────────────────────────────

    def _load_model(self) -> None:
        """Lazy-load tokeniser and model. Called automatically on first use."""
        if self._model is not None:
            return
        import os, torch
        from transformers import T5Tokenizer, T5ForConditionalGeneration

        # Bypass corporate SSL certificate issues with HuggingFace
        os.environ['CURL_CA_BUNDLE'] = ''
        os.environ['REQUESTS_CA_BUNDLE'] = ''
        os.environ['HF_HUB_DISABLE_SSL_VERIFY'] = '1'

        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        logger.info(f'Loading {self.model_name} on {self.device} ...')

        self._tokenizer = T5Tokenizer.from_pretrained(self.model_name)
        self._model = T5ForConditionalGeneration.from_pretrained(self.model_name)
        self._model = self._model.to(self.device)
        self._model.eval()

        logger.info(f'Model ready: {self.model_name} [{self.device}]')


    # ── Core generation ────────────────────────────────────────────────────────

    def _generate(self, prompt: str, max_new_tokens: int = 90) -> str:
        """
        Tokenise *prompt*, generate, and decode the output.

        Speed-optimised: greedy decoding (num_beams=1), capped output length,
        and truncated input to keep CPU inference within 5–10 s per clause.
        """
        self._load_model()
        import torch

        inputs = self._tokenizer(
            prompt,
            return_tensors='pt',
            truncation=True,
            max_length=256,          # Shorter input → faster tokenisation & generation
        ).to(self.device)

        with torch.no_grad():
            outputs = self._model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                num_beams=1,           # Greedy decode — 4× faster than beam search
                do_sample=False,       # Deterministic, no extra computation
                early_stopping=False,  # Not needed for greedy
            )

        decoded = self._tokenizer.decode(outputs[0], skip_special_tokens=True)
        return decoded.strip()

    # ── Public simplification API ─────────────────────────────────────────────

    def simplify_baseline(self, clause_text: str) -> str:
        """
        BASELINE simplification — no constraint guidance.
        Truncates input to 400 chars to stay within token budget.
        """
        text = clause_text.strip()[:400]   # Hard cap → faster tokenisation
        prompt = (
            'Simplify this legal clause into plain language for a citizen:\n\n'
            f'{text}\n\n'
            'Plain language version:'
        )
        return self._generate(prompt)

    def simplify_constrained(self, clause_text: str, constraints: List) -> str:
        """
        CONSTRAINT-GUIDED simplification — the proposed research approach.
        Input is pre-truncated to 350 chars so the full prompt stays under
        256 tokens, keeping CPU inference under 10 s per clause.
        """
        from services.constraint_service import ConstraintService
        constraint_fragment = ConstraintService().constraints_to_prompt_fragment(constraints)

        text = clause_text.strip()[:350]   # Hard cap — critical for speed

        prompt = (
            'Simplify this legal clause into plain language. '
            'Preserve ALL amounts, dates, parties, obligations, prohibitions and penalties exactly.\n\n'
        )
        if constraint_fragment:
            prompt += f'Key constraints:\n{constraint_fragment}\n\n'
        prompt += f'Legal clause:\n{text}\n\nPlain language version:'

        return self._generate(prompt)


    # ── Batch methods ─────────────────────────────────────────────────────────

    def batch_simplify_baseline(self, clauses: List[dict]) -> List[dict]:
        """
        Run baseline simplification on a list of clause dicts.

        Args:
            clauses: List of {clause_id, text} dicts.

        Returns:
            List of {clause_id, original_text, simplified_text} dicts.
        """
        results = []
        for clause in clauses:
            try:
                simplified = self.simplify_baseline(clause['text'])
            except Exception as exc:
                logger.error(f"Baseline failed for {clause['clause_id']}: {exc}")
                simplified = clause['text']
            results.append({
                'clause_id': clause['clause_id'],
                'original_text': clause['text'],
                'simplified_text': simplified,
            })
        return results

    def batch_simplify_constrained(
        self,
        clauses: List[dict],
        constraints_per_clause: Optional[List[List]] = None,
    ) -> List[dict]:
        """
        Run constraint-guided simplification on a list of clause dicts.

        Args:
            clauses:                  List of {clause_id, text} dicts.
            constraints_per_clause:   Parallel list of LegalConstraint lists.

        Returns:
            List of {clause_id, original_text, simplified_text} dicts.
        """
        results = []
        for i, clause in enumerate(clauses):
            constraints = (constraints_per_clause[i]
                           if constraints_per_clause and i < len(constraints_per_clause)
                           else [])
            try:
                simplified = self.simplify_constrained(clause['text'], constraints)
            except Exception as exc:
                logger.error(f"Constrained simplification failed for {clause['clause_id']}: {exc}")
                simplified = clause['text']
            results.append({
                'clause_id': clause['clause_id'],
                'original_text': clause['text'],
                'simplified_text': simplified,
            })
        return results
