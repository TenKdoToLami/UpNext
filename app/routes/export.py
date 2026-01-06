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

from flask import Blueprint, request, send_file, render_template, jsonify, current_app
from app.services.data_manager import DataManager
from app.utils.constants import RATING_MAP, MEDIA_COLOR_MAP, STATUS_TEXT_MAP

bp = Blueprint('export', __name__, url_prefix='/api')
data_manager = DataManager()
logger = logging.getLogger(__name__)

# Default fields for CSV export (Updated to be comprehensive)
DEFAULT_CSV_FIELDS = [
    'id', 'title', 'type', 'status', 'rating', 'authors', 'universe',
    'series', 'seriesNumber', 'progress', 'description', 'notes',
    'review', 'coverUrl', 'isHidden', 
    'releaseDate', 'tags', 'abbreviations', 'alternateTitles',
    'episodeCount', 'volumeCount', 'chapterCount', 'wordCount', 
    'pageCount', 'avgDurationMinutes', 'completedAt', 'rereadCount',
    'externalLinks', 'children'
]

# Patterns to exclude from full backup
EXCLUDE_PATTERNS = [
    '__pycache__', '.pyc', '.git', '.env', 'venv', 'env',
    '.vscode', '.idea', 'node_modules', '.DS_Store', 'Thumbs.db',
    'dist', 'build', '.pytest_cache', '.mypy_cache'
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
    
    # Check if we are doing a raw export (JSON/CSV/XML)
    # For raw exports, we usually want to ignore the "Hidden" filter to ensure full backup
    # unless explicitly handled otherwise. 
    # However, user requested "unless you are in raw data, where it should show them anyway"
    # So for raw formats, we FORCE exclude_hidden to False.
    is_raw_format = params['format'] in ['json_raw', 'csv', 'xml', 'db']
    exclude_hidden = params['exclude_hidden']
    
    if is_raw_format:
        exclude_hidden = False

    for item in items:
        # Hidden filter
        if exclude_hidden and item.get('isHidden'):
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
    """
    Collect item IDs for items that have cover images.
    
    Args:
        items (list): List of item dictionaries.
        include_covers (bool): Whether to include covers in the export.
        
    Returns:
        set: A set of item IDs that have associated cover content.
    """
    if not include_covers:
        return set()
    return {item.get('id') for item in items if item.get('coverUrl')}


def add_images_to_zip(zf, item_ids):
    """
    Retrieves cover binary data from the database and adds it to the ZIP archive.
    
    Args:
        zf (zipfile.ZipFile): The target ZIP archive.
        item_ids (set): Set of item IDs to fetch covers for.
    """
    from app.models import MediaItem
    from app.database import db
    import mimetypes

    for item_id in item_ids:
        item = db.session.get(MediaItem, item_id)
        if item and item.cover and item.cover.cover_image:
            ext = ".jpg"
            if item.cover.cover_mime:
                 ext = mimetypes.guess_extension(item.cover.cover_mime) or ".jpg"
            
            filename = f"{item_id}{ext}"
            zf.writestr(f"images/{filename}", item.cover.cover_image)



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

# =============================================================================
# EXPORT FORMATS
# =============================================================================

def export_json(items, fields, images):
    """Export items as JSON."""
    processed_items = _process_items_for_export(items, images, base64_encode=False)
    # ... (same as before but using updated process func) ...
    export_items = [filter_item_fields(item, fields) for item in processed_items] if fields else processed_items
    json_data = json.dumps(export_items, indent=2, ensure_ascii=False)
    
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w') as zf:
        zf.writestr('upnext_library.json', json_data)
        add_images_to_zip(zf, images)
    
    return create_zip_response(generate_zip_filename('upnext_raw_export'), memory_file)


def _process_items_for_export(items, images, base64_encode=False):
    """
    Adjusts item metadata for export.
    
    Args:
        items (list): List of item dictionaries.
        images (set): Set of item IDs being exported with binary covers.
        base64_encode (bool): If True, embeds images as base64 strings.
        
    Returns:
        list: Processed item dictionaries.
    """
    # Local imports to prevent circular dependencies
    from app.models import MediaItem
    from app.database import db
    import mimetypes
    import base64
    
    processed = []
    for item in items:
        new_item = item.copy()
        
        # Handle cover images handling (Binary Link vs Base64)
        if new_item.get('id') in images:
             media_item = db.session.get(MediaItem, new_item['id'])
             if media_item and media_item.cover and media_item.cover.cover_image:
                 mime = media_item.cover.cover_mime or "image/jpeg"
                 ext = mimetypes.guess_extension(mime) or ".jpg"
                 
                 if base64_encode:
                     b64_str = base64.b64encode(media_item.cover.cover_image).decode('utf-8')
                     new_item['coverUrl'] = f"data:{mime};base64,{b64_str}"
                 else:
                     new_item['coverUrl'] = f"images/{new_item['id']}{ext}"

        # Ensure child items have necessary display fields
        if 'children' in new_item and new_item['children']:
            updated_children = []
            for child in new_item['children']:
                child_data = child.copy() if isinstance(child, dict) else child
                updated_children.append(child_data)
            new_item['children'] = updated_children

        processed.append(new_item)
    return processed

def export_csv(items, fields, images):
    """Export items as CSV."""
    processed_items = _process_items_for_export(items, images, base64_encode=False)
    
    # Use provided fields or fallback to extended default list
    csv_fields = [f for f in fields] if fields else DEFAULT_CSV_FIELDS
    
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=csv_fields, extrasaction='ignore')
    writer.writeheader()
    
    for item in processed_items:
        row = {}
        for field in csv_fields:
            value = item.get(field, '')
            if isinstance(value, list):
                # Handle lists of dicts (like children, externalLinks) vs strings (tags)
                if value and isinstance(value[0], dict):
                     value = json.dumps(value, ensure_ascii=False)
                else:
                     value = ', '.join(str(v) for v in value)
            elif isinstance(value, bool):
                value = 'Yes' if value else 'No'
            elif value is None:
                value = ""
                
            row[field] = value
        writer.writerow(row)
    
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, 'w') as zf:
        zf.writestr('upnext_library.csv', output.getvalue())
        add_images_to_zip(zf, images)
    
    return create_zip_response(generate_zip_filename('upnext_csv_export'), memory_file)


def export_xml(items, fields, images):
    """Export items as XML."""
    processed_items = _process_items_for_export(items, images, base64_encode=False)
    
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
    """
    Export items as a SINGLE HTML file.
    
    Embeds CSS and Images (Base64) directly into the HTML.
    """
    processed_items = _process_items_for_export(items, images, base64_encode=True)
    
    template_map = {
        'html_card': 'export_card.html',
        'html_accordion': 'export_accordion.html'
    }
    template_name = template_map.get(format_param, 'export_list.html')
    
    # Read CSS Content
    css_file_map = {
        'html_card': 'export_card.css',
        'html_accordion': 'export_accordion.css'
    }
    css_file_name = css_file_map.get(format_param, 'export_list.css')
    
    css_content = ""
    try:
        from app.config import STATIC_DIR
        css_path = os.path.join(STATIC_DIR, 'css', css_file_name)
        if os.path.exists(css_path):
            with open(css_path, 'r', encoding='utf-8') as f:
                css_content = f.read()
    except Exception as e:
        logger.warning(f"Failed to include exported CSS: {e}")

    # Render Template
    html_content = render_template(
        template_name,
        items=processed_items,
        fields=fields,
        now=datetime.now(),
        # css_content passed via string replacement to avoid formatter issues
        RATING_MAP=RATING_MAP,
        MEDIA_COLOR_MAP=MEDIA_COLOR_MAP,
        STATUS_TEXT_MAP=STATUS_TEXT_MAP
    )
    
    # Inject CSS via string replacement to be robust against HTML formatters
    # that break Jinja2 {{ variable }} syntax
    if css_content:
        html_content = html_content.replace('/* UP_NEXT_CSS_INJECT */', css_content)
    
    # Create Response
    memory_file = io.BytesIO()
    memory_file.write(html_content.encode('utf-8'))
    memory_file.seek(0)
    
    return send_file(
        memory_file,
        mimetype='text/html',
        as_attachment=True,
        download_name=generate_zip_filename(f'upnext_{format_param}').replace('.zip', '.html')
    )



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
    
    Creates a ZIP containing the complete application directory contents,
    respecting exclusion patterns. This includes source code, data, config,
    static assets, and templates.
    
    Returns:
        ZIP file containing the complete application directory structure.
    """
    try:
        # Use BASE_DIR from config which handles both source and frozen envs
        from app.config import BASE_DIR
        
        target_root = BASE_DIR
        
        def should_exclude(path):
            return any(pattern in path for pattern in EXCLUDE_PATTERNS)
        
        memory_file = io.BytesIO()
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            for root, dirs, files in os.walk(target_root):
                # Filter directories in-place
                dirs[:] = [d for d in dirs if not should_exclude(os.path.join(root, d))]
                
                for file in files:
                    file_path = os.path.join(root, file)
                    if should_exclude(file_path):
                        continue
                    
                    # Store relative to BASE_DIR
                    rel_path = os.path.relpath(file_path, target_root)
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

## Restore Instructions

1.  **Extract**: Unzip this archive to your desired location.
2.  **Environment**: 
    - If running from source, ensure you have Python 3.8+ and run `pip install -r requirements.txt`.
    - If this was a portable build, you likely have the executable + data.
3.  **Run**:
    - Source: `python manage.py run`
    - Executable: Run the `.exe` or binary file.

## Contents Overview

*   `data/`: Contains your `library.db` (media items) and `config.json` (settings).
*   `app/`: Source code directory.
*   `manage.py`: Management script.
""".strip()
