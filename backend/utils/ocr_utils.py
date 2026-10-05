import logging
import io
from typing import Optional
from PIL import Image

logger = logging.getLogger(__name__)

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("pytesseract not installed. OCR will gracefully degrade.")

def perform_ocr(image_path_or_bytes: str | bytes) -> str:
    """
    Perform OCR on an image using pytesseract.
    Gracefully handles missing tesseract installation.
    """
    if not TESSERACT_AVAILABLE:
        logger.warning("OCR requested but pytesseract is not available.")
        return ""
        
    try:
        if isinstance(image_path_or_bytes, bytes):
            img = Image.open(io.BytesIO(image_path_or_bytes))
        else:
            img = Image.open(image_path_or_bytes)
            
        text = pytesseract.image_to_string(img)
        return text
    except Exception as e:
        logger.error(f"Error during OCR: {e}")
        # Could be missing tesseract executable
        return ""

def pdf_page_to_image(page) -> Optional[bytes]:
    """
    Helper to convert a PyMuPDF page to image bytes for OCR.
    """
    try:
        pix = page.get_pixmap()
        return pix.tobytes("png")
    except Exception as e:
        logger.error(f"Error converting PDF page to image: {e}")
        return None
