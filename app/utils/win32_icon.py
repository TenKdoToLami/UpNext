import sys
import logging
import time
import threading
from typing import Optional

# Only import Windows-specific modules on Windows
if sys.platform == "win32":
    import ctypes
    from ctypes import wintypes
else:
    # Placeholders for non-Windows platforms to avoid NameErrors if called
    ctypes = None
    wintypes = None

logger = logging.getLogger("win32_icon")

# Windows Constants
WM_SETICON = 0x0080
ICON_SMALL = 0
ICON_BIG = 1
LR_LOADFROMFILE = 0x00000010
IMAGE_ICON = 1

def set_window_icon(title: str, icon_path: str) -> None:
    """
    Sets the window icon for a window with the given title using Win32 API.
    
    This function spawns a background thread to poll for the window, as pywebview
    may take a moment to initialize the native handle. It attempts to find the 
    window for up to 10 seconds.
    
    Args:
        title (str): The exact title of the target window.
        icon_path (str): Absolute path to the .ico file.
    """
    user32 = ctypes.windll.user32
    
    # Load the icon
    h_icon = user32.LoadImageW(
        None, 
        icon_path, 
        IMAGE_ICON, 
        0, 0, 
        LR_LOADFROMFILE
    )
    
    if not h_icon:
        logger.error(f"Failed to load icon from {icon_path}")
        return

    def find_window_callback():
        hwnd = 0
        checks = 0
        max_checks = 20 # 10 seconds
        
        while hwnd == 0 and checks < max_checks:
            hwnd = user32.FindWindowW(None, title)
            if hwnd:
                # Set Big Icon (Taskbar/Alt-Tab)
                user32.SendMessageW(hwnd, WM_SETICON, ICON_BIG, h_icon)
                # Set Small Icon (Titlebar)
                user32.SendMessageW(hwnd, WM_SETICON, ICON_SMALL, h_icon)
                logger.info(f"Icon applied to window '{title}'")
                return
            time.sleep(0.5)
            checks += 1
            
        logger.warning(f"Could not find window '{title}' to set icon.")

    # Run in a separate thread to not block main execution
    threading.Thread(target=find_window_callback, daemon=True).start()
