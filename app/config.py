import os
import sys
import socket

# App Identification
APP_NAME = "UpNext"
HOST = "127.0.0.1"


def find_available_port(host, preferred_ports):
    """
    Finds an available port from a list of preferred ports.
    If none are available, returns a random free port.
    """
    for port in preferred_ports:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex((host, port)) != 0:
                return port
                
    # Fallback: bind to 0 to let OS choose
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind((host, 0))
        return s.getsockname()[1]


PREFERRED_PORTS = [5000, 5001, 8000, 8080, 8888]
PORT = find_available_port(HOST, PREFERRED_PORTS)

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
# Database Configuration
DB_CONFIG_FILE = os.path.join(DATA_DIR, "db_config.json")
DEFAULT_DB_NAME = 'library.db'

def get_sqlite_db_path(db_filename=None):
    """Returns the absolute path to the specified or default database file."""
    if db_filename:
        return os.path.join(DATA_DIR, db_filename)
    
    # Check for persisted selection
    if os.path.exists(DB_CONFIG_FILE):
        try:
            import json
            with open(DB_CONFIG_FILE, 'r') as f:
                config = json.load(f)
                last_db = config.get('last_db')
                if last_db and os.path.exists(os.path.join(DATA_DIR, last_db)):
                    return os.path.join(DATA_DIR, last_db)
        except Exception:
            pass # Fallback to default on error

    return os.path.join(DATA_DIR, DEFAULT_DB_NAME)

def list_available_databases():
    """Lists all .db files in the data directory."""
    if not os.path.exists(DATA_DIR):
        return []
    return [f for f in os.listdir(DATA_DIR) if f.endswith('.db')]

# Initial Database Setup
SQLITE_DB_PATH = get_sqlite_db_path()
SQLALCHEMY_DATABASE_URI = f"sqlite:///{SQLITE_DB_PATH}"
SQLALCHEMY_TRACK_MODIFICATIONS = False


# Template and Static directories
TEMPLATE_DIR = os.path.join(RESOURCE_DIR, "app", "templates")
STATIC_DIR = os.path.join(RESOURCE_DIR, "app", "static")
