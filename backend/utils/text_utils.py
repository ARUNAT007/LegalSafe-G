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
    """Extracts currency amounts including INR (Rs, ₹) and international ($)."""
    # Pattern looks for ₹, Rs, Rs., $, €, £ followed by numbers, commas, decimals
    pattern = r'(?:₹|Rs\.?|\$|€|£)\s*\d+(?:,\d{3})*(?:\.\d{1,2})?'
    matches = re.findall(pattern, text, re.IGNORECASE)
    return [m.strip() for m in matches]

def extract_dates(text: str) -> List[str]:
    """Extracts dates in various formats."""
    # Simple regex for DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
    pattern = r'\b(?:\d{1,2}[-/thstndrd\s]+\w+[-/\s]+\d{2,4}|\d{2,4}[-/]\d{1,2}[-/]\d{1,2})\b'
    matches = re.findall(pattern, text)
    return [m.strip() for m in matches]

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
