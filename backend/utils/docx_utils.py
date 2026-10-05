import docx
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def extract_docx(file_path: str) -> Dict[str, Any]:
    """
    Extract text and metadata from a DOCX file using python-docx.
    """
    logger.info(f"Extracting DOCX: {file_path}")
    result = {
        'paragraphs': [],
        'raw_text': '',
        'metadata': {}
    }
    
    try:
        doc = docx.Document(file_path)
        
        # Extract core properties
        core_props = doc.core_properties
        result['metadata'] = {
            'author': core_props.author,
            'title': core_props.title,
            'subject': core_props.subject,
            'created': str(core_props.created) if core_props.created else None,
            'modified': str(core_props.modified) if core_props.modified else None
        }
        
        full_text = []
        for i, para in enumerate(doc.paragraphs):
            text = para.text
            result['paragraphs'].append({
                'index': i,
                'text': text,
                'style': para.style.name if para.style else None
            })
            if text.strip():
                full_text.append(text)
                
        result['raw_text'] = '\n'.join(full_text)
        
    except Exception as e:
        logger.error(f"Error extracting DOCX {file_path}: {e}")
        raise
        
    return result
