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
        # Removed --clean to speed up repeated builds by using cache
        subprocess.run([python_exe, '-m', 'PyInstaller', spec_file, '--noconfirm'], check=True)
        logger.info("PyInstaller compilation successful.")
    except Exception as e:
        logger.error(f"Build failed during compilation phase: {e}")
    except Exception as e:
        logger.error(f"Build failed during compilation phase: {e}")
        sys.exit(1)

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
        logger.error("Build artifact not found in 'dist' directory.")
        sys.exit(1)

    # 3. Finalization
    _cleanup_build_artifacts(root_dir, target_exe)
    logger.info("Build operation completed successfully.")


def _create_linux_desktop_entry(root_dir: str, target_exe: str):
    """Copies Linux packaging files to the root directory."""
    pkg_dir = os.path.join(root_dir, 'packaging', 'linux')
    
    # 1. Copy Desktop File
    src_desktop = os.path.join(pkg_dir, 'UpNext.desktop')
    dst_desktop = os.path.join(root_dir, 'UpNext.desktop')
    if os.path.exists(src_desktop):
        shutil.copy(src_desktop, dst_desktop)
        
        # Update the placeholder in the local copy to point to current dir
        with open(dst_desktop, 'r') as f:
            content = f.read()
        
        # For local dev builds, point absolute path to root_dir
        content = content.replace('__APP_DIR__', root_dir)
        
        with open(dst_desktop, 'w') as f:
            f.write(content)
        os.chmod(dst_desktop, 0o755)
        logger.info("Linux Desktop entry created from template.")
    else:
        logger.warning(f"Template not found: {src_desktop}")

    # 2. Copy Installer Script
    src_install = os.path.join(pkg_dir, 'install.sh')
    dst_install = os.path.join(root_dir, 'install.sh')
    if os.path.exists(src_install):
        shutil.copy(src_install, dst_install)
        os.chmod(dst_install, 0o755)
        logger.info("Installer script copied.")


def _cleanup_build_artifacts(root_dir: str, target_exe: str):
    """Removes temporary filesystem objects created during the build."""
    for folder in ['build', 'dist']:
        path = os.path.join(root_dir, folder)
        if os.path.exists(path):
            shutil.rmtree(path)

    logger.info("-" * 30)
    logger.info("✨ Build Complete!")
    if target_exe:
        logger.info(f"   - Executable: {os.path.basename(target_exe)}")


if __name__ == "__main__":
    build_project()
