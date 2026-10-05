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
            
        clauses = []
        
        # Naive segmentation based on numbered lists (e.g., "1.", "1.1", "Article 1")
        # Split text into paragraphs first
        paragraphs = [p.strip() for p in re.split(r'\n{2,}', text) if p.strip()]
        
        clause_counter = 1
        current_section = "General"
        
        for p in paragraphs:
            # Check if paragraph looks like a heading
            if len(p) < 100 and p.isupper():
                current_section = p
                continue
                
            # Check if paragraph starts with a number
            match = re.match(r'^((?:\d+\.)+\d*|Article\s+\d+|Section\s+\d+)\s*(.*)', p, re.IGNORECASE)
            
            if match:
                clause_id = match.group(1).strip()
                content = match.group(2).strip()
                if not content:
                    content = p # Fallback
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
