"""
IPC and Instance Lock Management for UpNext.
"""

import sys
import os
import socket
import json
import tempfile
import threading
import logging

logger = logging.getLogger("app_lifecycle.ipc")

LOCK_FILE_PATH = os.path.join(tempfile.gettempdir(), "upnext_instance.lock")
UPNEXT_PROTOCOL_ID = b"UPNEXT_IPC_V1"


def find_free_port() -> int:
    """Find an available port by letting OS assign one."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def check_existing_instance() -> bool:
    """
    Check if another instance is already running using lock file.
    If so, send a message to show its window and return True.
    """
    if not os.path.exists(LOCK_FILE_PATH):
        return False

    try:
        with open(LOCK_FILE_PATH, "r") as f:
            data = json.load(f)
            ipc_port = data.get("port")
            pid = data.get("pid")

        # Check if the process is still running (platform-specific)
        if pid:
            process_running = False
            if sys.platform == "win32":
                # Windows: Use ctypes to check process
                import ctypes

                PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
                handle = ctypes.windll.kernel32.OpenProcess(
                    PROCESS_QUERY_LIMITED_INFORMATION, False, pid
                )
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
            with socket.create_connection(("127.0.0.1", ipc_port), timeout=1.0) as sock:
                sock.sendall(UPNEXT_PROTOCOL_ID)
                response = sock.recv(1024)

                if response != UPNEXT_PROTOCOL_ID:
                    return False  # Not UpNext

                sock.sendall(b"SHOW_WINDOW")
                response = sock.recv(1024)
                if response == b"OK":
                    logger.info(
                        "Another UpNext instance is running. Signaled it to show window."
                    )
                    return True
    except (
        ConnectionRefusedError,
        socket.timeout,
        OSError,
        json.JSONDecodeError,
        FileNotFoundError,
    ):
        pass
    return False


def create_lock_file(port: int) -> bool:
    """Create lock file with our PID and IPC port."""
    try:
        with open(LOCK_FILE_PATH, "w") as f:
            json.dump({"pid": os.getpid(), "port": port}, f)
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


def start_single_instance_listener(
    window_ref: list, target_url: str, is_dormant: list
) -> int:
    """
    Start a listener that accepts connections from new instances.
    Returns the port number used.
    """
    ipc_port = find_free_port()

    def listener_thread():
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            server.bind(("127.0.0.1", ipc_port))
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
                        if data == b"SHOW_WINDOW":
                            logger.info(
                                "Received show window request from another instance"
                            )
                            try:
                                if window_ref[0]:
                                    # Restore from dormant state if needed
                                    if is_dormant[0]:
                                        logger.info(
                                            "Restoring from dormant state on IPC signal..."
                                        )
                                        window_ref[0].load_url(target_url)
                                        is_dormant[0] = False
                                    window_ref[0].restore()
                                    window_ref[0].show()
                                conn.sendall(b"OK")
                            except Exception as e:
                                logger.error(f"Failed to show window: {e}")
                                conn.sendall(b"ERROR")
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
