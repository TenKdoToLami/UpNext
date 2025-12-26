"""
Browser Utility Service.

Helper functions to locate and launch the user's web browser, 
specifically targeting Chromium-based browsers for "App Mode".
"""
import os
import shutil
import platform
import subprocess
import webbrowser
import logging
from typing import Tuple, Optional

# Late import to avoid circular dependency if config imports services (unlikely but safe)
from app.config import DATA_DIR

logger = logging.getLogger("browser_service")

def get_browser_path() -> Tuple[Optional[str], bool]:
    """
    Finds a Chromium-based browser (Edge or Chrome) across Windows/Linux/Mac.
    
    Returns:
        tuple: (path_to_executable_or_None, is_chromium_boolean)
    """
    system = platform.system()

    # 1. Windows Specific Paths (Chromium)
    if system == 'Windows':
        local_app_data = os.environ.get('LOCALAPPDATA', '')
        paths = [
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        ]
        if local_app_data:
            paths.extend([
                os.path.join(local_app_data, r"Microsoft\Edge\Application\msedge.exe"),
                os.path.join(local_app_data, r"Google\Chrome\Application\chrome.exe"),
            ])
            
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


def launch_browser_app(target_url: str) -> Optional[subprocess.Popen]:
    """
    Attempts to launch the user's browser in a focused 'App Mode'.
    
    Favors Chromium-based browsers for their support of the --app flag.
    Falls back to a standard browser tab if no suitable executable is found.
    
    Args:
        target_url: The application URL to open.
        
    Returns:
        Optional[subprocess.Popen]: The browser process object if launched in app mode, None otherwise.
    """
    browser_exe, is_chromium = get_browser_path()

    if not browser_exe:
        logger.warning("No recognized browser found in PATH. Falling back to default.")
        webbrowser.open(target_url)
        return None

    logger.debug(f"Targeting browser executable: {browser_exe}")

    if is_chromium:
        return _launch_chromium_app(browser_exe, target_url)
    
    # Non-chromium fallback
    logger.info("Opening application in standard browser tab.")
    webbrowser.get(browser_exe).open(target_url)
    return None


def _launch_chromium_app(browser_exe: str, target_url: str) -> Optional[subprocess.Popen]:
    """
    Launches a Chromium instance with app-specific flags and a dedicated profile.
    
    Args:
        browser_exe: Path to chromium/chrome/edge executable.
        target_url: The library URL.
        
    Returns:
        Optional[subprocess.Popen]: The process object if successful.
    """
    profile_dir = os.path.join(DATA_DIR, "browser_profile")
    os.makedirs(profile_dir, exist_ok=True)

    # CLI flags to make the browser feel like a native desktop app
    cmd = [
        browser_exe,
        f'--app={target_url}',
        f'--user-data-dir={profile_dir}',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1280,850'
    ]

    try:
        logger.info("Launching UpNext Desktop Window...")
        process = subprocess.Popen(cmd)
        return process
    except Exception as e:
        logger.error(f"Failed to launch in app-mode: {e}")
        webbrowser.open(target_url)
        return None
