"""
Data Manager Service for UpNext.

Handles persistence of library items to the JSON database.
"""

import os
import json
import logging
from typing import List, Dict, Any, Union

from app.config import DATA_DIR, DB_FILE

logger = logging.getLogger(__name__)


class DataManager:
    """
    Handles data persistence for the application using a JSON file.
    """

    def __init__(self):
        self._ensure_structure()

    def _ensure_structure(self) -> None:
        """Creates data directory and database file if they don't exist."""
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
            if not os.path.exists(DB_FILE):
                with open(DB_FILE, 'w', encoding='utf-8') as f:
                    json.dump([], f)
                logger.info(f"Created new database file at {DB_FILE}")
        except Exception as e:
            logger.error(f"Error ensuring data structure: {e}")
            raise

    def load_items(self) -> List[Dict[str, Any]]:
        """
        Loads all items from the JSON database.

        Returns:
            List[Dict[str, Any]]: The list of items. Returns empty list on error.
        """
        try:
            if not os.path.exists(DB_FILE):
                return []
                
            with open(DB_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except json.JSONDecodeError:
            logger.error(f"Corrupt DB file: {DB_FILE}")
            return []
        except Exception as e:
            logger.error(f"Error loading DB: {e}")
            return []

    def save_items(self, items: List[Dict[str, Any]]) -> bool:
        """
        Saves the list of items to the JSON database.

        Args:
            items (List[Dict[str, Any]]): The items to save.

        Returns:
            bool: True on success, False on error.
        """
        try:
            # Atomic save (write to temp then rename)
            temp_file = f"{DB_FILE}.tmp"
            with open(temp_file, 'w', encoding='utf-8') as f:
                json.dump(items, f, indent=2, ensure_ascii=False)
            
            os.replace(temp_file, DB_FILE)
            return True
        except Exception as e:
            logger.error(f"Error saving DB: {e}")
            if os.path.exists(temp_file):
                os.remove(temp_file)
            return False
