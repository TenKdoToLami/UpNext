import os
import sys

# App Settings
APP_NAME = "UpNext"
HOST = "127.0.0.1"
PORT = 5000

# Path Configuration
# Environment & Path Configuration
if getattr(sys, 'frozen', False):
    # Running as compiled .exe (Production)
    BASE_DIR = os.path.dirname(sys.executable)
    SQLALCHEMY_ECHO = False
else:
    # Running from source (Development)
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    SQLALCHEMY_ECHO = True

# Directories
DATA_DIR = os.path.join(BASE_DIR, "data")
# Database
SQLITE_DB_PATH = os.path.join(DATA_DIR, 'library.db')
SQLALCHEMY_DATABASE_URI = f"sqlite:///{SQLITE_DB_PATH}"
SQLALCHEMY_TRACK_MODIFICATIONS = False


# Template and Static directories
TEMPLATE_DIR = os.path.join(BASE_DIR, "app", "templates")
STATIC_DIR = os.path.join(BASE_DIR, "app", "static")
