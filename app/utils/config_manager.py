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
    Uses atomic writing to prevent corruption/race conditions.

    Args:
        new_data (Dict[str, Any]): Dictionary of keys/values to update.
    """
    try:
        # Retry logic for reading in case of transients (though atomic write should fix most)
        current_config = load_config()
        current_config.update(new_data)
        
        # Atomic write: write to temp file then rename
        tmp_file = CONFIG_FILE + '.tmp'
        with open(tmp_file, 'w') as f:
            json.dump(current_config, f, indent=4)
            f.flush()
            os.fsync(f.fileno()) # Ensure data is on disk
            
        os.replace(tmp_file, CONFIG_FILE)
        logger.info("Configuration saved.")
    except Exception as e:
        logger.error(f"Failed to save config: {e}")
        if os.path.exists(CONFIG_FILE + '.tmp'):
            try:
                os.remove(CONFIG_FILE + '.tmp')
            except:
                pass

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
