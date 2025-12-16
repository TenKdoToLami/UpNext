"""
Browser Utility Service.

Helper functions to locate and launch the user's web browser, 
specifically targeting Chromium-based browsers for "App Mode".
"""
import os
import shutil
import platform
from typing import Tuple, Optional

def get_browser_path() -> Tuple[Optional[str], bool]:
    """
    Finds a Chromium-based browser (Edge or Chrome) across Windows/Linux/Mac.
    
    Returns:
        tuple: (path_to_executable_or_None, is_chromium_boolean)
    """
    system = platform.system()

    # 1. Windows Specific Paths (Chromium)
    if system == 'Windows':
        paths = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ]
        for p in paths:
            if os.path.exists(p):
                return p, True

    # 2. Linux / General Chromium binary names to check in PATH
    chromium_binaries = [
        "microsoft-edge",
        "msedge",
        "google-chrome-stable",
        "google-chrome",
        "chrome",
        "chromium",
        "chromium-browser",
        "brave-browser"
    ]

    for binary in chromium_binaries:
        path = shutil.which(binary)
        if path:
            return path, True

    # 3. MacOS specific fallback (Chromium)
    if system == 'Darwin':
        mac_paths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
        ]
        for p in mac_paths:
            if os.path.exists(p):
                return p, True

    # 4. Fallback for non-Chromium browsers (like Firefox on Linux)
    if system == 'Linux':
        firefox_binaries = ["firefox", "firefox-esr"]
        for binary in firefox_binaries:
            path = shutil.which(binary)
            if path:
                # Return path but indicate app_mode is NOT supported (is_chromium=False)
                return path, False

    return None, False
