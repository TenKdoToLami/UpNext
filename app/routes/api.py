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
from app.services.image_service import ImageService
from app.utils.constants import MEDIA_TYPES, STATUS_TYPES

bp = Blueprint('api', __name__, url_prefix='/api')
data_manager = DataManager()
image_service = ImageService()
logger = logging.getLogger(__name__)


@bp.route('/items', methods=['GET'])
def get_items():
    """Retrieve all items, sorted by recently updated."""
    items = data_manager.load_items()
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
        new_image_name = image_service.process_image(image_file)

        items = data_manager.load_items()
        
        # Determine if New or Update
        item_id = form_data.get('id')
        existing_item_idx = -1
        
        if item_id:
             existing_item_idx = next(
                 (i for i, x in enumerate(items) if x['id'] == item_id), -1
             )

        if existing_item_idx > -1:
            # --- UPDATE EXISTING ---
            existing_item = items[existing_item_idx]
            
            # Remove deprecated fields if present (cleanup)
            existing_item.pop('isR18', None)

            # Handle Cover Image update
            if new_image_name:
                # Delete old image if it exists
                old_cover = existing_item.get('coverUrl')
                if old_cover:
                    image_service.delete_image(old_cover)
                form_data['coverUrl'] = new_image_name
            else:
                # Keep existing cover
                form_data['coverUrl'] = existing_item.get('coverUrl')

            form_data['updatedAt'] = datetime.now().isoformat()
            
            # Merge updates (form_data overrides existing)
            items[existing_item_idx].update(form_data)

            # Ensure we return the full updated item
            final_item = items[existing_item_idx]

        else:
            # --- CREATE NEW ---
            if not item_id:
                form_data['id'] = uuid.uuid4().hex
            
            form_data['coverUrl'] = new_image_name
            form_data['createdAt'] = datetime.now().isoformat()
            form_data['updatedAt'] = datetime.now().isoformat()
            form_data['isHidden'] = form_data.get('isHidden', False)
            
            # Insert at top
            items.insert(0, form_data)
            final_item = form_data

        if not data_manager.save_items(items):
            raise IOError("Failed to save items to database")

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
        items = data_manager.load_items()
        item_idx = next((i for i, x in enumerate(items) if x['id'] == item_id), -1)
        
        if item_idx > -1:
            item = items[item_idx]
            # Delete associated image
            image_service.delete_image(item.get('coverUrl'))
            
            # Remove from list
            items.pop(item_idx)
            
            if data_manager.save_items(items):
                return jsonify({'status': 'success'})
            else:
                return jsonify({'status': 'error', 'message': "Failed to save database"}), 500
        
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
