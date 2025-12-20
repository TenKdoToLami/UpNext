import os
import sys

# App Settings
APP_NAME = "UpNext"
HOST = "127.0.0.1"
PORT = 5000

# Path Configuration
if getattr(sys, 'frozen', False):
    # Running as compiled .exe
    BASE_DIR = os.path.dirname(sys.executable)
    # Disable SQL echo in production/built app
    SQLALCHEMY_ECHO = False
else:
    # Running from source (app/config.py -> app/ -> root)
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # Enable SQL echo in dev/source options
    SQLALCHEMY_ECHO = True

# Directories
DATA_DIR = os.path.join(BASE_DIR, "data")
# New SQLite DB
SQLITE_DB_PATH = os.path.join(DATA_DIR, 'library.db')
SQLALCHEMY_DATABASE_URI = f"sqlite:///{SQLITE_DB_PATH}"
SQLALCHEMY_TRACK_MODIFICATIONS = False


# Template and Static directories
TEMPLATE_DIR = os.path.join(BASE_DIR, "app", "templates")
STATIC_DIR = os.path.join(BASE_DIR, "app", "static")
