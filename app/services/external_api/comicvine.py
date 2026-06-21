import logging
import re
import time
from typing import Any, Dict, List, Optional
import requests

from .base import BaseAPIClient

logger = logging.getLogger(__name__)


class ComicVineClient(BaseAPIClient):
    """
    Comic Vine API client for Comics/Graphic Novels.
    Requires API Key.
    """

    BASE_URL = "https://comicvine.gamespot.com/api"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    def _request(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        if not self.api_key:
            return None

        params = params or {}
        params["api_key"] = self.api_key
        params["format"] = "json"

        # Rate limit heuristic: 1 req/sec
        time.sleep(1.0)

        try:
            response = requests.get(
                f"{self.BASE_URL}{endpoint}",
                params=params,
                headers={"User-Agent": "UpNext/1.0"},
                timeout=10,
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Comic Vine API request failed: {e}")
            return None

    def search(
        self, query: str, media_type: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        data = self._request(
            "/search", {"query": query, "resources": "volume", "limit": 10}
        )
        if not data or "results" not in data:
            return []

        results = []
        for item in data["results"]:
            year = item.get("start_year")

            desc = item.get("deck") or item.get("description") or ""
            desc = re.sub(r"<[^>]+>", "", desc)

            results.append(
                {
                    "id": str(item["id"]),
                    "source": "comicvine",
                    "title": item.get("name", "Unknown"),
                    "cover_url": item.get("image", {}).get("medium_url"),
                    "year": int(year) if year and str(year).isdigit() else None,
                    "description_preview": (
                        desc[:200] + "..." if len(desc) > 200 else desc
                    ),
                    "publisher": item.get("publisher", {}).get("name"),
                    "issues": item.get("count_of_issues"),
                }
            )

        return results

    def get_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        # Comic Vine detail resource ID needs type prefix "4050-" for volumes
        resource_id = f"4050-{external_id}"

        data = self._request(f"/volume/{resource_id}/")
        if not data or "results" not in data:
            return None

        item = data["results"]

        year = item.get("start_year")
        release_date = f"{year}-01-01" if year else None

        desc = item.get("description") or item.get("deck") or ""
        desc = re.sub(r"<[^>]+>", "", desc)  # Remove HTML tags

        # Map Publisher to Authors list
        authors = []
        publisher = item.get("publisher", {}).get("name")
        if publisher:
            authors.append(publisher)

        return {
            "id": external_id,
            "source": "comicvine",
            "title": item.get("name", "Unknown"),
            "cover_url": item.get("image", {}).get("original_url")
            or item.get("image", {}).get("medium_url"),
            "description": desc,
            "release_date": release_date,
            "publisher": publisher,
            "authors": authors,
            "volumes": 1,
            "episodes": item.get("count_of_issues"),
            "external_link": item.get("site_detail_url"),
        }
