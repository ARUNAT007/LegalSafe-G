"""
Upload route — POST /api/upload

Validates file extension and size, saves with a unique safe filename,
stores metadata in the documents table, returns a UUID document_id.
"""

import os
import uuid
import logging
from datetime import datetime
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from database import get_db

logger = logging.getLogger(__name__)
upload_bp = Blueprint('upload', __name__)


def allowed_file(filename: str) -> bool:
    """Check that the file extension is in the allowed set."""
    return (
        '.' in filename
        and filename.rsplit('.', 1)[1].lower()
        in current_app.config.get('ALLOWED_EXTENSIONS', {'pdf', 'docx', 'txt'})
    )


@upload_bp.route('/upload', methods=['POST'])
def upload_file():
    """
    Upload a legal document for processing.

    Expects:
        multipart/form-data with field 'file' containing a PDF, DOCX, or TXT file.

    Returns:
        JSON { document_id, filename, status, message }
    """
    # ── Validate file presence ────────────────────────────────────────────────
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in request'}), 400

    file = request.files['file']
    if not file or file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        allowed = ', '.join(
            current_app.config.get('ALLOWED_EXTENSIONS', {'pdf', 'docx', 'txt'})
        )
        return jsonify({
            'error': f'File type not allowed. Accepted types: {allowed}'
        }), 400

    # ── Sanitise filename and save ────────────────────────────────────────────
    original_filename = file.filename
    safe_name = secure_filename(original_filename)
    document_id = str(uuid.uuid4())
    unique_filename = f'{document_id}_{safe_name}'

    upload_folder = current_app.config.get('UPLOAD_FOLDER', 'uploads')
    os.makedirs(upload_folder, exist_ok=True)
    file_path = os.path.join(upload_folder, unique_filename)

    try:
        file.save(file_path)
    except OSError as exc:
        logger.error(f'Failed to save uploaded file: {exc}')
        return jsonify({'error': 'Failed to save file on server'}), 500

    # ── Persist document record ───────────────────────────────────────────────
    try:
        with get_db(current_app) as db:
            db.execute(
                'INSERT INTO documents (id, filename, uploaded_at, status, file_path) '
                'VALUES (?, ?, ?, ?, ?)',
                (document_id, safe_name, datetime.utcnow().isoformat(),
                 'uploaded', file_path)
            )
            db.commit()
    except Exception as exc:
        logger.error(f'DB insert failed for {document_id}: {exc}')
        # Clean up saved file if DB fails
        if os.path.exists(file_path):
            os.remove(file_path)
        return jsonify({'error': 'Failed to register document'}), 500

    logger.info(f'Uploaded: {safe_name} → {document_id}')
    return jsonify({
        'document_id': document_id,
        'filename': safe_name,
        'status': 'uploaded',
        'message': 'File uploaded successfully. Ready for simplification.',
    }), 201
