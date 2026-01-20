"""
Backup Manager for UpNext databases.

Provides automatic and manual backup functionality with configurable
retention policies. Backups are stored in data/backups/{db_name}/ with
date-based naming.
"""
import os
import shutil
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any

from app.config import DATA_DIR

logger = logging.getLogger("backup_manager")

BACKUP_DIR = os.path.join(DATA_DIR, "backups")

# Default backup settings
DEFAULT_BACKUP_SETTINGS = {
    "enabled": True,
    "frequencyDays": 7,  # Weekly
    "maxBackups": 3
}


def list_databases_with_backups() -> List[str]:
    """
    Lists all database names that have backup folders.
    Includes databases that may have been deleted but still have backups.
    
    Returns:
        List of database names (with .db extension) that have backups.
    """
    if not os.path.exists(BACKUP_DIR):
        return []
    
    databases = []
    for folder_name in os.listdir(BACKUP_DIR):
        folder_path = os.path.join(BACKUP_DIR, folder_name)
        if os.path.isdir(folder_path):
            # Check if folder has any .db backup files
            has_backups = any(f.endswith('.db') for f in os.listdir(folder_path))
            if has_backups:
                databases.append(f"{folder_name}.db")
    
    return sorted(databases)


def get_backup_dir(db_name: str) -> str:
    """
    Returns the backup directory path for a specific database.
    Creates the directory if it doesn't exist.
    
    Args:
        db_name: Database filename (e.g., 'library.db')
    
    Returns:
        Absolute path to the backup directory for this database.
    """
    # Strip .db extension for cleaner folder name
    base_name = db_name.replace('.db', '')
    backup_path = os.path.join(BACKUP_DIR, base_name)
    
    if not os.path.exists(backup_path):
        os.makedirs(backup_path)
        logger.info(f"Created backup directory: {backup_path}")
    
    return backup_path


def list_backups(db_name: str) -> List[Dict[str, Any]]:
    """
    Lists all backups for a specific database.
    
    Args:
        db_name: Database filename (e.g., 'library.db')
    
    Returns:
        List of backup info dicts with keys: filename, path, date, size_bytes, size_human
    """
    backup_dir = get_backup_dir(db_name)
    backups = []
    
    if not os.path.exists(backup_dir):
        return backups
    
    for filename in os.listdir(backup_dir):
        if filename.endswith('.db'):
            filepath = os.path.join(backup_dir, filename)
            stat = os.stat(filepath)
            
            # Parse date from filename (format: dbname_YYYY-MM-DD.db)
            try:
                date_str = filename.rsplit('_', 1)[-1].replace('.db', '')
                date = datetime.strptime(date_str, '%Y-%m-%d')
            except (ValueError, IndexError):
                date = datetime.fromtimestamp(stat.st_mtime)
            
            backups.append({
                'filename': filename,
                'path': filepath,
                'date': date.isoformat(),
                'date_formatted': date.strftime('%b %d, %Y'),
                'size_bytes': stat.st_size,
                'size_human': _format_file_size(stat.st_size)
            })
    
    # Sort by date, newest first
    backups.sort(key=lambda x: x['date'], reverse=True)
    return backups


def _format_file_size(size_bytes: int) -> str:
    """Formats file size in human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def get_last_backup_date(db_name: str) -> Optional[datetime]:
    """
    Gets the date of the most recent backup for a database.
    
    Args:
        db_name: Database filename
    
    Returns:
        datetime of last backup, or None if no backups exist
    """
    backups = list_backups(db_name)
    if not backups:
        return None
    
    try:
        return datetime.fromisoformat(backups[0]['date'])
    except (ValueError, KeyError):
        return None


def should_backup(db_name: str, frequency_days: int = 7) -> bool:
    """
    Determines if a backup is due based on frequency setting.
    
    Args:
        db_name: Database filename
        frequency_days: Days between backups (default: 7 for weekly)
    
    Returns:
        True if backup should be performed, False otherwise
    """
    last_backup = get_last_backup_date(db_name)
    
    if last_backup is None:
        logger.info(f"No previous backup found for {db_name}, backup needed")
        return True
    
    days_since_backup = (datetime.now() - last_backup).days
    should_run = days_since_backup >= frequency_days
    
    if should_run:
        logger.info(f"Backup due for {db_name}: {days_since_backup} days since last backup")
    else:
        logger.debug(f"Backup not due for {db_name}: {days_since_backup}/{frequency_days} days")
    
    return should_run


def create_backup(db_name: str, max_backups: int = 3) -> Dict[str, Any]:
    """
    Creates a backup of the specified database.
    
    Args:
        db_name: Database filename (e.g., 'library.db')
        max_backups: Maximum number of backups to retain (oldest are pruned)
    
    Returns:
        Dict with status and backup info or error message
    """
    try:
        source_path = os.path.join(DATA_DIR, db_name)
        
        if not os.path.exists(source_path):
            return {'status': 'error', 'message': f'Database not found: {db_name}'}
        
        backup_dir = get_backup_dir(db_name)
        base_name = db_name.replace('.db', '')
        date_str = datetime.now().strftime('%Y-%m-%d')
        backup_filename = f"{base_name}_{date_str}.db"
        backup_path = os.path.join(backup_dir, backup_filename)
        
        # If backup for today already exists, add time suffix
        if os.path.exists(backup_path):
            time_str = datetime.now().strftime('%H%M%S')
            backup_filename = f"{base_name}_{date_str}_{time_str}.db"
            backup_path = os.path.join(backup_dir, backup_filename)
        
        # Copy the database file
        shutil.copy2(source_path, backup_path)
        logger.info(f"Created backup: {backup_path}")
        
        # Prune old backups if exceeding max
        _prune_old_backups(db_name, max_backups)
        
        stat = os.stat(backup_path)
        return {
            'status': 'success',
            'backup': {
                'filename': backup_filename,
                'path': backup_path,
                'date': datetime.now().isoformat(),
                'size_human': _format_file_size(stat.st_size)
            }
        }
    
    except Exception as e:
        logger.error(f"Failed to create backup for {db_name}: {e}")
        return {'status': 'error', 'message': str(e)}


def _prune_old_backups(db_name: str, max_backups: int) -> None:
    """Removes oldest backups exceeding the maximum retention count."""
    backups = list_backups(db_name)
    
    if len(backups) <= max_backups:
        return
    
    # Remove oldest backups (list is sorted newest first)
    for backup in backups[max_backups:]:
        try:
            os.remove(backup['path'])
            logger.info(f"Pruned old backup: {backup['filename']}")
        except Exception as e:
            logger.error(f"Failed to remove backup {backup['filename']}: {e}")


def restore_backup(backup_path: str, db_name: str) -> Dict[str, Any]:
    """
    Restores a backup by replacing the current database file.
    
    Args:
        backup_path: Full path to the backup file
        db_name: Target database filename to restore to
    
    Returns:
        Dict with status and message
    """
    try:
        if not os.path.exists(backup_path):
            return {'status': 'error', 'message': 'Backup file not found'}
        
        target_path = os.path.join(DATA_DIR, db_name)
        
        # Create a safety backup before restoring
        if os.path.exists(target_path):
            safety_backup = target_path + '.pre_restore'
            shutil.copy2(target_path, safety_backup)
            logger.info(f"Created safety backup: {safety_backup}")
        
        # Restore the backup
        shutil.copy2(backup_path, target_path)
        logger.info(f"Restored backup {backup_path} to {target_path}")
        
        return {
            'status': 'success',
            'message': f'Restored {os.path.basename(backup_path)} to {db_name}'
        }
    
    except Exception as e:
        logger.error(f"Failed to restore backup: {e}")
        return {'status': 'error', 'message': str(e)}


def delete_backup(backup_path: str) -> Dict[str, Any]:
    """
    Deletes a specific backup file.
    
    Args:
        backup_path: Full path to the backup file
    
    Returns:
        Dict with status and message
    """
    try:
        if not os.path.exists(backup_path):
            return {'status': 'error', 'message': 'Backup file not found'}
        
        # Security: ensure the path is within the backups directory
        if not os.path.abspath(backup_path).startswith(os.path.abspath(BACKUP_DIR)):
            return {'status': 'error', 'message': 'Invalid backup path'}
        
        os.remove(backup_path)
        logger.info(f"Deleted backup: {backup_path}")
        
        return {
            'status': 'success',
            'message': f'Deleted {os.path.basename(backup_path)}'
        }
    
    except Exception as e:
        logger.error(f"Failed to delete backup: {e}")
        return {'status': 'error', 'message': str(e)}


def run_auto_backup(db_name: str, settings: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """
    Runs automatic backup if enabled and due.
    
    Args:
        db_name: Database filename
        settings: Backup settings dict (uses defaults if not provided)
    
    Returns:
        Backup result if backup was created, None otherwise
    """
    if settings is None:
        settings = DEFAULT_BACKUP_SETTINGS
    
    if not settings.get('enabled', True):
        logger.debug("Auto-backup disabled")
        return None
    
    frequency = settings.get('frequencyDays', 7)
    max_backups = settings.get('maxBackups', 3)
    
    if should_backup(db_name, frequency):
        return create_backup(db_name, max_backups)
    
    return None
