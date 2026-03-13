import sys
import os
from datetime import datetime

# Ensure we're running from the root directory to allow absolute imports
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.append(ROOT_DIR)

from app import create_app
from app.database import db
from app.models import MediaItem

def backfill():
    print("Starting completed_at backfill...")
    app = create_app()
    with app.app_context():
        # Get all items that have user_data and are Anticipating or Completed
        items = MediaItem.query.all()
        count = 0
        for item in items:
            if item.user_data and item.user_data.status in ["Anticipating", "Completed"]:
                if not item.user_data.completed_at:
                    # Use updated_at as fallback, or created_at, or now
                    fallback_dt = item.updated_at or item.created_at or datetime.utcnow()
                    item.user_data.completed_at = fallback_dt.date()
                    count += 1
        
        db.session.commit()
        print(f"Successfully backfilled {count} items with completed_at dates.")

if __name__ == "__main__":
    backfill()
