import argparse
import sys
import os
import subprocess

def main():
    # Check for virtual environment and re-execute if not currently using it
    root_dir = os.path.dirname(os.path.abspath(__file__))
    venv_dir = os.path.join(root_dir, '.venv')
    
    if os.path.exists(venv_dir):
        # Simple check: is the executable inside the venv dir?
        # Resolve symlinks to be sure, although venv usually puts the binary inside.
        # sys.prefix is a better check for "is this environment active"
        if sys.prefix != venv_dir:
            # Not running on the venv python. Attempt to find it.
            if sys.platform == "win32":
                python_exe = os.path.join(venv_dir, "Scripts", "python.exe")
            else:
                python_exe = os.path.join(venv_dir, "bin", "python")
            
            if os.path.exists(python_exe):
                # Re-execute the script with the venv python
                cmd = [python_exe] + sys.argv
                try:
                    subprocess.run(cmd, check=True)
                    sys.exit(0)
                except subprocess.CalledProcessError as e:
                    sys.exit(e.returncode)
                except Exception as e:
                    print(f"Error re-executing in venv: {e}")
                    sys.exit(1)

    # Lazy imports to avoid ModuleNotFoundError before venv switch
    from scripts import run
    from scripts import build
    from scripts import clean
    
    parser = argparse.ArgumentParser(description="UpNext Project Management Script")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Run command
    subparsers.add_parser("run", help="Run the application")

    # Build command
    subparsers.add_parser("build", help="Build the executable")

    # Clean command
    subparsers.add_parser("clean", help="Clean temporary files")

    args = parser.parse_args()

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
