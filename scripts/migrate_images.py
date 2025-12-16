
import os
import sys
import mimetypes

# Add project root to path
sys.path.append(os.getcwd())

from app import create_app
from app.database import db
from app.models import MediaItem
from app.config import IMAGES_DIR

def migrate_images():
    """Reads image files and saves them to the database."""
    app = create_app()
    
    count = 0
    errors = 0
    
    with app.app_context():
        # Important: we need to ensure the new columns exist in the DB.
        # Since we are using create_all() in create_app, and SQLite doesn't support 
        # dropping columns easily, adding new columns might need "alter table" 
        # or relying on create_all to add them if they don't exist?
        # create_all() typically doesn't update existing tables.
        # So we might need to manually alter the table for SQLite.
        
        try:
            print("Attempting to add new columns to SQLite if they don't exist...")
            with db.engine.connect() as conn:
                try:
                    conn.execute(db.text("ALTER TABLE media_items ADD COLUMN cover_image BLOB"))
                    print("Added cover_image column.")
                except Exception as e:
                    print(f"cover_image column might already exist: {e}")
                    
                try:
                    conn.execute(db.text("ALTER TABLE media_items ADD COLUMN cover_mime VARCHAR(50)"))
                    print("Added cover_mime column.")
                except Exception as e:
                    print(f"cover_mime column might already exist: {e}")
                
                conn.commit()
        except Exception as e:
            print(f"Schema update error: {e}")

        # Now migrate data
        items = MediaItem.query.all()
        print(f"Found {len(items)} items. Checking for images...")
        
        for item in items:
            if item.cover_url:
                image_path = os.path.join(IMAGES_DIR, item.cover_url)
                
                if os.path.exists(image_path):
                    try:
                        with open(image_path, 'rb') as f:
                            file_data = f.read()
                            
                        mime_type, _ = mimetypes.guess_type(image_path)
                        if not mime_type:
                            mime_type = 'application/octet-stream'
                            
                        item.cover_image = file_data
                        item.cover_mime = mime_type
                        
                        count += 1
                        print(f"Migrated image for '{item.title}' ({len(file_data)} bytes)")
                    except Exception as e:
                        print(f"Failed to read image for '{item.title}': {e}")
                        errors += 1
                else:
                    print(f"Image not found for '{item.title}': {item.cover_url}")
        
        try:
            db.session.commit()
            print(f"\nMigration complte. Updated {count} items.")
            if errors > 0:
                print(f"Encountered {errors} errors.")
        except Exception as e:
            print(f"Failed to commit changes: {e}")
            db.session.rollback()

if __name__ == "__main__":
    migrate_images()
