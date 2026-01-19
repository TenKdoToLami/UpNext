#!/bin/bash

# UpNext Linux Installer (User Scope)

set -e

# Support for executing this script from anywhere, assuming files are in the same dir
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="UpNext"
DESKTOP_FILE_NAME="UpNext.desktop"

# Destintations
APPLICATIONS_DIR="$HOME/.local/share/applications"
ICONS_DIR="$HOME/.local/share/icons"

# Ensure directories exist
mkdir -p "$APPLICATIONS_DIR"
mkdir -p "$ICONS_DIR"

echo "Installing $APP_NAME..."

# 1. Resolve absolute path to the binary in the current folder
# We assume the user keeps the binaries where they extracted them (portable-ish)
# or moved the whole folder to /opt. This script just links to WHEREVER it is run from.
APP_DIR="$SCRIPT_DIR"
BINARY_PATH="$APP_DIR/UpNext"

if [ ! -f "$BINARY_PATH" ]; then
    echo "Error: Could not find binary '$BINARY_PATH'"
    exit 1
fi

chmod +x "$BINARY_PATH"

# 2. Prepare the .desktop file
TEMPLATE_PATH="$APP_DIR/UpNext.desktop"
TARGET_DESKTOP_PATH="$APPLICATIONS_DIR/$DESKTOP_FILE_NAME"

if [ ! -f "$TEMPLATE_PATH" ]; then
    echo "Error: Could not find desktop template '$TEMPLATE_PATH'"
    exit 1
fi

# Replace placeholders with actual paths
# We use sed to replace __APP_DIR__ with the absolute path
echo "Generating desktop entry..."
sed "s|__APP_DIR__|$APP_DIR|g" "$TEMPLATE_PATH" > "$TARGET_DESKTOP_PATH"

# 3. Handle Icon (Optional: copy to standard location if preferred, but .desktop links to local one too)
# The .desktop file we just generated points to $APP_DIR/icon.png.
# To be safer, let's also copy the icon to standard icon theme path if we want,
# but the absolute path in .desktop is robust enough for custom installs.

echo "Desktop entry installed to: $TARGET_DESKTOP_PATH"
echo "You can now find '$APP_NAME' in your application menu."
echo "Done!"
