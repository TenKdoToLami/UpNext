"""
Export API Routes for UpNext.

Handles all export functionality including:
- Visual exports (HTML formats)
- Raw data exports (JSON, CSV, XML)
- Full application backup

Routes:
    GET /api/export - Export library data in various formats
    GET /api/export/full - Export complete application backup

Usage:
    This Blueprint can be registered in any Flask application to provide export capabilities.
    It requires a `DataManager` service to fetch items and assumes items are dictionaries.
"""

import os
import io
import csv
import json
import zipfile
import logging
from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom

from flask import Blueprint, request, send_file, render_template, jsonify
from app.services.data_manager import DataManager
from app.utils.constants import RATING_MAP, MEDIA_COLOR_MAP, STATUS_TEXT_MAP

bp = Blueprint('export', __name__, url_prefix='/api')
data_manager = DataManager()
logger = logging.getLogger(__name__)

# Default fields for CSV export
DEFAULT_CSV_FIELDS = [
    'title', 'type', 'status', 'rating', 'authors', 'universe',
    'series', 'seriesNumber', 'progress', 'description', 'notes',
    'review', 'coverUrl', 'isHidden'
]

# Patterns to exclude from full backup
EXCLUDE_PATTERNS = [
    '__pycache__', '.pyc', '.git', '.env', 'venv', 'env',
    '.vscode', '.idea', 'node_modules', '.DS_Store', 'Thumbs.db'
]


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def parse_export_params():
    """Parse and return export request parameters."""
    return {
        'format': request.args.get('format', 'html_list'),
        'fields': [f for f in request.args.get('fields', '').split(',') if f],
        'filter_types': [t for t in request.args.get('filterTypes', '').split(',') if t],
        'filter_statuses': [s for s in request.args.get('filterStatuses', '').split(',') if s],
        'filter_ratings': [int(r) for r in request.args.get('filterRatings', '').split(',') if r.isdigit()],
        'exclude_hidden': request.args.get('excludeHidden', 'false').lower() == 'true',
        'include_covers': request.args.get('includeCovers', 'true').lower() == 'true'
    }


def filter_items(items, params):
    """Filter items based on export parameters."""
    filtered = []
    for item in items:
        # Hidden filter
        if params['exclude_hidden'] and item.get('isHidden'):
            continue
        # Type filter
        if params['filter_types'] and item.get('type') not in params['filter_types']:
            continue
        # Status filter
        if params['filter_statuses'] and item.get('status') not in params['filter_statuses']:
            continue
        # Rating filter
        if params['filter_ratings']:
            try:
                rating = int(item.get('rating') or 0)
            except (ValueError, TypeError):
                rating = 0
            if rating not in params['filter_ratings']:
                continue
        filtered.append(item)
    return filtered


def filter_item_fields(item, fields):
    """Filter item to only include specified fields."""
    if not fields:
        return item
    return {k: v for k, v in item.items() if k in fields}



def collect_cover_images(items, include_covers):
    """Collect item IDs for items that have cover images."""
    if not include_covers:
        return set()
    return {item.get('id') for item in items if item.get('coverUrl')}


def add_images_to_zip(zf, item_ids):
    """Add cover images to a ZIP file from the database."""
    from app.models import MediaItem
    from app.database import db
    import mimetypes

    for item_id in item_ids:
        item = db.session.get(MediaItem, item_id)
        if item and item.cover_image:
            ext = ".jpg"
            if item.cover_mime:
                 ext = mimetypes.guess_extension(item.cover_mime) or ".jpg"
            
            filename = f"{item_id}{ext}"
            zf.writestr(f"images/{filename}", item.cover_image)



def create_zip_response(filename, memory_file):
    """Create a ZIP file download response."""
    memory_file.seek(0)
    return send_file(
        memory_file,
        mimetype='application/zip',
        as_attachment=True,
        download_name=filename
    )


def generate_zip_filename(prefix):
    """Generate a timestamped ZIP filename."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f'{prefix}_{timestamp}.zip'


# =============================================================================
# EXPORT FORMATS
# =============================================================================

def export_json(items, fields, images):
    """Export items as JSON."""
    processed_items = _process_items_for_export(items, images)
    export_items = [filter_item_fields(item, fields) for item in processed_items] if fields else processed_items
    json_data = json.dumps(export_items, indent=2, ensure_ascii=False)
    
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w') as zf:
        zf.writestr('upnext_library.json', json_data)
        add_images_to_zip(zf, images)
    
    return create_zip_response(generate_zip_filename('upnext_raw_export'), memory_file)


def _process_items_for_export(items, images):
    """Refreshes item cover URLs for zip export."""
    from app.models import MediaItem
    from app.database import db
    import mimetypes
    
    processed = []
    for item in items:
        new_item = item.copy()
        if new_item.get('id') in images:
             media_item = db.session.get(MediaItem, new_item['id'])
             ext = ".jpg"
             if media_item and media_item.cover_mime:
                 ext = mimetypes.guess_extension(media_item.cover_mime) or ".jpg"
             new_item['coverUrl'] = f"images/{new_item['id']}{ext}"
        processed.append(new_item)
    return processed

def export_csv(items, fields, images):
    """Export items as CSV."""
    processed_items = _process_items_for_export(items, images)
    csv_fields = [f for f in fields if f not in ['children', 'externalLinks']] if fields else DEFAULT_CSV_FIELDS
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=csv_fields, extrasaction='ignore')
    writer.writeheader()
    
    for item in processed_items:
        row = {}
        for field in csv_fields:
            value = item.get(field, '')
            if isinstance(value, list):
                value = ', '.join(str(v) for v in value)
            elif isinstance(value, bool):
                value = 'Yes' if value else 'No'
            row[field] = value
        writer.writerow(row)
    
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w') as zf:
        zf.writestr('upnext_library.csv', output.getvalue())
        add_images_to_zip(zf, images)
    
    return create_zip_response(generate_zip_filename('upnext_csv_export'), memory_file)


def export_xml(items, fields, images):
    """Export items as XML."""
    processed_items = _process_items_for_export(items, images)
    
    root = Element('library')
    root.set('exported', datetime.now().isoformat())
    root.set('count', str(len(items)))
    
    for item in processed_items:
        item_data = filter_item_fields(item, fields) if fields else item
        item_el = SubElement(root, 'item')
        item_el.set('id', item.get('id', ''))
        
        for key, value in item_data.items():
            if key == 'id':
                continue
            
            field_el = SubElement(item_el, key)
            
            if isinstance(value, list):
                _serialize_list_to_xml(field_el, key, value)
            elif isinstance(value, bool):
                field_el.text = 'true' if value else 'false'
            elif value is not None:
                field_el.text = str(value)
    
    rough_string = tostring(root, encoding='unicode')
    reparsed = minidom.parseString(rough_string)
    xml_data = reparsed.toprettyxml(indent="  ")
    
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w') as zf:
        zf.writestr('upnext_library.xml', xml_data)
        add_images_to_zip(zf, images)
    
    return create_zip_response(generate_zip_filename('upnext_xml_export'), memory_file)

def _serialize_list_to_xml(parent_el, key, value_list):
    """Serialize a list to XML elements."""
    # Singularize key for child elements (e.g. authors -> author)
    child_tag = key[:-1] if key.endswith('s') else key + '_item'
    
    for item in value_list:
        child_el = SubElement(parent_el, child_tag)
        if isinstance(item, dict):
            for k, v in item.items():
                sub_el = SubElement(child_el, k)
                sub_el.text = str(v) if v is not None else ''
        else:
            child_el.text = str(item)


def export_db():
    """Export the SQLite database file."""
    # Assuming DB is at data/library.db based on config
    from app.config import SQLITE_DB_PATH
    
    if not os.path.exists(SQLITE_DB_PATH):
        raise FileNotFoundError("Database file not found")
        
    return send_file(
        SQLITE_DB_PATH,
        mimetype='application/x-sqlite3',
        as_attachment=True,
        download_name=f'library_backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.db'
    )


def export_html(items, fields, format_param, images):
    """Export items as HTML."""
    processed_items = _process_items_for_export(items, images)
    
    template_map = {
        'html_card': 'export_card.html',
        'html_accordion': 'export_accordion.html'
    }
    template_name = template_map.get(format_param, 'export_list.html')
    
    html_content = render_template(
        template_name,
        items=processed_items,
        fields=fields,
        now=datetime.now(),
        RATING_MAP=RATING_MAP,
        MEDIA_COLOR_MAP=MEDIA_COLOR_MAP,
        STATUS_TEXT_MAP=STATUS_TEXT_MAP
    )
    
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w') as zf:
        zf.writestr('upnext_library.html', html_content)
        add_images_to_zip(zf, images)
    
    return create_zip_response(generate_zip_filename('upnext_export'), memory_file)


# =============================================================================
# ROUTES
# =============================================================================

@bp.route('/export', methods=['GET'])
def export_data():
    """
    Export library data in various formats.
    
    Query Parameters:
        format: Export format (html_list, html_card, html_accordion, json_raw, csv, xml)
        fields: Comma-separated list of fields to include
        filterTypes: Comma-separated media types to include
        filterStatuses: Comma-separated statuses to include
        filterRatings: Comma-separated ratings to include
        excludeHidden: Whether to exclude hidden items (true/false)
        includeCovers: Whether to include cover images (true/false)
    
    Returns:
        ZIP file containing the exported data and optionally images
    """
    try:
        items = data_manager.get_items()
        items.sort(key=lambda x: x.get('updatedAt', ''), reverse=True)
        
        params = parse_export_params()
        items = filter_items(items, params)
        images = collect_cover_images(items, params['include_covers'])
        
        format_param = params['format']
        fields = params['fields']
        
        if format_param == 'json_raw':
            return export_json(items, fields, images)
        elif format_param == 'csv':
            return export_csv(items, fields, images)
        elif format_param == 'xml':
            return export_xml(items, fields, images)
        elif format_param == 'db':
            return export_db()
        else:
            return export_html(items, fields, format_param, images)
    
    except Exception as e:
        logger.error(f"Export error: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@bp.route('/export/full', methods=['GET'])
def export_full():
    """
    Export complete application backup.
    
    Creates a ZIP containing all application files needed to run the app:
    - Python source code
    - HTML templates
    - Static files (CSS, JS, images)
    - Data files
    - Configuration files
    
    Returns:
        ZIP file containing the complete application
    """
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        app_dir = os.path.dirname(current_dir)
        project_root = os.path.dirname(app_dir)
        
        def should_exclude(path):
            return any(pattern in path for pattern in EXCLUDE_PATTERNS)
        
        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(project_root):
                dirs[:] = [d for d in dirs if not should_exclude(d)]
                
                for file in files:
                    file_path = os.path.join(root, file)
                    if should_exclude(file_path):
                        continue
                    
                    rel_path = os.path.relpath(file_path, project_root)
                    try:
                        zf.write(file_path, arcname=rel_path)
                    except Exception as e:
                        logger.warning(f"Could not add file to backup: {rel_path} - {e}")
            
            zf.writestr('BACKUP_README.md', _generate_backup_readme())
        
        return create_zip_response(generate_zip_filename('upnext_full_backup'), memory_file)
    
    except Exception as e:
        logger.error(f"Full export error: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


def _generate_backup_readme():
    """Generate README content for backup ZIP."""
    return f"""# UpNext Full Backup

Created: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

## How to Run

1. Extract this ZIP file to a folder
2. Install Python 3.8+ if not already installed
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run the application:
   ```bash
   python manage.py run
   ```
   (Or use `python manage.py build` to create an executable)

5. Open your browser to http://localhost:5000

## Contents

- `app/` - Application source code
  - `routes/` - API endpoints
  - `services/` - Business logic
  - `models.py` - Database models
  - `database.py` - Database utilities
  - `static/` - CSS, JavaScript, and assets
  - `templates/` - HTML templates
- `data/` - Database directory
  - `library.db` - SQLite database containing all items and images
- `run.py` - Application entry point
- `manage.py` - Project manager script
- `requirements.txt` - Python dependencies

## Notes

- This is a complete backup of your UpNext installation.
- All your library entries and images are stored within `data/library.db`.
- You can restore this backup by extracting it and running the application, or by copying `data/library.db` to a new installation.
"""
