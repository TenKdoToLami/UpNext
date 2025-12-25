import os
import sys

# App Identification
APP_NAME = "UpNext"
HOST = "127.0.0.1"
PORT = 5000

# Path and Environment Configuration
# We handle both standard development runs and frozen PyInstaller executables.
if getattr(sys, 'frozen', False):
    # Production Mode (compiled .exe)
    # BASE_DIR is the directory containing the executable.
    BASE_DIR = os.path.dirname(sys.executable)
    # RESOURCE_DIR points to the temporary filesystem where PyInstaller unpacks the app.
    RESOURCE_DIR = sys._MEIPASS
    SQLALCHEMY_ECHO = False
else:
    # Development Mode (running from source)
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    RESOURCE_DIR = BASE_DIR
    SQLALCHEMY_ECHO = False  # Set to True only when debugging SQL queries locally

# Directories
DATA_DIR = os.path.join(BASE_DIR, "data")
# Database
SQLITE_DB_PATH = os.path.join(DATA_DIR, 'library.db')
SQLALCHEMY_DATABASE_URI = f"sqlite:///{SQLITE_DB_PATH}"
SQLALCHEMY_TRACK_MODIFICATIONS = False


# Template and Static directories
TEMPLATE_DIR = os.path.join(RESOURCE_DIR, "app", "templates")
STATIC_DIR = os.path.join(RESOURCE_DIR, "app", "static")
