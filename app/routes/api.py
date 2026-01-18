"""
API Routes for UpNext.

Handles CRUD operations for media items and system configuration.
"""

import logging
import json
import uuid
import os
from datetime import datetime
from typing import Any, Dict

from flask import Blueprint, jsonify, request, current_app, Response, stream_with_context
from sqlalchemy import create_engine, text
import requests
import io
from PIL import Image

from app.services.data_manager import DataManager
from app.utils.constants import MEDIA_TYPES, STATUS_TYPES
from app.models import TagMeta, MediaItem
from app.config import get_sqlite_db_path, list_available_databases
from app.database import db
from app.utils.config_manager import load_config, save_config

bp = Blueprint("api", __name__, url_prefix="/api")
data_manager = DataManager()
logger = logging.getLogger(__name__)


@bp.route("/items", methods=["GET"])
def get_items():
    """Retrieve all library items, sorted by recently updated."""
    items = data_manager.get_items()
    items.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
    return jsonify(items)


@bp.route("/items/check", methods=["GET"])
def check_duplicate():
    """
    Checks if an item with the same title and type already exists.
    
    Query params:
        title: Title to search for (required)
        type: Media type (required)
        exclude_id: Optional ID to exclude from check (for edit mode)
        
    Returns:
        { "exists": bool, "item": {id, title, type} | null }
    """
    title = request.args.get("title", "").strip()
    media_type = request.args.get("type", "").strip()
    exclude_id = request.args.get("exclude_id")
    
    if not title or not media_type:
        return jsonify({"exists": False, "item": None})
        
    # Case-insensitive search
    # 1. Check strict title match
    query = MediaItem.query.filter(
        db.func.lower(MediaItem.title) == title.lower(),
        MediaItem.type == media_type
    )
    
    if exclude_id:
        query = query.filter(MediaItem.id != exclude_id)
        
    existing = query.first()
    
    if existing:
        return jsonify({
            "exists": True,
            "item": {
                "id": existing.id,
                "title": existing.title,
                "type": existing.type
            }
        })

    # 2. Check overlap with alternate titles
    candidates = db.session.query(MediaItem.id, MediaItem.title, MediaItem.alternate_titles).filter(
        MediaItem.type == media_type
    )
    
    if exclude_id:
        candidates = candidates.filter(MediaItem.id != exclude_id)
        
    for cid, ctitle, calts in candidates.all():
        if not calts: continue

        alts_list = calts if isinstance(calts, list) else []
        
        if any(t.lower() == title.lower() for t in alts_list):
             return jsonify({
                "exists": True,
                "item": {
                    "id": cid,
                    "title": ctitle,
                    "type": media_type
                }
            })

    return jsonify({"exists": False, "item": None})




# =============================================================================
# DATABASE SELECTION ENDPOINTS
# =============================================================================

@bp.route("/database/status", methods=["GET"])
def get_db_status():
    """Returns the current database status and available options."""
    available = list_available_databases()
    current_app.config["AVAILABLE_DBS"] = available
    
    config = load_config()
    has_config = 'last_db' in config or 'active_db' in config
    
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
    
    available = list_available_databases()
    
    if not db_name or db_name not in available:
        return jsonify({"status": "error", "message": "Invalid database selection"}), 400
    
    try:
        new_path = get_sqlite_db_path(db_name)
        new_uri = f"sqlite:///{new_path}"
        
        current_app.config["SQLALCHEMY_DATABASE_URI"] = new_uri
        
        db.engine.dispose()
        db.session.remove()
        
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

@bp.route("/database/schema", methods=["GET"])
def get_db_schema():
    """Returns the SQL schema for the current database."""
    try:
        # Query sqlite_master for table definitions
        with db.engine.connect() as conn:
            result = conn.execute(text("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL"))
            schema = [row[0] for row in result]
        
        return jsonify({"status": "success", "schema": schema})
    except Exception as e:
        logger.error(f"Failed to fetch DB schema: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
@bp.route("/database/create", methods=["POST"])
def create_database():
    """Creates a new empty database."""
    data = request.get_json()
    db_name = data.get("db_name")

    if not db_name:
        return jsonify({"status": "error", "message": "Database name is required"}), 400

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


@bp.route("/database/delete", methods=["POST"])
def delete_database():
    """Deletes a database file."""
    data = request.get_json()
    db_name = data.get("db_name")

    if not db_name:
        return jsonify({"status": "error", "message": "Database name is required"}), 400

    # Prevent deleting the currently active database
    if current_app.config.get("ACTIVE_DB") == db_name:
         return jsonify({"status": "error", "message": "Cannot delete the currently active database"}), 400
         
    # Prevent deleting critical files (basic safety)
    if db_name.lower() in ['config.json', 'users.db']: 
         return jsonify({"status": "error", "message": "Cannot delete system files"}), 400

    try:
        db_path = get_sqlite_db_path(db_name)
        if not os.path.exists(db_path):
             return jsonify({"status": "error", "message": "Database does not exist"}), 404

        os.remove(db_path)
        logger.info(f"Deleted database: {db_name}")
        
        return jsonify({"status": "success", "message": f"Deleted {db_name}"})

    except Exception as e:
        logger.error(f"Failed to delete database: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# =============================================================================
# SETTINGS ENDPOINTS
# =============================================================================

@bp.route("/settings", methods=["GET"])
def get_settings():
    """Retrieves application settings."""
    config = load_config()
    return jsonify(config.get('appSettings', {}))

@bp.route("/settings", methods=["POST"])
def save_settings():
    """Saves application settings."""
    try:
        new_settings = request.get_json()
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
                    response = requests.get(cover_url, timeout=10, headers={
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
        
        if media_type == "Movie" and not source and not service.tmdb.api_key:
            return jsonify({
                "error": "TMDB API key not configured",
                "message": "Please add your TMDB API key in Settings to search for movies."
            }), 400
            
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
    
    if source not in ("anilist", "tmdb", "openlibrary", "tvmaze", "mangadex", "googlebooks", "comicvine"):
        return jsonify({"error": "Invalid source"}), 400
    
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
        googlebooks_key = data.get("googlebooks")
        comicvine_key = data.get("comicvine")
        
        service = _get_external_api_service()
        
        # Load current config to update
        config = load_config()
        api_keys = config.get('apiKeys', {})
        
        if tmdb_key:
            service.set_tmdb_api_key(tmdb_key)
            api_keys['tmdb'] = tmdb_key
            
        if googlebooks_key:
            # Add method to service if needed, or just update config for next init
            if hasattr(service, 'update_keys'):
                service.update_keys(googlebooks=googlebooks_key)
            api_keys['googlebooks'] = googlebooks_key
            
        if comicvine_key:
            if hasattr(service, 'update_keys'):
                service.update_keys(comicvine=comicvine_key)
            api_keys['comicvine'] = comicvine_key
            
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
    config = load_config()
    return jsonify(config)


@bp.route("/proxy/image", methods=["GET"])
def proxy_image():
    """
    Proxies an external image to bypass CORS restrictions.
    Used by the Image Editor to allow canvas cropping of third-party images.
    """
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "No URL provided"}), 400

    try:
        response = requests.get(url, timeout=15, stream=True, headers={
            "User-Agent": "UpNext/1.0 (Media Tracker App)"
        })
        
        if response.status_code != 200:
            logger.warning(f"Failed to fetch proxied image from {url}: {response.status_code}")
            return jsonify({"error": "Failed to fetch image"}), response.status_code

        content_type = response.headers.get("Content-Type", "image/jpeg")
        return Response(response.content, mimetype=content_type)
        
    except Exception as e:
        logger.error(f"Image proxy failed for {url}: {e}")
        return jsonify({"error": "Proxy failed", "message": str(e)}), 500


@bp.route("/admin/optimize-images", methods=["POST"])
def optimize_images():
    """
    Batch optimizes all stored cover images in the database.
    
    Accepts JSON parameters:
        - width (int): Max width to resize images to. Default: 800.
        - format (str): MIME type for target format. Default: 'image/webp'.
        - quality (int): Compression quality (1-100). Default: 85.
    
    Returns:
        A text/event-stream with progress updates and final stats.
    """
    data_req = request.get_json() or {}
    target_width = int(data_req.get("width", 800))
    target_format = data_req.get("format", "image/webp")
    target_quality = int(data_req.get("quality", 85))
    
    # Map MIME type to Pillow format string
    format_map = {
        "image/webp": "WEBP",
        "image/jpeg": "JPEG",
        "image/png": "PNG",
        "image/avif": "AVIF"  # Requires pillow-avif-plugin
    }
    pil_format = format_map.get(target_format, "WEBP")

    def generate():
        """SSE generator for optimization progress."""
        conn = None
        try:
            db_path = get_sqlite_db_path(current_app.config["ACTIVE_DB"])
            import sqlite3
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            cursor.execute("SELECT count(*) FROM media_covers WHERE cover_image IS NOT NULL")
            total = cursor.fetchone()[0]
            
            yield f"data: {json.dumps({'progress': 0, 'total': total, 'message': 'Starting...'})}\n\n"
            
            cursor.execute("SELECT item_id, cover_image, cover_mime FROM media_covers WHERE cover_image IS NOT NULL")
            
            processed = 0
            original_size_total = 0
            new_size_total = 0
            rows = cursor.fetchall()
            
            for row in rows:
                item_id, blob, mime = row
                if not blob: continue
                
                original_size = len(blob)
                original_size_total += original_size
                
                try:
                    # Optimize
                    img = Image.open(io.BytesIO(blob))
                    
                    # Resize
                    if img.width > target_width:
                        ratio = target_width / img.width
                        new_height = int(img.height * ratio)
                        img = img.resize((target_width, new_height), Image.Resampling.LANCZOS)
                        
                    # Save
                    out = io.BytesIO()
                    save_kwargs = {"quality": target_quality, "optimize": True}
                    if pil_format == "PNG": 
                         save_kwargs = {"optimize": True} # PNG is lossless
                    
                    if img.mode != "RGB" and pil_format == "JPEG":
                        img = img.convert("RGB")
                        
                    img.save(out, format=pil_format, **save_kwargs)
                    new_blob = out.getvalue()
                    
                    # Update DB
                    cursor.execute(
                        "UPDATE media_covers SET cover_image = ?, cover_mime = ? WHERE item_id = ?",
                        (new_blob, target_format, item_id)
                    )
                    
                    new_size_total += len(new_blob)
                    processed += 1
                    
                    if processed % 5 == 0:
                        yield f"data: {json.dumps({'progress': processed, 'total': total, 'message': f'Processing {processed}/{total}'})}\n\n"
                        
                except Exception as e:
                    logger.error(f"Failed to optimize {item_id}: {e}")
            
            conn.commit()
            
            yield f"data: {json.dumps({'progress': total, 'total': total, 'message': 'Vacuuming database...'})}\n\n"
            cursor.execute("VACUUM")
            conn.commit()
            
            saved_bytes = original_size_total - new_size_total
            saved_mb = round(saved_bytes / (1024 * 1024), 2)
            
            yield f"data: {json.dumps({'done': True, 'stats': {'processed': processed, 'savedMB': saved_mb}})}\n\n"
            
        except Exception as e:
            logger.exception("Optimization failed")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            if conn:
                conn.close()
            
    return Response(stream_with_context(generate()), mimetype='text/event-stream')
