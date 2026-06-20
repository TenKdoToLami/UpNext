"""
System Tray Integration for UpNext (Windows & Linux).
"""

import sys
import os
import logging
import threading
import webbrowser
from typing import Callable, Any

logger = logging.getLogger("app_lifecycle.tray")


def create_tray_menu(
    window_ref: list, 
    tray_icon: list, 
    tray_available: list, 
    quick_add_ref: list, 
    is_dormant: list, 
    target_url: str,
    tray_icon_path: str,
    JsApi_class: Any
):
    """
    Sets up system tray actions and registers tray icons.
    """
    try:
        import pystray
        from PIL import Image
        tray_available[0] = True
    except Exception as e:
        logger.warning(f"System Tray disabled: Failed to load pystray backend: {e}")
        pystray = None

    def on_open(icon, item):
        from app.utils.config_manager import load_config
        config = load_config()
        action = config.get('appSettings', {}).get('trayClickAction', 'native')

        if action == 'browser':
            on_open_browser(icon, item)
        else:
            on_restore_native(icon, item)

    def on_restore_native(icon, item):
        if window_ref[0]:
            if is_dormant[0]:
                logger.info("Restoring from dormant state...")
                window_ref[0].load_url(target_url)
                is_dormant[0] = False
            
            window_ref[0].restore()
            window_ref[0].show()

            try:
                from app.utils.config_manager import load_config, ensure_window_on_screen
                wx, wy = window_ref[0].x, window_ref[0].y
                ww, wh = window_ref[0].width, window_ref[0].height
                
                config = load_config()
                win_conf = config.get('window', {})
                
                if wx <= -16000 or wy <= -16000 or wx >= 32000 or wy >= 32000:
                    wx = win_conf.get('x', None)
                    wy = win_conf.get('y', None)
                    
                if ww < 800 or wh < 600:
                    ww = max(win_conf.get('width', 1200), 800)
                    wh = max(win_conf.get('height', 800), 600)
                    
                valid_x, valid_y = ensure_window_on_screen(wx, wy, ww, wh)
                
                if valid_x is not None and valid_y is not None:
                    if window_ref[0].x != valid_x or window_ref[0].y != valid_y:
                        logger.info(f"Relocating window back to screen: ({valid_x}, {valid_y})")
                        window_ref[0].move(int(valid_x), int(valid_y))
                        
                if window_ref[0].width != ww or window_ref[0].height != wh:
                    window_ref[0].resize(int(ww), int(wh))
            except Exception as e:
                logger.error(f"Error enforcing geometry on restore: {e}")

    def on_open_browser(icon, item):
        webbrowser.open(target_url)

    def on_exit(icon, item):
        if icon:
            icon.stop()
        if window_ref[0]:
            window_ref[0].destroy()
        os._exit(0)

    def on_quick_add(icon, item):
        """Opens a small window directly to the add modal."""
        import webview
        quick_add_url = f"{target_url}/quick_add"
        
        if window_ref[0]:
             try:
                 api_instance = JsApi_class(window_ref, target_url, quick_add_ref)
                 quick_add_ref[0] = webview.create_window(
                     'Add Entry', 
                     quick_add_url, 
                     width=700, 
                     height=800, 
                     resizable=False, 
                     text_select=True, 
                     js_api=api_instance
                 )
             except Exception as e:
                 logger.error(f"Failed to create quick add window: {e}")

    def on_switch_db(icon, item):
        """Restores window and triggers DB selection."""
        if window_ref[0]:
            if is_dormant[0]:
                window_ref[0].load_url(target_url)
                is_dormant[0] = False
            window_ref[0].restore()
            window_ref[0].show()
            try:
                window_ref[0].evaluate_js("if(window.restartToDbSelect) window.restartToDbSelect();")
            except Exception as e:
                logger.error(f"Failed to switch DB from tray: {e}")

    def setup_pystray_tray():
        if not tray_available[0] or not pystray:
            return

        try:
            image = Image.open(tray_icon_path)
            menu = pystray.Menu(
                pystray.MenuItem("Open", on_open, default=True),
                pystray.MenuItem("Open in Browser", on_open_browser),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Add", on_quick_add),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Switch Library", on_switch_db),
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Exit", on_exit)
            )
            icon = pystray.Icon("UpNext", image, "UpNext", menu)
            tray_icon[0] = icon
            icon.run_detached()
        except Exception as e:
            logger.error(f"Failed to setup tray icon: {e}")

    # Register functions to make them callable from other modules
    tray_actions = {
        "on_open": on_open,
        "on_restore_native": on_restore_native,
        "on_open_browser": on_open_browser,
        "on_exit": on_exit,
        "on_quick_add": on_quick_add,
        "on_switch_db": on_switch_db,
        "setup_pystray_tray": setup_pystray_tray
    }
    
    return tray_actions
