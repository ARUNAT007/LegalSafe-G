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
