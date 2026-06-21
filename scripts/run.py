"""
Main Application Entry Point (Frozen/Production).

This script is used by PyInstaller ("run.py") to launch the application.
It uses the shared lifecycle service to ensure behavior consistency with development.
"""

import os
import sys
import logging

try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    pass

# Ensure root dir is in path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(root_dir)

from app import create_app
from app.config import HOST, PORT
from app.services.lifecycle import run_application_stack
from app.utils.logging_setup import setup_logging

# Configure logging
setup_logging("UpNext_App")
logger = logging.getLogger("run")


def main() -> None:
    """Main entry point."""
    import argparse

    # Check frozen state (PyInstaller)
    if getattr(sys, "frozen", False):
        os.chdir(os.path.dirname(sys.executable))

    parser = argparse.ArgumentParser(description="UpNext Application")
    parser.add_argument("--headless", action="store_true", help="Run in headless mode")
    parser.add_argument("--minimized", action="store_true", help="Start minimized")

    # If the executable name contains '-server', default to headless
    exe_name = os.path.basename(sys.executable).lower()
    default_headless = "-server" in exe_name

    args, unknown = parser.parse_known_args()

    is_headless = (
        args.headless or default_headless or os.environ.get("UPNEXT_HEADLESS") == "1"
    )

    run_application_stack(
        create_app, HOST, PORT, headless=is_headless, minimized=args.minimized
    )


if __name__ == "__main__":
    main()
