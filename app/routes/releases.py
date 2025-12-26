"""
API Routes for Release Calendar.

Handles fetching and managing media release events including month-based
and upcoming/overdue views.
"""

from flask import Blueprint, jsonify, request
from datetime import date, datetime, timedelta
import logging
from sqlalchemy import or_

from app.database import db
from app.models import MediaRelease, MediaItem

bp = Blueprint("releases", __name__, url_prefix="/api")
logger = logging.getLogger(__name__)


@bp.route("/releases", methods=["GET"])
def get_releases():
    """
    Fetch releases with optional date filtering.
    
    Query params:
        from: Start date (YYYY-MM-DD), defaults to 30 days ago
        to: End date (YYYY-MM-DD), defaults to 60 days from now
    """
    try:
        from_str = request.args.get("from")
        to_str = request.args.get("to")
        today = date.today()
        
        if from_str:
            from_date = datetime.strptime(from_str, "%Y-%m-%d").date()
        else:
            from_date = today - timedelta(days=30)
        
        if to_str:
            to_date = datetime.strptime(to_str, "%Y-%m-%d").date()
        else:
            to_date = today + timedelta(days=60)
        
        releases = (
            db.session.query(MediaRelease)
            .filter(MediaRelease.date >= from_date)
            .filter(MediaRelease.date <= to_date)
            .order_by(MediaRelease.date.asc(), MediaRelease.release_time.asc())
            .all()
        )
        
        result = []
        for release in releases:
            release_data = {
                "id": release.id,
                "date": release.date.isoformat(),
                "time": release.release_time.strftime("%H:%M") if release.release_time else None,
                "content": release.content,
                "isTracked": release.is_tracked,
                "itemId": release.item_id,
            }
            
            if release.item:
                release_data["item"] = {
                    "id": release.item.id,
                    "title": release.item.title,
                    "type": release.item.type,
                    "coverUrl": release.item.cover_url,
                }
            result.append(release_data)
        
        return jsonify(result)
        
    except ValueError as e:
        logger.warning(f"Invalid date format in releases query: {e}")
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
    except Exception as e:
        logger.error(f"Error fetching releases: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch releases"}), 500


@bp.route("/releases/upcoming", methods=["GET"])
def get_upcoming_releases():
    """
    Fetch upcoming releases plus past releases that haven't been marked as seen.
    """
    try:
        limit = min(int(request.args.get("limit", 50)), 100)
        offset = int(request.args.get("offset", 0))
        today = date.today()
        
        # 1. Overdue/Unseen Releases
        overdue_releases = (
            db.session.query(MediaRelease)
            .filter(MediaRelease.date < today)
            .filter(or_(MediaRelease.is_tracked == True, MediaRelease.is_tracked == None))
            .order_by(MediaRelease.date.asc(), MediaRelease.release_time.asc())
            .all()
        )

        # 2. Future Releases
        future_releases = (
            db.session.query(MediaRelease)
            .filter(MediaRelease.date >= today)
            .filter(or_(MediaRelease.is_tracked == True, MediaRelease.is_tracked == None))
            .order_by(MediaRelease.date.asc(), MediaRelease.release_time.asc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        
        all_releases = overdue_releases + future_releases
        
        result = []
        for release in all_releases:
            release_data = {
                "id": release.id,
                "date": release.date.isoformat(),
                "time": release.release_time.strftime("%H:%M") if release.release_time else None,
                "content": release.content,
                "isTracked": release.is_tracked,
                "itemId": release.item_id,
            }
            
            if release.item:
                release_data["item"] = {
                    "id": release.item.id,
                    "title": release.item.title,
                    "type": release.item.type,
                    "coverUrl": release.item.cover_url,
                    "userData": {
                        "rating": release.item.rating if release.item.user_data else 0
                    }
                }
            result.append(release_data)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error fetching upcoming releases: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch upcoming releases"}), 500


@bp.route("/releases", methods=["POST"])
def create_release():
    """
    Create a new release event.
    """
    try:
        data = request.get_json()
        if not data or not data.get("date") or not data.get("content"):
            return jsonify({"error": "Date and content are required"}), 400
            
        try:
            release_date = datetime.strptime(data["date"], "%Y-%m-%d").date()
        except ValueError:
            return jsonify({"error": "Invalid date format. Use YYYY-MM-DD"}), 400
            
        release_time = None
        if data.get("time"):
            try:
                release_time = datetime.strptime(data["time"], "%H:%M").time()
            except ValueError:
                pass

        new_release = MediaRelease(
            date=release_date,
            release_time=release_time,
            content=data["content"],
            item_id=data.get("itemId"),
            is_tracked=data.get("isTracked", True),
            notification_sent=False
        )
        
        db.session.add(new_release)
        db.session.commit()
        
        return jsonify({
            "status": "success", 
            "id": new_release.id
        }), 201
        
    except Exception as e:
        logger.error(f"Error creating release: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Failed to create release"}), 500


@bp.route("/releases/<int:release_id>", methods=["PUT"])
def update_release(release_id):
    """
    Update an existing release event.
    """
    try:
        release = db.session.get(MediaRelease, release_id)
        if not release:
            return jsonify({"error": "Release not found"}), 404
            
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400
            
        if "date" in data:
            try:
                release.date = datetime.strptime(data["date"], "%Y-%m-%d").date()
            except ValueError:
                return jsonify({"error": "Invalid date format"}), 400
                
        if "content" in data:
            release.content = data["content"]
        if "time" in data:
            if data["time"]:
                try:
                    release.release_time = datetime.strptime(data["time"], "%H:%M").time()
                except ValueError:
                    pass
            else:
                release.release_time = None
        if "itemId" in data:
            release.item_id = data["itemId"]
        if "isTracked" in data:
            release.is_tracked = data["isTracked"]
            
        db.session.commit()
        return jsonify({"status": "success"}), 200
        
    except Exception as e:
        logger.error(f"Error updating release {release_id}: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Failed to update release"}), 500


@bp.route("/releases/<int:release_id>", methods=["DELETE"])
def delete_release(release_id):
    """
    Remove a release event from the calendar.
    """
    try:
        release = db.session.get(MediaRelease, release_id)
        if not release:
            return jsonify({"error": "Release not found"}), 404
            
        db.session.delete(release)
        db.session.commit()
        return jsonify({"status": "success"}), 200
        
    except Exception as e:
        logger.error(f"Error deleting release {release_id}: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Failed to delete release"}), 500
