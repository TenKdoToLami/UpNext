import argparse
import sys
import os
import subprocess
import logging

# Ensure we're running from the root directory to allow absolute imports
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
if ROOT_DIR not in sys.path:
    sys.path.append(ROOT_DIR)


def main():
    """Main entry point for project management."""
    # Environment Detection and Self-Correction: ensure we run inside the venv
    venv_dir = os.path.join(ROOT_DIR, '.venv')
    
    if os.path.exists(venv_dir) and sys.prefix != venv_dir:
        python_exe = os.path.join(venv_dir, "Scripts", "python.exe") if sys.platform == "win32" else os.path.join(venv_dir, "bin", "python")
        
        if os.path.exists(python_exe):
            cmd = [python_exe] + sys.argv
            try:
                subprocess.run(cmd, check=True)
                sys.exit(0)
            except Exception as e:
                print(f"CRITICAL: Failed to re-execute in environment: {e}")
                sys.exit(1)

    # Lazy imports to prevent dependency errors before venv switch
    from app import create_app
    from app.config import HOST, PORT
    from app.services.app_lifecycle import run_application_stack
    from app.utils.logging_setup import setup_logging
    from scripts import build, clean

    # Configure logging
    setup_logging()
    logger = logging.getLogger("manage")
    
    parser = argparse.ArgumentParser(
        description="UpNext Management CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python manage.py run\n  python manage.py build\n  python manage.py clean"
    )
    subparsers = parser.add_subparsers(dest="command", help="Operational commands")

    subparsers.add_parser("run", help="Start the development server and launch UI")
    subparsers.add_parser("build", help="Compile the application into a standalone executable")
    subparsers.add_parser("clean", help="Remove temporary build artifacts and cache files")

    args = parser.parse_args()

    if args.command == "run":
        run_application_stack(create_app, HOST, PORT)
    elif args.command == "build":
        build.build_project()
    elif args.command == "clean":
        clean.clean_project()
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
