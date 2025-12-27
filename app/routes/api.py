"""
API Routes for UpNext.

Handles CRUD operations for media items.
"""

from flask import Blueprint, jsonify, request, current_app
import logging
import json
import uuid
import os
from datetime import datetime
from typing import Any, Dict
from sqlalchemy import create_engine

from app.services.data_manager import DataManager
from app.utils.constants import MEDIA_TYPES, STATUS_TYPES
from app.config import get_sqlite_db_path
from app.database import db

bp = Blueprint("api", __name__, url_prefix="/api")
data_manager = DataManager()
logger = logging.getLogger(__name__)


@bp.route("/items", methods=["GET"])
def get_items():
    """Retrieve all library items, sorted by recently updated."""
    items = data_manager.get_items()
    # Sort by updatedAt descending for the frontend
    items.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
    return jsonify(items)


# =============================================================================
# DATABASE SELECTION ENDPOINTS
# =============================================================================

@bp.route("/database/status", methods=["GET"])
def get_db_status():
    """Returns the current database status and available options."""
    return jsonify({
        "active": current_app.config.get("ACTIVE_DB"),
        "available": current_app.config.get("AVAILABLE_DBS", []),
        "needsSelection": current_app.config.get("NEEDS_DB_SELECTION", False)
    })


@bp.route("/database/select", methods=["POST"])
def select_database():
    """Switches the active database connection."""
    data = request.get_json()
    db_name = data.get("db_name")
    
    if not db_name or db_name not in current_app.config.get("AVAILABLE_DBS", []):
        return jsonify({"status": "error", "message": "Invalid database selection"}), 400
    
    try:
        new_path = get_sqlite_db_path(db_name)
        new_uri = f"sqlite:///{new_path}"
        
        # Update SQLAlchemy configuration
        current_app.config["SQLALCHEMY_DATABASE_URI"] = new_uri
        
        # Dispose of current engine and session
        db.engine.dispose()
        db.session.remove()
        
        # Reconfigure database engine
        new_engine = create_engine(new_uri)
        if hasattr(db, 'engines'):
            db.engines.clear()
            db.engines[None] = new_engine
        
        current_app.config["ACTIVE_DB"] = db_name

        # Persist selection
        try:
            from app.config import DB_CONFIG_FILE
            with open(DB_CONFIG_FILE, 'w') as f:
                json.dump({'last_db': db_name}, f)
        except Exception as e:
            logger.warning(f"Failed to persist DB selection: {e}")
        
        logger.info(f"Database switched to: {db_name}")
        return jsonify({"status": "success", "message": f"Switched to {db_name}"})
        
    except Exception as e:
        logger.error(f"Failed to switch database: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# =============================================================================
# MEDIA ITEM ENDPOINTS
# =============================================================================


@bp.route("/items", methods=["POST"])
def save_item():
    """
    Creates a new media item or updates an existing one.
    
    Expects a multipart/form-data request with:
    - data: JSON string containing item attributes.
    - image: (Optional) Binary image file for the cover.
    """
    try:
        data_str = request.form.get("data")
        if not data_str:
            raise ValueError("No data provided in 'data' field.")

        form_data: Dict[str, Any] = json.loads(data_str)
        item_id = form_data.get("id")

        # Validate against system constants (types, statuses)
        _validate_item(form_data, is_update=bool(item_id))

        # Handle Image Upload
        image_file = request.files.get("image")
        if image_file and image_file.filename:
            form_data["cover_image"] = image_file.read()
            form_data["cover_mime"] = image_file.mimetype
            form_data["cover_url"] = ""  # Real image overrides external URL

        if item_id:
            # Update existing record
            if not data_manager.get_item(item_id):
                return jsonify({"status": "error", "message": "Item not found"}), 404

            form_data["updatedAt"] = datetime.utcnow().isoformat()
            success = data_manager.update_item(item_id, form_data)
        else:
            # Create new record
            item_id = uuid.uuid4().hex
            form_data["id"] = item_id
            form_data["createdAt"] = datetime.utcnow().isoformat()
            form_data["updatedAt"] = datetime.utcnow().isoformat()
            form_data["isHidden"] = form_data.get("isHidden", False)

            success = data_manager.add_item(form_data)

        if not success:
            raise IOError("DataManager failed to persist changes.")

        return jsonify({"status": "success", "item": data_manager.get_item(item_id)})

    except ValueError as ve:
        logger.warning(f"Validation failure: {ve}")
        return jsonify({"status": "error", "message": str(ve)}), 400
    except Exception as e:
        logger.error(f"Unexpected error in save_item: {e}", exc_info=True)
        return jsonify({"status": "error", "message": "Internal server error"}), 500


@bp.route("/items/<item_id>", methods=["DELETE"])
def delete_item(item_id):
    """Delete an item by its ID."""
    try:
        # Check existence first if needed, though delete_item handles it
        if data_manager.delete_item(item_id):
            return jsonify({"status": "success"})
        
        # If not found, return success (idempotent)
        return jsonify({"status": "success"})

    except Exception as e:
        logger.error(f"Error deleting item {item_id}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


def _validate_item(data: Dict[str, Any], is_update: bool = False) -> None:
    """
    Validates item data against allowed constants.
    
    Args:
        data: The item dictionary to validate.
        is_update: Whether this is an update to an existing item.
        
    Raises:
        ValueError: If validation fails.
    """
    # Type validation
    item_type = data.get("type")
    if not is_update or "type" in data:
        if item_type not in MEDIA_TYPES:
             raise ValueError(f"Invalid media type: {item_type}")

    # Status validation
    status = data.get("status")
    if status and status not in STATUS_TYPES:
        raise ValueError(f"Invalid status: {status}")
