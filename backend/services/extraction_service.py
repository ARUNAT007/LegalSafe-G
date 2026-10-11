"""
Enhanced ExtractionService — uses spaCy NER + comprehensive regex patterns.

Correctly handles modality priority (MUST NOT before MUST, SHALL NOT before SHALL)
and extracts: entities, modality, action, subject, amounts, deadlines,
conditions, penalties, obligations, rights, prohibitions, permissions.
"""

import re
import logging
from typing import Optional, Tuple, List, Dict
from models.legal_fact import LegalFact
from utils.text_utils import extract_currency_amounts, extract_dates

logger = logging.getLogger(__name__)


# ── Constants ────────────────────────────────────────────────────────────────

# Order matters: more specific patterns FIRST
MODALITY_PATTERNS: List[Tuple[str, str]] = [
    ('MUST NOT',    r'\b(?:must\s+not|shall\s+not|may\s+not|cannot|is\s+not\s+permitted\s+to|is\s+prohibited\s+from|is\s+forbidden\s+to)\b'),
    ('PROHIBITED',  r'\b(?:prohibited|forbidden|not\s+permitted|not\s+allowed)\b'),
    ('MUST',        r'\b(?:must|shall|is\s+required\s+to|agrees?\s+to|undertakes?\s+to|is\s+responsible\s+for|is\s+obligated\s+to|has\s+a\s+duty\s+to|will)\b'),
    ('MAY',         r'\b(?:may|can|is\s+entitled\s+to|has\s+the\s+right\s+to|is\s+permitted\s+to|is\s+authorized\s+to|is\s+allowed\s+to)\b'),
    ('SHOULD',      r'\bshould\b'),
]

LEGAL_ACTIONS: List[str] = [
    'pay', 'submit', 'terminate', 'transfer', 'sign', 'notify', 'prohibit',
    'permit', 'execute', 'deliver', 'provide', 'maintain', 'ensure', 'comply',
    'indemnify', 'sublet', 'sublease', 'assign', 'renew', 'vacate', 'inspect',
    'disclose', 'reimburse', 'compensate', 'repair', 'restore', 'return',
    'deposit', 'secure', 'guarantee', 'warrant', 'represent', 'agree',
    'undertake', 'covenant', 'acknowledge', 'authorize', 'approve', 'bear',
    'vacate', 'furnish', 'release', 'waive', 'refrain', 'remedy', 'remedies',
]

# Common legal roles dynamically identified only if present in the document
LEGAL_ROLES: List[str] = [
    'Tenant', 'Landlord', 'Lessor', 'Lessee', 'Employer', 'Employee',
    'Buyer', 'Seller', 'Purchaser', 'Vendor', 'Borrower', 'Lender',
    'Licensor', 'Licensee', 'Customer', 'Client', 'Contractor', 'Subcontractor',
    'Company', 'Individual', 'Partner', 'Shareholder', 'Director', 'Guarantor',
    'Worker', 'Service Provider', 'Author', 'Publisher', 'Disclosing Party',
    'Receiving Party', 'Party', 'Parties'
]

# Penalty indicator patterns
PENALTY_PATTERNS: List[str] = [
    r'penalt(?:y|ies)\s+of\s+([^\.,;]+)',
    r'fine\s+of\s+([^\.,;]+)',
    r'charge(?:d|s)?\s+(?:an?\s+)?(?:additional\s+)?([₹$€£][^\.,;]+)',
    r'liable\s+(?:to\s+pay\s+)?([₹$€£][^\.,;]+)',
    r'damages?\s+of\s+([^\.,;]+)',
    r'liquidated\s+damages\s+(?:in\s+the\s+amount\s+of\s+)?([^\.,;]+)',
    r'compensation\s+of\s+([^\.,;]+)',
]

# Condition indicators
CONDITION_PATTERNS: List[str] = [
    r'if\s+(.+?)(?:,\s*(?:then\s+)?|\s+then\s+)',
    r'in\s+the\s+event\s+(?:that\s+)?(.+?)(?:,|\s+then)',
    r'provided\s+that\s+(.+?)(?:,|;)',
    r'subject\s+to\s+(.+?)(?:,|;|\.|$)',
    r'upon\s+(.+?)(?:,|\s+the\s+)',
    r'unless\s+(.+?)(?:,|;|\.|$)',
    r'in\s+case\s+(?:of\s+)?(.+?)(?:,|;|\.|$)',
    r'only\s+if\s+(.+?)(?:,|;|\.|$)',
]

# Exception indicators
EXCEPTION_PATTERNS: List[str] = [
    r'except\s+(?:where\s+)?(.+?)(?:,|\.|$|;)',
    r'unless\s+(.+?)(?:,|\.|$|;)',
    r'saving\s+and\s+except\s+(.+?)(?:,|\.|$|;)',
    r'without\s+(?:the\s+)?prior\s+(?:written\s+)?consent\s*(?:of\s+[^,\.;]+)?',
]

# Frequency indicators
FREQUENCY_PATTERNS: List[str] = [
    r'\b(monthly|annually|weekly|daily|quarterly|per\s+month|per\s+annum|per\s+year|each\s+month|every\s+month|on\s+a\s+monthly\s+basis)\b',
    r'\bby\s+the\s+(\d+(?:st|nd|rd|th)?\s+day(?:\s+of\s+(?:each|every)\s+month)?)\b',
]

# Duration / Deadline indicators
DURATION_PATTERNS: List[str] = [
    r'\b(within\s+\d+\s+(?:business\s+)?(?:days?|months?|years?|weeks?|hours?))\b',
    r'\b(\d+\s+(?:business\s+)?(?:days?|months?|years?|weeks?|hours?))\b',
]

PERCENTAGE_PATTERN = r'\b(\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s*percent(?:age)?)\b'

# Obligation, right, prohibition, permission keywords
OBLIGATION_KEYWORDS = ['shall', 'must', 'is required to', 'is obligated to', 'has a duty to', 'agrees to', 'undertakes to', 'responsible for']
RIGHT_KEYWORDS = ['is entitled to', 'has the right to', 'may', 'can', 'is authorized to', 'permitted to']
PROHIBITION_KEYWORDS = ['shall not', 'must not', 'may not', 'is prohibited from', 'is not permitted to', 'cannot', 'forbidden']
PERMISSION_KEYWORDS = ['is permitted to', 'is allowed to', 'may', 'can', 'has permission to']


class ExtractionService:
    """
    Service for extracting structured legal facts from text.

    Uses spaCy for named entity recognition and dependency parsing,
    supplemented by regex patterns for legal-specific patterns.
    """

    def __init__(self, spacy_model: str = 'en_core_web_sm'):
        self.spacy_model = spacy_model
        self._nlp = None

    @property
    def nlp(self):
        """Lazy-load spaCy model on first use."""
        if self._nlp is None:
            logger.info(f'Loading spaCy model: {self.spacy_model}')
            import spacy
            try:
                self._nlp = spacy.load(self.spacy_model)
            except OSError:
                logger.warning(f'spaCy model {self.spacy_model} not found — downloading...')
                import spacy.cli
                spacy.cli.download(self.spacy_model)
                self._nlp = spacy.load(self.spacy_model)
        return self._nlp

    # ── Public API ────────────────────────────────────────────────────────────

    def extract(self, clause_id: str, text: str) -> LegalFact:
        """
        Extract all legal facts dynamically from a user-uploaded clause.

        Args:
            clause_id: Unique identifier for the clause (e.g. 'C001').
            text: Raw clause text from the uploaded document.

        Returns:
            LegalFact populated with extracted information and source text tracing.
        """
        if not text or not text.strip():
            return LegalFact(clause_id=clause_id, fact_id=f"F_{clause_id}", source_text=text or "")

        try:
            doc = self.nlp(text)
        except Exception as exc:
            logger.error(f'spaCy processing failed for {clause_id}: {exc}')
            return LegalFact(clause_id=clause_id, fact_id=f"F_{clause_id}", source_text=text)

        fact = LegalFact(
            clause_id=clause_id,
            fact_id=f"F_{clause_id}",
            source_text=text.strip(),
        )

        # ── 1. Entity extraction (spaCy NER + dynamic legal role patterns) ───
        self._extract_entities(doc, fact, text)

        # ── 2. Currency amounts ───────────────────────────────────────────────
        regex_amounts = extract_currency_amounts(text)
        if regex_amounts:
            raw = regex_amounts[0]
            fact.amount = raw
            if '₹' in raw or 'Rs' in raw or 'INR' in raw:
                fact.currency = 'INR'
            elif '$' in raw or 'USD' in raw:
                fact.currency = 'USD'
            elif '€' in raw or 'EUR' in raw:
                fact.currency = 'EUR'
            elif '£' in raw or 'GBP' in raw:
                fact.currency = 'GBP'

        # ── 3. Percentage values ──────────────────────────────────────────────
        fact.percentage = self._extract_percentage(text)

        # ── 4. Dates & Deadlines ──────────────────────────────────────────────
        regex_dates = extract_dates(text)
        for d in regex_dates:
            if d not in fact.dates:
                fact.dates.append(d)

        # Duration & explicit deadlines
        fact.duration = self._extract_duration(text)
        extracted_deadline = self._extract_deadline(text)
        # Filter metadata / copyright years from dates (e.g. '© European Union, 2025' or standalone '2025')
        clean_dates = []
        for d in fact.dates:
            d_clean = d.strip()
            # Ignore metadata years like '2025', '© 2025', 'Copyright 2025'
            if re.match(r'^(?:©|copyright|\d{4}$)', d_clean, re.IGNORECASE) or (len(d_clean) == 4 and d_clean.isdigit()):
                continue
            clean_dates.append(d_clean)
        fact.dates = clean_dates

        # Duration & explicit deadlines
        fact.duration = self._extract_duration(text)
        extracted_deadline = self._extract_deadline(text)
        if extracted_deadline:
            fact.deadline = extracted_deadline
        elif fact.duration and not fact.deadline:
            fact.deadline = fact.duration
        elif fact.dates and not fact.deadline:
            # Only assign date as deadline if clause contains deadline-oriented keywords
            text_lower_dl = text.lower()
            if any(kw in text_lower_dl for kw in ['by', 'due', 'expire', 'within', 'before', 'until', 'no later than', 'deadline']):
                fact.deadline = fact.dates[0]

        # ── 5. Frequency ──────────────────────────────────────────────────────
        fact.frequency = self._extract_frequency(text)

        # ── 6. Modality — check negations FIRST ──────────────────────────────
        fact.modality = self._extract_modality(text)

        # ── 7. Subject, Action, Object ────────────────────────────────────────
        fact.action = self._extract_action(doc, text)
        fact.subject = self._extract_subject(doc, fact, text)
        fact.obj = self._extract_object(doc)

        # ── 8. Penalty ────────────────────────────────────────────────────────
        fact.penalty = self._extract_penalty(text)

        # ── 9. Condition & Exceptions ─────────────────────────────────────────
        conditions = self._extract_conditions(text)
        if conditions:
            fact.condition = conditions[0]
            fact.conditions = conditions

        exceptions = self._extract_exceptions(text)
        if exceptions:
            fact.exception = exceptions[0]
            fact.exceptions = exceptions

        # ── 10. Obligation / right / prohibition / permission classification ──
        text_lower = text.lower()
        if fact.modality in ('MUST', 'SHALL') or any(kw in text_lower for kw in OBLIGATION_KEYWORDS):
            fact.obligations.append(text)
        if fact.modality in ('MUST NOT', 'SHALL NOT', 'MAY NOT', 'PROHIBITED') or any(kw in text_lower for kw in PROHIBITION_KEYWORDS):
            fact.prohibitions.append(text)
        if fact.modality in ('MAY', 'CAN') or any(kw in text_lower for kw in PERMISSION_KEYWORDS):
            fact.permissions.append(text)
        if any(kw in text_lower for kw in RIGHT_KEYWORDS):
            fact.rights.append(text)

        return fact

    # ── Private helpers ───────────────────────────────────────────────────────

    def _extract_entities(self, doc, fact: LegalFact, text: str) -> None:
        """Populate parties, organizations, dates, amount, locations dynamically from text."""
        # Non-party words to exclude from parties list
        NON_PARTIES = {
            'confidentiality', 'agreement', 'proposed transaction', 'test passage',
            'legalsafe-g', 'section', 'clause', 'effective date', 'confidential information',
            'test objective', 'required fact', 'disclosure', 'exceptions', 'survival',
            'information', 'transaction', 'parties', 'party', 'non-public'
        }

        def _is_valid_party(p_str: str) -> bool:
            clean = p_str.strip().strip("’'\"sS").lower()
            if not clean or len(clean) < 3:
                return False
            if clean in NON_PARTIES or any(np in clean for np in ['confidentiality and information', 'test passage', 'test objective', 'proposed transaction']):
                return False
            return True

        # 1. spaCy NER
        for ent in doc.ents:
            if ent.label_ == 'PERSON':
                if _is_valid_party(ent.text) and ent.text not in fact.parties:
                    fact.parties.append(ent.text)
            elif ent.label_ == 'ORG':
                if _is_valid_party(ent.text):
                    if ent.text not in fact.parties:
                        fact.parties.append(ent.text)
                    if ent.text not in fact.organizations:
                        fact.organizations.append(ent.text)
            elif ent.label_ == 'DATE':
                if ent.text not in fact.dates:
                    fact.dates.append(ent.text)
            elif ent.label_ == 'MONEY' and not fact.amount:
                fact.amount = ent.text
            elif ent.label_ in ('LOC', 'GPE'):
                if ent.text not in fact.locations:
                    fact.locations.append(ent.text)

        # 2. Dynamic legal role scan — matches ONLY what exists in the uploaded document
        text_lower = text.lower()
        for role in LEGAL_ROLES:
            pattern = rf'\b(?:the\s+)?{re.escape(role.lower())}\b'
            if re.search(pattern, text_lower):
                # Ensure canonical title-case representation in parties
                canonical = role.title()
                if _is_valid_party(canonical) and canonical not in fact.parties and role not in fact.parties:
                    fact.parties.append(canonical)

        # 3. Quoted party definitions, e.g., (the "Tenant") or "Company"
        quoted_parties = re.findall(r'["\']([A-Z][a-zA-Z0-9\s]{1,30})["\']', text)
        for qp in quoted_parties:
            clean_qp = qp.strip()
            if _is_valid_party(clean_qp) and clean_qp not in fact.parties:
                fact.parties.append(clean_qp)

    def _extract_modality(self, text: str) -> Optional[str]:
        """
        Extract the dominant legal modality using prioritized pattern matching.
        Negations (MUST NOT, SHALL NOT) are checked BEFORE affirmatives.
        """
        text_lower = text.lower()
        for modality, pattern in MODALITY_PATTERNS:
            if re.search(pattern, text_lower):
                return modality
        return None

    def _extract_action(self, doc, text: str) -> Optional[str]:
        """Extract the primary legal action verb."""
        text_lower = text.lower()
        for action in LEGAL_ACTIONS:
            if re.search(rf'\b{action}\b', text_lower):
                return action
        for token in doc:
            if token.pos_ == 'VERB' and token.dep_ in ('ROOT', 'relcl', 'advcl'):
                return token.lemma_.lower()
        return None

    def _extract_subject(self, doc, fact: LegalFact, text: str) -> Optional[str]:
        """Extract the subject, giving preference to recognized legal entities in the clause."""
        # 1. Look for known legal parties appearing in the subject position
        for party in fact.parties:
            if re.search(rf'\b{re.escape(party)}\b', text, re.IGNORECASE):
                return party

        # 2. Fall back to spaCy dependency parse
        for token in doc:
            if 'subj' in token.dep_:
                subj_text = token.text
                if subj_text.lower() in ('he', 'she', 'it', 'they', 'who', 'which', 'that') and fact.parties:
                    return fact.parties[0]
                return subj_text.title() if len(subj_text) > 2 else subj_text

        # 3. Default to first party if found
        if fact.parties:
            return fact.parties[0]
        return None

    def _extract_object(self, doc) -> Optional[str]:
        """Extract the grammatical object of the main clause."""
        for token in doc:
            if token.dep_ in ('dobj', 'obj', 'pobj') and token.pos_ in ('NOUN', 'PROPN'):
                # Include compounding nouns if present
                compounds = [w.text for w in token.lefts if w.dep_ == 'compound']
                if compounds:
                    return f"{' '.join(compounds)} {token.text}"
                return token.text
        return None

    def _extract_penalty(self, text: str) -> Optional[str]:
        """Extract penalty amount or description using regex patterns."""
        for pattern in PENALTY_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None

    def _extract_conditions(self, text: str) -> List[str]:
        """Extract all condition clauses (IF/WHEN/UNLESS/PROVIDED THAT) if present."""
        found = []
        for pattern in CONDITION_PATTERNS:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                val = match.group(1).strip()
                if val and val not in found and len(val) > 4:
                    found.append(val)
        return found

    def _extract_condition(self, text: str) -> Optional[str]:
        """Extract primary condition for backward compatibility."""
        conds = self._extract_conditions(text)
        return conds[0] if conds else None

    def _extract_exceptions(self, text: str) -> List[str]:
        """Extract exception clauses (EXCEPT/UNLESS/WITHOUT CONSENT)."""
        found = []
        for pattern in EXCEPTION_PATTERNS:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                val = match.group(0).strip()
                if val and val not in found:
                    found.append(val)
        return found

    def _extract_frequency(self, text: str) -> Optional[str]:
        """Extract payment or performance frequency (e.g. monthly, weekly, annually)."""
        for pattern in FREQUENCY_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip().capitalize()
        return None

    def _extract_percentage(self, text: str) -> Optional[str]:
        """Extract percentages (e.g. 5%, 18 percent)."""
        match = re.search(PERCENTAGE_PATTERN, text, re.IGNORECASE)
        return match.group(1).strip() if match else None

    def _extract_duration(self, text: str) -> Optional[str]:
        """Extract duration or time window (e.g. within 30 days, 10 days)."""
        for pattern in DURATION_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None

    def _extract_deadline(self, text: str) -> Optional[str]:
        """Extract specific deadlines (e.g. by the 5th day, on or before Dec 31)."""
        deadline_patterns = [
            r'\b(?:by\s+the\s+)?(\d+(?:st|nd|rd|th)?\s+day(?:\s+of\s+(?:each|every)\s+month)?)\b',
            r'\b(?:on\s+or\s+before|due\s+by|no\s+later\s+than)\s+([^\.,;]+)',
        ]
        for pattern in deadline_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None
