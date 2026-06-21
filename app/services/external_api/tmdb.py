import logging
from typing import Any, Dict, List, Optional
import requests

from .base import BaseAPIClient

logger = logging.getLogger(__name__)


class TMDBClient(BaseAPIClient):
    """
    TMDB REST API client for Movies and TV Series.

    API Docs: https://developer.themoviedb.org/docs
    Rate Limit: None (officially removed Dec 2019)
    """

    API_BASE = "https://api.themoviedb.org/3"
    IMAGE_BASE = "https://image.tmdb.org/t/p"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    def _request(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Execute a REST request."""
        if not self.api_key:
            logger.warning("TMDB API key not configured")
            return None

        params = params or {}
        params["api_key"] = self.api_key

        # Force English language
        params["language"] = "en-US"

        try:
            response = requests.get(
                f"{self.API_BASE}{endpoint}", params=params, timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"TMDB API request failed: {e}")
            return None

    def search(
        self, query: str, media_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Search TMDB for movies or TV series.

        Args:
            query: Search query string
            media_type: 'Movie' or 'Series'
        """
        endpoint = "/search/movie" if media_type == "Movie" else "/search/tv"

        data = self._request(endpoint, {"query": query, "page": 1})
        if not data:
            return []

        results = []
        for item in data.get("results", [])[:10]:
            # Movies use 'title', TV uses 'name'
            title = item.get("title") or item.get("name") or "Unknown"
            original_title = item.get("original_title") or item.get("original_name")

            # Date parsing
            date_str = item.get("release_date") or item.get("first_air_date") or ""
            year = None
            if len(date_str) >= 4 and date_str[:4].isdigit():
                year = int(date_str[:4])

            poster_path = item.get("poster_path")
            cover_url = f"{self.IMAGE_BASE}/w780{poster_path}" if poster_path else None

            desc = item.get("overview", "") or ""
            desc_preview = desc[:200] + "..." if len(desc) > 200 else desc

            results.append(
                {
                    "id": str(item["id"]),
                    "source": "tmdb",
                    "title": title,
                    "original_title": (
                        original_title if original_title != title else None
                    ),
                    "cover_url": cover_url,
                    "year": year,
                    "description_preview": desc_preview,
                }
            )

        return results

    def get_details(
        self, external_id: str, media_type: str = "Movie"
    ) -> Optional[Dict[str, Any]]:
        """Get full details for a TMDB item."""
        endpoint = (
            f"/movie/{external_id}" if media_type == "Movie" else f"/tv/{external_id}"
        )

        # Append credits to get cast/crew
        data = self._request(endpoint, {"append_to_response": "credits"})
        if not data:
            return None

        title = data.get("title") or data.get("name") or "Unknown"
        original_title = data.get("original_title") or data.get("original_name")

        # Build alternate titles
        alt_titles = []
        if original_title and original_title != title:
            alt_titles.append(original_title)

        # Date
        date_str = data.get("release_date") or data.get("first_air_date") or ""
        release_date = date_str if date_str else None

        # Standardize YYYY to YYYY-01-01
        if release_date and len(release_date) == 4 and release_date.isdigit():
            release_date = f"{release_date}-01-01"

        # Cover
        poster_path = data.get("poster_path")
        cover_url = f"{self.IMAGE_BASE}/original{poster_path}" if poster_path else None

        # Genres
        genres = [g["name"] for g in data.get("genres", [])]

        # Directors/Creators
        credits = data.get("credits", {})
        directors = [
            c["name"] for c in credits.get("crew", []) if c.get("job") == "Director"
        ][:3]

        # For TV, get creators instead
        if media_type == "Series":
            directors = [c["name"] for c in data.get("created_by", [])][:3]

        # Runtime
        runtime = data.get("runtime")  # Movies
        if not runtime:
            # Check episode run times (list)
            runtimes = data.get("episode_run_time", [])
            if runtimes:
                runtime = sum(runtimes) // len(runtimes)

            # Fallback 1: Last episode to air
            if not runtime:
                last_ep = data.get("last_episode_to_air") or {}
                if last_ep.get("runtime"):
                    runtime = last_ep.get("runtime")

            # Fallback 2: Next episode to air
            if not runtime:
                next_ep = data.get("next_episode_to_air") or {}
                if next_ep.get("runtime"):
                    runtime = next_ep.get("runtime")

        # Episode/Season count for Series
        episodes = data.get("number_of_episodes")
        seasons = data.get("number_of_seasons")

        seasons_list = []
        if media_type == "Series":
            # If we have season data from API, use it
            if data.get("seasons"):
                for s in data["seasons"]:
                    if s.get("season_number") == 0:
                        continue

                    seasons_list.append(
                        {
                            "number": s.get("season_number"),
                            "episodes": s.get("episode_count") or 0,
                            "duration": runtime or 0,
                            "release_date": s.get("air_date"),
                        }
                    )

            # Fallback: If no season details but we have a season count, generate placeholders
            elif seasons and seasons > 0:
                for i in range(1, seasons + 1):
                    seasons_list.append(
                        {
                            "number": i,
                            "episodes": 0,
                            "duration": runtime or 0,
                            "release_date": None,
                        }
                    )

        return {
            "id": str(data["id"]),
            "source": "tmdb",
            "title": title,
            "alternate_titles": alt_titles,
            "cover_url": cover_url,
            "description": data.get("overview", ""),
            "release_date": release_date,
            "avg_duration_minutes": runtime,
            "episodes": episodes,
            "volumes": seasons,  # Map seasons count to volumes for Series
            "seasons": seasons_list,  # Full list for auto-population
            "genres": genres,
            "authors": directors,  # Directors/Creators
            "external_link": f"https://www.themoviedb.org/{'movie' if media_type == 'Movie' else 'tv'}/{data['id']}",
        }
