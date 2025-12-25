import argparse
import sys
import os
import subprocess

def main():
    """
    Main entry point for project management.
    
    Automatically detects and switches to the virtual environment if present,
    then dispatches commands to specialized script modules.
    """
    # 1. Environment Detection and Self-Correction
    root_dir = os.path.dirname(os.path.abspath(__file__))
    venv_dir = os.path.join(root_dir, '.venv')
    
    if os.path.exists(venv_dir):
        # If we're not already running inside the venv, re-execute the script using the venv's python
        if sys.prefix != venv_dir:
            python_exe = os.path.join(venv_dir, "Scripts", "python.exe") if sys.platform == "win32" else os.path.join(venv_dir, "bin", "python")
            
            if os.path.exists(python_exe):
                cmd = [python_exe] + sys.argv
                try:
                    subprocess.run(cmd, check=True)
                    sys.exit(0)
                except Exception as e:
                    print(f"FAILED to re-execute in environment: {e}")
                    sys.exit(1)

    # 2. Command Dispatching
    # Lazy imports to prevent dependency errors before the venv switch occurs above
    from scripts import run, build, clean
    
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

    # Execute the requested operation
    if args.command == "run":
        run.main()
    elif args.command == "build":
        build.build_project()
    elif args.command == "clean":
        clean.clean_project()
    else:
        parser.print_help()
        sys.exit(1)

if __name__ == "__main__":
    main()
