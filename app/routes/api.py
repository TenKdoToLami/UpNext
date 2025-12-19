"""
API Routes for UpNext.

Handles CRUD operations for media items.
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Any, Dict

from flask import Blueprint, jsonify, request

from app.services.data_manager import DataManager
from app.utils.constants import MEDIA_TYPES, STATUS_TYPES

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


@bp.route("/items", methods=["POST"])
def save_item():
    """Create a new item or update an existing one."""
    try:
        data_str = request.form.get("data")
        if not data_str:
            raise ValueError("No data provided")

        form_data: Dict[str, Any] = json.loads(data_str)

        # Basic Validation
        _validate_item(form_data)

        # Handle Image Upload (Binary storage)
        image_file = request.files.get("image")
        if image_file and image_file.filename:
            form_data["cover_image"] = image_file.read()
            form_data["cover_mime"] = image_file.mimetype
            # Clear legacy coverUrl if we have a real image
            form_data["cover_url"] = ""

        item_id = form_data.get("id")

        if item_id:
            # --- UPDATE ---
            existing_item = data_manager.get_item(item_id)
            if not existing_item:
                return jsonify({"status": "error", "message": "Item not found"}), 404

            form_data["updatedAt"] = datetime.now().isoformat()
            success = data_manager.update_item(item_id, form_data)
        else:
            # --- CREATE NEW ---
            item_id = uuid.uuid4().hex
            form_data["id"] = item_id
            form_data["createdAt"] = datetime.now().isoformat()
            form_data["updatedAt"] = datetime.now().isoformat()
            form_data["isHidden"] = form_data.get("isHidden", False)

            success = data_manager.add_item(form_data)

        if not success:
            raise IOError("Failed to save item to database")

        final_item = data_manager.get_item(item_id)
        return jsonify({"status": "success", "item": final_item})

    except ValueError as ve:
        logger.warning(f"Validation error: {ve}")
        return jsonify({"status": "error", "message": str(ve)}), 400
    except Exception as e:
        logger.error(f"Error saving item: {e}")
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


def _validate_item(data: Dict[str, Any]) -> None:
    """Validates item data against allowed constants."""
    if data.get("type") not in MEDIA_TYPES:
        raise ValueError(f"Invalid media type: {data.get('type')}")
    if data.get("status") not in STATUS_TYPES:
        raise ValueError(f"Invalid status: {data.get('status')}")





