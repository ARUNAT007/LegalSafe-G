import re
import logging
from typing import List
from werkzeug.utils import secure_filename as werkzeug_secure_filename

logger = logging.getLogger(__name__)

def normalize_whitespace(text: str) -> str:
    """Normalizes multiple spaces and newlines."""
    if not text:
        return ""
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_currency_amounts(text: str) -> List[str]:
    """Extracts currency amounts including INR (Rs, ₹, INR) and international ($, €, £, USD, EUR, GBP)."""
    if not text:
        return []
    # Pattern captures ₹, Rs., Rs, INR, $, €, £, USD, EUR, GBP with standard and Indian numbering (1,00,000)
    pattern = r'(?:₹|Rs\.?|INR|\$|€|£|USD|EUR|GBP)\s*\d+(?:,\d{2,3})*(?:\.\d{1,2})?|\b\d+(?:,\d{2,3})*(?:\.\d{1,2})?\s*(?:Rupees|Dollars|Euros|Pounds|INR|USD)\b'
    matches = re.findall(pattern, text, re.IGNORECASE)
    return [m.strip() for m in matches]

def extract_dates(text: str) -> List[str]:
    """Extracts dates and deadlines in various formats (ISO, Indian, ordinal, month names, relative)."""
    if not text:
        return []
    patterns = [
        # Standard numeric dates: 15/10/2026, 2026-10-15, 15.10.2026
        r'\b\d{1,4}[-/\.]\d{1,2}[-/\.]\d{1,4}\b',
        # Verbal dates: 15th October 2026, October 15, 2026, 15 Oct 2026
        r'\b\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{2,4}\b',
        r'\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*|\s+)\d{2,4}\b',
        # Monthly/Day deadlines: 5th day of each month, 1st of every month
        r'\b\d{1,2}(?:st|nd|rd|th)?\s+day\s+of\s+(?:each|every|the)\s+month\b',
        # Relative durations: within 30 days, 15 business days
        r'\bwithin\s+\d+\s+(?:business\s+)?(?:days?|months?|years?|weeks?|hours?)\b',
    ]
    combined_pattern = '|'.join(patterns)
    matches = re.findall(combined_pattern, text, re.IGNORECASE)
    # Deduplicate while preserving order
    seen = set()
    result = []
    for m in matches:
        cleaned = m.strip()
        if cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            result.append(cleaned)
    return result

def contains_legal_negation(text: str) -> bool:
    """Checks if text contains legal negations like 'notwithstanding', 'without prejudice', etc."""
    negations = [
        r'\bnotwithstanding\b',
        r'\bwithout prejudice\b',
        r'\bexcept as\b',
        r'\bprovided that\b',
        r'\bunless\b',
        r'\bshall not\b',
        r'\bmay not\b',
        r'\bnull and void\b'
    ]
    pattern = '|'.join(negations)
    return bool(re.search(pattern, text, re.IGNORECASE))

def safe_filename(filename: str) -> str:
    """Returns a safe filename."""
    return werkzeug_secure_filename(filename)

def truncate_text(text: str, max_length: int = 100) -> str:
    """Truncates text with ellipsis."""
    if not text:
        return ""
    return text if len(text) <= max_length else text[:max_length-3] + "..."

def split_into_sentences(text: str) -> List[str]:
    """Basic sentence splitter based on punctuation."""
    # This is a naive implementation; for better results use spaCy.
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]
