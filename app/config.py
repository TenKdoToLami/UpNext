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
else:
    # Running from source (app/config.py -> app/ -> root)
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Directories
DATA_DIR = os.path.join(BASE_DIR, "data")
IMAGES_DIR = os.path.join(DATA_DIR, "images")
DB_FILE = os.path.join(DATA_DIR, "library.json")

# Template and Static directories
TEMPLATE_DIR = os.path.join(BASE_DIR, "app", "templates")
STATIC_DIR = os.path.join(BASE_DIR, "app", "static")
