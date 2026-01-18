import logging
import os

from flask import Flask

from app.config import DATA_DIR, STATIC_DIR, TEMPLATE_DIR
from app.utils.logging_setup import setup_logging


def create_app():
    """
    Application factory that creates and configures the Flask instance.
    
    Initializes logging, registers blueprints, sets up the database, 
    and ensures all required data directories exist.
    
    Returns:
        Flask: The configured application instance.
    """
    # Setup logging first to capture all initialization events
    setup_logging()
    logger = logging.getLogger(__name__)

    # Initialize Flask app
    app = Flask(__name__, template_folder=TEMPLATE_DIR, static_folder=STATIC_DIR)
    app.config.from_object("app.config")
    app.config['APP_VERSION'] = "1.2.1"

    @app.context_processor
    def inject_version():
        return dict(APP_VERSION=app.config.get('APP_VERSION', '0.0.0'))

    # Register Blueprints for API, Exports, and HTML Views
    from app.routes import api, export, views, releases
    app.register_blueprint(views.bp)
    app.register_blueprint(api.bp)
    app.register_blueprint(export.bp)
    app.register_blueprint(releases.bp)

    # Initialize Database with SQLAlchemy
    from app.database import db
    db.init_app(app)

    # Multi-Database Detection
    from app.config import list_available_databases
    dbs = list_available_databases()
    app.config['AVAILABLE_DBS'] = sorted(dbs)
    app.config['ACTIVE_DB'] = os.path.basename(app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', ''))
    
    # Determine if selection is needed
    # If the main configuration contains a 'last_db' entry, we assume the user has 
    # previously selected a database and thus do not need to prompt them again.
    # Otherwise, if multiple databases are present, we flag for selection.
    from app.utils.config_manager import load_config
    config_data = load_config()
    has_choice = 'last_db' in config_data
    
    app.config['NEEDS_DB_SELECTION'] = (len(dbs) > 1 and not has_choice)

    # Ensure data directory exists for the SQLite database
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

    # Automatically create missing tables within application context
    with app.app_context():
        # Initializes schema if connected to a valid DB
        db.create_all()

    logger.info("Application initialized successfully.")
    return app
