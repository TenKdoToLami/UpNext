"""
Browser Service.

Handles the creation and management of the native window using pywebview.
"""
import logging
import webview
from typing import Optional

logger = logging.getLogger("browser")

def launch_browser_app(url: str, title: str = "UpNext") -> Optional[webview.Window]:
    """
    Launches the webview window pointing to the specified URL.
    
    Args:
        url: The local server URL to display.
        title: The window title.
    """
    try:
        logger.info(f"Creating webview window for {url}")
        
        # Load saved config
        from app.utils.config_manager import (
            load_config, save_window_geometry, save_config, ensure_window_on_screen
        )
        config = load_config()
        
        # Access 'window' key safely
        window_state = config.get('window', {})
        
        initial_width = window_state.get('width', 1200)
        initial_height = window_state.get('height', 800)
        saved_x = window_state.get('x', None)
        saved_y = window_state.get('y', None)
        
        initial_x, initial_y = ensure_window_on_screen(
            saved_x, saved_y, initial_width, initial_height
        )

        class JsApi:
            def save_app_config(self, key, value):
                """Bridge to save config from JS."""
                save_config({key: value})
                return "OK"
                
            def get_app_config(self):
                """Bridge to get full config from JS."""
                return load_config()

        window = webview.create_window(
            title, 
            url, 
            width=initial_width, 
            height=initial_height,
            x=initial_x,
            y=initial_y,
            resizable=True,
            min_size=(800, 600),
            text_select=False,
            js_api=JsApi()
        )
        
        # Bind close event to save window geometry
        def on_closing():
            save_window_geometry(window)
        
        window.events.closing += on_closing
        
        return window
    except Exception as e:
        logger.error(f"Failed to create webview window: {e}")
        return None

