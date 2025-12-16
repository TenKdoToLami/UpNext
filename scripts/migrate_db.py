
import os
import sys
import json
import logging
from datetime import datetime

# Add root dir to sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(root_dir)

from app import create_app
from app.database import db
from app.models import MediaItem
from app.config import JSON_DB_FILE

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Migrate")

def migrate():
    """Migrate data from library.json to sqlite.db"""
    json_path = JSON_DB_FILE
    
    if not os.path.exists(json_path):
        logger.error(f"JSON file not found at {json_path}")
        return

    logger.info("🚀 Starting migration...")
    
    app = create_app()
    with app.app_context():
        # Create tables
        db.create_all()
        logger.info("✔ Database tables created.")
        
        # Read JSON
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception as e:
            logger.error(f"Failed to read JSON: {e}")
            return

        if not isinstance(data, list):
            logger.error("JSON data is not a list!")
            return

        count = 0
        for item in data:
            # Check if exists
            if db.session.get(MediaItem, item['id']):
                logger.warning(f"Item {item['id']} already exists, skipping.")
                continue

            # Parse dates
            created_at = None
            updated_at = None
            if item.get('createdAt'):
                try:
                    created_at = datetime.fromisoformat(item['createdAt'])
                except ValueError:
                    pass
            if item.get('updatedAt'):
                try:
                    updated_at = datetime.fromisoformat(item['updatedAt'])
                except ValueError:
                    pass

            # Create object
            new_item = MediaItem(
                id=item['id'],
                title=item['title'],
                type=item['type'],
                status=item.get('status', 'Planning'),
                rating=item.get('rating', 0),
                progress=item.get('progress', ''),
                description=item.get('description', ''),
                review=item.get('review', ''),
                notes=item.get('notes', ''),
                universe=item.get('universe', ''),
                series=item.get('series', ''),
                series_number=item.get('seriesNumber', ''),
                cover_url=item.get('coverUrl', ''),
                is_hidden=item.get('isHidden', False),
                authors=item.get('authors', []),
                alternate_titles=item.get('alternateTitles', []),
                external_links=item.get('externalLinks', []),
                children=item.get('children', []),
                created_at=created_at,
                updated_at=updated_at
            )
            db.session.add(new_item)
            count += 1
        
        try:
            db.session.commit()
            logger.info(f"✔ Successfully migrated {count} items.")
            
            # Rename old file
            backup_path = json_path + ".bak"
            os.rename(json_path, backup_path)
            logger.info(f"✔ Renamed {json_path} to {backup_path}")
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"❌ Migration failed during commit: {e}")

if __name__ == "__main__":
    migrate()
