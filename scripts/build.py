import os
import subprocess
import sys
import logging

import shutil

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(message)s')
logger = logging.getLogger("Builder")


def build_project():
    """Builds the project executable and documentation."""
    logger.info("🚀 Starting Project Build...")
    
    # Root dir is one level up from this script
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    spec_file = os.path.join(root_dir, 'scripts', 'UpNext.spec')
    
    # Use the current python interpreter to run the module
    python_exe = sys.executable

    # 1. Run PyInstaller
    logger.info(f"📦 Running PyInstaller...")
    try:
        subprocess.run([python_exe, '-m', 'PyInstaller', spec_file, '--clean', '--noconfirm'], check=True)
        logger.info("✔ PyInstaller build complete.")
    except subprocess.CalledProcessError as e:
        logger.error(f"❌ PyInstaller failed: {e}")
        return
    except Exception as e:
        logger.error(f"❌ An error occurred: {e}")
        return

    # 2. Move executable to root
    dist_exe = os.path.join(root_dir, 'dist', 'UpNext')
    if os.name == 'nt':
        dist_exe += '.exe'
    
    target_exe = os.path.join(root_dir, 'UpNext')
    if os.name == 'nt':
        target_exe += '.exe'
        
    if os.path.exists(dist_exe):
        try:
            if os.path.exists(target_exe):
                os.remove(target_exe)
            shutil.move(dist_exe, target_exe)
            logger.info(f"✔ Moved executable to: {target_exe}")
            
            # Create Linux Desktop Entry
            if os.name != 'nt':
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
                logger.info(f"✔ Created Desktop Entry: {desktop_file}")

        except Exception as e:
            logger.error(f"❌ Failed to move executable to root: {e}")
    else:
        logger.warning(f"⚠️ Could not find executable at {dist_exe} to move.")

    # 3. Cleanup build artifacts
    logger.info("🧹 Cleaning up build artifacts...")
    build_dir = os.path.join(root_dir, 'build')
    dist_dir = os.path.join(root_dir, 'dist')
    
    try:
        if os.path.exists(build_dir):
            shutil.rmtree(build_dir)
            logger.info("✔ Removed build directory")
        if os.path.exists(dist_dir):
            shutil.rmtree(dist_dir)
            logger.info("✔ Removed dist directory")
    except Exception as e:
        logger.warning(f"⚠️ Failed to clean up artifacts: {e}")

    logger.info("-" * 30)
    logger.info("✨ Build Complete!")
    logger.info(f"   - Executable: {os.path.basename(target_exe)}")


if __name__ == "__main__":
    build_project()
