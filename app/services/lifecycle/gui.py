"""
GUI Window Configuration and JS Bridge for UpNext.
"""

import sys
import os
import logging
import urllib.request
import shutil
import webview
from typing import Any, Optional

logger = logging.getLogger("app_lifecycle.gui")


class JsApi:
    """
    Javascript API Bridge.
    Exposed to the native webview to allow frontend -> backend communication.
    """

    def __init__(self, window_ref: list, target_url: str, quick_add_ref: list):
        self.window_ref = window_ref
        self.target_url = target_url
        self.quick_add_ref = quick_add_ref

    def save_app_config(self, key: str, value: Any) -> str:
        """Bridge: Save configuration key/value pair."""
        from app.utils.config_manager import save_config

        save_config({key: value})
        return "OK"

    def get_app_config(self) -> dict:
        """Bridge: Retrieve full configuration."""
        from app.utils.config_manager import load_config

        return load_config()

    def download_file(self, relative_url: str, filename: str) -> str:
        """
        Bridge: Trigger a native file save dialog and download content from local server.
        """
        try:
            if not self.window_ref[0]:
                return "ERROR: Window not ready"

            # 1. Open Native Save Dialog
            save_path = self.window_ref[0].create_file_dialog(
                webview.SAVE_DIALOG, directory="", save_filename=filename
            )

            if not save_path:
                return "CANCELLED"

            if isinstance(save_path, (list, tuple)):
                if not save_path:
                    return "CANCELLED"
                save_path = save_path[0]

            # 2. Stream download from local server
            full_url = f"{self.target_url.rstrip('/')}/{relative_url.lstrip('/')}"

            with urllib.request.urlopen(full_url) as response, open(
                save_path, "wb"
            ) as out_file:
                shutil.copyfileobj(response, out_file)

            return "OK"
        except Exception as e:
            logger.error(f"Native download failed: {e}")
            return f"ERROR: {str(e)}"

    def read_clipboard(self) -> Optional[str]:
        """
        Bridge: Read text from system clipboard securely.
        """
        try:
            if sys.platform == "linux":
                try:
                    from PyQt6.QtWidgets import QApplication

                    app = QApplication.instance()
                    if app:
                        return app.clipboard().text()
                except ImportError:
                    pass
            return None
        except Exception as e:
            logger.error(f"Clipboard bridge failed: {e}")
            return None

    def copy_to_clipboard(self, text: str) -> bool:
        """Bridge: Write text to system clipboard securely."""
        try:
            import subprocess

            if sys.platform == "win32":
                process = subprocess.Popen(
                    ["clip.exe"], stdin=subprocess.PIPE, text=True, encoding="utf-8"
                )
                process.communicate(input=text)
                return True
            elif sys.platform == "darwin":
                process = subprocess.Popen(
                    ["pbcopy"], stdin=subprocess.PIPE, text=True, encoding="utf-8"
                )
                process.communicate(input=text)
                return True
            elif sys.platform == "linux":
                import shutil

                if shutil.which("xclip"):
                    process = subprocess.Popen(
                        ["xclip", "-selection", "clipboard"],
                        stdin=subprocess.PIPE,
                        text=True,
                        encoding="utf-8",
                    )
                    process.communicate(input=text)
                    return True
                elif shutil.which("wl-copy"):
                    process = subprocess.Popen(
                        ["wl-copy"], stdin=subprocess.PIPE, text=True, encoding="utf-8"
                    )
                    process.communicate(input=text)
                    return True
        except Exception as e:
            logger.error(f"Failed to copy to clipboard via bridge: {e}")
        return False

    def notify_update(self) -> str:
        """Bridge: Reload main window data."""
        if self.window_ref[0]:
            try:
                self.window_ref[0].evaluate_js(
                    "if(window.loadItems) window.loadItems();"
                )
            except Exception as e:
                logger.error(f"Failed to refresh main window: {e}")
        return "OK"

    def close_quick_add(self) -> str:
        """Bridge: Close the quick add window."""
        try:
            if self.quick_add_ref[0]:
                self.quick_add_ref[0].destroy()
                self.quick_add_ref[0] = None
        except Exception as e:
            logger.error(f"Failed to close quick add window: {e}")
        return "OK"


def setup_window_closing_handler(
    window_ref: list,
    is_dormant: list,
    tray_available: list,
    tray_icon: list,
    target_url: str,
):
    """Binds closing interceptor to window."""

    def on_closing():
        logger.info(
            f"on_closing fired: is_dormant={is_dormant[0]}, window_ref={window_ref[0] is not None}"
        )

        # Save geometry if window is not minimized/dormant
        if window_ref[0] and not is_dormant[0]:
            try:
                from app.utils.config_manager import save_window_geometry

                save_window_geometry(window_ref[0])
            except Exception as e:
                logger.debug(f"Failed to save window geometry: {e}")

        if not tray_available[0] or not tray_icon[0]:
            return True  # Exit if tray is disabled

        from app.utils.config_manager import load_config

        config = load_config()
        close_behavior = config.get("appSettings", {}).get("closeBehavior", "minimize")

        if close_behavior == "exit":
            logger.info("Exiting (user preference)...")
            return True
        else:
            logger.info("Minimizing to tray...")
            if window_ref[0]:
                window_ref[0].hide()

                # Enter dormant mode to save RAM
                dormant_enabled = config.get("appSettings", {}).get("dormantMode", True)
                if dormant_enabled:
                    logger.info("Entering dormant mode: Unloading page resources...")
                    window_ref[0].load_url("about:blank")
                    is_dormant[0] = True

                    import gc

                    gc.collect()

                    try:
                        from app.database import db

                        db.session.remove()
                    except Exception:
                        pass
            return False

    return on_closing
