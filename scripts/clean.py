import os
import shutil
import logging

# Configure Logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("Cleaner")

def clean_project():
    """
    Purges temporary files, caches, and build artifacts from the repository.
    """
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    dirs_to_remove = ['build', 'dist', os.path.join('data', 'browser_profile')]
    files_to_remove = ['UpNext', 'UpNext.exe', 'UpNext.desktop']
    
    logger.info("Starting comprehensive project cleanup...")

    # 1. Target known build artifacts
    for reldir in dirs_to_remove:
        path = os.path.join(root_dir, reldir)
        if os.path.exists(path):
            try:
                shutil.rmtree(path)
                logger.info(f"Removed directory: {reldir}")
            except Exception as e:
                logger.error(f"Failed to remove {reldir}: {e}")

    for relfile in files_to_remove:
        path = os.path.join(root_dir, relfile)
        if os.path.exists(path):
            try:
                os.remove(path)
                logger.info(f"Removed artifact: {relfile}")
            except Exception as e:
                logger.error(f"Failed to remove {relfile}: {e}")

    # 2. Recursive cleanup of bytecode and cache
    cleaned_count = 0
    for current_root, dirs, files in os.walk(root_dir):
        # Optimized skip list
        for skip in ['.git', 'venv', '.venv', '.agent', 'data']:
            if skip in dirs:
                dirs.remove(skip)

        # Cleanup Python Caches
        for d in list(dirs):
            if d == '__pycache__':
                path = os.path.join(current_root, d)
                try:
                    shutil.rmtree(path)
                    cleaned_count += 1
                except Exception as e:
                    logger.warning(f"Could not clean cache @ {path}: {e}")

        # Cleanup Bytecode
        for f in files:
            if f.endswith('.pyc'):
                path = os.path.join(current_root, f)
                try:
                    os.remove(path)
                    cleaned_count += 1
                except Exception as e:
                    logger.warning(f"Could not remove bytecode @ {path}: {e}")

    logger.info(f"Cleanup complete. Removed {cleaned_count} temporary project assets.")

if __name__ == "__main__":
    clean_project()
