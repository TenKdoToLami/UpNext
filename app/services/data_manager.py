"""
Data Manager Service for UpNext.

Handles persistence of library items to the JSON database.
"""

from datetime import datetime
import logging
from typing import List, Dict, Any, Union

from app.database import db
from app.models import MediaItem



logger = logging.getLogger(__name__)


class DataManager:
    """
    Handles data persistence for the application using a JSON file.
    """

    def __init__(self):
        # DB is initialized in app creation
        pass

    def _ensure_structure(self) -> None:
        # DB tables are created in app creation
        pass

    def get_items(self) -> List[Dict[str, Any]]:
        """Retrieves all items from the database."""
        try:
            items = MediaItem.query.all()
            return [item.to_dict() for item in items]
        except Exception as e:
            logger.error(f"Error retrieving items: {e}")
            return []

    def get_item(self, item_id: str) -> Union[Dict[str, Any], None]:
        """Retrieve a single item by ID."""
        try:
            item = db.session.get(MediaItem, item_id)
            return item.to_dict() if item else None
        except Exception as e:
            logger.error(f"Error loading item {item_id}: {e}")
            return None

    def add_item(self, data: Dict[str, Any]) -> bool:
        """Add a new item to the database."""
        try:
            new_item = MediaItem(
                id=data['id'],
                title=data['title'],
                type=data['type'],
                status=data.get('status', 'Planning'),
                rating=data.get('rating') if data.get('rating') is not None else 0,
                progress=data.get('progress', ''),
                description=data.get('description', ''),
                review=data.get('review', ''),
                notes=data.get('notes', ''),
                universe=data.get('universe', ''),
                series=data.get('series', ''),
                series_number=data.get('seriesNumber', ''),
                cover_url=data.get('coverUrl', ''),
                is_hidden=data.get('isHidden', False),
                authors=data.get('authors', []),
                alternate_titles=data.get('alternateTitles', []),
                external_links=data.get('externalLinks', []),
                children=data.get('children', []),
                created_at=datetime.fromisoformat(data['createdAt']) if data.get('createdAt') else None,
                updated_at=datetime.fromisoformat(data['updatedAt']) if data.get('updatedAt') else None,
                cover_image=data.get('cover_image'),
                cover_mime=data.get('cover_mime')
            )
            db.session.add(new_item)
            db.session.commit()
            return True
        except Exception as e:
            logger.error(f"Error adding item: {e}")
            db.session.rollback()
            return False

    def update_item(self, item_id: str, data: Dict[str, Any]) -> bool:
        """Update an existing item."""
        try:
            item = db.session.get(MediaItem, item_id)
            if not item:
                return False
            
            # Update fields
            item.title = data.get('title', item.title)
            item.type = data.get('type', item.type)
            item.status = data.get('status', item.status)
            item.rating = data.get('rating') if data.get('rating') is not None else (item.rating if 'rating' not in data else 0)
            item.progress = data.get('progress', item.progress)
            item.description = data.get('description', item.description)
            item.review = data.get('review', item.review)
            item.notes = data.get('notes', item.notes)
            item.universe = data.get('universe', item.universe)
            item.series = data.get('series', item.series)
            item.series_number = data.get('seriesNumber', item.series_number)
            item.cover_url = data.get('coverUrl', item.cover_url)
            item.is_hidden = data.get('isHidden', item.is_hidden)
            item.authors = data.get('authors', item.authors)
            item.alternate_titles = data.get('alternateTitles', item.alternate_titles)
            item.external_links = data.get('externalLinks', item.external_links)
            item.children = data.get('children', item.children)
            
            if 'cover_image' in data:
                item.cover_image = data['cover_image']
            if 'cover_mime' in data:
                item.cover_mime = data['cover_mime']
            
            if data.get('updatedAt'):
                item.updated_at = datetime.fromisoformat(data['updatedAt'])
            else:
                item.updated_at = datetime.utcnow()

            db.session.commit()
            return True
        except Exception as e:
            logger.error(f"Error updating item {item_id}: {e}")
            db.session.rollback()
            return False

    def delete_item(self, item_id: str) -> bool:
        """Delete an item by ID."""
        try:
            item = db.session.get(MediaItem, item_id)
            if item:
                db.session.delete(item)
                db.session.commit()
                return True
            return False # Item not found, treat as handled or error? idempotent usually true.
        except Exception as e:
            logger.error(f"Error deleting item {item_id}: {e}")
            db.session.rollback()
            return False

    # Deprecated/Compatibility methods to be removed or mapped
    def load_items(self) -> List[Dict[str, Any]]:
        return self.get_items()
    
    def save_items(self, items: List[Dict[str, Any]]) -> bool:
        # This method is dangerous in SQL context as it implies bulk replace.
        # We will log a warning and return False to force usage of new methods.
        # OR we could loop and upsert... which is safer for transition but slow.
        # Let's force refactoring of api.py by NOT implementing this fully.
        logger.warning("save_items (bulk) is deprecated and not supported in SQL mode. Use update_item/add_item.")
        return False

