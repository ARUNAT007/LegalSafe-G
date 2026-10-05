import os
import logging
from typing import Dict, Any

from utils.pdf_utils import extract_pdf
from utils.docx_utils import extract_docx
# from utils.ocr_utils import perform_ocr, pdf_page_to_image

logger = logging.getLogger(__name__)

class DocumentService:
    """Service to handle document extraction."""
    
    def extract(self, file_path: str, filename: str = None) -> Dict[str, Any]:
        """
        Extracts content from PDF, DOCX, or TXT.
        Returns a standard DocumentResult dict.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        ext = file_path.rsplit('.', 1)[-1].lower()
        
        result = {
            'file_path': file_path,
            'filename': filename or os.path.basename(file_path),
            'extension': ext,
            'raw_text': '',
            'metadata': {},
            'has_scanned_pages': False,
        }
        
        try:
            if ext == 'pdf':
                pdf_result = extract_pdf(file_path)
                result['raw_text'] = pdf_result['raw_text']
                result['metadata'] = pdf_result['metadata']
                # TODO: Integrate OCR if has_scanned_pages is True
            elif ext == 'docx':
                docx_result = extract_docx(file_path)
                result['raw_text'] = docx_result['raw_text']
                result['metadata'] = docx_result['metadata']
            elif ext == 'txt':
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        result['raw_text'] = f.read()
                except UnicodeDecodeError:
                    with open(file_path, 'r', encoding='latin-1', errors='replace') as f:
                        result['raw_text'] = f.read()
            else:
                raise ValueError(
                    f"Unsupported file extension: .{ext}. Please upload a supported PDF, DOCX, or TXT file."
                )
                
            if not result['raw_text'].strip():
                raise ValueError("No readable text was found in the uploaded document.")

            return result
            
        except Exception as e:
            logger.error(f"Extraction failed for {file_path}: {e}")
            raise
