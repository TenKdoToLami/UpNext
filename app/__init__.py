import logging
import os

from flask import Flask

from app.config import DATA_DIR, STATIC_DIR, TEMPLATE_DIR
from app.utils.logging_setup import setup_logging


def create_app():
    """Factory function to create the Flask app."""
    # Setup logging first
    setup_logging()
    logger = logging.getLogger(__name__)

    # Initialize Flask app
    app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
    app.config.from_object("app.config")

    # Register Blueprints
    from app.routes import api, export, views
    app.register_blueprint(views.bp)
    app.register_blueprint(api.bp)
    app.register_blueprint(export.bp)

    # Initialize Database
    from app.database import db
    db.init_app(app)

    # Ensure data directory exists for SQLite
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    # Create tables within application context
    with app.app_context():
        db.create_all()

    logger.info("Application initialized successfully.")
    return app
