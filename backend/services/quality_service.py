"""
SimplificationQualityService — the new "SIMPLIFICATION QUALITY CHECK" step.

Inserted between candidate generation (Step 7) and graph verification (Step 9).

Responsibilities:
  - Copy detection: is the output essentially the same words as the input?
  - Omission detection: did the output lose critical graph nodes/facts?
  - Modality flip detection: did obligation → permission or prohibition → permission?
  - Quality scoring: returns a structured QualityResult

Design principles:
  - Legal terms preserved in both texts are NOT penalised as "copies"
  - Short output is only flagged if graph nodes are actually lost
  - Uses token-level comparison — no heavy ML model needed (CPU-friendly)
"""

import re
import logging
from dataclasses import dataclass, field, asdict
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Legal terms that are EXPECTED to appear in both original and simplified ──
# These must NOT be treated as evidence of copying.
LEGAL_STOPWORDS = {
    # Modals & legal verbs
    'shall', 'must', 'may', 'will', 'should', 'agree', 'undertake',
    # Roles
    'tenant', 'landlord', 'employer', 'employee', 'buyer', 'seller',
    'party', 'parties', 'lessee', 'lessor', 'licensee', 'licensor',
    'vendor', 'purchaser', 'borrower', 'lender', 'contractor', 'client',
    'company', 'individual', 'guarantor', 'partner',
    # Common legal nouns
    'agreement', 'contract', 'clause', 'section', 'article',
    'obligation', 'right', 'duty', 'liability', 'penalty', 'damages',
    'rent', 'payment', 'amount', 'fee', 'deposit', 'notice',
    'termination', 'breach', 'default', 'confidential', 'property',
    'premises', 'term', 'period', 'date', 'day', 'days', 'month',
    'months', 'year', 'years', 'written', 'consent', 'prior',
}

# ── Modality categories for flip detection ──────────────────────────────────
OBLIGATION_MODALS = {'must', 'shall', 'is required to', 'is obligated to',
                     'agrees to', 'undertakes to', 'has a duty to',
                     'is responsible for', 'will'}
PROHIBITION_MODALS = {'must not', 'shall not', 'may not', 'cannot',
                      'is prohibited from', 'is not permitted to',
                      'is forbidden to', 'prohibited', 'forbidden'}
PERMISSION_MODALS = {'may', 'can', 'is entitled to', 'has the right to',
                     'is permitted to', 'is authorized to', 'is allowed to'}


@dataclass
class QualityResult:
    """Structured quality assessment of a simplification candidate."""
    copy_score: float = 0.0                    # 0.0–1.0 (1.0 = identical)
    is_insufficient_simplification: bool = False
    compression_ratio: float = 1.0             # simplified_len / original_len
    is_over_compressed: bool = False
    graph_preservation_ratio: float = 1.0      # gen_nodes / orig_nodes
    has_legal_omission: bool = False
    omission_details: List[str] = field(default_factory=list)
    modality_flips: List[Dict[str, str]] = field(default_factory=list)
    has_modality_flip: bool = False
    overall_quality_status: str = 'PASS'       # PASS | INSUFFICIENT_SIMPLIFICATION | LEGAL_INFORMATION_OMISSION | MODALITY_FLIP
    reason: str = ''

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ── Tokeniser ───────────────────────────────────────────────────────────────

_WORD_RE = re.compile(r'[a-z0-9₹$€£%]+', re.IGNORECASE)

def _tokenize(text: str) -> List[str]:
    """Lowercase word-level tokenisation."""
    return [w.lower() for w in _WORD_RE.findall(text or '')]

def _char_ngrams(text: str, n: int = 3) -> set:
    """Generate character n-grams from normalised text."""
    s = re.sub(r'\s+', ' ', (text or '').lower().strip())
    if len(s) < n:
        return {s}
    return {s[i:i+n] for i in range(len(s) - n + 1)}


class SimplificationQualityService:
    """
    Performs the SIMPLIFICATION QUALITY CHECK step in the pipeline.

    Reads thresholds from Flask app.config (set in config.py).
    Falls back to sensible defaults if called outside a Flask context.
    """

    def __init__(self, config: Optional[Dict] = None):
        """
        Args:
            config: dict-like object (e.g. app.config). If None, uses defaults.
        """
        self._cfg = config or {}

    def _get(self, key: str, default):
        return self._cfg.get(key, default)

    # ── Public API ──────────────────────────────────────────────────────────

    def check_quality(
        self,
        original_text: str,
        simplified_text: str,
        orig_fact,
        gen_fact,
        orig_graph=None,
        gen_graph=None,
        clause_id: str = '',
    ) -> QualityResult:
        """
        Run all quality checks on a simplification candidate.

        Args:
            original_text:  The source clause text.
            simplified_text: The generated candidate.
            orig_fact:      LegalFact from the original.
            gen_fact:       LegalFact from the candidate.
            orig_graph:     LegalGraph from the original (optional).
            gen_graph:      LegalGraph from the candidate (optional).
            clause_id:      For logging.

        Returns:
            QualityResult with all sub-scores and overall status.
        """
        result = QualityResult()

        # ── 1. Copy / insufficient simplification ────────────────────────────
        result.copy_score = self._copy_score(original_text, simplified_text)

        copy_thresh = float(self._get('COPY_SIMILARITY_THRESHOLD', 0.92))
        min_change = float(self._get('MEANINGFUL_SIMPLIFICATION_THRESHOLD', 0.15))

        structural_change = 1.0 - result.copy_score
        if result.copy_score >= copy_thresh or structural_change < min_change:
            result.is_insufficient_simplification = True
            logger.info(
                f'[{clause_id}] QUALITY: Insufficient simplification — '
                f'copy_score={result.copy_score:.3f}, '
                f'structural_change={structural_change:.3f}'
            )

        # ── 2. Compression ratio & omission ──────────────────────────────────
        orig_len = len((original_text or '').split())
        simp_len = len((simplified_text or '').split())
        result.compression_ratio = simp_len / max(orig_len, 1)

        # Graph-based omission detection
        omission_ratio = float(self._get('OMISSION_COMPRESSION_RATIO', 0.35))
        node_min = float(self._get('GRAPH_NODE_PRESERVATION_MIN', 0.50))

        if orig_graph and gen_graph:
            orig_nodes = orig_graph.node_count() if hasattr(orig_graph, 'node_count') else 0
            gen_nodes = gen_graph.node_count() if hasattr(gen_graph, 'node_count') else 0
            result.graph_preservation_ratio = gen_nodes / max(orig_nodes, 1)
        else:
            result.graph_preservation_ratio = 1.0

        # Check fact-level omission
        omission_details = self._check_fact_omission(orig_fact, gen_fact)
        result.omission_details = omission_details

        # Over-compressed: short AND losing graph nodes
        if (result.compression_ratio < omission_ratio
                and result.graph_preservation_ratio < node_min):
            result.is_over_compressed = True
            result.has_legal_omission = True
            logger.info(
                f'[{clause_id}] QUALITY: Over-compression — '
                f'compression={result.compression_ratio:.2f}, '
                f'graph_preservation={result.graph_preservation_ratio:.2f}'
            )

        # Fact-level omission: critical fields lost even if text is not dramatically shorter
        if omission_details:
            result.has_legal_omission = True
            logger.info(
                f'[{clause_id}] QUALITY: Legal fact omission — '
                f'{omission_details}'
            )

        # ── 3. Modality flip detection ───────────────────────────────────────
        result.modality_flips = self._modality_flip_check(
            orig_fact, gen_fact, clause_id
        )
        result.has_modality_flip = len(result.modality_flips) > 0

        # ── 4. Overall status ────────────────────────────────────────────────
        if result.has_modality_flip:
            result.overall_quality_status = 'MODALITY_FLIP'
            flip_desc = '; '.join(
                f'{f["original_modality"]}→{f["generated_modality"]}'
                for f in result.modality_flips
            )
            result.reason = f'Modality flip detected: {flip_desc}'
        elif result.has_legal_omission:
            result.overall_quality_status = 'LEGAL_INFORMATION_OMISSION'
            result.reason = (
                f'Critical legal facts omitted: '
                f'{", ".join(omission_details) if omission_details else "graph nodes lost"}'
            )
        elif result.is_insufficient_simplification:
            result.overall_quality_status = 'INSUFFICIENT_SIMPLIFICATION'
            result.reason = (
                f'Output is too similar to the input '
                f'(copy_score={result.copy_score:.2f}). '
                f'Rewrite with simpler vocabulary and structure.'
            )
        else:
            result.overall_quality_status = 'PASS'
            result.reason = 'Quality check passed'

        logger.info(
            f'[{clause_id}] QUALITY CHECK: status={result.overall_quality_status} '
            f'copy={result.copy_score:.2f} '
            f'compression={result.compression_ratio:.2f} '
            f'graph_pres={result.graph_preservation_ratio:.2f} '
            f'modality_flips={len(result.modality_flips)} '
            f'omissions={len(omission_details)}'
        )

        return result

    # ── Copy detection ──────────────────────────────────────────────────────

    def _copy_score(self, original: str, simplified: str) -> float:
        """
        Compute a structural similarity score between original and simplified.

        Returns 0.0–1.0 where 1.0 = identical.

        Design: legal terminology tokens are excluded from the structural
        comparison so that preserving "tenant", "₹10,000", etc. is NOT
        penalised as copying.
        """
        orig_tokens = _tokenize(original)
        simp_tokens = _tokenize(simplified)

        if not orig_tokens and not simp_tokens:
            return 1.0
        if not orig_tokens or not simp_tokens:
            return 0.0

        # Filter out legal stopwords — these are expected to be shared
        structure_orig = [t for t in orig_tokens if t not in LEGAL_STOPWORDS]
        structure_simp = [t for t in simp_tokens if t not in LEGAL_STOPWORDS]

        # Jaccard on structural (non-legal) tokens
        set_orig = set(structure_orig)
        set_simp = set(structure_simp)
        union = set_orig | set_simp
        jaccard = len(set_orig & set_simp) / max(len(union), 1)

        # Character trigram overlap (captures word-order / phrasing similarity)
        ngram_orig = _char_ngrams(original, 3)
        ngram_simp = _char_ngrams(simplified, 3)
        ngram_union = ngram_orig | ngram_simp
        ngram_overlap = len(ngram_orig & ngram_simp) / max(len(ngram_union), 1)

        # Weighted combination
        combined = 0.55 * jaccard + 0.45 * ngram_overlap

        return round(combined, 4)

    # ── Fact-level omission ─────────────────────────────────────────────────

    def _check_fact_omission(self, orig_fact, gen_fact) -> List[str]:
        """
        Check whether critical legal fact fields present in the original
        are missing in the generated output.

        Returns a list of omitted field names.
        """
        omissions = []

        def _present(val):
            if val is None:
                return False
            if isinstance(val, str):
                return len(val.strip()) > 0
            if isinstance(val, list):
                return len(val) > 0
            return bool(val)

        # Access fact fields — handle both LegalFact objects and dicts
        def _get(fact, field, default=None):
            if hasattr(fact, field):
                return getattr(fact, field, default)
            if isinstance(fact, dict):
                return fact.get(field, default)
            return default

        # Check high-priority fields
        critical_fields = [
            ('amount', 'monetary amount'),
            ('deadline', 'deadline/time limit'),
            ('penalty', 'penalty'),
            ('condition', 'condition'),
        ]

        for field_name, label in critical_fields:
            orig_val = _get(orig_fact, field_name)
            gen_val = _get(gen_fact, field_name)
            if _present(orig_val) and not _present(gen_val):
                omissions.append(label)

        # Check list fields
        list_fields = [
            ('obligations', 'obligation(s)'),
            ('prohibitions', 'prohibition(s)'),
            ('parties', 'party/entity'),
        ]

        for field_name, label in list_fields:
            orig_list = _get(orig_fact, field_name, []) or []
            gen_list = _get(gen_fact, field_name, []) or []
            if len(orig_list) > 0 and len(gen_list) == 0:
                omissions.append(label)

        return omissions

    # ── Modality flip detection ─────────────────────────────────────────────

    def _modality_flip_check(
        self, orig_fact, gen_fact, clause_id: str = ''
    ) -> List[Dict[str, str]]:
        """
        Detect dangerous modality changes:
          - obligation → permission  (shall/must → may)
          - prohibition → permission (must not → may)
          - obligation → optional

        Uses the extracted modality field from LegalFact.
        """
        flips = []

        def _get(fact, field, default=None):
            if hasattr(fact, field):
                return getattr(fact, field, default)
            if isinstance(fact, dict):
                return fact.get(field, default)
            return default

        orig_mod = (_get(orig_fact, 'modality') or '').strip().upper()
        gen_mod = (_get(gen_fact, 'modality') or '').strip().upper()

        if not orig_mod or not gen_mod:
            return []

        if orig_mod == gen_mod:
            return []

        # Classify original modality
        orig_category = self._classify_modality(orig_mod)
        gen_category = self._classify_modality(gen_mod)

        # Dangerous flips
        dangerous_transitions = [
            ('OBLIGATION', 'PERMISSION'),
            ('PROHIBITION', 'PERMISSION'),
            ('PROHIBITION', 'OBLIGATION'),  # "must not" → "must" flips meaning
            ('OBLIGATION', 'PROHIBITION'),  # less common but still a flip
        ]

        if (orig_category, gen_category) in dangerous_transitions:
            flip = {
                'original_modality': orig_mod,
                'generated_modality': gen_mod,
                'original_category': orig_category,
                'generated_category': gen_category,
                'clause_id': clause_id,
            }
            flips.append(flip)
            logger.warning(
                f'[{clause_id}] MODALITY FLIP: {orig_mod} ({orig_category}) → '
                f'{gen_mod} ({gen_category})'
            )

        return flips

    def _classify_modality(self, modality: str) -> str:
        """Classify a modality string into OBLIGATION / PROHIBITION / PERMISSION / OTHER."""
        m = modality.lower().strip()
        if 'not' in m or 'prohibited' in m or 'forbidden' in m:
            return 'PROHIBITION'
        if m in ('must', 'shall', 'will') or 'required' in m or 'obligat' in m:
            return 'OBLIGATION'
        if m in ('may', 'can') or 'entitled' in m or 'permitted' in m or 'allowed' in m:
            return 'PERMISSION'
        if m == 'should':
            return 'RECOMMENDATION'
        return 'OTHER'
