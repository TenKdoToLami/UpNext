"""
Core Media Items API Routes for UpNext.

Handles CRUD operations, duplicates checking, and data validations for media items.
"""

import logging
import json
import uuid
from datetime import datetime
from typing import Any, Dict
from flask import Blueprint, jsonify, request
import requests

from app.services.data_manager import DataManager
from app.utils.constants import MEDIA_TYPES, STATUS_TYPES
from app.models import MediaItem
from app.database import db
from app.utils.config_manager import load_config
from app.utils.image_processor import process_image, get_default_image_settings

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
            # Process uploaded image to match user defaults
            config = load_config()
            target_width, target_format, target_quality = get_default_image_settings(config)
            
            raw_data = image_file.read()
            processed_blob, actual_mime = process_image(
                raw_data, 
                target_width=target_width, 
                target_format=target_format, 
                quality=target_quality
            )
            
            form_data["cover_image"] = processed_blob
            form_data["cover_mime"] = actual_mime
            form_data["cover_url"] = ""  # Real image overrides external URL
            logger.info(f"Processed uploaded image as {actual_mime}")
        else:
            # Check for external cover URL (from API import)
            cover_url = request.form.get("cover_url")
            if cover_url:
                try:
                    response = requests.get(cover_url, timeout=10, headers={
                        "User-Agent": "UpNext/1.0 (Media Tracker App)"
                    })
                    if response.status_code == 200:
                        # Process image to match user defaults
                        config = load_config()
                        target_width, target_format, target_quality = get_default_image_settings(config)
                        
                        processed_blob, actual_mime = process_image(
                            response.content, 
                            target_width=target_width, 
                            target_format=target_format, 
                            quality=target_quality
                        )
                        
                        form_data["cover_image"] = processed_blob
                        form_data["cover_mime"] = actual_mime
                        form_data["cover_url"] = cover_url
                        logger.info(f"Downloaded and processed cover from: {cover_url} as {actual_mime}")
                except Exception as e:
                    logger.warning(f"Failed to download/process cover from {cover_url}: {e}")

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
