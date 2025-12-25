import os
import subprocess
import sys
import logging

import shutil

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("Builder")


def build_project():
    """
    Orchestrates the build process to create a standalone binary.
    
    1. Invokes PyInstaller to bundle dependencies.
    2. Relocates the resulting artifact to the project root.
    3. (Linux) Generates a .desktop integration file.
    4. Cleans up temporary build directories.
    """
    logger.info("Starting production build process...")
    
    # Path Resolution
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    spec_file = os.path.join(root_dir, 'scripts', 'UpNext.spec')
    python_exe = sys.executable

    # 1. Compilation Stage
    try:
        subprocess.run([python_exe, '-m', 'PyInstaller', spec_file, '--clean', '--noconfirm'], check=True)
        logger.info("PyInstaller compilation successful.")
    except Exception as e:
        logger.error(f"Build failed during compilation phase: {e}")
        return

    # 2. Artifact Management
    dist_exe = os.path.join(root_dir, 'dist', 'UpNext' + ('.exe' if os.name == 'nt' else ''))
    target_exe = os.path.join(root_dir, 'UpNext' + ('.exe' if os.name == 'nt' else ''))
        
    if os.path.exists(dist_exe):
        try:
            if os.path.exists(target_exe):
                os.remove(target_exe)
            shutil.move(dist_exe, target_exe)
            logger.info(f"Executable moved to root: {os.path.basename(target_exe)}")
            
            # Platform-specific integrations
            if os.name != 'nt':
                _create_linux_desktop_entry(root_dir, target_exe)

        except Exception as e:
            logger.error(f"Post-build artifact move failed: {e}")
    else:
        logger.warning("Build artifact not found in 'dist' directory.")

    # 3. Finalization
    _cleanup_build_artifacts(root_dir)
    logger.info("Build operation completed successfully.")


def _create_linux_desktop_entry(root_dir: str, target_exe: str):
    """Generates a .desktop file for Linux desktop environments."""
    desktop_file = os.path.join(root_dir, 'UpNext.desktop')
    icon_path = os.path.join(root_dir, 'app', 'static', 'icon.png')
    content = f"""[Desktop Entry]
Name=UpNext
Exec={target_exe}
Icon={icon_path}
Type=Application
Terminal=false
Categories=Utility;
"""
    with open(desktop_file, 'w') as f:
        f.write(content)
    os.chmod(desktop_file, 0o755)
    logger.info("Linux Desktop entry generated.")


def _cleanup_build_artifacts(root_dir: str):
    """Removes temporary filesystem objects created during the build."""
    for folder in ['build', 'dist']:
        path = os.path.join(root_dir, folder)
        if os.path.exists(path):
            shutil.rmtree(path)

    logger.info("-" * 30)
    logger.info("✨ Build Complete!")
    logger.info(f"   - Executable: {os.path.basename(target_exe)}")


if __name__ == "__main__":
    build_project()
