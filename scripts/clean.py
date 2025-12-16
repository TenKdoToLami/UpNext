import os
import shutil
import logging

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("Cleaner")

def clean_project():
    """Cleans temporary files and directories from the project."""
    
    
    # Root dir is one level up from this script
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Specific directories to remove (relative to root)
    dirs_to_remove = [
        'build',
        'dist',
        os.path.join('data', 'browser_profile')
    ]

    # Specific files to remove (relative to root)
    specific_files_to_remove = [
        'generate_docs.sh',
        'UpNext',
        'UpNext.exe',
        'UpNext.desktop'
    ]
    
    # Extensions to remove recursively
    files_to_remove_ext = [
        '.pyc'
    ]
    
    # Directories to remove recursively (by name)
    dirs_to_remove_name = [
        '__pycache__'
    ]

    logger.info("🧹 Starting Project Cleanup...")

    # 1. Remove specific top-level directories
    for reldir in dirs_to_remove:
        path = os.path.join(root_dir, reldir)
        if os.path.exists(path):
            try:
                shutil.rmtree(path)
                logger.info(f"✔ Removed directory: {reldir}")
            except Exception as e:
                logger.error(f"❌ Failed to remove {reldir}: {e}")

    # 2. Remove specific top-level files
    for relfile in specific_files_to_remove:
        path = os.path.join(root_dir, relfile)
        if os.path.exists(path):
            try:
                os.remove(path)
                logger.info(f"✔ Removed file: {relfile}")
            except Exception as e:
                logger.error(f"❌ Failed to remove {relfile}: {e}")

    # 3. Walk through the project and remove recursive targets
    cleaned_files_count = 0
    cleaned_dirs_count = 0
    
    for current_root, dirs, files in os.walk(root_dir):
        # Skip .git directory and venv if present
        if '.git' in dirs:
            dirs.remove('.git')
        if 'venv' in dirs:
            dirs.remove('venv')
        if '.venv' in dirs:
            dirs.remove('.venv')
        if '.agent' in dirs:
            dirs.remove('.agent')

        # Remove __pycache__ directories
        for d in list(dirs):
            if d in dirs_to_remove_name:
                path = os.path.join(current_root, d)
                try:
                    shutil.rmtree(path)
                    logger.info(f"✔ Removed cache dir: {os.path.relpath(path, root_dir)}")
                    dirs.remove(d) # Don't traverse into deleted dir
                    cleaned_dirs_count += 1
                except Exception as e:
                    logger.error(f"❌ Failed to remove {path}: {e}")

        # Remove file patterns
        for f in files:
            _, ext = os.path.splitext(f)
            if ext in files_to_remove_ext:
                # Special case: Don't delete build.py even though it looks like a spec file content-wise, 
                # but here we are matching extensions. build.py is .py so it's safe.
                # If there are actual .spec files generated, we remove them.
                path = os.path.join(current_root, f)
                try:
                    os.remove(path)
                    logger.info(f"✔ Removed file: {os.path.relpath(path, root_dir)}")
                    cleaned_files_count += 1
                except Exception as e:
                    logger.error(f"❌ Failed to remove {path}: {e}")

    logger.info("-" * 30)
    logger.info(f"✨ Cleanup Complete!")
    logger.info(f"   - Directories removed: {cleaned_dirs_count + len([d for d in dirs_to_remove if os.path.exists(os.path.join(root_dir, d))])}") # Approx count logic
    logger.info(f"   - Files removed: {cleaned_files_count}")

if __name__ == "__main__":
    clean_project()
