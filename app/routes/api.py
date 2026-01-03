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
from app.models import TagMeta, MediaItem
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
    from app.config import list_available_databases, APP_CONFIG_FILE
    from app.utils.config_manager import load_config
    
    available = list_available_databases()
    # Update cache if needed
    current_app.config["AVAILABLE_DBS"] = available
    
    # Check if a config file actually exists with a selection
    config = load_config()
    has_config = 'last_db' in config or 'active_db' in config # Check explicit keys
    
    return jsonify({
        "active": current_app.config.get("ACTIVE_DB"),
        "available": available,
        "hasConfig": has_config
    })


@bp.route("/database/select", methods=["POST"])
def select_database():
    """Switches the active database connection."""
    data = request.get_json()
    db_name = data.get("db_name")
    
    from app.config import list_available_databases
    from app.utils.config_manager import save_config
    
    available = list_available_databases()
    
    if not db_name or db_name not in available:
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

        # Persist selection to main config.json
        try:
            save_config({'last_db': db_name})
        except Exception as e:
            logger.warning(f"Failed to persist DB selection: {e}")
        
        logger.info(f"Database switched to: {db_name}")
        return jsonify({"status": "success", "message": f"Switched to {db_name}"})
        
    except Exception as e:
        logger.error(f"Failed to switch database: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route("/database/create", methods=["POST"])
def create_database():
    """Creates a new empty database."""
    data = request.get_json()
    db_name = data.get("db_name")

    if not db_name:
        return jsonify({"status": "error", "message": "Database name is required"}), 400

    # Sanitize inputs (basic alphanumeric check)
    if not db_name.replace('_', '').replace('-', '').isalnum():
        return jsonify({"status": "error", "message": "Invalid characters in database name"}), 400
    
    if not db_name.lower().endswith(".db"):
        db_name += ".db"

    try:
        new_path = get_sqlite_db_path(db_name)
        if os.path.exists(new_path):
             return jsonify({"status": "error", "message": "Database already exists"}), 409

        # Create empty file
        open(new_path, 'a').close()
        
        logger.info(f"Created new database: {db_name}")
        return jsonify({"status": "success", "message": f"Created {db_name}", "db_name": db_name})

    except Exception as e:
        logger.error(f"Failed to create database: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# =============================================================================
# SETTINGS ENDPOINTS
# =============================================================================

@bp.route("/settings", methods=["GET"])
def get_settings():
    """Retrieves application settings."""
    from app.utils.config_manager import load_config
    config = load_config()
    return jsonify(config.get('appSettings', {}))

@bp.route("/settings", methods=["POST"])
def save_settings():
    """Saves application settings."""
    try:
        new_settings = request.get_json()
        from app.utils.config_manager import save_config
        save_config({'appSettings': new_settings})
        return jsonify({"status": "success", "message": "Settings saved"})
    except Exception as e:
        logger.error(f"Failed to save settings: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500



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

@bp.route("/tags", methods=["GET"])
def get_tags():
    """Get all tags with their metadata."""
    tags = TagMeta.query.all()
    return jsonify({tag.name: tag.to_dict() for tag in tags}), 200

@bp.route("/tags", methods=["POST"])
def save_tag():
    """Create or update a tag's metadata."""
    data = request.json
    name = data.get("name")
    color = data.get("color")
    description = data.get("description", "")
    
    if not name or not color:
        return jsonify({"error": "Name and color are required"}), 400
        
    tag = TagMeta.query.get(name)
    if not tag:
        tag = TagMeta(name=name, color=color, description=description)
        db.session.add(tag)
    else:
        tag.color = color
        if description is not None:
             tag.description = description
            
    db.session.commit()
    return jsonify(tag.to_dict()), 200

@bp.route("/tags/<path:name>", methods=["DELETE"])
def delete_tag(name):
    """Delete a tag and remove it from all items."""
    # 1. Delete metadata
    tag = TagMeta.query.get(name)
    if tag:
        db.session.delete(tag)
    
    # 2. Update all items
    items = MediaItem.query.all()
    for item in items:
        if item.tags and name in item.tags:
            # Filter out deleted tag
            item.tags = [t for t in item.tags if t != name]
            
    db.session.commit()
    return jsonify({"success": True}), 200

@bp.route("/tags/rename", methods=["POST"])
def rename_tag():
    """Rename a tag and update all items."""
    data = request.json
    old_name = data.get("oldName")
    new_name = data.get("newName")
    
    if not old_name or not new_name:
        return jsonify({"error": "oldName and newName required"}), 400
        
    if old_name == new_name:
        return jsonify({"success": True}), 200
        
    # 1. Handle Metadata
    old_tag = TagMeta.query.get(old_name)
    new_tag = TagMeta.query.get(new_name)
    
    color = old_tag.color if old_tag else "#e4e4e7"
    desc = old_tag.description if old_tag else ""
    
    if not new_tag:
        # Create new tag carrying over old metadata
        new_tag = TagMeta(name=new_name, color=color, description=desc)
        db.session.add(new_tag)
    
    if old_tag:
        db.session.delete(old_tag)
        
    # 2. Update Items
    items = MediaItem.query.all()
    for item in items:
        if item.tags and old_name in item.tags:
            # Rename, preventing duplicates if new_name already existed
            final_tags = []
            seen = set()
            for t in item.tags:
                val = new_name if t == old_name else t
                if val not in seen:
                    final_tags.append(val)
                    seen.add(val)
            item.tags = final_tags
            
    db.session.commit()
    return jsonify(new_tag.to_dict()), 200
