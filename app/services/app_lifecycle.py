"""
Application Lifecycle Service.

Centralizes the logic for starting the Flask server, launching the UI,
and monitoring the process lifecycle.
"""
import sys
import threading
import time
import socket
import logging
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
    3. Launches Browser (Process)
    4. Monitors Browser Process & Handles Shutdown
    """
    # 1. Start Server
    start_flask_server_thread(create_app_func, host, port)

    # 2. Add polling wait for server availability
    if not wait_for_server(host, port):
        logger.error("Server failed to start within timeout.")
        
    # 3. Launch UI via Service
    target_url = f'http://{host}:{port}'
    start_time = time.time()
    logger.info("Launching browser...")
    process = launch_browser_app(target_url)

    if not process:
        print("\n" + "=" * 50)
        print("WARNING: 'App Mode' not supported by found browser.")
        print("Opened in standard tab. Automatic shutdown disabled.")
        print("You must press Ctrl+C to stop the server.")
        print("=" * 50 + "\n")

    # 4. Handle Process Lifecycle
    if process:
        try:
            process.wait()
            end_time = time.time()
            duration = end_time - start_time
            
            if duration < 5:
                print("\n" + "!" * 50)
                print("Window closed almost immediately after launch.")
                print("!" * 50)
                # In frozen apps, input might not be available, handle gracefully
                if sys.stdin and sys.stdin.isatty():
                    user_input = input("Stop the server and exit? (Y/n): ").strip().lower()
                    if user_input in ('y', 'yes', ''):
                        logger.info("Shutting down...")
                        sys.exit(0)
                    else:
                        logger.info("Keeping server alive. Press Ctrl+C to exit manually.")
                else:
                     logger.warning("Interactive prompt skipped (no TTY). Keeping server alive safely.")
            else:
                logger.info("Browser closed. Shutting down server...")
                sys.exit(0)

        except KeyboardInterrupt:
            logger.info("Interrupted. Shutting down...")
            if process.poll() is None:
                process.terminate()
            sys.exit(0)
    
    # 5. Fallback loop
    if threading.active_count() > 0:
        logger.info("Server is running. Press Ctrl+C to exit.")
        try:
            if sys.stdin and sys.stdin.isatty():
                input()
            else:
                while True:
                    time.sleep(1)
        except (KeyboardInterrupt, EOFError):
            logger.info("Shutting down...")
            sys.exit(0)
