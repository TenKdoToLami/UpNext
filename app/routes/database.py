"""
Database and System Settings Blueprints for UpNext.

Handles multi-database selection, database creations/deletions, backup operations,
system shutdowns, update checks, and configuration settings.
"""

import logging
import os
from flask import Blueprint, jsonify, request, current_app
from sqlalchemy import create_engine, text

from app.database import db
from app.config import get_sqlite_db_path, list_available_databases
from app.utils.config_manager import load_config, save_config

bp = Blueprint("database", __name__, url_prefix="/api")
logger = logging.getLogger(__name__)


# =============================================================================
# DATABASE SELECTION ENDPOINTS
# =============================================================================


@bp.route("/database/status", methods=["GET"])
def get_db_status():
    """Returns the current database status and available options."""
    available = list_available_databases()
    current_app.config["AVAILABLE_DBS"] = available

    config = load_config()
    has_config = "last_db" in config or "active_db" in config

    return jsonify(
        {
            "active": current_app.config.get("ACTIVE_DB"),
            "available": available,
            "hasConfig": has_config,
        }
    )


@bp.route("/database/select", methods=["POST"])
def select_database():
    """Switches the active database connection."""
    data = request.get_json()
    db_name = data.get("db_name")

    available = list_available_databases()

    if not db_name or db_name not in available:
        return (
            jsonify({"status": "error", "message": "Invalid database selection"}),
            400,
        )

    try:
        new_path = get_sqlite_db_path(db_name)
        new_uri = f"sqlite:///{new_path}"

        current_app.config["SQLALCHEMY_DATABASE_URI"] = new_uri

        db.engine.dispose()
        db.session.remove()

        new_engine = create_engine(new_uri)
        if hasattr(db, "engines"):
            db.engines.clear()
            db.engines[None] = new_engine

        current_app.config["ACTIVE_DB"] = db_name

        # Persist selection to main config.json
        try:
            save_config({"last_db": db_name})
        except Exception as e:
            logger.warning(f"Failed to persist DB selection: {e}")

        # Run auto-backup check if enabled
        try:
            from app.utils.backup_manager import run_auto_backup

            config = load_config()
            backup_settings = config.get("appSettings", {}).get("backupSettings", {})
            if backup_settings.get("enabled", True):
                backup_result = run_auto_backup(db_name, backup_settings)
                if backup_result and backup_result.get("status") == "success":
                    logger.info(
                        f"Auto-backup created: {backup_result.get('backup', {}).get('filename')}"
                    )
        except Exception as e:
            logger.warning(f"Auto-backup check failed: {e}")

        logger.info(f"Database switched to: {db_name}")
        return jsonify({"status": "success", "message": f"Switched to {db_name}"})

    except Exception as e:
        logger.error(f"Failed to switch database: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route("/database/schema", methods=["GET"])
def get_db_schema():
    """Returns the SQL schema for the current database."""
    try:
        # Query sqlite_master for table definitions
        with db.engine.connect() as conn:
            result = conn.execute(
                text(
                    "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL"
                )
            )
            schema = [row[0] for row in result]

        return jsonify({"status": "success", "schema": schema})
    except Exception as e:
        logger.error(f"Failed to fetch DB schema: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route("/database/create", methods=["POST"])
def create_database():
    """Creates a new empty database."""
    data = request.get_json()
    db_name = data.get("db_name")

    if not db_name:
        return jsonify({"status": "error", "message": "Database name is required"}), 400

    if not db_name.replace("_", "").replace("-", "").isalnum():
        return (
            jsonify(
                {"status": "error", "message": "Invalid characters in database name"}
            ),
            400,
        )

    if not db_name.lower().endswith(".db"):
        db_name += ".db"

    try:
        new_path = get_sqlite_db_path(db_name)
        if os.path.exists(new_path):
            return (
                jsonify({"status": "error", "message": "Database already exists"}),
                409,
            )

        # Create empty file
        open(new_path, "a").close()

        logger.info(f"Created new database: {db_name}")
        return jsonify(
            {"status": "success", "message": f"Created {db_name}", "db_name": db_name}
        )

    except Exception as e:
        logger.error(f"Failed to create database: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route("/database/delete", methods=["POST"])
def delete_database():
    """Deletes a database file."""
    data = request.get_json()
    db_name = data.get("db_name")

    if not db_name:
        return jsonify({"status": "error", "message": "Database name is required"}), 400

    # Prevent deleting the currently active database
    if current_app.config.get("ACTIVE_DB") == db_name:
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Cannot delete the currently active database",
                }
            ),
            400,
        )

    # Prevent deleting critical files (basic safety)
    if db_name.lower() in ["config.json", "users.db"]:
        return (
            jsonify({"status": "error", "message": "Cannot delete system files"}),
            400,
        )

    try:
        db_path = get_sqlite_db_path(db_name)
        if not os.path.exists(db_path):
            return (
                jsonify({"status": "error", "message": "Database does not exist"}),
                404,
            )

        os.remove(db_path)
        logger.info(f"Deleted database: {db_name}")

        return jsonify({"status": "success", "message": f"Deleted {db_name}"})

    except Exception as e:
        logger.error(f"Failed to delete database: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# =============================================================================
# BACKUP ENDPOINTS
# =============================================================================


@bp.route("/backups/<db_name>", methods=["GET"])
def get_backups(db_name):
    """Lists all backups for a specific database."""
    from app.utils.backup_manager import list_backups

    try:
        backups = list_backups(db_name)
        return jsonify({"status": "success", "backups": backups})
    except Exception as e:
        logger.error(f"Failed to list backups for {db_name}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route("/backups/<db_name>", methods=["POST"])
def create_backup(db_name):
    """Creates a manual backup for a database."""
    from app.utils.backup_manager import create_backup

    try:
        config = load_config()
        backup_settings = config.get("appSettings", {}).get("backupSettings", {})
        max_backups = backup_settings.get("maxBackups", 3)

        result = create_backup(db_name, max_backups)

        if result["status"] == "success":
            return jsonify(result)
        else:
            return jsonify(result), 400
    except Exception as e:
        logger.error(f"Failed to create backup for {db_name}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route("/backups/restore", methods=["POST"])
def restore_backup():
    """Restores a backup to a database."""
    from app.utils.backup_manager import restore_backup

    data = request.get_json()
    backup_path = data.get("backup_path")
    db_name = data.get("db_name")

    if not backup_path or not db_name:
        return (
            jsonify(
                {"status": "error", "message": "backup_path and db_name are required"}
            ),
            400,
        )

    # Prevent restoring to currently active database without force
    active_db = current_app.config.get("ACTIVE_DB")
    if active_db == db_name and not data.get("force"):
        return (
            jsonify(
                {
                    "status": "error",
                    "message": "Cannot restore to active database. Switch to another database first or use force=true.",
                    "requiresForce": True,
                }
            ),
            409,
        )

    try:
        result = restore_backup(backup_path, db_name)
        return jsonify(result)
    except Exception as e:
        logger.error(f"Failed to restore backup: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route("/backups/<db_name>/<backup_file>", methods=["DELETE"])
def delete_backup(db_name, backup_file):
    """Deletes a specific backup file."""
    from app.utils.backup_manager import delete_backup, get_backup_dir
    import os

    try:
        backup_dir = get_backup_dir(db_name)
        backup_path = os.path.join(backup_dir, backup_file)

        result = delete_backup(backup_path)

        if result["status"] == "success":
            return jsonify(result)
        else:
            return jsonify(result), 400
    except Exception as e:
        logger.error(f"Failed to delete backup {backup_file}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route("/backups/databases", methods=["GET"])
def list_backup_databases():
    """Lists all databases that have backups, including deleted ones."""
    from app.utils.backup_manager import list_databases_with_backups

    try:
        # Get databases with backups (includes deleted DBs)
        backup_dbs = set(list_databases_with_backups())

        # Get currently available databases
        available_dbs = set(list_available_databases())

        # Merge both sets - available DBs and DBs with backups
        all_dbs = sorted(available_dbs | backup_dbs)

        # Mark which ones are deleted
        result = [
            {"name": db, "exists": db in available_dbs, "hasBackups": db in backup_dbs}
            for db in all_dbs
        ]

        return jsonify({"status": "success", "databases": result})
    except Exception as e:
        logger.error(f"Failed to list backup databases: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route("/backups/settings", methods=["GET"])
def get_backup_settings():
    """Returns current backup settings."""
    from app.utils.backup_manager import DEFAULT_BACKUP_SETTINGS

    config = load_config()
    settings = config.get("appSettings", {}).get(
        "backupSettings", DEFAULT_BACKUP_SETTINGS
    )
    return jsonify({"status": "success", "settings": settings})


@bp.route("/backups/settings", methods=["POST"])
def save_backup_settings():
    """Saves backup settings."""
    try:
        new_settings = request.get_json()

        config = load_config()
        app_settings = config.get("appSettings", {})
        app_settings["backupSettings"] = new_settings
        save_config({"appSettings": app_settings})

        return jsonify({"status": "success", "message": "Backup settings saved"})
    except Exception as e:
        logger.error(f"Failed to save backup settings: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


# =============================================================================
# SYSTEM ENDPOINTS
# =============================================================================


@bp.route("/system/check_update", methods=["GET"])
def check_update():
    """
    Checks for the latest application release via GitHub.
    Returns version comparison status and release details.
    """
    from app.services.updater import get_latest_release

    current_version = current_app.config.get("APP_VERSION", "0.0.0")
    latest = get_latest_release()

    if not latest:
        return (
            jsonify(
                {
                    "current_version": current_version,
                    "error": "Could not fetch latest release info",
                }
            ),
            502,
        )

    def parse_version(v):
        try:
            return [int(x) for x in v.split(".")]
        except ValueError:
            return [0, 0, 0]

    cur_parts = parse_version(current_version)
    lat_parts = parse_version(latest["tag_name"])

    return jsonify(
        {
            "current_version": current_version,
            "latest_version": latest["tag_name"],
            "update_available": (lat_parts > cur_parts),
            "download_url": latest["html_url"],
            "release_notes": latest["body"],
            "published_at": latest["published_at"],
        }
    )


@bp.route("/system/shutdown", methods=["POST"])
def shutdown_app():
    """Shuts down the application."""
    if os.environ.get("UPNEXT_HEADLESS") == "1":
        return (
            jsonify(
                {"status": "error", "message": "Shutdown disabled in headless mode"}
            ),
            403,
        )

    def shutdown():
        import time

        time.sleep(1)
        # Using os._exit to force kill including threads
        os._exit(0)

    # Start shutdown in thread to allow response to send
    import threading

    threading.Thread(target=shutdown).start()
    return jsonify({"status": "success", "message": "Shutting down..."})


# =============================================================================
# SETTINGS ENDPOINTS
# =============================================================================


@bp.route("/settings", methods=["GET"])
def get_settings():
    """Retrieves application settings."""
    config = load_config()
    return jsonify(config.get("appSettings", {}))


@bp.route("/settings", methods=["POST"])
def save_settings():
    """Saves application settings."""
    try:
        new_settings = request.get_json()
        save_config({"appSettings": new_settings})
        return jsonify({"status": "success", "message": "Settings saved"})
    except Exception as e:
        logger.error(f"Failed to save settings: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500


@bp.route("/config", methods=["POST"])
def update_config():
    """
    Updates the application configuration.

    Accepts a partial JSON object and merges it into the existing config.
    Used for persisting settings from the frontend.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        save_config(data)
        return jsonify({"status": "success"})
    except Exception as e:
        logger.error(f"Failed to update config: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500
