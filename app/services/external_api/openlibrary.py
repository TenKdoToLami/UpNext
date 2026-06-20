import logging
import re
from typing import Any, Dict, List, Optional
import requests

from .base import BaseAPIClient

logger = logging.getLogger(__name__)


class OpenLibraryClient(BaseAPIClient):
    """
    OpenLibrary REST API client for Books.
    
    API Docs: https://openlibrary.org/developers/api
    Rate Limit: None (but use User-Agent header for high volume)
    """

    SEARCH_URL = "https://openlibrary.org/search.json"
    WORKS_URL = "https://openlibrary.org"
    COVERS_URL = "https://covers.openlibrary.org/b"

    def _request(self, url: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Execute a REST request."""
        try:
            response = requests.get(
                url,
                params=params,
                headers={"User-Agent": "UpNext/1.0 (Media Tracker App)"},
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"OpenLibrary API request failed: {e}")
            return None

    def search(self, query: str, media_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search OpenLibrary for books."""
        data = self._request(self.SEARCH_URL, {
            "q": query,
            "limit": 10,
            "fields": "key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject,publisher,isbn,edition_count,language"
        })
        if not data:
            return []

        results = []
        for item in data.get("docs", []):
            cover_id = item.get("cover_i")
            cover_url = f"{self.COVERS_URL}/id/{cover_id}-L.jpg" if cover_id else None

            authors = item.get("author_name", [])[:3]
            subjects = item.get("subject", [])[:5]
            publishers = item.get("publisher", [])[:2]
            isbns = item.get("isbn", [])[:3]
            edition_count = item.get("edition_count")

            results.append({
                "id": item.get("key", "").replace("/works/", ""),
                "source": "openlibrary",
                "title": item.get("title", "Unknown"),
                "cover_url": cover_url,
                "year": item.get("first_publish_year"),
                "description_preview": "",  # Search doesn't include description
                "authors": authors,
                "page_count": item.get("number_of_pages_median"),
                "tags": subjects,
                "publishers": publishers,
                "isbns": isbns,
                "edition_count": edition_count,
            })

        return results

    def get_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        """Get full details for an OpenLibrary work."""
        # Fetch work data
        work_url = f"{self.WORKS_URL}/works/{external_id}.json"
        data = self._request(work_url, {})
        if not data:
            return None

        title = data.get("title", "Unknown")

        # Description can be string or dict
        description = data.get("description", "")
        if isinstance(description, dict):
            description = description.get("value", "")

        # Cover
        covers = data.get("covers", [])
        cover_url = f"{self.COVERS_URL}/id/{covers[0]}-L.jpg" if covers else None

        # Subjects as tags
        subjects = data.get("subjects", [])[:10]
        if isinstance(subjects[0], dict) if subjects else False:
            subjects = [s.get("name", s) for s in subjects]

        # Get author details
        authors = []
        for author_ref in data.get("authors", [])[:5]:
            author_key = author_ref.get("author", {}).get("key", "")
            if author_key:
                author_data = self._request(f"{self.WORKS_URL}{author_key}.json", {})
                if author_data:
                    authors.append(author_data.get("name", "Unknown"))

        # First publish date
        first_publish = data.get("first_publish_date", "")
        release_date = None
        
        if first_publish:
            # Try to extract year
            year_match = re.search(r'\d{4}', first_publish)
            if year_match:
                release_date = f"{year_match.group()}-01-01"
            else:
                release_date = str(first_publish)
        
        if not release_date:
            # Fallback to created date
            created = data.get("created", {}).get("value", "")
            if created:
                year_match = re.search(r'\d{4}', created)
                if year_match: release_date = f"{year_match.group()}-01-01"

        subjects = data.get("subjects", [])[:10]
        if subjects and isinstance(subjects[0], dict):
            subjects = [s.get("name", str(s)) for s in subjects]
        else:
            subjects = [str(s) for s in subjects]

        page_count = data.get("number_of_pages") or data.get("pagination")
        if not page_count and "number_of_pages_median" in data:
            page_count = data["number_of_pages_median"]

        return {
            "id": external_id,
            "source": "openlibrary",
            "title": title,
            "alternate_titles": [],
            "cover_url": cover_url,
            "description": description,
            "release_date": release_date,
            "authors": authors,
            "tags": subjects[:5],
            "page_count": page_count,
            "external_link": f"https://openlibrary.org/works/{external_id}",
        }
