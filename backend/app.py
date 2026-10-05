import os
import logging
import threading
from flask import Flask, jsonify
from flask_cors import CORS
from config import Config
from database import init_db

# Import routes
from routes.upload_routes import upload_bp
from routes.simplification_routes import simplify_bp
from routes.verification_routes import verify_bp
from routes.evaluation_routes import evaluate_bp

def _prewarm_model(app):
    """Load FLAN-T5 into memory at startup in a background thread."""
    import os
    os.environ['CURL_CA_BUNDLE']            = ''
    os.environ['REQUESTS_CA_BUNDLE']        = ''
    os.environ['HF_HUB_DISABLE_SSL_VERIFY'] = '1'
    with app.app_context():
        try:
            from routes.simplification_routes import _get_transformer
            logger = logging.getLogger('prewarm')
            logger.info('Pre-warming FLAN-T5 model in background...')
            t = _get_transformer()
            t._load_model()
            logger.info('FLAN-T5 model ready.')
        except Exception as exc:
            logging.getLogger('prewarm').warning(f'Model pre-warm failed: {exc}')

def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    # Configure logging
    logging.basicConfig(
        level=getattr(logging, app.config['LOG_LEVEL']),
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    logger = logging.getLogger(__name__)

    # Ensure upload folder exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    # Enable CORS
    CORS(app, resources={r"/api/*": {"origins": app.config['CORS_ORIGINS']}})

    # Initialize Database
    init_db(app)

    # Register Blueprints
    app.register_blueprint(upload_bp, url_prefix='/api')
    app.register_blueprint(simplify_bp, url_prefix='/api')
    app.register_blueprint(verify_bp, url_prefix='/api')
    app.register_blueprint(evaluate_bp, url_prefix='/api')

    # Error handlers
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({"error": "Bad Request", "message": str(error)}), 400

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Not Found", "message": "The requested resource was not found"}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({"error": "Internal Server Error", "message": str(error)}), 500

    @app.route('/health', methods=['GET'])
    def health_check():
        return jsonify({"status": "healthy"}), 200

    # Pre-warm model after startup (background thread — doesn't block requests)
    threading.Thread(target=_prewarm_model, args=(app,), daemon=True).start()

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=app.config['DEBUG'], port=5000)
