"""
Image Service for UpNext.

Handles all image-related operations including processing uploads,
validating file types, and managing file deletions.
"""

import os
import uuid
import logging
from typing import Optional
from werkzeug.datastructures import FileStorage

from app.config import IMAGES_DIR

logger = logging.getLogger(__name__)

# Allowed image extensions
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}
DEFAULT_EXT = '.jpg'


class ImageService:
    """Service class for managing image files."""

    def __init__(self):
        self._ensure_storage()

    def _ensure_storage(self) -> None:
        """Ensures the image storage directory exists."""
        os.makedirs(IMAGES_DIR, exist_ok=True)

    def process_image(self, file_storage: Optional[FileStorage]) -> Optional[str]:
        """
        Saves an uploaded image with a unique name.

        Args:
            file_storage (Optional[FileStorage]): The uploaded file object.

        Returns:
            Optional[str]: The saved filename, or None if no file or error.
        """
        if not file_storage or not file_storage.filename:
            return None

        # Validate and normalize extension
        ext = os.path.splitext(file_storage.filename)[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            ext = DEFAULT_EXT

        # Generate unique filename
        filename = f"{uuid.uuid4().hex}{ext}"
        target_path = os.path.join(IMAGES_DIR, filename)

        try:
            file_storage.save(target_path)
            logger.info(f"Image saved: {filename}")
            return filename
        except Exception as e:
            logger.error(f"Image processing error for {filename}: {e}")
            return None

    def delete_image(self, filename: Optional[str]) -> bool:
        """
        Deletes an image file from disk.

        Args:
            filename (Optional[str]): The filename to delete.

        Returns:
            bool: True if deleted or didn't exist, False on error.
        """
        if not filename:
            return True

        path = os.path.join(IMAGES_DIR, filename)
        if os.path.exists(path):
            try:
                os.remove(path)
                logger.info(f"Image deleted: {filename}")
                return True
            except Exception as e:
                logger.error(f"Error deleting image {filename}: {e}")
                return False
        return True
