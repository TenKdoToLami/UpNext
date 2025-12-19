from datetime import datetime
import uuid
from typing import List, Optional

from sqlalchemy import String, Integer, Text, Boolean, DateTime, JSON, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column

from app.database import db

class MediaItem(db.Model):
    """
    SQLAlchemy model for a media item (Anime, Book, Manga, etc.).
    Uses JSON columns for flexible list storage.
    """
    __tablename__ = "media_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="Planning")
    rating: Mapped[int] = mapped_column(Integer, default=0)
    progress: Mapped[str] = mapped_column(String(100), default="")
    
    # Text content
    description: Mapped[str] = mapped_column(Text, default="")
    review: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    
    # Categorization
    universe: Mapped[str] = mapped_column(String(100), default="")
    series: Mapped[str] = mapped_column(String(100), default="")
    series_number: Mapped[str] = mapped_column(String(50), default="")
    
    # Image storage
    cover_url: Mapped[str] = mapped_column(String(255), default="")
    cover_image: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    cover_mime: Mapped[String] = mapped_column(String(50), default="")
    
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # Complex metadata stored as JSON
    authors: Mapped[List[str]] = mapped_column(JSON, default=list)
    alternate_titles: Mapped[List[str]] = mapped_column(JSON, default=list)
    external_links: Mapped[List[dict]] = mapped_column(JSON, default=list)
    children: Mapped[List[dict]] = mapped_column(JSON, default=list)
    
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        """
        Convert the model instance to a dictionary for JSON responses.
        Handles cover URL generation based on stored image or external URL.
        """
        # Determine cover URL logic
        c_url = self.cover_url
        if self.cover_image:
            # Use dynamic route for internal images. 
            # Append timestamp cache buster to force browser refresh on update.
            ts = int(self.updated_at.timestamp()) if self.updated_at else 0
            c_url = f"{self.id}?v={ts}"
            
        return {
            "id": self.id,
            "title": self.title,
            "type": self.type,
            "status": self.status,
            "rating": self.rating,
            "progress": self.progress,
            "description": self.description,
            "review": self.review,
            "notes": self.notes,
            "universe": self.universe,
            "series": self.series,
            "seriesNumber": self.series_number,
            "coverUrl": c_url,
            "isHidden": self.is_hidden,
            "authors": self.authors,
            "alternateTitles": self.alternate_titles,
            "externalLinks": self.external_links,
            "children": self.children,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
        }
