import logging
from typing import List
import re

from utils.text_utils import normalize_whitespace

logger = logging.getLogger(__name__)

class PreprocessingService:
    """Service for safe preprocessing of legal text."""
    
    def __init__(self):
        self.difficult_terms = {
            'indemnify', 'liability', 'warranty', 'covenant', 
            'easement', 'encumbrance', 'sublet', 'sublease', 
            'lien', 'arbitration', 'jurisdiction', 'force majeure', 
            'liquidated damages', 'notwithstanding', 'heretofore', 'herein'
        }

    def get_difficult_terms(self) -> set:
        """Returns the set of difficult legal terms."""
        return self.difficult_terms

    def preprocess(self, text: str) -> str:
        """
        Safely preprocess text while preserving legal negations, 
        dates, currency, and legal terms.
        """
        if not text:
            return ""
            
        # 1. Normalize whitespace
        text = normalize_whitespace(text)
        
        # In a real implementation, we would use a more sophisticated approach
        # (e.g., masking) to ensure dates, amounts, and negations are not corrupted.
        # For now, normalization is the primary step.
        
        return text
