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



@bp.route("/config", methods=["POST"])
def update_config():
    """
    Updates the application configuration.
    
    Accepts a partial JSON object and merges it into the existing config.
    Used for persisting settings from the frontend.
    """
    try:
        data = request.get_json()
        from app.utils.config_manager import save_config
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        save_config(data)
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Failed to update config: {e}")
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
        else:
            # Check for external cover URL (from API import)
            cover_url = request.form.get("cover_url")
            if cover_url:
                try:
                    import requests as req
                    response = req.get(cover_url, timeout=10, headers={
                        "User-Agent": "UpNext/1.0 (Media Tracker App)"
                    })
                    if response.status_code == 200:
                        form_data["cover_image"] = response.content
                        form_data["cover_mime"] = response.headers.get(
                            "Content-Type", "image/jpeg"
                        )
                        form_data["cover_url"] = cover_url
                        logger.info(f"Downloaded cover from: {cover_url}")
                except Exception as e:
                    logger.warning(f"Failed to download cover from {cover_url}: {e}")

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


# =============================================================================
# EXTERNAL API ENDPOINTS
# =============================================================================

# Lazy-loaded singleton for external API service
_external_api_service = None

def _get_external_api_service():
    """Get or create the external API service singleton."""
    global _external_api_service
    if _external_api_service is None:
        from app.services.external_api import ExternalAPIService
        from app.utils.config_manager import load_config
        
        config = load_config()
        tmdb_key = config.get('apiKeys', {}).get('tmdb', '')
        _external_api_service = ExternalAPIService(tmdb_api_key=tmdb_key)
    return _external_api_service


@bp.route("/external/search", methods=["GET"])
def external_search():
    """
    Search external APIs for media metadata.
    
    Query params:
        q: Search query string (required)
        type: Media type - Anime, Manga, Book, Movie, Series (required)
    
    Returns:
        List of search results with normalized structure.
    """
    query = request.args.get("q", "").strip()
    media_type = request.args.get("type", "")
    
    if not query:
        return jsonify({"error": "Query parameter 'q' is required"}), 400
    
    if media_type not in MEDIA_TYPES:
        return jsonify({"error": f"Invalid media type. Must be one of: {', '.join(MEDIA_TYPES)}"}), 400
    
    try:
        service = _get_external_api_service()
        source = request.args.get("source")
        
        # Check TMDB API key for Movies (only if not forcing another source)
        if media_type == "Movie" and not source and not service.tmdb.api_key:
            return jsonify({
                "error": "TMDB API key not configured",
                "message": "Please add your TMDB API key in Settings to search for movies."
            }), 400
            
        # Also check if explicit TMDB source requested without key
        if source == "tmdb" and not service.tmdb.api_key:
             return jsonify({
                "error": "TMDB API key not configured",
                "message": "Please add your TMDB API key in Settings."
            }), 400
        
        results = service.search(query, media_type, source)
        return jsonify({"results": results})
    
    except Exception as e:
        logger.exception(f"External search failed for query '{query}', type '{media_type}': {e}")
        return jsonify({"error": "Search failed", "message": str(e)}), 500


@bp.route("/external/details", methods=["GET"])
def external_details():
    """
    Get full details for a specific item from an external API.
    
    Query params:
        id: External ID of the item (required)
        type: Media type - Anime, Manga, Book, Movie, Series (required)
        source: API source - anilist, tmdb, openlibrary (required)
    
    Returns:
        Full item details normalized for UpNext wizard pre-fill.
    """
    external_id = request.args.get("id", "").strip()
    media_type = request.args.get("type", "")
    source = request.args.get("source", "").lower()
    
    if not external_id:
        return jsonify({"error": "Query parameter 'id' is required"}), 400
    
    if media_type not in MEDIA_TYPES:
        return jsonify({"error": f"Invalid media type. Must be one of: {', '.join(MEDIA_TYPES)}"}), 400
    
    if source not in ("anilist", "tmdb", "openlibrary", "tvmaze"):
        return jsonify({"error": "Invalid source. Must be one of: anilist, tmdb, openlibrary, tvmaze"}), 400
    
    try:
        service = _get_external_api_service()
        
        # Check TMDB API key
        if source == "tmdb" and not service.tmdb.api_key:
            return jsonify({
                "error": "TMDB API key not configured",
                "message": "Please add your TMDB API key in Settings."
            }), 400
        
        details = service.get_details(external_id, media_type, source)
        
        if not details:
            return jsonify({"error": "Item not found"}), 404
        
        return jsonify({"item": details})
    
    except Exception as e:
        logger.error(f"External details fetch failed: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch details", "message": str(e)}), 500


@bp.route("/external/update-key", methods=["POST"])
def update_external_api_key():
    """
    Update external API keys at runtime.
    
    Body:
        tmdb: TMDB API key
    """
    try:
        data = request.get_json()
        tmdb_key = data.get("tmdb")
        
        if tmdb_key:
            service = _get_external_api_service()
            service.set_tmdb_api_key(tmdb_key)
            
            # Also persist to config
            from app.utils.config_manager import load_config, save_config
            config = load_config()
            api_keys = config.get('apiKeys', {})
            api_keys['tmdb'] = tmdb_key
            save_config({'apiKeys': api_keys})
        
        return jsonify({"status": "success"})
    except Exception as e:
        logger.exception(f"Failed to update API key: {e}")
        return jsonify({"error": "Update failed", "message": str(e)}), 500


@bp.route("/external/priority", methods=["POST"])
def update_search_priority():
    """
    Update search priority configuration.
    
    Body:
        type: Media type ('Anime', 'Movie', 'Series')
        source: Source name ('anilist', 'tmdb', 'tvmaze')
    """
    try:
        data = request.get_json()
        media_type = data.get("type")
        source = data.get("source")
        
        if not media_type or not source:
            return jsonify({"error": "Missing type or source"}), 400
            
        from app.utils.config_manager import load_config, save_config
        config = load_config()
        priorities = config.get('searchPriorities', {})
        priorities[media_type] = source
        save_config({'searchPriorities': priorities})
        
        return jsonify({"status": "success"})
    except Exception as e:
        logger.exception(f"Failed to update search priority: {e}")
        return jsonify({"error": "Update failed", "message": str(e)}), 500


@bp.route("/config", methods=["GET"])
def get_config():
    """Returns the current public configuration."""
    from app.utils.config_manager import load_config
    config = load_config()
    return jsonify(config)
