#!/bin/bash

# UpNext Linux Uninstaller (User Scope)

set -e

APP_NAME="UpNext"
DESKTOP_FILE_NAME="UpNext.desktop"
APPLICATIONS_DIR="$HOME/.local/share/applications"
TARGET_DESKTOP_PATH="$APPLICATIONS_DIR/$DESKTOP_FILE_NAME"

echo "Uninstalling $APP_NAME desktop entry..."

if [ -f "$TARGET_DESKTOP_PATH" ]; then
    rm "$TARGET_DESKTOP_PATH"
    echo "Removed: $TARGET_DESKTOP_PATH"
    echo "Desktop shortcut removed successfully."
else
    echo "Desktop shortcut not found at: $TARGET_DESKTOP_PATH"
    echo "Nothing to remove."
fi

# We do not remove the application binary/folder itself as we don't know if the user
# wants to keep the data or if they ran this from within the folder they want to delete.
# Standard practice for portable apps is to just remove the system integration.
echo "Done! You can now safely delete this folder if you wish to remove the application entirely."
