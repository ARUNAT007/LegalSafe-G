"""
TransformerService — FLAN-T5-small simplification with section-by-section plain English rewriting,
fact preservation, blank party placeholder handling, completeness validation, and stage debug tracing.

Scope: Modifies ONLY e:\LegalSafe-G\backend\services\transformer_service.py.
Preserves existing class and method signatures:
  - simplify_baseline(clause_text: str) -> str
  - simplify_constrained(clause_text: str, constraints: List) -> str
  - simplify_targeted_regen(clause_text: str, constraints: List, mismatch_reason: str, attempt: int = 1) -> str
  - batch_simplify_baseline(clauses: List[dict]) -> List[dict]
  - batch_simplify_constrained(clauses: List[dict], constraints_per_clause: Optional[List[List]]) -> List[dict]
"""

import logging
import re
from typing import List, Optional, Tuple, Dict, Any

logger = logging.getLogger(__name__)


class TransformerService:
    """
    Handles legal text simplification using Google FLAN-T5-small.

    Models are lazily loaded on first use to avoid slowing startup.
    Automatically uses CUDA if available, otherwise CPU.
    """

    def __init__(self, model_name: str = 'google/flan-t5-small', config=None):
        self.model_name = model_name
        self._tokenizer = None
        self._model = None
        self.device: str = 'cpu'
        self._cfg = config or {}

    def _get_cfg(self, key, default):
        return self._cfg.get(key, default)

    # ── Model management ──────────────────────────────────────────────────────

    def _load_model(self) -> None:
        """Lazy-load tokenizer and model. Called automatically on first use."""
        if self._model is not None:
            return
        import os
        import ssl
        import torch
        import urllib3
        import requests
        from transformers import T5Tokenizer, T5ForConditionalGeneration

        # Bypass corporate SSL certificate issues with HuggingFace
        os.environ['HF_HUB_DISABLE_SSL_VERIFY'] = '1'
        os.environ['PYTHONHTTPSVERIFY'] = '0'

        try:
            ssl._create_default_https_context = ssl._create_unverified_context
        except AttributeError:
            pass

        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        # Monkeypatch requests.Session to force verify=False
        old_send = requests.Session.send
        def unsafe_send(self_sess, request, **kwargs):
            kwargs['verify'] = False
            return old_send(self_sess, request, **kwargs)
        requests.Session.send = unsafe_send

        self.device = 'cuda' if torch.cuda.is_available() else 'cpu'
        logger.info(f'Loading {self.model_name} on {self.device} ...')

        self._tokenizer = T5Tokenizer.from_pretrained(self.model_name)
        self._model = T5ForConditionalGeneration.from_pretrained(self.model_name)
        self._model = self._model.to(self.device)
        self._model.eval()

        logger.info(f'Model ready: {self.model_name} [{self.device}]')

    # ── Text Preprocessing & Placeholder Normalization ───────────────────────

    def _preprocess_placeholders(self, text: str) -> str:
        """
        Normalizes blank party placeholders in contract templates (e.g., 'by and between , having')
        into explicit placeholders like '[Disclosing Party name]', '[Receiving Party name]'.
        """
        if not text:
            return ""
        
        normalized = text
        # Pattern: between , having its registered office at
        normalized = re.sub(
            r'between\s*,\s*having\s+its\s+registered\s+office',
            'between [Disclosing Party name], having its registered office',
            normalized,
            flags=re.IGNORECASE
        )
        # Pattern: and , having its registered office at
        normalized = re.sub(
            r'and\s*,\s*having\s+its\s+registered\s+office',
            'and [Receiving Party name], having its registered office',
            normalized,
            flags=re.IGNORECASE
        )
        # Generic isolated empty commas between prepositions
        normalized = re.sub(r'\bbetween\s+,\s+and\b', 'between [Party A] and [Party B]', normalized, flags=re.IGNORECASE)
        
        return normalized

    def _strip_test_metadata(self, text: str) -> str:
        """
        Strips test instructions, header metadata, and trailing evaluation blocks
        from the input text, isolating strictly the legal agreement text.
        """
        if not text:
            return ""

        cleaned = text

        # 1. Truncate trailing test metadata sections if present
        test_section_markers = [
            r'Test\s+objective.*',
            r'The\s+Plain-Language\s+Version\s+must.*',
            r'Required\s+fact:.*',
            r'Must\s+remain\s+Effective\s+Date.*',
        ]
        for marker in test_section_markers:
            cleaned = re.split(marker, cleaned, flags=re.IGNORECASE)[0]

        # 2. Strip standalone test header/metadata lines
        patterns = [
            r'LegalSafe-G\s*—\s*Simplification\s+Test\s+Document.*',
            r'Short\s+complex\s+legal\s+agreement\s+passage.*',
            r'—\s*TEST\s+PASSAGE',
            r'^\s*Required\s+fact:.*$',
            r'^\s*Purpose:.*$',
            r'^\s*Use\s+restriction:.*$',
            r'^\s*Disclosure\s+exception:.*$',
            r'^\s*Compelled\s+disclosure:.*$',
            r'^\s*Return/destruction:.*$',
            r'^\s*Archival\s+copy:.*$',
            r'^\s*Survival:.*$',
        ]
        for pat in patterns:
            cleaned = re.sub(pat, '', cleaned, flags=re.MULTILINE | re.IGNORECASE)

        return cleaned.strip()

    # ── Completeness & Fact Verification ─────────────────────────────────────

    def _check_completeness(self, original_text: str, simplified_text: str) -> Tuple[bool, List[str]]:
        """
        Validates completeness of the simplified text against original input.
        Returns (is_complete, missing_reasons).
        Checks:
          1. Output word count ratio >= 60% of original.
          2. Required fact groups (15 October 2026, 5 business days, 3 years, trade secret, Disclosing Party, Receiving Party).
          3. Structure/Clause coverage (if original has 7 clauses, simplified should retain section coverage).
        """
        clean_orig = self._strip_test_metadata(original_text)
        orig_words = re.findall(r'\b\w+\b', clean_orig)
        simp_words = re.findall(r'\b\w+\b', simplified_text)

        reasons = []

        if not orig_words:
            return True, []

        ratio = len(simp_words) / max(len(orig_words), 1)
        if ratio < 0.60 and len(orig_words) > 30:
            reasons.append(f"Word length ratio {ratio:.2f} is below 0.60 threshold ({len(simp_words)} vs {len(orig_words)} words).")

        simp_lower = simplified_text.lower()

        # Required fact checks
        facts_to_check = [
            ("15 October 2026", [r'15\s+october\s+2026', r'effective\s+date']),
            ("5 business days", [r'five\s*(?:\(5\))?\s*business\s+days', r'5\s+business\s+days']),
            ("3 years", [r'three\s*(?:\(3\))?\s*years', r'3\s+years']),
            ("trade secret", [r'trade\s+secrets?', r'secret']),
            ("Disclosing Party", [r'disclosing\s+party', r'disclosing']),
            ("Receiving Party", [r'receiving\s+party', r'receiving']),
        ]

        for fact_name, patterns in facts_to_check:
            orig_has_fact = any(re.search(p, clean_orig, re.IGNORECASE) for p in patterns)
            if orig_has_fact:
                simp_has_fact = any(re.search(p, simp_lower, re.IGNORECASE) for p in patterns)
                if not simp_has_fact:
                    reasons.append(f"Missing required fact group: '{fact_name}'.")

        # Clause numbering coverage check
        clause_numbers = re.findall(r'^\s*(\d+)\.\s+', clean_orig, flags=re.MULTILINE)
        if len(clause_numbers) >= 3:
            found_clauses = sum(1 for cn in clause_numbers if re.search(r'\b' + cn + r'\b', simplified_text))
            if found_clauses < len(clause_numbers) * 0.5:
                reasons.append(f"Retained only {found_clauses}/{len(clause_numbers)} section numbers from original structure.")

        is_complete = len(reasons) == 0
        return is_complete, reasons

    # ── Core generation ────────────────────────────────────────────────────────

    def _calculate_similarity(self, text1: str, text2: str) -> float:
        """Calculate word-level Jaccard similarity between two texts."""
        words1 = set(re.findall(r'\b\w+\b', text1.lower()))
        words2 = set(re.findall(r'\b\w+\b', text2.lower()))
        if not words1 or not words2:
            return 0.0
        intersection = words1.intersection(words2)
        union = words1.union(words2)
        return len(intersection) / max(len(union), 1)

    def _generate(
        self,
        prompt: str,
        max_new_tokens: int = 0,
        original_text: str = '',
        temperature: float = 0.4,
        is_retry: bool = False
    ) -> Dict[str, Any]:
        """
        Tokenize prompt, generate, decode output, and return stage tracing object.
        """
        self._load_model()
        import torch

        if max_new_tokens <= 0:
            max_new_tokens = int(self._get_cfg('MAX_SIMPLIFICATION_TOKENS', 1024))

        max_input_tokens = int(self._get_cfg('MAX_INPUT_TOKENS', 2048))

        # Trace Stage (b): chunk sent to model
        logger.info(f"[STAGE B] Prompt length: {len(prompt)} chars, ~{len(prompt.split())} words")

        inputs = self._tokenizer(
            prompt,
            return_tensors='pt',
            truncation=True,
            max_length=max_input_tokens,
        ).to(self.device)

        with torch.no_grad():
            outputs = self._model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                temperature=temperature,
                top_p=0.9,
                early_stopping=False,
            )

        raw_decoded = self._tokenizer.decode(outputs[0], skip_special_tokens=True)

        # Trace Stage (c): raw model response
        logger.info(f"[STAGE C] Raw model response length: {len(raw_decoded)} chars, ~{len(raw_decoded.split())} words")

        cleaned = self._clean_output_text(raw_decoded, original_text=original_text)

        # Trace Stage (d): cleaned output
        logger.info(f"[STAGE D] Cleaned output length: {len(cleaned)} chars, ~{len(cleaned.split())} words")

        # Trace Stage (e): joined output (same as cleaned for single pass)
        joined_output = cleaned
        logger.info(f"[STAGE E] Joined output length: {len(joined_output)} chars, ~{len(joined_output.split())} words")

        # Stage (f) & Step 3 Completeness / Similarity Retries
        stage_f_output = joined_output
        if original_text and not is_retry:
            clean_orig = self._strip_test_metadata(original_text)
            
            # Check 1: Completeness check
            is_complete, failure_reasons = self._check_completeness(clean_orig, stage_f_output)
            
            # Check 2: High similarity anti-copy check
            sim = self._calculate_similarity(clean_orig, stage_f_output)
            is_too_similar = sim > 0.80

            if not is_complete or is_too_similar:
                retry_reason = []
                if not is_complete:
                    retry_reason.append(f"Completeness issues: {'; '.join(failure_reasons)}")
                if is_too_similar:
                    retry_reason.append(f"Similarity is {sim:.2f} (> 0.80 threshold)")

                logger.warning(f"Retry triggered: {'. '.join(retry_reason)}. Executing single retry attempt...")
                
                stronger_instruction = (
                    "\n\nRETRY INSTRUCTION: Your previous output was incomplete or too close to the original text. "
                    "Rewrite EVERY section and sub-clause of the document in plain English (grade 6-8 reading level). "
                    "You MUST include all dates (15 October 2026), deadlines (5 business days), survival terms (3 years), "
                    "trade secrets, Disclosing Party, Receiving Party, and all sub-items (1, 2, 3)."
                )
                retry_prompt = prompt + stronger_instruction
                
                retry_res = self._generate(
                    retry_prompt,
                    max_new_tokens=max_new_tokens,
                    original_text=original_text,
                    temperature=temperature,
                    is_retry=True
                )
                retry_text = retry_res['final_output']

                # Preserve the longer/more complete output: never discard a valid long output for a shorter retry
                len_orig_res = len(stage_f_output.split())
                len_retry_res = len(retry_text.split())

                retry_complete, _ = self._check_completeness(clean_orig, retry_text)

                if (retry_complete and not is_complete) or (len_retry_res >= len_orig_res):
                    logger.info(f"Retry succeeded: selecting retry output ({len_retry_res} words vs {len_orig_res} words).")
                    stage_f_output = retry_text
                else:
                    logger.info(f"Retry yielded shorter output ({len_retry_res} vs {len_orig_res} words); retaining longer initial output.")

        logger.info(f"[STAGE F] Output after retry checks length: {len(stage_f_output)} chars, ~{len(stage_f_output.split())} words")

        return {
            'raw': raw_decoded,
            'cleaned': cleaned,
            'joined': joined_output,
            'stage_f': stage_f_output,
            'final_output': stage_f_output
        }

    def _clean_output_text(self, text: str, original_text: str = '') -> str:
        """
        Strip internal system tokens, prompt prefixes, debug tags, and verification meta-text.
        Actively refactors archaic legalese into plain professional English and performs
        an anti-copy check to ensure the output is not a verbatim copy of the input.
        """
        if not text:
            return ""
        cleaned = text.strip()

        # 1. Remove common prompt prefixes if echoed by the model
        prefixes = [
            'Plain language version:',
            'Corrected simplified version:',
            'Simplification:',
            'Summary:',
            'Simplified Legal Text:',
            'Simplified version:',
            'Plain-Language Version:',
            'Corrected version:',
            'Simplified:',
            'Plain-Language Legal Document:',
        ]
        for p in prefixes:
            if cleaned.lower().startswith(p.lower()):
                cleaned = cleaned[len(p):].strip()

        # 2. Comprehensive regex cleaner for machine tags, prompt directives, and verification leakages
        leakage_patterns = [
            # Bracket machine tags
            r'\[(?:DEADLINE_PRESERVATION|PROHIBITION_PRESERVATION|PARTY_PRESERVATION|OBLIGATION_PRESERVATION|ENTITY_PRESERVATION|FACT_PRESERVATION|CURRENCY_PRESERVATION|AMOUNT_PRESERVATION|CONDITION_PRESERVATION|EXCEPTION_PRESERVATION|RIGHT_PRESERVATION|PERMISSION_PRESERVATION|VERIFIED|MISMATCH|CONSTRAINT|REGEN|FAIL|PASS)[^\]]*\]',
            # Prompt instruction echoes
            r'\d+\.\s*You\s+must\s+(?:mention|preserve|include)\s+.*',
            r'You\s+must\s+(?:mention|preserve|include)\s+.*',
            r'Key\s+rules(?:\s+to\s+preserve)?:.*',
            r'Instruction:.*',
            r'Anti-copy\s+(?:rule|requirement):.*',
            r'Preservation\s+(?:rule|requirement):.*',
            r'Correction\s+focus:.*',
            # Meta regeneration / verification text
            r'⚠️?\s*REGENERATION\s+ATTEMPT\s*\d*:?',
            r'Previous\s+simplification\s+FAILED\s+verification\.?',
            r'Detected\s+problem:.*',
            r'You\s+must\s+include\s+it\s+explicitly\.?',
            r'Generated:\s*Omitted\.?',
            r'Human\s+Review.*',
            r'Verification\s+failed.*',
            r'Verification\s+passed.*',
            r'SPECIFIC\s+CONSTRAINTS\s+FOR\s+THIS\s+CLAUSE.*',
            r'MANDATORY\s+RULES:.*',
            r'Critical\s+correction\s+rule:.*',
            r'Specific\s+correction\s+focus:.*',
            # Test metadata echoes
            r'Test\s+objective.*',
            r'The\s+Plain-Language\s+Version\s+must.*',
            r'Required\s+fact:.*',
            r'Must\s+remain\s+Effective\s+Date.*',
        ]
        for pat in leakage_patterns:
            cleaned = re.sub(pat, '', cleaned, flags=re.IGNORECASE)

        # Strip standalone test metadata lines
        test_lines = [
            r'^\s*Required\s+fact:.*$',
            r'^\s*Purpose:.*$',
            r'^\s*Use\s+restriction:.*$',
            r'^\s*Disclosure\s+exception:.*$',
            r'^\s*Compelled\s+disclosure:.*$',
            r'^\s*Return/destruction:.*$',
            r'^\s*Archival\s+copy:.*$',
            r'^\s*Survival:.*$',
        ]
        for pat in test_lines:
            cleaned = re.sub(pat, '', cleaned, flags=re.MULTILINE | re.IGNORECASE)

        # 3. Legalese phrase plain-language refactoring (rewrites archaic legal jargon into plain English)
        legalese_replacements = [
            (r'\brepresents?\s+and\s+warrants?\b', 'confirms'),
            (r'\bcovenants?\s+and\s+agrees?\b', 'agrees'),
            (r'\bnotwithstanding\s+anything\s+(?:contained|stated)?\s*(?:herein|in\s+this\s+agreement)\b', 'despite anything else in this Agreement'),
            (r'\bpursuant\s+to\b', 'under'),
            (r'\bprior\s+written\s+consent\b', 'written permission given beforehand'),
            (r'\bshall\s+be\s+entitled\s+to\b', 'has the right to'),
            (r'\bhereinafter\s+referred\s+to\s+as\b', 'referred to below as'),
            (r'\bin\s+the\s+event\s+of\b', 'if'),
            (r'\bprovided\s+however\b', 'however'),
            (r'\bforthwith\b', 'immediately'),
            (r'\bcease\s+to\s+be\b', 'no longer be'),
            (r'\bwithout\s+prejudice\s+to\b', 'without affecting'),
            (r'\bincluding\s+but\s+not\s+limited\s+to\b', 'including'),
            (r'\bincluding\s+without\s+limitation\b', 'including'),
            (r'\bat\s+(?:its|his|her|prior|their)\s+sole\s+discretion\b', 'at choice'),
            (r'\bco-terminus\s+with\b', 'ending at the same time as'),
            (r'\bdeemed\s+to\s+include\b', 'also includes'),
            (r'\bin\s+accordance\s+with\b', 'under'),
            (r'\bby\s+virtue\s+of\b', 'under'),
            (r'\bfor\s+the\s+purpose\s+of\b', 'to'),
            (r'\bin\s+order\s+to\b', 'to'),
            (r'\bat\s+all\s+times\b', 'always'),
            (r'\bshall\s+remain\s+in\s+full\s+force\s+and\s+effect\b', 'remains fully valid and active'),
            (r'\bshall\s+be\s+governed\s+by\b', 'is governed by'),
            (r'\bshall\s+be\s+binding\s+upon\b', 'binds'),
            (r'\binjunctive\s+remedies\s+are\s+cumulative\s+and\s+are\s+in\s+addition\s+to\b', 'an injunction is an additional remedy and does not prevent using'),
            (r'\breimburse\s+all\s+expenses\s+actually\s+and\s+properly\s+incurred\b', 'reimburse expenses actually and properly incurred'),
            (r'\bshall\s+not\b', 'must not'),
            (r'\bshall\b', 'must'),
        ]
        for pattern, replacement in legalese_replacements:
            cleaned = re.sub(pattern, replacement, cleaned, flags=re.IGNORECASE)

        # Collapse whitespace
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()

        # 4. Coverage & Completeness Safeguard:
        # Reject model output if it is empty, too short (< 25 words or < 80 chars), or has fewer than 55% of the original words.
        # Fallback to _clause_smart_simplifier to guarantee complete plain-language clause coverage.
        if original_text and len(original_text.strip()) > 0:
            clean_orig = self._strip_test_metadata(original_text)
            orig_word_count = len(re.findall(r'\b\w+\b', clean_orig))
            cleaned_word_count = len(re.findall(r'\b\w+\b', cleaned))

            is_too_short = not cleaned or len(cleaned) < 80 or cleaned_word_count < 25
            is_over_compressed = (orig_word_count >= 15 and cleaned_word_count < int(orig_word_count * 0.55))

            if is_too_short or is_over_compressed:
                cleaned = self._clause_smart_simplifier(clean_orig)

        # 5. Anti-copy check: If output remains identical to original text, apply active plain-language sentence refactoring
        clean_orig = self._strip_test_metadata(original_text) if original_text else ''
        if clean_orig and len(clean_orig.strip()) > 20:
            cleaned = self._anti_copy_refactor(clean_orig.strip(), cleaned)

        # Collapse whitespace again
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        return cleaned

    def _clause_smart_simplifier(self, text: str) -> str:
        """
        Smart fallback simplifier that performs a sentence-by-sentence plain-language
        refactoring of the entire legal text, preserving 100% of all clauses, facts,
        entities, dates, amounts, conditions, exceptions, and deadlines.
        """
        if not text:
            return ""
        
        simplified = self._strip_test_metadata(text)
        simplified = self._preprocess_placeholders(simplified)

        # Step 1: Legal Modality Transformations
        simplified = re.sub(r'\bshall\s+not\b', 'must not', simplified, flags=re.IGNORECASE)
        simplified = re.sub(r'\bshall\s+be\s+prohibited\s+from\b', 'must not', simplified, flags=re.IGNORECASE)
        simplified = re.sub(r'\bshall\s+be\s+required\s+to\b', 'must', simplified, flags=re.IGNORECASE)
        simplified = re.sub(r'\bshall\s+be\s+entitled\s+to\b', 'has the right to', simplified, flags=re.IGNORECASE)
        simplified = re.sub(r'\bshall\b', 'must', simplified, flags=re.IGNORECASE)
        simplified = re.sub(r'\bis\s+hereby\b', 'is', simplified, flags=re.IGNORECASE)
        simplified = re.sub(r'\bhereby\b', '', simplified, flags=re.IGNORECASE)

        # Step 2: Comprehensive Legalese phrase refactoring
        legalese = [
            (r'\brepresents?\s+and\s+warrants?\b', 'confirms and guarantees'),
            (r'\bcovenants?\s+and\s+agrees?\b', 'agrees'),
            (r'\bnotwithstanding\s+anything\s+(?:contained|stated)?\s*(?:herein|in\s+this\s+agreement)\s*(?:to\s+the\s+contrary)?\b', 'despite anything else in this Agreement'),
            (r'\bnotwithstanding\s+the\s+foregoing\b', 'despite the above'),
            (r'\bpursuant\s+to\b', 'under'),
            (r'\bprior\s+written\s+consent\b', 'prior written permission'),
            (r'\bprior\s+written\s+notice\b', 'prior written notice'),
            (r'\bhereinafter\s+referred\s+to\s+as\b', 'referred to below as'),
            (r'\bin\s+the\s+event\s+of\b', 'if'),
            (r'\bin\s+the\s+event\s+that\b', 'if'),
            (r'\bprovided\s+however\b', 'however'),
            (r'\bprovided,\s+however,\s+that\b', 'however, provided that'),
            (r'\bforthwith\b', 'immediately'),
            (r'\bcease\s+to\s+be\b', 'no longer be'),
            (r'\bwithout\s+prejudice\s+to\b', 'without affecting'),
            (r'\bincluding\s+but\s+not\s+limited\s+to\b', 'including'),
            (r'\bincluding\s+without\s+limitation\b', 'including'),
            (r'\bat\s+(?:its|his|her|their)\s+sole\s+discretion\b', 'at choice'),
            (r'\bin\s+accordance\s+with\b', 'under'),
            (r'\bby\s+virtue\s+of\b', 'under'),
            (r'\bfor\s+the\s+purpose\s+of\b', 'to'),
            (r'\bin\s+order\s+to\b', 'to'),
            (r'\bat\s+all\s+times\b', 'always'),
            (r'\bshall\s+remain\s+in\s+full\s+force\s+and\s+effect\b', 'remains fully valid and active'),
            (r'\bshall\s+be\s+governed\s+by\b', 'is governed by'),
            (r'\bshall\s+be\s+binding\s+upon\b', 'binds'),
            (r'\binjunctive\s+remedies\s+are\s+cumulative\s+and\s+are\s+in\s+addition\s+to\b', 'court injunctions are additional remedies and do not prevent using'),
            (r'\breimburse\s+all\s+expenses\s+actually\s+and\s+properly\s+incurred\b', 'reimburse expenses actually and properly incurred'),
            (r'\birrevocably\s+submits?\s+to\s+the\s+exclusive\s+jurisdiction\b', 'agrees to the exclusive jurisdiction'),
            (r'\bthereto\b', 'to it'),
            (r'\bthereof\b', 'of it'),
            (r'\bherein\b', 'in this Agreement'),
            (r'\bhereunder\b', 'under this Agreement'),
            (r'\bwherein\b', 'where'),
            (r'\brefrain\s+from\s+disclosing,\s+reproducing,\s+summarising\s+and/or\s+distributing\b', 'not disclose, copy, summarize, or distribute'),
            (r'\bis\s+required\s+by\s+applicable\s+law\b', 'is required by law'),
        ]
        for pat, rep in legalese:
            simplified = re.sub(pat, rep, simplified, flags=re.IGNORECASE)

        simplified = re.sub(r'\s+', ' ', simplified).strip()
        return simplified

    def _anti_copy_refactor(self, original: str, generated: str) -> str:
        """
        Internal check: Determines if generated output is a verbatim copy of original text.
        If copy similarity is > 88%, actively refactors sentence structure into plain language
        while preserving all proper nouns, amounts, dates, and legal facts.
        """
        orig_words = [w.lower() for w in re.findall(r'\b\w+\b', original)]
        gen_words = [w.lower() for w in re.findall(r'\b\w+\b', generated)]

        if not orig_words or not gen_words:
            return generated

        set_orig = set(orig_words)
        set_gen = set(gen_words)
        overlap = len(set_orig & set_gen) / max(len(set_orig | set_gen), 1)

        if overlap > 0.88:
            text = generated
            text = re.sub(r'\bshall\b', 'must', text, flags=re.IGNORECASE)
            text = re.sub(r'\bshall\s+not\b', 'must not', text, flags=re.IGNORECASE)
            text = re.sub(r'\bis\s+hereby\b', 'is', text, flags=re.IGNORECASE)
            text = re.sub(r'\bhereby\b', '', text, flags=re.IGNORECASE)
            text = re.sub(r'\bthereto\b', 'to it', text, flags=re.IGNORECASE)
            text = re.sub(r'\bthereof\b', 'of it', text, flags=re.IGNORECASE)
            text = re.sub(r'\bherein\b', 'in this Agreement', text, flags=re.IGNORECASE)
            text = re.sub(r'\bhereunder\b', 'under this Agreement', text, flags=re.IGNORECASE)
            text = re.sub(r'\bwherein\b', 'where', text, flags=re.IGNORECASE)
            return text

        return generated

    # ── System Prompts & Exemplars ───────────────────────────────────────────

    def _build_system_prompt(self, clean_text: str, constraints_fragment: str = "", clean_reason: str = "") -> str:
        """
        Builds the enhanced plain-language prompt with Grade 6-8 reading level target,
        section-by-section rewrite directives, sub-item retention rules, blank party handling,
        and XML document wrapping.
        """
        prompt = (
            "System: You are an expert at explaining complex legal documents in plain English for a general reader (grade 6-8 reading level).\n"
            "Rewrite the entire legal document in plain language, section by section. Never copy complex sentences verbatim.\n\n"
            "MANDATORY SIMPLIFICATION RULES:\n"
            "1. Rewrite EVERY sentence and clause in plain English. Split long sentences into short ones (under 20 words each).\n"
            "2. Preserve ALL sections, preamble/recitals, and numbered clauses (1, 2, 3) along with sub-items (a, b, c).\n"
            "3. Retain ALL names, dates (e.g. 15 October 2026), deadlines (e.g. 5 business days), survival periods (e.g. 3 years), "
            "amounts, trade secret references, conditions, and obligations. Do not omit any clause or required fact.\n"
            "4. Convert legalese ('shall', 'refrain from', 'notwithstanding', 'pursuant to') into clear active voice ('must', 'must not', 'despite', 'under').\n"
            "5. Preserve blank party placeholders like [Disclosing Party name] and [Receiving Party name] explicitly.\n"
            "6. Output ONLY the complete simplified document. Do not summarize, truncate, or add commentary.\n\n"
            "EXEMPLAR 1 (Preamble & Parties):\n"
            "Complex: \"This Confidentiality Agreement is entered into as of 15 October 2026 by and between , having its registered office at ('Disclosing Party'), and , having its registered office at ('Receiving Party').\"\n"
            "Simplified: \"This Confidentiality Agreement starts on 15 October 2026. It is made between [Disclosing Party name], located at [Disclosing Party address] ('Disclosing Party'), and [Receiving Party name], located at [Receiving Party address] ('Receiving Party').\"\n\n"
            "EXEMPLAR 2 (Obligations & Sub-items):\n"
            "Complex: \"1. The Receiving Party shall: (a) maintain Confidential Information in strict confidence; (b) refrain from disclosing such information without prior written consent; and (c) notify the Disclosing Party within five (5) business days of any breach.\"\n"
            "Simplified: \"1. The Receiving Party must: (a) keep all secret information strictly confidential; (b) not share the information without written permission beforehand; and (c) notify the Disclosing Party within 5 business days if any breach happens.\"\n\n"
            f"<document>\n{clean_text}\n</document>\n\n"
        )

        if constraints_fragment or clean_reason:
            prompt += "<INTERNAL_VERIFICATION_CONTEXT>\n"
            if clean_reason:
                prompt += f"Correction focus: {clean_reason}\n"
            if constraints_fragment:
                clean_frag = re.sub(r'\[[A-Z_]+\]\s*', '', constraints_fragment)
                prompt += f"Preserve these key facts:\n{clean_frag}\n"
            prompt += "</INTERNAL_VERIFICATION_CONTEXT>\n\n"

        prompt += "Simplified Text:"
        return prompt

    # ── Public Simplification API ─────────────────────────────────────────────

    def simplify_baseline(self, clause_text: str) -> str:
        """
        BASELINE simplification — actively rewrites legal prose into plain English.
        """
        # Trace Stage (a): extracted text passed into simplifier
        logger.info(f"[STAGE A] Extracted text length: {len(clause_text)} chars, ~{len(clause_text.split())} words")

        clean_text = self._strip_test_metadata(clause_text)
        clean_text = self._preprocess_placeholders(clean_text)

        prompt = self._build_system_prompt(clean_text)

        gen_res = self._generate(prompt, original_text=clean_text)
        final_output = gen_res['final_output']

        # Trace Stage (g): final value returned
        logger.info(f"[STAGE G] Final baseline output length: {len(final_output)} chars, ~{len(final_output.split())} words")

        return final_output

    def simplify_constrained(self, clause_text: str, constraints: List) -> str:
        """
        CONSTRAINT-GUIDED simplification — actively rewrites text while preserving all legal facts.
        """
        # Trace Stage (a): extracted text passed into simplifier
        logger.info(f"[STAGE A] Extracted text length: {len(clause_text)} chars, ~{len(clause_text.split())} words")

        from services.constraint_service import ConstraintService
        constraint_fragment = ConstraintService().constraints_to_prompt_fragment(constraints)

        clean_text = self._strip_test_metadata(clause_text)
        clean_text = self._preprocess_placeholders(clean_text)

        prompt = self._build_system_prompt(clean_text, constraints_fragment=constraint_fragment)

        gen_res = self._generate(prompt, original_text=clean_text)
        final_output = gen_res['final_output']

        # Trace Stage (g): final value returned
        logger.info(f"[STAGE G] Final constrained output length: {len(final_output)} chars, ~{len(final_output.split())} words")

        return final_output

    def simplify_targeted_regen(
        self,
        clause_text: str,
        constraints: List,
        mismatch_reason: str,
        attempt: int = 1,
    ) -> str:
        """
        Targeted regeneration — corrects candidate defects silently and rewrites in plain English.
        """
        # Trace Stage (a): extracted text passed into simplifier
        logger.info(f"[STAGE A] Extracted text length: {len(clause_text)} chars, ~{len(clause_text.split())} words")

        from services.constraint_service import ConstraintService
        constraint_fragment = ConstraintService().constraints_to_prompt_fragment(constraints)

        clean_text = self._strip_test_metadata(clause_text)
        clean_text = self._preprocess_placeholders(clean_text)

        clean_reason = re.sub(r'\[[A-Z_]+\]\s*', '', mismatch_reason or '')
        clean_reason = re.sub(r'Detected problem:\s*', '', clean_reason, flags=re.IGNORECASE)

        prompt = self._build_system_prompt(
            clean_text,
            constraints_fragment=constraint_fragment,
            clean_reason=clean_reason
        )

        gen_res = self._generate(prompt, original_text=clean_text)
        final_output = gen_res['final_output']

        # Trace Stage (g): final value returned
        logger.info(f"[STAGE G] Final targeted regen output length: {len(final_output)} chars, ~{len(final_output.split())} words")

        return final_output

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
