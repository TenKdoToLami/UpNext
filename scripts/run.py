"""
Main Application Entry Point (Frozen/Production).

This script is used by PyInstaller ("run.py") to launch the application.
It uses the shared lifecycle service to ensure behavior consistency with development.
"""
import os
import sys
import logging

# Ensure root dir is in path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(root_dir)

from app import create_app
from app.config import HOST, PORT
from app.services.app_lifecycle import run_application_stack
from app.utils.logging_setup import setup_logging

# Configure logging
setup_logging("UpNext_App")
logger = logging.getLogger("run")


def main() -> None:
    """Main entry point."""
    # Check frozen state (PyInstaller)
    if getattr(sys, 'frozen', False):
        os.chdir(os.path.dirname(sys.executable))

    run_application_stack(create_app, HOST, PORT)


if __name__ == '__main__':
    main()
