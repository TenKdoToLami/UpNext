"""
API Routes for UpNext.

Handles CRUD operations for library items.
"""

import json
import uuid
import logging
from datetime import datetime
from typing import Dict, Any

from flask import Blueprint, jsonify, request
from app.services.data_manager import DataManager
from app.services.data_manager import DataManager
from app.utils.constants import MEDIA_TYPES, STATUS_TYPES

bp = Blueprint('api', __name__, url_prefix='/api')
data_manager = DataManager()
logger = logging.getLogger(__name__)


@bp.route('/items', methods=['GET'])
def get_items():
    """Retrieve all items, sorted by recently updated."""
    items = data_manager.get_items()
    # Sort by updatedAt descending
    items.sort(key=lambda x: x.get('updatedAt', ''), reverse=True)
    return jsonify(items)


@bp.route('/items', methods=['POST'])
def save_item():
    """Create or update an item."""
    try:
        data_str = request.form.get('data')
        if not data_str:
            raise ValueError("No data provided")

        form_data: Dict[str, Any] = json.loads(data_str)

        # Basic Validation
        _validate_item(form_data)

        # Handle Image Upload
        image_file = request.files.get('image')
        if image_file and image_file.filename:
            # Save bytes to DB columns
            form_data['cover_image'] = image_file.read()
            form_data['cover_mime'] = image_file.mimetype
            # Clear old coverUrl if present, as it's legacy
            form_data['cover_url'] = ""

        # Determine if New or Update
        item_id = form_data.get('id')
        
        if item_id:
            # --- UPDATE ---
            existing_item = data_manager.get_item(item_id)
            if not existing_item:
                 pass 

            # Update timestamp
            form_data['updatedAt'] = datetime.now().isoformat()
            
            # Use DataManager to update
            # Map camelCase form_data specific fields if model uses snake_case?
            # MediaItem uses snake_case but DataManager and models might handle mapping?
            # Wait, MediaItem model had mapped attributes?
            # The model has snake_case fields: cover_url, cover_image, is_hidden.
            # But to_dict returns camelCase.
            # The form_data likely comes in camelCase.
            # I need to ensure keys match model attributes or DataManager handles it.
            # Let's check DataManager update_item again.
            # It does setattr(item, key, value). item is MediaItem.
            # So key must vary.
            
            # Use DataManager to update
            success = data_manager.update_item(item_id, form_data)
            final_item = data_manager.get_item(item_id)

        else:
            # --- CREATE NEW ---
            item_id = uuid.uuid4().hex
            form_data['id'] = item_id
            
            form_data['createdAt'] = datetime.now().isoformat()
            form_data['updatedAt'] = datetime.now().isoformat()
            form_data['isHidden'] = form_data.get('isHidden', False)
            
            success = data_manager.add_item(form_data)
            final_item = data_manager.get_item(item_id)

        if not success:
            raise IOError("Failed to save item to database")

        return jsonify({'status': 'success', 'item': final_item})

    except ValueError as ve:
        logger.warning(f"Validation error: {ve}")
        return jsonify({'status': 'error', 'message': str(ve)}), 400
    except Exception as e:
        logger.error(f"Error saving item: {e}")
        return jsonify({'status': 'error', 'message': "Internal server error"}), 500


@bp.route('/items/<item_id>', methods=['DELETE'])
def delete_item(item_id):
    """Delete an item by ID."""
    try:
        item = data_manager.get_item(item_id)
        
        if item:
            # Image is in DB, cascade delete handles it or simple row delete
            if data_manager.delete_item(item_id):
                return jsonify({'status': 'success'})
            else:
                return jsonify({'status': 'error', 'message': "Failed to delete from database"}), 500
        
        return jsonify({'status': 'success'})  # Idempotent success if not found

    except Exception as e:
        logger.error(f"Error deleting item {item_id}: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


def _validate_item(data: Dict[str, Any]) -> None:
    """Validates item data."""
    if data.get('type') not in MEDIA_TYPES:
        raise ValueError(f"Invalid media type: {data.get('type')}")
    if data.get('status') not in STATUS_TYPES:
        raise ValueError(f"Invalid status: {data.get('status')}")




