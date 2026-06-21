"""
External APIs and Image/Proxy Utilities Blueprints for UpNext.

Handles searching external databases (AniList, TMDB, OpenLibrary, TVMaze, MangaDex),
fetching detail profiles, updating developer keys, image proxying, and image optimizations.
"""

import logging
import json
import os
import requests
from datetime import datetime
from flask import (
    Blueprint,
    jsonify,
    request,
    current_app,
    Response,
    stream_with_context,
)

from app.utils.constants import MEDIA_TYPES
from app.utils.config_manager import load_config, save_config
from app.config import get_sqlite_db_path
from app.utils.image_processor import process_image

bp = Blueprint("external", __name__, url_prefix="/api")
logger = logging.getLogger(__name__)

# Lazy-loaded singleton for external API service
_external_api_service = None


def _get_external_api_service():
    """Get or create the external API service singleton."""
    global _external_api_service
    if _external_api_service is None:
        from app.services.external_api import ExternalAPIService

        config = load_config()
        tmdb_key = config.get("apiKeys", {}).get("tmdb", "")
        _external_api_service = ExternalAPIService(tmdb_api_key=tmdb_key)
    return _external_api_service


@bp.route("/external/search", methods=["GET"])
def external_search():
    """
    Search external APIs for media metadata.

    Query params:
        q: Search query string (required)
        type: Media type - Anime, Manga, Book, Movie, Series (required)

    Returns:
        List of search results with normalized structure.
    """
    query = request.args.get("q", "").strip()
    media_type = request.args.get("type", "")

    if not query:
        return jsonify({"error": "Query parameter 'q' is required"}), 400

    if media_type not in MEDIA_TYPES:
        return (
            jsonify(
                {
                    "error": f"Invalid media type. Must be one of: {', '.join(MEDIA_TYPES)}"
                }
            ),
            400,
        )

    try:
        service = _get_external_api_service()
        source = request.args.get("source")

        if media_type == "Movie" and not source and not service.tmdb.api_key:
            return (
                jsonify(
                    {
                        "error": "TMDB API key not configured",
                        "message": "Please add your TMDB API key in Settings to search for movies.",
                    }
                ),
                400,
            )

        if source == "tmdb" and not service.tmdb.api_key:
            return (
                jsonify(
                    {
                        "error": "TMDB API key not configured",
                        "message": "Please add your TMDB API key in Settings.",
                    }
                ),
                400,
            )

        results = service.search(query, media_type, source)
        return jsonify({"results": results})

    except Exception as e:
        logger.exception(
            f"External search failed for query '{query}', type '{media_type}': {e}"
        )
        return jsonify({"error": "Search failed", "message": str(e)}), 500


@bp.route("/external/details", methods=["GET"])
def external_details():
    """
    Get full details for a specific item from an external API.

    Query params:
        id: External ID of the item (required)
        type: Media type - Anime, Manga, Book, Movie, Series (required)
        source: API source - anilist, tmdb, openlibrary (required)

    Returns:
        Full item details normalized for UpNext wizard pre-fill.
    """
    external_id = request.args.get("id", "").strip()
    media_type = request.args.get("type", "")
    source = request.args.get("source", "").lower()

    if not external_id:
        return jsonify({"error": "Query parameter 'id' is required"}), 400

    if media_type not in MEDIA_TYPES:
        return (
            jsonify(
                {
                    "error": f"Invalid media type. Must be one of: {', '.join(MEDIA_TYPES)}"
                }
            ),
            400,
        )

    if source not in (
        "anilist",
        "tmdb",
        "openlibrary",
        "tvmaze",
        "mangadex",
        "googlebooks",
        "comicvine",
    ):
        return jsonify({"error": "Invalid source"}), 400

    try:
        service = _get_external_api_service()

        # Check TMDB API key
        if source == "tmdb" and not service.tmdb.api_key:
            return (
                jsonify(
                    {
                        "error": "TMDB API key not configured",
                        "message": "Please add your TMDB API key in Settings.",
                    }
                ),
                400,
            )

        details = service.get_details(external_id, media_type, source)

        if not details:
            return jsonify({"error": "Item not found"}), 404

        return jsonify({"item": details})

    except Exception as e:
        logger.error(f"External details fetch failed: {e}", exc_info=True)
        return jsonify({"error": "Failed to fetch details", "message": str(e)}), 500


@bp.route("/external/update-key", methods=["POST"])
def update_external_api_key():
    """
    Update external API keys at runtime.

    Body:
        tmdb: TMDB API key
    """
    try:
        data = request.get_json()
        tmdb_key = data.get("tmdb")
        googlebooks_key = data.get("googlebooks")
        comicvine_key = data.get("comicvine")

        service = _get_external_api_service()

        # Load current config to update
        config = load_config()
        api_keys = config.get("apiKeys", {})

        if tmdb_key:
            service.set_tmdb_api_key(tmdb_key)
            api_keys["tmdb"] = tmdb_key

        if googlebooks_key:
            if hasattr(service, "update_keys"):
                service.update_keys(googlebooks=googlebooks_key)
            api_keys["googlebooks"] = googlebooks_key

        if comicvine_key:
            if hasattr(service, "update_keys"):
                service.update_keys(comicvine=comicvine_key)
            api_keys["comicvine"] = comicvine_key

        save_config({"apiKeys": api_keys})

        return jsonify({"status": "success"})
    except Exception as e:
        logger.exception(f"Failed to update API key: {e}")
        return jsonify({"error": "Update failed", "message": str(e)}), 500


@bp.route("/external/priority", methods=["POST"])
def update_search_priority():
    """
    Update search priority configuration.

    Body:
        type: Media type ('Anime', 'Movie', 'Series')
        source: Source name ('anilist', 'tmdb', 'tvmaze')
    """
    try:
        data = request.get_json()
        media_type = data.get("type")
        source = data.get("source")

        if not media_type or not source:
            return jsonify({"error": "Missing type or source"}), 400

        config = load_config()
        priorities = config.get("searchPriorities", {})
        priorities[media_type] = source
        save_config({"searchPriorities": priorities})

        return jsonify({"status": "success"})
    except Exception as e:
        logger.exception(f"Failed to update search priority: {e}")
        return jsonify({"error": "Update failed", "message": str(e)}), 500


@bp.route("/config", methods=["GET"])
def get_config():
    """Returns the current public configuration."""
    config = load_config()
    return jsonify(config)


@bp.route("/proxy/image", methods=["GET"])
def proxy_image():
    """
    Proxies an external image to bypass CORS restrictions.
    Used by the Image Editor to allow canvas cropping of third-party images.
    """
    url = request.args.get("url")
    if not url:
        return jsonify({"error": "No URL provided"}), 400

    try:
        response = requests.get(
            url,
            timeout=15,
            stream=True,
            headers={"User-Agent": "UpNext/1.0 (Media Tracker App)"},
        )

        if response.status_code != 200:
            logger.warning(
                f"Failed to fetch proxied image from {url}: {response.status_code}"
            )
            return jsonify({"error": "Failed to fetch image"}), response.status_code

        content_type = response.headers.get("Content-Type", "image/jpeg")
        return Response(response.content, mimetype=content_type)

    except Exception as e:
        logger.error(f"Image proxy failed for {url}: {e}")
        return jsonify({"error": "Proxy failed", "message": str(e)}), 500


@bp.route("/admin/optimize-images", methods=["POST"])
def optimize_images():
    """
    Batch optimizes all stored cover images in the database.

    Accepts JSON parameters:
        - width (int): Max width to resize images to. Default: 800.
        - format (str): MIME type for target format. Default: 'image/webp'.
        - quality (int): Compression quality (1-100). Default: 85.

    Returns:
        A text/event-stream with progress updates and final stats.
    """
    data_req = request.get_json() or {}
    target_width = int(data_req.get("width", 800))
    target_format = data_req.get("format", "image/webp")
    target_quality = int(data_req.get("quality", 85))

    # Map MIME type to Pillow format string
    format_map = {
        "image/webp": "WEBP",
        "image/jpeg": "JPEG",
        "image/png": "PNG",
        "image/avif": "AVIF",
    }
    pil_format = format_map.get(target_format, "WEBP")

    def generate():
        """SSE generator for optimization progress."""
        conn = None
        try:
            db_path = get_sqlite_db_path(current_app.config["ACTIVE_DB"])
            import sqlite3

            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()

            cursor.execute(
                "SELECT count(*) FROM media_covers WHERE cover_image IS NOT NULL"
            )
            total = cursor.fetchone()[0]

            yield f"data: {json.dumps({'progress': 0, 'total': total, 'message': 'Starting...'})}\n\n"

            cursor.execute(
                "SELECT item_id, cover_image, cover_mime FROM media_covers WHERE cover_image IS NOT NULL"
            )

            processed = 0
            original_size_total = 0
            new_size_total = 0
            rows = cursor.fetchall()

            for row in rows:
                item_id, blob, mime = row
                if not blob:
                    continue

                original_size = len(blob)
                original_size_total += original_size

                try:
                    new_blob, actual_mime = process_image(
                        blob,
                        target_width=target_width,
                        target_format=target_format,
                        quality=target_quality,
                    )

                    cursor.execute(
                        "UPDATE media_covers SET cover_image = ?, cover_mime = ? WHERE item_id = ?",
                        (new_blob, actual_mime, item_id),
                    )

                    cursor.execute(
                        "UPDATE media_items SET updated_at = ? WHERE id = ?",
                        (datetime.utcnow().isoformat(), item_id),
                    )

                    new_size_total += len(new_blob)
                    processed += 1

                    if processed % 10 == 0:
                        conn.commit()

                    if processed % 5 == 0:
                        yield f"data: {json.dumps({'progress': processed, 'total': total, 'message': f'Processing {processed}/{total}'})}\n\n"

                except Exception as e:
                    logger.error(f"Failed to optimize {item_id}: {e}")

            conn.commit()

            yield f"data: {json.dumps({'progress': total, 'total': total, 'message': 'Vacuuming database...'})}\n\n"
            cursor.execute("VACUUM")
            conn.commit()

            saved_bytes = original_size_total - new_size_total
            saved_mb = round(saved_bytes / (1024 * 1024), 2)

            yield f"data: {json.dumps({'done': True, 'stats': {'processed': processed, 'savedMB': saved_mb}})}\n\n"

        except Exception as e:
            logger.exception("Optimization failed")
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            if conn:
                conn.close()

    return Response(stream_with_context(generate()), mimetype="text/event-stream")
