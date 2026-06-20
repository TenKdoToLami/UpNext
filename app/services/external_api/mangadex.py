import logging
from typing import Any, Dict, List, Optional
import requests

from .base import BaseAPIClient

logger = logging.getLogger(__name__)


class MangaDexClient(BaseAPIClient):
    """
    MangaDex API client for Manga.
    No API key required for public read access.
    """
    BASE_URL = "https://api.mangadex.org"
    COVERS_URL = "https://uploads.mangadex.org/covers"

    def _request(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        try:
            response = requests.get(
                f"{self.BASE_URL}{endpoint}",
                params=params,
                headers={"User-Agent": "UpNext/1.0"},
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"MangaDex API request failed: {e}")
            return None

    def search(self, query: str, media_type: Optional[str] = None) -> List[Dict[str, Any]]:
        params = {
            "title": query,
            "limit": 10,
            "includes[]": ["cover_art", "author", "artist"],
            "order[relevance]": "desc",
            "contentRating[]": ["safe", "suggestive", "erotica"]
        }
        
        try:
            data = self._request("/manga", params)
        except Exception as e:
            logger.error(f"MangaDex search error: {e}")
            return []
        if not data or "data" not in data:
            return []

        results = []
        for item in data["data"]:
            attrs = item.get("attributes", {})
            
            # Title (prefer English, fallback to romaji/others)
            titles = attrs.get("title", {})
            title = titles.get("en") or titles.get("ja-ro") or next(iter(titles.values()), "Unknown")
            
            # Description
            desc_map = attrs.get("description", {})
            desc = desc_map.get("en") or next(iter(desc_map.values()), "")
            desc_preview = (desc[:200] + "...") if len(desc) > 200 else desc

            # Cover URL
            cover_file = None
            for rel in item.get("relationships", []):
                if rel["type"] == "cover_art" and "attributes" in rel:
                    cover_file = rel["attributes"].get("fileName")
                    break
            
            cover_url = None
            if cover_file:
                cover_url = f"{self.COVERS_URL}/{item['id']}/{cover_file}.256.jpg" # Use 256px thumbnail for list view

            # Authors
            authors = []
            for rel in item.get("relationships", []):
                if rel["type"] in ["author", "artist"] and "attributes" in rel:
                    name = rel["attributes"].get("name")
                    if name and name not in authors:
                        authors.append(name)

            results.append({
                "id": item["id"],
                "source": "mangadex",
                "title": title,
                "cover_url": cover_url,
                "description_preview": desc_preview,
                "year": attrs.get("year"),
                "status": attrs.get("status"),
                "authors": authors
            })
            
        return results

    def get_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        data = self._request(f"/manga/{external_id}", {"includes[]": ["cover_art", "author", "artist"]})
        if not data or "data" not in data:
            return None

        item = data["data"]
        attrs = item.get("attributes", {})
        
        # Title
        titles = attrs.get("title", {})
        title = titles.get("en") or titles.get("ja-ro") or next(iter(titles.values()), "Unknown")
        
        # Alt titles
        alt_titles = []
        for t_map in attrs.get("altTitles", []):
            val = next(iter(t_map.values()), "")
            if val: alt_titles.append(val)
            
        # Description
        desc_map = attrs.get("description", {})
        desc = desc_map.get("en") or next(iter(desc_map.values()), "")
        
        # Cover
        cover_file = None
        for rel in item.get("relationships", []):
            if rel["type"] == "cover_art" and "attributes" in rel:
                cover_file = rel["attributes"].get("fileName")
                break
        cover_url = f"{self.COVERS_URL}/{item['id']}/{cover_file}" if cover_file else None

        # Authors
        authors = []
        for rel in item.get("relationships", []):
            if rel["type"] in ["author", "artist"] and "attributes" in rel:
                name = rel["attributes"].get("name")
                if name and name not in authors:
                    authors.append(name)
                    
        # Tags
        tags = []
        for t in attrs.get("tags", []):
            tags.append(t["attributes"]["name"]["en"])

        # Status/year
        status = attrs.get("status")
        year = attrs.get("year")
        release_date = f"{year}-01-01" if year else None

        return {
            "id": item["id"],
            "source": "mangadex",
            "title": title,
            "alternate_titles": alt_titles[:5],
            "cover_url": cover_url,
            "description": desc,
            "release_date": release_date,
            "authors": authors,
            "tags": tags[:10],
            "status": status,
            "external_link": f"https://mangadex.org/title/{item['id']}"
        }
