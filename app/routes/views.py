"""
View Routes.

Handles serving the main HTML entry point and user uploaded images.
"""
from flask import Blueprint, render_template, send_from_directory
from app.config import IMAGES_DIR

bp = Blueprint('views', __name__)

@bp.route('/')
def index():
    """Serves the main application page."""
    return render_template('index.html')

@bp.route('/images/<path:filename>')
def serve_image(filename):
    """Serves user-uploaded images."""
    return send_from_directory(IMAGES_DIR, filename)
