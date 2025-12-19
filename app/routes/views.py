"""
View Routes.

Handles serving the main HTML entry point and user uploaded images.
"""
from flask import Blueprint, render_template, send_file, abort
import io
from app.database import db
from app.models import MediaItem

bp = Blueprint('views', __name__)

@bp.route('/')
def index():
    """Serves the main application page."""
    return render_template('index.html')

@bp.route('/images/<item_id>')
def serve_image(item_id):
    """Serves images from the database."""
    item = db.session.get(MediaItem, item_id)
    if item and item.cover_image:
        return send_file(
            io.BytesIO(item.cover_image),
            mimetype=item.cover_mime or 'image/jpeg'
        )
    abort(404)
