import fitz  # PyMuPDF
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def extract_pdf(file_path: str) -> Dict[str, Any]:
    """
    Extract text and metadata from a PDF file using PyMuPDF.
    Detects if pages are scanned (i.e., contain images but no text).
    """
    logger.info(f"Extracting PDF: {file_path}")
    result = {
        'pages': [],
        'raw_text': '',
        'metadata': {},
        'has_scanned_pages': False
    }
    
    try:
        doc = fitz.open(file_path)
        result['metadata'] = doc.metadata
        
        full_text = []
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            text = page.get_text()
            
            # Simple heuristic for scanned page: no text but has images
            is_scanned = False
            if not text.strip() and page.get_images():
                is_scanned = True
                result['has_scanned_pages'] = True
                
            page_data = {
                'page_number': page_num + 1,
                'text': text,
                'is_scanned': is_scanned
            }
            result['pages'].append(page_data)
            full_text.append(text)
            
        result['raw_text'] = '\n'.join(full_text)
        doc.close()
        
    except Exception as e:
        logger.error(f"Error extracting PDF {file_path}: {e}")
        raise
        
    return result
