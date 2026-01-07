import json
import os
import logging
from typing import Dict, Optional, Any, Tuple

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
        current_config = load_config()
        current_config.update(new_data)
        
        # Atomic write: write to temp file then rename
        tmp_file = CONFIG_FILE + '.tmp'
        with open(tmp_file, 'w') as f:
            json.dump(current_config, f, indent=4)
            f.flush()
            os.fsync(f.fileno())
            
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

def ensure_window_on_screen(x: Optional[int], y: Optional[int], 
                            width: int, height: int) -> Tuple[Optional[int], Optional[int]]:
    """
    Ensures the window position is within visible monitor bounds.
    If position is off-screen or None, returns None to let the OS position it.
    
    Args:
        x: Saved window X position (can be None)
        y: Saved window Y position (can be None)
        width: Window width
        height: Window height
        
    Returns:
        Tuple of (x, y) - validated position, or (None, None) if should use OS default
    """
    if x is None or y is None:
        return None, None
    
    try:
        from screeninfo import get_monitors
        monitors = get_monitors()
        
        if not monitors:
            logger.warning("No monitors detected, using OS default position")
            return None, None
        
        # Check if window center point is visible on any monitor
        window_center_x = x + width // 2
        window_center_y = y + height // 2
        
        for monitor in monitors:
            # Check if window center is within this monitor's bounds
            if (monitor.x <= window_center_x < monitor.x + monitor.width and
                monitor.y <= window_center_y < monitor.y + monitor.height):
                # Window is visible on this monitor
                # Clamp to ensure at least 100px of window is visible
                clamped_x = max(monitor.x - width + 100, min(x, monitor.x + monitor.width - 100))
                clamped_y = max(monitor.y, min(y, monitor.y + monitor.height - 100))
                
                if clamped_x != x or clamped_y != y:
                    logger.info(f"Clamped window position from ({x}, {y}) to ({clamped_x}, {clamped_y})")
                
                return clamped_x, clamped_y
        
        # Window center not on any monitor - position is off-screen
        logger.warning(f"Window position ({x}, {y}) is off-screen, using OS default")
        return None, None
        
    except ImportError:
        logger.warning("screeninfo not available, skipping monitor bounds check")
        return x, y
    except Exception as e:
        logger.error(f"Error checking monitor bounds: {e}")
        return x, y

