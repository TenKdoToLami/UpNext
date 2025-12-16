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

# Ensure app module can be imported
# Ensure app module can be imported from parent directory
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from app.config import HOST, PORT, DATA_DIR
from app.services.browser import get_browser_path
from app.utils.logging_setup import setup_logging

# Configure logging
setup_logging()
logger = logging.getLogger("run")


def start_server() -> None:
    """Starts the Flask server in a thread."""
    app = create_app()
    logger.info(f"Starting server at http://{HOST}:{PORT}")
    # use_reloader=False is required when running in a thread
    app.run(host=HOST, port=PORT, debug=False, use_reloader=False)


def launch_browser(target_url: str) -> None:
    """Launches the browser in app mode if possible."""
    browser_exe, is_chromium = get_browser_path()

    if not browser_exe:
        logger.warning("⚠️ No recognized browser path found. Opening default.")
        webbrowser.open(target_url)
        return

    logger.info(f"✅ Found Browser: {browser_exe}")

    if is_chromium:
        _launch_chromium_app(browser_exe, target_url)
    else:
        logger.info("🌐 Opening in default browser window.")
        webbrowser.get(browser_exe).open(target_url)


def _launch_chromium_app(browser_exe: str, target_url: str) -> None:
    """Helper to launch Chromium in app mode."""
    profile_dir = os.path.join(DATA_DIR, "browser_profile")
    os.makedirs(profile_dir, exist_ok=True)

    cmd = [
        browser_exe,
        f'--app={target_url}',
        f'--user-data-dir={profile_dir}',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=1280,850'
    ]

    try:
        logger.info("🚀 Launching App Window...")
        proc = subprocess.Popen(cmd)
        proc.wait()
        logger.info("👋 App Window Closed. Exiting...")
    except Exception as e:
        logger.error(f"❌ Error launching app mode: {e}")
        webbrowser.open(target_url)


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
    launch_browser(target_url)

    # 4. Cleanup/Exit when browser closes (if app mode waits)
    # If browser doesn't wait (like non-app mode), keep script alive
    if threading.active_count() > 0:
        print("Server is running. Press Enter to exit if window is closed.")
        try:
             input()
        except EOFError:
            pass


if __name__ == '__main__':
    main()
