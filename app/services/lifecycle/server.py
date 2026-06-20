"""
Flask Backend Thread Management for UpNext.
"""

import time
import socket
import threading
import logging
from typing import Callable

logger = logging.getLogger("app_lifecycle.server")


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


def start_flask_server_thread(create_app_func: Callable, host: str, port: int) -> threading.Thread:
    """Starts the Flask application in a daemon thread."""
    def server_thread():
        app = create_app_func()
        logger.info(f"Server starting at http://{host}:{port}")
        app.run(host=host, port=port, debug=False, use_reloader=False)

    t = threading.Thread(target=server_thread)
    t.daemon = True
    t.start()
    return t
