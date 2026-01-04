"""
Application Lifecycle Service.

Centralizes the logic for starting the Flask server and running the native GUI.
"""
import sys
import threading
import time
import socket
import logging
import os
import locale
from typing import Callable

from app.services.browser import launch_browser_app

logger = logging.getLogger("app_lifecycle")

def wait_for_server(host: str, port: int, timeout: float = 5.0) -> bool:
    """Polls the server port until it becomes available."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with socket.create_connection((host, port), timeout=0.1):
                return True
        except (socket.timeout, ConnectionRefusedError):
            time.sleep(0.1)
    return False

def start_flask_server_thread(create_app_func: Callable, host: str, port: int):
    """Starts the Flask application in a daemon thread."""
    def server_thread():
        app = create_app_func()
        logger.info(f"Server starting at http://{host}:{port}")
        app.run(host=host, port=port, debug=False, use_reloader=False)

    t = threading.Thread(target=server_thread)
    t.daemon = True
    t.start()
    return t

from PIL import Image


def run_application_stack(create_app_func: Callable, host: str, port: int, headless: bool = False, minimized: bool = False):
    """
    Main driver function to run the application.
    
    Args:
        create_app_func: Factory function to create Flask app
        host: Host to bind to
        port: Port to bind to
        headless: If True, runs without GUI (server only)
        minimized: If True, starts with window hidden (Tray only)
    """
    # 1. Start Server
    start_flask_server_thread(create_app_func, host, port)

    # 2. Add polling wait for server availability
    if not wait_for_server(host, port):
        logger.error("Server failed to start within timeout.")

    target_url = f'http://{host}:{port}'
    
    # Resolve icon path
    basedir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if sys.platform == 'win32':
        icon_path = os.path.join(basedir, 'app', 'static', 'img', 'icon.ico')
        tray_icon_path = icon_path # Use .ico for Windows tray if preferred, but PIL loads images
        # PIL needs an image file, pystray on windows handles ICO well if loaded as Image
    else:
        icon_path = os.path.join(basedir, 'app', 'static', 'img', 'icon.png')
        tray_icon_path = icon_path

    # If HEADLESS, simply block main thread
    if headless:
        logger.info("Running in HEADLESS mode. Server is active.")
        logger.info(f"Access at: {target_url}")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Headless server stopping...")
            sys.exit(0)

    # --- GUI & TRAY MODE ---
    
    # Stability fixes for Linux/Qt (Existing logic)
    if sys.platform != 'win32':
        try:
            locale.setlocale(locale.LC_ALL, 'C.UTF-8')
        except Exception:
            pass
        os.environ['QTWEBENGINE_DISABLE_SANDBOX'] = '1'
        if os.environ.get('WEBVIEW_DISABLE_GPU'):
            os.environ['QT_WEBENGINE_DISABLE_GPU'] = '1'
        os.environ['PYTHONIOENCODING'] = 'utf-8'

    import webview

    # Configure Webview
    webview.settings['OPEN_DEVTOOLS_IN_DEBUG'] = False
    
    # Global state for tray interaction
    window_ref = [None] # Mutable container to hold window reference for closures
    tray_icon = [None]
    tray_available = [False]

    # Try to import pystray safely
    # Linux often requires AppIndicator3/AyatanaAppIndicator3 which might be missing
    try:
        import pystray # type: ignore
        tray_available[0] = True
    except Exception as e:
        logger.warning(f"System Tray disabled: Failed to load pystray backend: {e}")
        # Make dummy pystray module or just ignore
        pystray = None

    # Safety check: Cannot start minimized if tray is missing (App would be invisible/unreachable)
    if minimized and not tray_available[0]:
        logger.warning("Cannot start minimized because System Tray is unavailable. Starting normally.")
        minimized = False

    def on_open(icon, item):
        # Check user preference for double-click action
        from app.utils.config_manager import load_config
        config = load_config()
        action = config.get('appSettings', {}).get('trayClickAction', 'native')

        if action == 'browser':
            on_open_browser(icon, item)
        else:
            on_restore_native(icon, item)

    def on_restore_native(icon, item):
        if window_ref[0]:
            # Lazy load URL if started minimized
            # Using private attribute _url or get_current_url logic depending on API
            # For simplicity, we just load it if we suspect it's blank/initial.
            # But safer is to just call load_url(target_url) which is idempotent-ish or cheap.
            # We check a flag or just do it.
            if minimized: # Using the outer scope variable 'minimized' which was True
                 # But we need to know if it's FIRST time.
                 # Let's inspect the current URL if possible, or just force load it if it's 'data:...' or 'about:blank'
                 # window.get_current_url() might not be reliable before show.
                 # Optimization: access private webview object or just always load_url.
                 # Calling load_url repeatedly is fine.
                 window_ref[0].load_url(target_url)
            
            window_ref[0].restore()
            window_ref[0].show()

    import webbrowser

    def on_open_browser(icon, item):
        webbrowser.open(target_url)

    def on_exit(icon, item):
        icon.stop()
        if window_ref[0]:
            window_ref[0].destroy()
        sys.exit(0)

    def setup_tray():
        if not tray_available[0] or not pystray:
            return

        try:
            image = Image.open(tray_icon_path)
            menu = pystray.Menu(
                pystray.MenuItem("Open UpNext", on_open, default=True),
                pystray.MenuItem("Open in Browser", on_open_browser),
                pystray.MenuItem("Exit", on_exit)
            )
            icon = pystray.Icon("UpNext", image, "UpNext", menu)
            tray_icon[0] = icon
            # Run detached so it doesn't block (webview needs main thread)
            icon.run_detached()
        except Exception as e:
            logger.error(f"Failed to setup tray icon: {e}")

    def on_closing():
        """Intercept window closing to minimize to tray instead."""
        if tray_available[0] and tray_icon[0]: # If tray is active
            logger.info("Minimizing to tray...")
            if window_ref[0]:
                window_ref[0].hide()
            return False # Cancel close
        return True # Allow close if no tray

    # Create Window
    # To prevent resource starvation, we start with a blank page if minimized (lazy loading)
    initial_url = 'about:blank' if minimized else target_url

    class JsApi:
        """
        Javascript API Bridge.
        Exposed to the native webview to allow frontend -> backend communication.
        """
        def save_app_config(self, key, value):
            """Bridge: Save configuration key/value pair."""
            from app.utils.config_manager import save_config
            save_config({key: value})
            return "OK"
            
        def get_app_config(self):
            """Bridge: Retrieve full configuration."""
            from app.utils.config_manager import load_config
            return load_config()

    from app.build_config import ENABLE_TRAY

    # Create the webview window
    # js_api is bound here to enable `window.pywebview.api` in frontend
    window = webview.create_window(
        'UpNext', 
        initial_url, 
        width=1200, 
        height=800, 
        hidden=minimized, 
        js_api=JsApi()
    )
    window_ref[0] = window
    
    # Attach closing event to minimize instead of quit if tray is active
    if ENABLE_TRAY:
        window.events.closing += on_closing

    # Initialize System Tray
    if ENABLE_TRAY:
        setup_tray()

    # Apply Windows-specific Icon
    if sys.platform == 'win32':
        try:
            from app.utils.win32_icon import set_window_icon
            set_window_icon("UpNext", icon_path)
        except Exception:
            pass

    logger.info("Starting GUI...")
    # Start Webview (Blocks Main Thread)
    webview.start(debug=True, icon=icon_path)
    
    # Cleanup after loop exit
    if ENABLE_TRAY and tray_icon[0]:
        tray_icon[0].stop()
    
    logger.info("Exiting...")
    sys.exit(0)
