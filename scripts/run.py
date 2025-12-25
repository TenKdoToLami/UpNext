"""
Main Application Entry Point.

This script initializes the Flask server in a daemon thread and 
launches the user's browser to display the application interface.
"""
import os
import sys
import threading
import time
import subprocess
import logging
import webbrowser
from typing import Tuple, Optional

# Ensure app module can be imported from parent directory
# Root dir is one level up from this script
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(root_dir)

from app import create_app
from app.config import HOST, PORT, DATA_DIR
from app.services.browser import get_browser_path
from app.utils.logging_setup import setup_logging

# Configure logging
setup_logging()
logger = logging.getLogger("run")


def start_server() -> None:
    """
    Initializes and starts the Flask application.
    
    This function is intended to run as a background daemon thread.
    """
    app = create_app()
    logger.info(f"Server starting at http://{HOST}:{PORT}")
    # Reloader is disabled to avoid starting nested threads
    app.run(host=HOST, port=PORT, debug=False, use_reloader=False)


def launch_browser(target_url: str) -> bool:
    """
    Attempts to launch the user's browser in a focused 'App Mode'.
    
    Favors Chromium-based browsers for their support of the --app flag.
    Falls back to a standard browser tab if no suitable executable is found.
    
    Args:
        target_url: The application URL to open.
        
    Returns:
        bool: True if the launch process is blocking (waiting for exit), False otherwise.
    """
    browser_exe, is_chromium = get_browser_path()

    if not browser_exe:
        logger.warning("No recognized browser found in PATH. Falling back to default.")
        webbrowser.open(target_url)
        return False

    logger.debug(f"Targeting browser executable: {browser_exe}")

    if is_chromium:
        return _launch_chromium_app(browser_exe, target_url)
    
    # Non-chromium fallback
    logger.info("Opening application in standard browser tab.")
    webbrowser.get(browser_exe).open(target_url)
    return False


def _launch_chromium_app(browser_exe: str, target_url: str) -> bool:
    """
    Launches a Chromium instance with app-specific flags and a dedicated profile.
    
    Args:
        browser_exe: Path to chromium/chrome/edge executable.
        target_url: The library URL.
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
    	subprocess.Popen(cmd)
    	return False  # Non-blocking launch
    except Exception as e:
    	logger.error(f"Failed to launch in app-mode: {e}")
    	webbrowser.open(target_url)
    	return False



def main() -> None:
    """Main entry point."""
    # Check frozen state (PyInstaller)
    if getattr(sys, 'frozen', False):
        os.chdir(os.path.dirname(sys.executable))

    # 1. Start Flask in background thread
    t = threading.Thread(target=start_server)
    t.daemon = True
    t.start()

    # 2. Give server a moment
    time.sleep(0.5)

    # 3. Launch UI
    target_url = f'http://{HOST}:{PORT}'
    waited = launch_browser(target_url)

    # 4. Cleanup/Exit when browser closes (if app mode waits)
    # If browser didn't wait (non-app mode), keep script alive manually
    if not waited and threading.active_count() > 0:
        print("Server is running. Press Enter to exit.")
        try:
             input()
        except EOFError:
            pass


if __name__ == '__main__':
    main()
