"""
Data Manager Service for UpNext.

Handles persistence of library items using SQLAlchemy.
"""

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Union

from app.database import db
from app.models import MediaItem, MediaCover, MediaUserData, MediaMetadata

logger = logging.getLogger(__name__)


class DataManager:
    """
    Service layer for library data persistence.
    
    This class handles all CRUD operations by mapping high-level application data 
    structures to underlying SQLAlchemy models. It ensures data normalization 
    across the core media, user tracking, and metadata tables.
    """

    def __init__(self):
        """Initialize the DataManager."""
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
        Retrieve a single media item by its primary key.
        
        Args:
            item_id: The unique UUID of the item.
            
        Returns:
            The serialized item dictionary if found, else None.
        """
        try:
            item = db.session.get(MediaItem, item_id)
            return item.to_dict() if item else None
        except Exception as e:
            logger.error(f"Error loading item {item_id}: {e}")
            return None

    def add_item(self, data: Dict[str, Any]) -> bool:
        """
        Create a new media record and its associated relational components.
        
        Args:
            data: Flat dictionary containing core fields (title, type) and 
                  related metadata (status, rating, etc.).
                  
        Returns:
            True if successful, False otherwise.
        """
        try:
            # 1. Initialize Core Item
            new_item = MediaItem(
                id=data["id"],
                title=data["title"],
                type=data["type"],
                universe=data.get("universe", ""),
                series=data.get("series", ""),
                series_number=data.get("seriesNumber", ""),
                description=data.get("description", ""),
                release_date=datetime.fromisoformat(data["releaseDate"]).date() if data.get("releaseDate") else None,
                
                authors=data.get("authors", []),
                tags=data.get("tags", []),
                abbreviations=data.get("abbreviations", []),
                alternate_titles=data.get("alternateTitles", []),
                external_links=data.get("externalLinks", []),
                children=data.get("children", []),
                
                created_at=datetime.fromisoformat(data["createdAt"]) if data.get("createdAt") else datetime.utcnow(),
                updated_at=datetime.fromisoformat(data["updatedAt"]) if data.get("updatedAt") else datetime.utcnow()
            )

            # 2. Extract and link related data components
            new_item.cover = MediaCover(
                item_id=new_item.id,
                cover_image=data.get("cover_image"),
                cover_mime=data.get("cover_mime"),
                cover_url=data.get("coverUrl", "") 
            )

            new_item.user_data = MediaUserData(
                item_id=new_item.id,
                status=data.get("status", "Planning"),
                rating=data.get("rating") if data.get("rating") is not None else 0,
                progress=data.get("progress", ""),
                completed_at=datetime.fromisoformat(data["completedAt"]).date() if data.get("completedAt") else None,
                reread_count=data.get("rereadCount", 0),
                review=data.get("review", ""),
                notes=data.get("notes", ""),
                is_hidden=data.get("isHidden", False)
            )

            new_item.metadata_info = MediaMetadata(
                item_id=new_item.id,
                episode_count=data.get("episodeCount"),
                volume_count=data.get("volumeCount"),
                page_count=data.get("pageCount"),
                avg_duration_minutes=data.get("avgDurationMinutes")
            )

            db.session.add(new_item)
            db.session.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to add item {data.get('id')}: {e}")
            db.session.rollback()
            return False

    def update_item(self, item_id: str, data: Dict[str, Any]) -> bool:
        """
        Update an existing media item across all related storage tables.
        
        Args:
            item_id: The unique identifier of the item.
            data: Dictionary of fields to update (supports partial updates).
            
        Returns:
            True if item was successfully updated, else False.
        """
        try:
            item = db.session.get(MediaItem, item_id)
            if not item:
                return False

            # Update Core Fields
            item.title = data.get("title", item.title)
            item.type = data.get("type", item.type)
            item.universe = data.get("universe", item.universe)
            item.series = data.get("series", item.series)
            item.series_number = data.get("seriesNumber", item.series_number)
            item.description = data.get("description", item.description)
            
            if "releaseDate" in data:
                 item.release_date = datetime.fromisoformat(data["releaseDate"]).date() if data["releaseDate"] else None
            
            item.authors = data.get("authors", item.authors)
            item.tags = data.get("tags", item.tags)
            item.abbreviations = data.get("abbreviations", item.abbreviations)
            item.alternate_titles = data.get("alternateTitles", item.alternate_titles)
            item.external_links = data.get("externalLinks", item.external_links)
            item.children = data.get("children", item.children)

            # Update User Tracking Data
            if not item.user_data:
                item.user_data = MediaUserData(item_id=item.id)
            
            item.user_data.status = data.get("status", item.user_data.status)
            if "rating" in data:
                item.user_data.rating = data["rating"] if data["rating"] is not None else 0
            item.user_data.progress = data.get("progress", item.user_data.progress)
            
            if "completedAt" in data:
                 item.user_data.completed_at = datetime.fromisoformat(data["completedAt"]).date() if data["completedAt"] else None
            if "rereadCount" in data:
                item.user_data.reread_count = data["rereadCount"]

            item.user_data.review = data.get("review", item.user_data.review)
            item.user_data.notes = data.get("notes", item.user_data.notes)
            item.user_data.is_hidden = data.get("isHidden", item.user_data.is_hidden)

            # Update Cover Information
            if not item.cover:
                item.cover = MediaCover(item_id=item.id)
            if "cover_image" in data:
                item.cover.cover_image = data["cover_image"]
            if "cover_mime" in data:
                item.cover.cover_mime = data["cover_mime"]
            if "coverUrl" in data:
                 item.cover.cover_url = data["coverUrl"]

            # Update technical metadata
            if not item.metadata_info:
                item.metadata_info = MediaMetadata(item_id=item.id)
            if "episodeCount" in data: item.metadata_info.episode_count = data["episodeCount"]
            if "volumeCount" in data: item.metadata_info.volume_count = data["volumeCount"]
            if "pageCount" in data: item.metadata_info.page_count = data["pageCount"]
            if "avgDurationMinutes" in data: item.metadata_info.avg_duration_minutes = data["avgDurationMinutes"]

            # Finalize Audit
            item.updated_at = datetime.fromisoformat(data["updatedAt"]) if data.get("updatedAt") else datetime.utcnow()

            db.session.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to update item {item_id}: {e}")
            db.session.rollback()
            return False

    def delete_item(self, item_id: str) -> bool:
        """
        Delete a media item by its ID.
        
        Args:
            item_id: The ID of the item to delete.
            
        Returns:
            True if successfully deleted, False otherwise.
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


