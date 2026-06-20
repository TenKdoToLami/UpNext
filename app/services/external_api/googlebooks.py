import logging
from typing import Any, Dict, List, Optional
import requests

from .base import BaseAPIClient

logger = logging.getLogger(__name__)


class GoogleBooksClient(BaseAPIClient):
    """
    Google Books API client.
    """
    BASE_URL = "https://www.googleapis.com/books/v1"

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key

    def _request(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        params = params or {}
        if self.api_key:
            params["key"] = self.api_key
        
        # Force English language for results
        params["hl"] = "en"
        
        try:
            response = requests.get(
                f"{self.BASE_URL}{endpoint}",
                params=params,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Google Books API request failed: {e}")
            return None

    def search(self, query: str, media_type: Optional[str] = None) -> List[Dict[str, Any]]:
        # Restrict to English results
        data = self._request("/volumes", {"q": query, "maxResults": 10, "langRestrict": "en"})
        if not data or "items" not in data:
            return []

        results = []
        for item in data["items"]:
            info = item.get("volumeInfo", {})
            
            # High quality cover if available
            img_links = info.get("imageLinks", {})
            cover_url = img_links.get("thumbnail") or img_links.get("smallThumbnail")
            if cover_url:
                cover_url = cover_url.replace("http://", "https://")

            date_str = info.get("publishedDate", "")
            year = int(date_str[:4]) if len(date_str) >= 4 else None

            results.append({
                "id": item["id"],
                "source": "googlebooks",
                "title": info.get("title", "Unknown"),
                "cover_url": cover_url,
                "year": year,
                "description_preview": (info.get("description") or "")[:200],
                "authors": info.get("authors", []),
                "page_count": info.get("pageCount")
            })
        return results

    def get_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        data = self._request(f"/volumes/{external_id}")
        if not data:
            return None

        info = data.get("volumeInfo", {})
        
        img_links = info.get("imageLinks", {})
        cover_url = img_links.get("extraLarge") or img_links.get("large") or img_links.get("medium") or img_links.get("thumbnail")
        if cover_url: cover_url = cover_url.replace("http://", "https://")

        return {
            "id": data["id"],
            "source": "googlebooks",
            "title": info.get("title", "Unknown"),
            "alternate_titles": [info.get("subtitle")] if info.get("subtitle") else [],
            "cover_url": cover_url,
            "description": info.get("description", ""),
            "release_date": info.get("publishedDate"),
            "authors": info.get("authors", []),
            "publisher": info.get("publisher"),
            "page_count": info.get("pageCount"),
            "categories": info.get("categories", []),
            "external_link": info.get("infoLink")
        }
