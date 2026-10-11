import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'default-dev-key')
    DEBUG = os.environ.get('DEBUG', 'True').lower() in ('true', '1', 't')
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', os.path.join(BASE_DIR, 'uploads'))
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 16 * 1024 * 1024)) # 16 MB limit
    ALLOWED_EXTENSIONS = {'txt', 'pdf', 'docx'}
    
    DATABASE_PATH = os.environ.get('DATABASE_PATH', os.path.join(BASE_DIR, 'legalsafe.db'))
    
    MODEL_NAME = os.environ.get('MODEL_NAME', 'google/flan-t5-small')
    SPACY_MODEL = os.environ.get('SPACY_MODEL', 'en_core_web_sm')
    SENTENCE_TRANSFORMER_MODEL = os.environ.get('SENTENCE_TRANSFORMER_MODEL', 'all-MiniLM-L6-v2')
    
    MAX_REGENERATION_RETRIES = int(os.environ.get('MAX_REGENERATION_RETRIES', 3))

    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')

    # ── Simplification Quality Thresholds ─────────────────────────────────────
    # Copy/insufficient-simplification: token Jaccard + n-gram combined score
    # above which the output is considered a near-copy of the input.
    COPY_SIMILARITY_THRESHOLD = float(os.environ.get('COPY_SIMILARITY_THRESHOLD', '0.92'))

    # Minimum structural change ratio (1 - copy_score) required to accept
    # the output as "meaningfully simplified".  Below this → INSUFFICIENT_SIMPLIFICATION.
    MEANINGFUL_SIMPLIFICATION_THRESHOLD = float(os.environ.get('MEANINGFUL_SIMPLIFICATION_THRESHOLD', '0.15'))

    # If simplified text length < this fraction of original AND graph nodes are lost → omission.
    OMISSION_COMPRESSION_RATIO = float(os.environ.get('OMISSION_COMPRESSION_RATIO', '0.35'))

    # Minimum fraction of original graph nodes that must survive in the generated graph.
    GRAPH_NODE_PRESERVATION_MIN = float(os.environ.get('GRAPH_NODE_PRESERVATION_MIN', '0.50'))

    # Verification pass threshold (graph comparison score).
    VERIFICATION_PASS_THRESHOLD = float(os.environ.get('VERIFICATION_PASS_THRESHOLD', '0.85'))

    # ── Transformer token limits ──────────────────────────────────────────────
    MAX_SIMPLIFICATION_TOKENS = int(os.environ.get('MAX_SIMPLIFICATION_TOKENS', '1024'))
    MAX_INPUT_CHARS = int(os.environ.get('MAX_INPUT_CHARS', '10000'))
    MAX_INPUT_TOKENS = int(os.environ.get('MAX_INPUT_TOKENS', '2048'))
