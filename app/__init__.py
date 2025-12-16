import logging
from flask import Flask
from app.config import APP_NAME, TEMPLATE_DIR, STATIC_DIR
from app.utils.logging_setup import setup_logging
from app.services.data_manager import DataManager

setup_logging(APP_NAME)
logger = logging.getLogger(__name__)

def create_app():
    """Factory function to create the Flask app."""
    # Initialize Flask app with correct template/static folders
    app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
    
    # Register Blueprints
    from app.routes import views, api, export
    app.register_blueprint(views.bp)
    app.register_blueprint(api.bp)
    app.register_blueprint(export.bp)
    
    # Ensure DB exists on startup
    db = DataManager()
    db._ensure_structure()
    
    return app
