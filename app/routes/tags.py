"""
Tag Management Blueprints for UpNext.

Handles CRUD operations, renaming, and application wide removal of tags.
"""

import logging
from flask import Blueprint, jsonify, request

from app.models import TagMeta, MediaItem
from app.database import db

bp = Blueprint("tags", __name__, url_prefix="/api")
logger = logging.getLogger(__name__)


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
