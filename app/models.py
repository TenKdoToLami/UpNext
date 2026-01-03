from datetime import datetime, date, time
import uuid
from typing import List, Optional

from sqlalchemy import String, Integer, Text, Boolean, DateTime, JSON, LargeBinary, ForeignKey, Date, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import db

class MediaItem(db.Model):
    """
    Represents the core identity of a media item (Anime, Manga, Book, etc.).
    
    This table is kept lightweight to ensure fast listing and searching in the UI.
    Detailed binary data (covers) and user-specific tracking are stored in 
    separate tables to optimize database page usage.
    """
    __tablename__ = "media_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    
    # Categorization and Metadata
    universe: Mapped[str] = mapped_column(String(100), default="")
    series: Mapped[str] = mapped_column(String(100), default="")
    series_number: Mapped[str] = mapped_column(String(50), default="")
    release_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    
    description: Mapped[str] = mapped_column(Text, default="")
    
    # Semi-structured metadata stored as JSON lists/objects
    authors: Mapped[List[str]] = mapped_column(JSON, default=list)
    tags: Mapped[List[str]] = mapped_column(JSON, default=list)
    abbreviations: Mapped[List[str]] = mapped_column(JSON, default=list)
    alternate_titles: Mapped[List[str]] = mapped_column(JSON, default=list)
    external_links: Mapped[List[dict]] = mapped_column(JSON, default=list)
    children: Mapped[List[dict]] = mapped_column(JSON, default=list)
    
    # Audit timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships to optimized secondary tables
    cover: Mapped["MediaCover"] = relationship(
        "MediaCover", back_populates="item", uselist=False, cascade="all, delete-orphan", lazy="select"
    )
    user_data: Mapped["MediaUserData"] = relationship(
        "MediaUserData", back_populates="item", uselist=False, cascade="all, delete-orphan", lazy="joined"
    )
    metadata_info: Mapped["MediaMetadata"] = relationship(
        "MediaMetadata", back_populates="item", uselist=False, cascade="all, delete-orphan", lazy="select"
    )
    releases: Mapped[List["MediaRelease"]] = relationship(
        "MediaRelease", back_populates="item", cascade="all, delete-orphan"
    )

    # --- Properties for backward compatibility with monolithic access patterns ---

    @property
    def status(self) -> str:
        """Proxies to MediaUserData.status."""
        return self.user_data.status if self.user_data else "Planning"
        
    @status.setter
    def status(self, value: str):
        if not self.user_data:
            self.user_data = MediaUserData(item_id=self.id)
        self.user_data.status = value

    @property
    def rating(self) -> int:
        """Proxies to MediaUserData.rating."""
        return self.user_data.rating if self.user_data else 0

    @rating.setter
    def rating(self, value: int):
        if not self.user_data:
            self.user_data = MediaUserData(item_id=self.id)
        self.user_data.rating = value

    @property
    def progress(self) -> str:
        """Proxies to MediaUserData.progress."""
        return self.user_data.progress if self.user_data else ""

    @progress.setter
    def progress(self, value: str):
        if not self.user_data:
            self.user_data = MediaUserData(item_id=self.id)
        self.user_data.progress = value

    @property
    def review(self) -> str:
        """Proxies to MediaUserData.review."""
        return self.user_data.review if self.user_data else ""

    @review.setter
    def review(self, value: str):
        if not self.user_data:
            self.user_data = MediaUserData(item_id=self.id)
        self.user_data.review = value

    @property
    def notes(self) -> str:
        """Proxies to MediaUserData.notes."""
        return self.user_data.notes if self.user_data else ""

    @notes.setter
    def notes(self, value: str):
        if not self.user_data:
            self.user_data = MediaUserData(item_id=self.id)
        self.user_data.notes = value

    @property
    def is_hidden(self) -> bool:
        """Proxies to MediaUserData.is_hidden."""
        return self.user_data.is_hidden if self.user_data else False

    @is_hidden.setter
    def is_hidden(self, value: bool):
        if not self.user_data:
            self.user_data = MediaUserData(item_id=self.id)
        self.user_data.is_hidden = value
    
    @property
    def cover_url(self) -> str:
        """Calculates the dynamic cover URL, favoring external URLs then internal binary data."""
        c_url = ""
        if self.cover:
            c_url = self.cover.cover_url
            if self.cover.cover_image:
                 ts = int(self.updated_at.timestamp()) if self.updated_at else 0
                 c_url = f"{self.id}?v={ts}"
        return c_url

    def to_dict(self) -> dict:
        """
        Serializes the model to a dictionary suitable for JSON responses.
        
        Reconstructs a flat view of the data by aggregating core fields, 
        user-specific data, and technical metadata.
        """
        data = {
            "id": self.id,
            "title": self.title,
            "type": self.type,
            "description": self.description,
            "universe": self.universe,
            "series": self.series,
            "seriesNumber": self.series_number,
            "releaseDate": self.release_date.isoformat() if self.release_date else None,
            "authors": self.authors,
            "tags": self.tags,
            "abbreviations": self.abbreviations,
            "alternateTitles": self.alternate_titles,
            "externalLinks": self.external_links,
            "children": self.children,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "updatedAt": self.updated_at.isoformat() if self.updated_at else None,
            "coverUrl": self.cover_url  # Use the dynamic property
        }
        
        # Aggregate user-specific tracking data
        if self.user_data:
            data.update({
                "status": self.user_data.status,
                "rating": self.user_data.rating,
                "progress": self.user_data.progress,
                "completedAt": self.user_data.completed_at.isoformat() if self.user_data.completed_at else None,
                "rereadCount": self.user_data.reread_count,
                "review": self.user_data.review,
                "notes": self.user_data.notes,
                "isHidden": self.user_data.is_hidden,
            })
        else:
            data.update({
                "status": "Planning",
                "rating": 0,
                "progress": "",
                "completedAt": None,
                "rereadCount": 0,
                "review": "",
                "notes": "",
                "isHidden": False,
            })

        # Aggregate extended technical metadata
        if self.metadata_info:
            data.update({
                "episodeCount": self.metadata_info.episode_count,
                "volumeCount": self.metadata_info.volume_count,
                "chapterCount": self.metadata_info.chapter_count,
                "wordCount": self.metadata_info.word_count,
                "pageCount": self.metadata_info.page_count,
                "avgDurationMinutes": self.metadata_info.avg_duration_minutes,
            })
        
        return data


class MediaCover(db.Model):
    """
    Stores heavy binary image data separately from the core MediaItem.
    
    This separation prevents database performance degradation when listing items,
    as BLOB columns (LargeBinary) significantly increase database page size.
    """
    __tablename__ = "media_covers"

    item_id: Mapped[str] = mapped_column(ForeignKey("media_items.id"), primary_key=True)
    
    cover_image: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    cover_mime: Mapped[str] = mapped_column(String(50), default="")
    cover_url: Mapped[str] = mapped_column(String(255), default="")
    
    item: Mapped["MediaItem"] = relationship("MediaItem", back_populates="cover")


class MediaUserData(db.Model):
    """
    Stores user-specific interaction and tracking data for a media item.
    
    Includes transient state like progress, ratings, and personal reviews.
    """
    __tablename__ = "media_user_data"

    item_id: Mapped[str] = mapped_column(ForeignKey("media_items.id"), primary_key=True)
    
    status: Mapped[str] = mapped_column(String(50), default="Planning")
    rating: Mapped[int] = mapped_column(Integer, default=0)
    progress: Mapped[str] = mapped_column(String(100), default="")
    
    completed_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    reread_count: Mapped[int] = mapped_column(Integer, default=0)

    review: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    
    item: Mapped["MediaItem"] = relationship("MediaItem", back_populates="user_data")


class MediaMetadata(db.Model):
    """
    Stores extended technical statistics and volume/episode metadata.
    """
    __tablename__ = "media_metadata"

    item_id: Mapped[str] = mapped_column(ForeignKey("media_items.id"), primary_key=True)
    
    episode_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    volume_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    chapter_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    word_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    page_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Legacy, kept for compatibility
    avg_duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    item: Mapped["MediaItem"] = relationship("MediaItem", back_populates="metadata_info")


class MediaRelease(db.Model):
    """
    Represents a specific release event (e.g., volume launch, season premiere).
    
    Can be associated with a specific library item or exist as a standalone 
    calendar entry for upcoming content.
    """
    __tablename__ = "media_releases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    item_id: Mapped[Optional[str]] = mapped_column(ForeignKey("media_items.id"), nullable=True)
    
    date: Mapped[date] = mapped_column(Date, nullable=False)
    release_time: Mapped[Optional[time]] = mapped_column(Time, nullable=True)
    content: Mapped[str] = mapped_column(String(255), nullable=False)
    
    is_tracked: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    
    item: Mapped["MediaItem"] = relationship("MediaItem", back_populates="releases")
