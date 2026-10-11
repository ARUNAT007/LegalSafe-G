import logging
import re
from typing import List, Dict

logger = logging.getLogger(__name__)

class ClauseService:
    """Service to segment legal text into clauses."""
    
    def segment(self, text: str) -> List[Dict[str, str]]:
        """
        Segments text by numbered clauses, headings, and paragraphs.
        Returns a list of dicts with keys: clause_id, section, text.
        """
        if not text:
            return []
            
        # 1. Normalize linebreaks
        raw = text.replace('\r\n', '\n')
        
        # 2. Split by double newlines or numbered clause headers (e.g., "1.", "Clause 1", "WHEREAS")
        raw_blocks = re.split(r'\n{2,}|(?<=\n)(?=(?:\d+\.|\bClause\s+\d+|\bSection\s+\d+|\bArticle\s+\d+|WHEREAS,)\s+)', raw)
        paragraphs = [p.strip() for p in raw_blocks if p.strip()]
        
        clauses = []
        clause_counter = 1
        current_section = "General"
        
        for p in paragraphs:
            if len(p) < 100 and p.isupper() and not p.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.')):
                current_section = p
                continue
                
            match = re.match(r'^((?:\d+\.)+\d*|Article\s+\d+|Section\s+\d+|Clause\s+\d+)\s*(.*)', p, re.IGNORECASE | re.DOTALL)
            
            if match:
                clause_id = match.group(1).strip()
                content = p
            else:
                clause_id = f"clause_{clause_counter}"
                content = p
                clause_counter += 1
                
            clauses.append({
                'clause_id': clause_id,
                'section': current_section,
                'text': content
            })
            
        return clauses
