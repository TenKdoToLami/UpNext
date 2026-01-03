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

def run_application_stack(create_app_func: Callable, host: str, port: int):
    """
    Main driver function to run the application.
    
    1. Starts Flask Server (Thread)
    2. Waits for Server Port
    3. Launches Native Window
    4. Blocks until window is closed
    """
    # 1. Start Server
    start_flask_server_thread(create_app_func, host, port)

    # 2. Add polling wait for server availability
    if not wait_for_server(host, port):
        logger.error("Server failed to start within timeout.")
        
    # 3. Create Native Window
    target_url = f'http://{host}:{port}'
    launch_browser_app(target_url)

    # Stability fixes for Linux/Qt
    if sys.platform != 'win32':
        # Force UTF-8 locale for Qt 6 compatibility
        try:
            locale.setlocale(locale.LC_ALL, 'C.UTF-8')
        except Exception:
            pass
            
        # Address sandbox and rendering issues on Linux
        # pywebview often suggests this for Arch/Manjaro/Nixos
        os.environ['QTWEBENGINE_DISABLE_SANDBOX'] = '1'
        # Prevent some GPU-related crashes on certain drivers
        if os.environ.get('WEBVIEW_DISABLE_GPU'):
            os.environ['QT_WEBENGINE_DISABLE_GPU'] = '1'
        
        # Ensure encoding is UTF-8
        os.environ['PYTHONIOENCODING'] = 'utf-8'

    # Lazy import webview after environment variables are set
    import webview

    # Resolve icon path (use PNG on Linux, ICO on Windows)
    basedir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if sys.platform == 'win32':
        icon_path = os.path.join(basedir, 'app', 'static', 'img', 'icon.ico')
    else:
        icon_path = os.path.join(basedir, 'app', 'static', 'img', 'icon.png')

    # debug=True enables DevTools (F12) for debugging.
    # We disable auto-opening of DevTools by setting 'OPEN_DEVTOOLS_IN_DEBUG' to False.
    webview.settings['OPEN_DEVTOOLS_IN_DEBUG'] = False
    
    # Manually apply icon for Windows (pywebview 6.x workaround)
    if sys.platform == 'win32':
        try:
            from app.utils.win32_icon import set_window_icon
            # Note: Title must match exactly what is passed to create_window ("UpNext")
            set_window_icon("UpNext", icon_path)
        except Exception as e:
            logger.error(f"Failed to apply Windows icon: {e}")

    # Use a safer start for Linux if needed, but for now we just apply env vars above
    webview.start(debug=True, icon=icon_path)
    
    logger.info("Window closed. Exiting...")
    sys.exit(0)
