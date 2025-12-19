"""
Data Manager Service for UpNext.

Handles persistence of library items using SQLAlchemy.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from app.database import db
from app.models import MediaItem

logger = logging.getLogger(__name__)


class DataManager:
    """
    Handles data persistence for the application using SQLAlchemy models.
    Provides methods for CRUD operations on MediaItem objects.
    """

    def __init__(self):
        """
        Initialize the DataManager.
        
        This service wraps SQLAlchemy calls. In a larger app, you might inject the db session here.
        """
        pass

    def get_items(self) -> List[Dict[str, Any]]:
        """
        Retrieves all media items from the database.
        
        Returns:
            List[Dict[str, Any]]: A list of all items serialized as dictionaries.
        """
        try:
            items = db.session.execute(db.select(MediaItem)).scalars().all()
            return [item.to_dict() for item in items]
        except Exception as e:
            logger.error(f"Error retrieving items: {e}")
            return []

    def get_item(self, item_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve a single media item by its ID.
        
        Args:
            item_id (str): The unique identifier of the item.
            
        Returns:
            Optional[Dict[str, Any]]: The serialized item if found, else None.
        """
        try:
            item = db.session.get(MediaItem, item_id)
            return item.to_dict() if item else None
        except Exception as e:
            logger.error(f"Error loading item {item_id}: {e}")
            return None

    def add_item(self, data: Dict[str, Any]) -> bool:
        """
        Add a new media item to the database.
        
        Args:
            data (Dict[str, Any]): Dictionary containing item data.
            
        Returns:
            bool: True if successful, False otherwise.
        """
        try:
            new_item = MediaItem(
                id=data["id"],
                title=data["title"],
                type=data["type"],
                status=data.get("status", "Planning"),
                # Ensure rating is never None to avoid IntegrityError
                rating=data.get("rating") if data.get("rating") is not None else 0,
                progress=data.get("progress", ""),
                description=data.get("description", ""),
                review=data.get("review", ""),
                notes=data.get("notes", ""),
                universe=data.get("universe", ""),
                series=data.get("series", ""),
                series_number=data.get("seriesNumber", ""),
                cover_url=data.get("coverUrl", ""),
                is_hidden=data.get("isHidden", False),
                authors=data.get("authors", []),
                alternate_titles=data.get("alternateTitles", []),
                external_links=data.get("externalLinks", []),
                children=data.get("children", []),
                created_at=datetime.fromisoformat(data["createdAt"])
                if data.get("createdAt")
                else datetime.utcnow(),
                updated_at=datetime.fromisoformat(data["updatedAt"])
                if data.get("updatedAt")
                else datetime.utcnow(),
                cover_image=data.get("cover_image"),
                cover_mime=data.get("cover_mime"),
            )
            db.session.add(new_item)
            db.session.commit()
            return True
        except Exception as e:
            logger.error(f"Error adding item: {e}")
            db.session.rollback()
            return False

    def update_item(self, item_id: str, data: Dict[str, Any]) -> bool:
        """
        Update an existing media item.
        
        Args:
            item_id (str): The ID of the item to update.
            data (Dict[str, Any]): Dictionary containing updated fields.
            
        Returns:
            bool: True if successful, False otherwise.
        """
        try:
            item = db.session.get(MediaItem, item_id)
            if not item:
                return False

            # Update fields selectively
            item.title = data.get("title", item.title)
            item.type = data.get("type", item.type)
            item.status = data.get("status", item.status)
            
            # Sanitized rating handling
            if "rating" in data:
                item.rating = data["rating"] if data["rating"] is not None else 0
            
            item.progress = data.get("progress", item.progress)
            item.description = data.get("description", item.description)
            item.review = data.get("review", item.review)
            item.notes = data.get("notes", item.notes)
            item.universe = data.get("universe", item.universe)
            item.series = data.get("series", item.series)
            item.series_number = data.get("seriesNumber", item.series_number)
            item.cover_url = data.get("coverUrl", item.cover_url)
            item.is_hidden = data.get("isHidden", item.is_hidden)
            item.authors = data.get("authors", item.authors)
            item.alternate_titles = data.get("alternateTitles", item.alternate_titles)
            item.external_links = data.get("externalLinks", item.external_links)
            item.children = data.get("children", item.children)

            if "cover_image" in data:
                item.cover_image = data["cover_image"]
            if "cover_mime" in data:
                item.cover_mime = data["cover_mime"]

            if data.get("updatedAt"):
                item.updated_at = datetime.fromisoformat(data["updatedAt"])
            else:
                item.updated_at = datetime.utcnow()

            db.session.commit()
            return True
        except Exception as e:
            logger.error(f"Error updating item {item_id}: {e}")
            db.session.rollback()
            return False

    def delete_item(self, item_id: str) -> bool:
        """
        Delete a media item by its ID.
        
        Args:
            item_id (str): The ID of the item to delete.
            
        Returns:
            bool: True if the item was found and deleted, False otherwise.
        """
        try:
            item = db.session.get(MediaItem, item_id)
            if item:
                db.session.delete(item)
                db.session.commit()
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting item {item_id}: {e}")
            db.session.rollback()
            return False


