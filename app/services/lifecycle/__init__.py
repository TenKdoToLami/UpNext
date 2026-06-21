"""
Application Lifecycle services package for UpNext.
"""

import sys
import os
import logging
import threading
import time
import atexit
import webview
from typing import Callable

from .ipc import (
    check_existing_instance, 
    create_lock_file, 
    remove_lock_file, 
    start_single_instance_listener
)
from .server import wait_for_server, start_flask_server_thread
from .gui import JsApi, setup_window_closing_handler
from .tray import create_tray_menu

logger = logging.getLogger("app_lifecycle")


def run_application_stack(
    create_app_func: Callable, 
    host: str, 
    port: int, 
    headless: bool = False, 
    minimized: bool = False
):
    """
    Main driver function to run the application.
    """
    # Check if another instance is already running (skip for headless mode)
    if not headless and check_existing_instance():
        logger.info("Exiting - another instance is already running")
        sys.exit(0)
    
    if headless or os.environ.get('UPNEXT_HEADLESS') == '1':
        headless = True
        os.environ['UPNEXT_HEADLESS'] = '1'
    
    # 1. Start Flask Server
    start_flask_server_thread(create_app_func, host, port)

    # 2. Wait for server availability
    if not wait_for_server(host, port):
        logger.error("Server failed to start within timeout.")

    target_url = f'http://{host}:{port}'
    
    # Resolve icon path
    basedir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    if sys.platform == 'win32':
        icon_path = os.path.join(basedir, 'app', 'static', 'img', 'icon.ico')
        tray_icon_path = icon_path 
    else:
        icon_path = os.path.join(basedir, 'app', 'static', 'img', 'icon.png')
        tray_icon_path = icon_path

    # If HEADLESS, block main thread
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
    # Global state for tray interaction
    window_ref = [None]
    tray_icon = [None]
    tray_available = [False]
    quick_add_ref = [None]
    is_dormant = [False]

    # Initialize System Tray actions mapping
    actions = create_tray_menu(
        window_ref=window_ref,
        tray_icon=tray_icon,
        tray_available=tray_available,
        quick_add_ref=quick_add_ref,
        is_dormant=is_dormant,
        target_url=target_url,
        tray_icon_path=tray_icon_path,
        JsApi_class=JsApi
    )

    # Safety check: Cannot start minimized if tray is missing
    if minimized and not tray_available[0]:
        logger.warning("Cannot start minimized because System Tray is unavailable. Starting normally.")
        minimized = False

    # Load App Settings Config
    from app.utils.config_manager import load_config
    config = load_config()
    
    # Read saved window geometry from config
    window_state = config.get('window', {})
    initial_width = window_state.get('width', 1200)
    initial_height = window_state.get('height', 800)
    initial_x = window_state.get('x', None)
    initial_y = window_state.get('y', None)
    
    # Validate dimensions against minimum window size
    MIN_WIDTH, MIN_HEIGHT = 800, 600
    if initial_width < MIN_WIDTH or initial_height < MIN_HEIGHT:
        logger.warning(f"Saved window size ({initial_width}x{initial_height}) below minimum, resetting to defaults")
        initial_width = max(initial_width, MIN_WIDTH)
        initial_height = max(initial_height, MIN_HEIGHT)
    
    # Ensure window is on screen
    from app.utils.config_manager import ensure_window_on_screen
    initial_x, initial_y = ensure_window_on_screen(initial_x, initial_y, initial_width, initial_height)
    
    # Determine if window should start hidden
    app_settings = config.get('appSettings', {})
    open_on_start = app_settings.get('openWindowOnStart', True)
    
    if not minimized and not open_on_start and tray_available[0]:
        minimized = True

    if minimized:
        is_dormant[0] = True
        
    from app.build_config import ENABLE_TRAY

    # Create the webview window
    initial_url = 'about:blank' if minimized else target_url
    window = webview.create_window(
        'UpNext', 
        initial_url, 
        width=initial_width, 
        height=initial_height, 
        x=initial_x,
        y=initial_y,
        hidden=minimized, 
        text_select=True,
        js_api=JsApi(window_ref, target_url, quick_add_ref)
    )

    window_ref[0] = window
    
    # Attach closing interceptor
    if ENABLE_TRAY:
        window.events.closing += setup_window_closing_handler(
            window_ref=window_ref,
            is_dormant=is_dormant,
            tray_available=tray_available,
            tray_icon=tray_icon,
            target_url=target_url
        )

    # Force window restore on load
    def on_loaded():
        if window_ref[0] and not is_dormant[0]:
            try:
                window_ref[0].restore()
            except Exception:
                pass
    
    window.events.loaded += on_loaded

    # Initialize System Tray (Platform Specific)
    if ENABLE_TRAY:
        if sys.platform == 'win32':
             if tray_available[0]:
                 actions["setup_pystray_tray"]()
        elif sys.platform == 'linux':
             # Linux tray setup will be handled in startup_handler to ensure it runs on Main Loop
             pass

    # Start single-instance listener and create lock file
    ipc_port = start_single_instance_listener(window_ref, target_url, is_dormant)
    create_lock_file(ipc_port)
    
    # Register cleanup on exit
    atexit.register(remove_lock_file)

    # Apply Windows-specific Icon
    if sys.platform == 'win32':
        try:
            from app.utils.win32_icon import set_window_icon
            set_window_icon("UpNext", icon_path)
        except Exception:
            pass

    # Initialize Manual Application/Tray on Linux (Must happen before webview.start)
    if ENABLE_TRAY and sys.platform == 'linux':
        try:
             from PyQt6.QtWidgets import QApplication, QSystemTrayIcon, QMenu
             from PyQt6.QtGui import QIcon, QAction
             
             app = QApplication.instance()
             if not app:
                 app = QApplication(sys.argv)
            
             app.setQuitOnLastWindowClosed(False)

             if os.path.exists(tray_icon_path):
                 qicon = QIcon(tray_icon_path)
                 tray = QSystemTrayIcon(qicon, app)
                 tray.setToolTip("UpNext")
                 
                 menu = QMenu()
                 
                 def run_threaded(target, *args):
                     threading.Thread(target=target, args=args).start()

                 action_open = QAction("Open", menu)
                 action_open.triggered.connect(lambda: run_threaded(actions["on_restore_native"], None, None))
                 
                 action_browser = QAction("Open in Browser", menu)
                 action_browser.triggered.connect(lambda: run_threaded(actions["on_open_browser"], None, None))
                 
                 action_add = QAction("Add", menu)
                 action_add.triggered.connect(lambda: run_threaded(actions["on_quick_add"], None, None))
                 
                 action_switch = QAction("Switch Library", menu)
                 action_switch.triggered.connect(lambda: run_threaded(actions["on_switch_db"], None, None))
                 
                 def linux_exit():
                     tray.hide()
                     if window_ref[0]:
                         window_ref[0].destroy()
                     os._exit(0)
                     
                 action_exit = QAction("Exit", menu)
                 action_exit.triggered.connect(lambda: run_threaded(linux_exit))
                 
                 menu.addAction(action_open)
                 menu.addAction(action_browser)
                 menu.addSeparator()
                 menu.addAction(action_add)
                 menu.addSeparator()
                 menu.addAction(action_switch)
                 menu.addSeparator()
                 menu.addAction(action_exit)
                 
                 tray.setContextMenu(menu)
                 tray.show()
                 
                 def on_tray_activated(reason):
                     if reason == QSystemTrayIcon.ActivationReason.Trigger:
                         actions["on_open"](None, None)
                          
                 tray.activated.connect(on_tray_activated)
                 
                 tray_icon[0] = tray
                 tray_available[0] = True
             else:
                 logger.error(f"Linux Tray: Icon not found at {tray_icon_path}")

        except Exception as e:
            logger.error(f"Failed to setup Linux tray (Manual Mode): {e}", exc_info=True)

    logger.info("Starting GUI...")
    gui_engine = 'qt' if sys.platform == 'linux' else None
    
    is_frozen = getattr(sys, 'frozen', False)
    debug_mode = not is_frozen or os.environ.get('UPNEXT_DEBUG') == '1'
    webview.start(debug=debug_mode, icon=icon_path, gui=gui_engine)
    
    # Cleanup after loop exit
    remove_lock_file()
    if ENABLE_TRAY and tray_icon[0]:
        if hasattr(tray_icon[0], 'stop'):
            try:
                tray_icon[0].stop()
            except Exception:
                pass
        elif hasattr(tray_icon[0], 'hide'):
            try:
                tray_icon[0].hide()
            except Exception:
                pass
    
    logger.info("Exiting...")
    sys.exit(0)
