import os
import sys
import argparse
import subprocess
import logging
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Ensure we're running from the root directory to allow absolute imports
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
if ROOT_DIR not in sys.path:
    sys.path.append(ROOT_DIR)


def main():
    """Main entry point for project management."""
    # Environment Detection and Self-Correction: ensure we run inside the venv
    venv_dir = None
    for v in ['.venv', 'venv']:
        candidate = os.path.join(ROOT_DIR, v)
        if os.path.isdir(candidate):
            venv_dir = candidate
            break
            
    if venv_dir and sys.prefix != venv_dir:
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
    from app.services.lifecycle import run_application_stack
    from app.utils.logging_setup import setup_logging
    from scripts import build, clean

    # Configure logging
    setup_logging()
    logger = logging.getLogger("manage")
    
    def run_interactive():
        print("==================================================")
        print("              UpNext CLI Manager                  ")
        print("==================================================")
        print("\nPlease select a command:")
        print("  1) run   - Start the development server and launch UI")
        print("  2) build - Compile the application into a standalone executable")
        print("  3) clean - Remove temporary build artifacts and cache files")
        print("  4) exit  - Cancel and exit\n")

        try:
            choice = input("Select an option (1-4): ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting.")
            sys.exit(0)

        if choice == "1":
            try:
                hl = input("Run in headless mode (no GUI)? (y/N): ").strip().lower()
                headless = hl in ("y", "yes")
                min_arg = input("Start minimized to the system tray? (y/N): ").strip().lower()
                minimized = min_arg in ("y", "yes")
            except (KeyboardInterrupt, EOFError):
                print("\nExiting.")
                sys.exit(0)
            run_application_stack(create_app, HOST, PORT, headless=headless, minimized=minimized)
        elif choice == "2":
            try:
                so = input("Build server-only version (no GUI)? (y/N): ").strip().lower()
                server_only = so in ("y", "yes")
            except (KeyboardInterrupt, EOFError):
                print("\nExiting.")
                sys.exit(0)
            build.build_project(server_only=server_only)
        elif choice == "3":
            clean.clean_project()
        elif choice == "4":
            print("Exiting.")
            sys.exit(0)
        else:
            print("Invalid option. Exiting.")
            sys.exit(1)

    if len(sys.argv) == 1:
        run_interactive()
        sys.exit(0)

    parser = argparse.ArgumentParser(
        description="UpNext Management CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Examples:\n  python manage.py run\n  python manage.py build\n  python manage.py clean"
    )
    subparsers = parser.add_subparsers(dest="command", help="Operational commands")

    run_parser = subparsers.add_parser("run", help="Start the development server and launch UI")
    run_parser.add_argument("--headless", action="store_true", help="Run in headless mode (no GUI)")
    run_parser.add_argument("--minimized", action="store_true", help="Start with window minimized to tray")
    
    build_parser = subparsers.add_parser("build", help="Compile the application into a standalone executable")
    build_parser.add_argument("--server", action="store_true", help="Build server-only version (no GUI, smaller size)")
    
    subparsers.add_parser("clean", help="Remove temporary build artifacts and cache files")

    args = parser.parse_args()

    if args.command == "run":
        run_application_stack(create_app, HOST, PORT, headless=args.headless, minimized=args.minimized)
    elif args.command == "build":
        build.build_project(server_only=args.server)
    elif args.command == "clean":
        clean.clean_project()
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
