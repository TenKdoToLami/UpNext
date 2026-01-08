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
# Single Instance Lock File and IPC
import tempfile
import json

LOCK_FILE_PATH = os.path.join(tempfile.gettempdir(), 'upnext_instance.lock')
UPNEXT_PROTOCOL_ID = b'UPNEXT_IPC_V1'

def find_free_port() -> int:
    """Find an available port by letting OS assign one."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

def check_existing_instance() -> bool:
    """
    Check if another instance is already running using lock file.
    If so, send a message to show its window and return True.
    """
    if not os.path.exists(LOCK_FILE_PATH):
        return False
    
    try:
        with open(LOCK_FILE_PATH, 'r') as f:
            data = json.load(f)
            ipc_port = data.get('port')
            pid = data.get('pid')
        
        # Check if the process is still running (platform-specific)
        if pid:
            process_running = False
            if sys.platform == 'win32':
                # Windows: Use ctypes to check process
                import ctypes
                PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
                handle = ctypes.windll.kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid)
                if handle:
                    ctypes.windll.kernel32.CloseHandle(handle)
                    process_running = True
            else:
                # Unix: Use kill signal 0
                try:
                    os.kill(pid, 0)
                    process_running = True
                except OSError:
                    pass
            
            if not process_running:
                # Process is dead, lock file is stale
                logger.debug("Found stale lock file, removing")
                os.remove(LOCK_FILE_PATH)
                return False
        
        # Try to connect to the IPC port
        if ipc_port:
            with socket.create_connection(('127.0.0.1', ipc_port), timeout=1.0) as sock:
                sock.sendall(UPNEXT_PROTOCOL_ID)
                response = sock.recv(1024)
                
                if response != UPNEXT_PROTOCOL_ID:
                    return False  # Not UpNext
                
                sock.sendall(b'SHOW_WINDOW')
                response = sock.recv(1024)
                if response == b'OK':
                    logger.info("Another UpNext instance is running. Signaled it to show window.")
                    return True
    except (ConnectionRefusedError, socket.timeout, OSError, json.JSONDecodeError, FileNotFoundError):
        pass
    return False

def create_lock_file(port: int) -> bool:
    """Create lock file with our PID and IPC port."""
    try:
        with open(LOCK_FILE_PATH, 'w') as f:
            json.dump({'pid': os.getpid(), 'port': port}, f)
        return True
    except Exception as e:
        logger.warning(f"Could not create lock file: {e}")
        return False

def remove_lock_file():
    """Remove lock file on exit."""
    try:
        if os.path.exists(LOCK_FILE_PATH):
            os.remove(LOCK_FILE_PATH)
    except:
        pass

def start_single_instance_listener(window_ref: list, target_url: str) -> int:
    """
    Start a listener that accepts connections from new instances.
    Returns the port number used.
    """
    ipc_port = find_free_port()
    
    def listener_thread():
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            server.bind(('127.0.0.1', ipc_port))
            server.listen(1)
            server.settimeout(1.0)
            
            while True:
                try:
                    conn, addr = server.accept()
                    try:
                        data = conn.recv(1024)
                        if data != UPNEXT_PROTOCOL_ID:
                            conn.close()
                            continue
                        
                        conn.sendall(UPNEXT_PROTOCOL_ID)
                        
                        data = conn.recv(1024)
                        if data == b'SHOW_WINDOW':
                            logger.info("Received show window request from another instance")
                            try:
                                if window_ref[0]:
                                    # Just show and restore - don't reload URL
                                    window_ref[0].restore()
                                    window_ref[0].show()
                                conn.sendall(b'OK')
                            except Exception as e:
                                logger.error(f"Failed to show window: {e}")
                                conn.sendall(b'ERROR')
                    finally:
                        conn.close()
                except socket.timeout:
                    continue
                except Exception as e:
                    logger.debug(f"Listener error: {e}")
        except OSError as e:
            logger.warning(f"Could not start IPC listener: {e}")
        finally:
            server.close()
    
    t = threading.Thread(target=listener_thread, daemon=True)
    t.start()
    return ipc_port

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
    # Check if another instance is already running (skip for headless mode)
    if not headless and check_existing_instance():
        logger.info("Exiting - another instance is already running")
        sys.exit(0)
    
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
        # Force disable GPU for QT on Linux to prevent flickering (Wayland/X11 compositing issues)
        os.environ['QT_WEBENGINE_DISABLE_GPU'] = '1'
        os.environ['QT_X11_NO_MITSHM'] = '1'
        # Force XCB (X11) platform to avoid native Wayland flickering issues
        os.environ['QT_QPA_PLATFORM'] = 'xcb'
        
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
        os._exit(0)

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
        """Intercept window closing to minimize to tray or exit based on preference."""
        # Always save window geometry before closing/hiding
        if window_ref[0]:
            try:
                from app.utils.config_manager import save_window_geometry
                save_window_geometry(window_ref[0])
            except Exception as e:
                logger.debug(f"Failed to save window geometry: {e}")
        
        if not tray_available[0] or not tray_icon[0]:
            return True  # Allow close if no tray
        
        # Check user preference
        from app.utils.config_manager import load_config
        config = load_config()
        close_behavior = config.get('appSettings', {}).get('closeBehavior', 'minimize')
        
        if close_behavior == 'exit':
            # Always exit
            logger.info("Exiting (user preference)...")
            return True
        else:
            # Default behavior: minimize to tray (covers 'ask' and 'minimize')
            logger.info("Minimizing to tray...")
            if window_ref[0]:
                window_ref[0].hide()
            return False

    # Create Window
    # To prevent resource starvation, we start with a blank page if minimized (lazy loading)
    initial_url = 'about:blank' if minimized else target_url

    class JsApi:
        """
        Javascript API Bridge.
        Exposed to the native webview to allow frontend -> backend communication.
        """
        def __init__(self, window_ref, target_url):
            self.window_ref = window_ref
            self.target_url = target_url

        def save_app_config(self, key, value):
            """Bridge: Save configuration key/value pair."""
            from app.utils.config_manager import save_config
            save_config({key: value})
            return "OK"
            
        def get_app_config(self):
            """Bridge: Retrieve full configuration."""
            from app.utils.config_manager import load_config
            return load_config()
            
        def download_file(self, relative_url, filename):
            """
            Bridge: Trigger a native file save dialog and download content from local server.
            Useful for exports where in-browser download might be suppressed.
            """
            try:
                if not self.window_ref[0]:
                    return "ERROR: Window not ready"
                
                # 1. Open Native Save Dialog
                save_path = self.window_ref[0].create_file_dialog(
                    webview.SAVE_DIALOG, 
                    directory='', 
                    save_filename=filename
                )
                
                # Handle cancellation (returns None or empty tuple/list depending on OS/version)
                if not save_path:
                    return "CANCELLED"
                
                # webview returns list of paths or string? usually string for save_dialog, but safe check
                if isinstance(save_path, (list, tuple)):
                    if not save_path: return "CANCELLED"
                    save_path = save_path[0]
                
                # 2. Download from local server
                # Construct full URL
                full_url = f"{self.target_url.rstrip('/')}/{relative_url.lstrip('/')}"
                
                import urllib.request
                
                # Stream download to file
                with urllib.request.urlopen(full_url) as response, open(save_path, 'wb') as out_file:
                    import shutil
                    shutil.copyfileobj(response, out_file)
                    
                return "OK"
            except Exception as e:
                logger.error(f"Native download failed: {e}")
                return f"ERROR: {str(e)}"

    # Load Config (for other settings)
    from app.utils.config_manager import load_config
    config = load_config()
    
    # Read saved window geometry from config (with defaults)
    window_state = config.get('window', {})
    initial_width = window_state.get('width', 1200)
    initial_height = window_state.get('height', 800)
    initial_x = window_state.get('x', None)
    initial_y = window_state.get('y', None)
    
    # Determine if window should start hidden
    # Priority: CLI --minimized flag > openWindowOnStart setting
    # If --minimized was passed, always start hidden
    # Otherwise, check the openWindowOnStart setting (defaults to True)
    app_settings = config.get('appSettings', {})
    open_on_start = app_settings.get('openWindowOnStart', True)
    
    # If user preference is to NOT open window on start AND tray is available, start hidden
    if not minimized and not open_on_start and tray_available[0]:
        minimized = True
        
    from app.build_config import ENABLE_TRAY

    # Create the webview window
    # js_api is bound here to enable `window.pywebview.api` in frontend
    window = webview.create_window(
        'UpNext', 
        initial_url, 
        width=initial_width, 
        height=initial_height, 
        x=initial_x,
        y=initial_y,
        hidden=minimized, 
        js_api=JsApi(window_ref, target_url)
    )
    window_ref[0] = window
    
    # Attach closing event to minimize instead of quit if tray is active
    if ENABLE_TRAY:
        window.events.closing += on_closing

    # Initialize System Tray
    if ENABLE_TRAY:
        setup_tray()

    # Start single-instance listener and create lock file
    ipc_port = start_single_instance_listener(window_ref, target_url)
    create_lock_file(ipc_port)
    
    # Register cleanup on exit
    import atexit
    atexit.register(remove_lock_file)

    # Apply Windows-specific Icon
    if sys.platform == 'win32':
        try:
            from app.utils.win32_icon import set_window_icon
            set_window_icon("UpNext", icon_path)
        except Exception:
            pass

    logger.info("Starting GUI...")
    # Start Webview (Blocks Main Thread)
    # Force QT on Linux to prevent flickering issues with GTK/WebKit
    gui_engine = 'qt' if sys.platform == 'linux' else None
    webview.start(debug=True, icon=icon_path, gui=gui_engine)
    
    # Cleanup after loop exit
    remove_lock_file()
    if ENABLE_TRAY and tray_icon[0]:
        tray_icon[0].stop()
    
    logger.info("Exiting...")
    sys.exit(0)
