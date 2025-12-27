import json
import os
import logging
from typing import Dict, Optional, Any

from app.config import DATA_DIR

logger = logging.getLogger("config_manager")

CONFIG_FILE = os.path.join(DATA_DIR, 'config.json')

def load_config() -> Dict[str, Any]:
    """
    Loads the persistent configuration from data/config.json.
    
    Returns:
        Dict[str, Any]: Configuration dictionary. Empty if file missing.
    """
    if not os.path.exists(CONFIG_FILE):
        return {}
    try:
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load config: {e}")
        return {}

def save_config(new_data: Dict[str, Any]) -> None:
    """
    Updates the configuration file with new data. 
    Merges with existing data to prevent data loss.

    Args:
        new_data (Dict[str, Any]): Dictionary of keys/values to update.
    """
    try:
        current_config = load_config()
        current_config.update(new_data)
        
        with open(CONFIG_FILE, 'w') as f:
            json.dump(current_config, f, indent=4)
        logger.info("Configuration saved.")
    except Exception as e:
        logger.error(f"Failed to save config: {e}")

def save_window_geometry(window: Any) -> None:
    """Helper to save just the window geometry."""
    save_config({
        'window': {
            'width': window.width,
            'height': window.height,
            'x': window.x,
            'y': window.y
        }
    })
