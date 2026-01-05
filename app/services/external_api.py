"""
External API Service for UpNext.

Provides unified access to external media databases:
- AniList (Anime/Manga) via GraphQL
- TMDB (Movies/Series) via REST
- OpenLibrary (Books) via REST
"""

import json
import logging
from datetime import datetime
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus
import time

import requests

logger = logging.getLogger(__name__)

_last_anilist_request = 0.0
ANILIST_MIN_INTERVAL = 0.7  # ~85 req/min


class BaseAPIClient(ABC):
    """Abstract base class for external API clients."""

    @abstractmethod
    def search(self, query: str, media_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search for media items."""
        pass

    @abstractmethod
    def get_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        """Get full details for an item by its external ID."""
        pass


class AniListClient(BaseAPIClient):
    """
    AniList GraphQL API client for Anime and Manga.
    
    API Docs: https://anilist.gitbook.io/anilist-apiv2-docs/
    Rate Limit: 90 requests/minute
    """

    API_URL = "https://graphql.anilist.co"
    
    SEARCH_QUERY = """
    query ($search: String, $type: MediaType, $page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
            media(search: $search, type: $type, sort: POPULARITY_DESC) {
                id
                title {
                    romaji
                    english
                    native
                }
                coverImage {
                    large
                    medium
                }
                startDate {
                    year
                }
                description(asHtml: false)
                episodes
                chapters
                volumes
                status
                genres
                studios(isMain: true) {
                    nodes {
                        name
                    }
                }
                staff(sort: RELEVANCE, perPage: 3) {
                    nodes {
                        name {
                            full
                        }
                    }
                }
            }
        }
    }
    """

    DETAILS_QUERY = """
    query ($id: Int) {
        Media(id: $id) {
            id
            title {
                romaji
                english
                native
            }
            coverImage {
                extraLarge
                large
            }
            bannerImage
            startDate {
                year
                month
                day
            }
            endDate {
                year
                month
                day
            }
            description(asHtml: false)
            episodes
            chapters
            volumes
            duration
            status
            genres
            tags {
                name
                rank
            }
            studios(isMain: true) {
                nodes {
                    name
                }
            }
            staff(sort: RELEVANCE, perPage: 5) {
                nodes {
                    name {
                        full
                    }
                }
            }
            synonyms
            siteUrl
        }
    }
    """

    def _rate_limit(self):
        """Enforce AniList rate limiting."""
        global _last_anilist_request
        now = time.time()
        elapsed = now - _last_anilist_request
        if elapsed < ANILIST_MIN_INTERVAL:
            time.sleep(ANILIST_MIN_INTERVAL - elapsed)
        _last_anilist_request = time.time()

    def _request(self, query: str, variables: Dict[str, Any]) -> Optional[Dict]:
        """Execute a GraphQL request with rate limiting."""
        self._rate_limit()
        try:
            response = requests.post(
                self.API_URL,
                json={"query": query, "variables": variables},
                headers={"Content-Type": "application/json", "Accept": "application/json"},
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            if "errors" in data:
                logger.warning(f"AniList API errors: {data['errors']}")
                return None
            return data.get("data")
        except requests.RequestException as e:
            logger.error(f"AniList API request failed: {e}")
            return None

    def search(self, query: str, media_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Search AniList for anime or manga.
        
        Args:
            query: Search query string
            media_type: 'Anime' or 'Manga' (maps to ANIME/MANGA in AniList)
        """
        anilist_type = "ANIME" if media_type == "Anime" else "MANGA"
        
        variables = {
            "search": query,
            "type": anilist_type,
            "page": 1,
            "perPage": 10
        }

        data = self._request(self.SEARCH_QUERY, variables)
        if not data or "Page" not in data:
            return []

        results = []
        for item in data["Page"].get("media", []):
            # Get best available title
            titles = item.get("title", {})
            title = titles.get("english") or titles.get("romaji") or titles.get("native") or "Unknown"
            
            # Get year
            start_date = item.get("startDate", {})
            year = start_date.get("year")

            # Get studios/authors
            studios_data = item.get("studios") or {}
            studios = [s["name"] for s in studios_data.get("nodes") or [] if s and s.get("name")]
            
            staff_data = item.get("staff") or {}
            staff = [s["name"]["full"] for s in staff_data.get("nodes") or [] if s and s.get("name") and s["name"].get("full")]

            # Truncate description for preview
            desc = item.get("description", "") or ""
            desc_preview = desc[:200] + "..." if len(desc) > 200 else desc

            results.append({
                "id": str(item["id"]),
                "source": "anilist",
                "title": title,
                "original_title": titles.get("native"),
                "cover_url": item.get("coverImage", {}).get("large"),
                "year": year,
                "description_preview": desc_preview,
                "episodes": item.get("episodes"),
                "chapters": item.get("chapters"),
                "volumes": item.get("volumes"),
                "genres": item.get("genres", []),
                "studios": studios,
                "authors": staff if media_type == "Manga" else [],
            })

        return results

    def get_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        """Get full details for an AniList item."""
        try:
            anilist_id = int(external_id)
        except ValueError:
            return None

        data = self._request(self.DETAILS_QUERY, {"id": anilist_id})
        if not data or "Media" not in data:
            return None

        item = data["Media"]
        titles = item.get("title", {})
        title = titles.get("english") or titles.get("romaji") or titles.get("native") or "Unknown"

        # Build alternate titles
        alt_titles = []
        if titles.get("romaji") and titles.get("romaji") != title:
            alt_titles.append(titles["romaji"])
        if titles.get("native"):
            alt_titles.append(titles["native"])
        alt_titles.extend(item.get("synonyms", [])[:5])

        # Get start date
        start_date = item.get("startDate", {})
        release_date = None
        if start_date.get("year"):
            year = start_date['year']
            month = start_date.get("month") or 1
            day = start_date.get("day") or 1
            release_date = f"{year}-{month:02d}-{day:02d}"

        # Studios and staff
        studios_data = item.get("studios") or {}
        studios = [s["name"] for s in studios_data.get("nodes") or [] if s and s.get("name")]
        
        staff_data = item.get("staff") or {}
        staff = [s["name"]["full"] for s in staff_data.get("nodes") or [] if s and s.get("name") and s["name"].get("full")]

        # Tags (top 5 by rank)
        tags = sorted(item.get("tags", []), key=lambda t: t.get("rank", 0), reverse=True)
        tag_names = [t["name"] for t in tags[:5] if t and t.get("name")]

        return {
            "id": str(item["id"]),
            "source": "anilist",
            "title": title,
            "alternate_titles": alt_titles,
            "cover_url": item.get("coverImage", {}).get("extraLarge") or item.get("coverImage", {}).get("large"),
            "description": item.get("description", ""),
            "release_date": release_date,
            "episodes": item.get("episodes"),
            "chapters": item.get("chapters"),
            "volumes": item.get("volumes"),
            "avg_duration_minutes": item.get("duration"),
            "genres": item.get("genres", []),
            "tags": tag_names,
            "studios": studios,
            "authors": staff,
            "external_link": item.get("siteUrl"),
        }


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

        try:
            response = requests.get(
                f"{self.API_BASE}{endpoint}",
                params=params,
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            logger.error(f"TMDB API request failed: {e}")
            return None

    def search(self, query: str, media_type: Optional[str] = None) -> List[Dict[str, Any]]:
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
            year = int(date_str[:4]) if len(date_str) >= 4 else None

            # Poster URL
            poster_path = item.get("poster_path")
            cover_url = f"{self.IMAGE_BASE}/w500{poster_path}" if poster_path else None

            # Description preview
            desc = item.get("overview", "") or ""
            desc_preview = desc[:200] + "..." if len(desc) > 200 else desc

            results.append({
                "id": str(item["id"]),
                "source": "tmdb",
                "title": title,
                "original_title": original_title if original_title != title else None,
                "cover_url": cover_url,
                "year": year,
                "description_preview": desc_preview,
            })

        return results

    def get_details(self, external_id: str, media_type: str = "Movie") -> Optional[Dict[str, Any]]:
        """Get full details for a TMDB item."""
        endpoint = f"/movie/{external_id}" if media_type == "Movie" else f"/tv/{external_id}"
        
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
        cover_url = f"{self.IMAGE_BASE}/w780{poster_path}" if poster_path else None

        # Genres
        genres = [g["name"] for g in data.get("genres", [])]

        # Directors/Creators
        credits = data.get("credits", {})
        directors = [
            c["name"] for c in credits.get("crew", [])
            if c.get("job") == "Director"
        ][:3]
        
        # For TV, get creators instead
        if media_type == "Series":
            directors = [c["name"] for c in data.get("created_by", [])][:3]

        # Runtime
        runtime = data.get("runtime")  # Movies
        if not runtime and data.get("episode_run_time"):
            runtimes = data.get("episode_run_time", [])
            runtime = runtimes[0] if runtimes else None

        # Episode/Season count for Series
        episodes = data.get("number_of_episodes")
        seasons = data.get("number_of_seasons")

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
            "volumes": seasons,  # Map seasons to volumes for Series
            "genres": genres,
            "authors": directors,  # Directors/Creators
            "external_link": f"https://www.themoviedb.org/{'movie' if media_type == 'Movie' else 'tv'}/{data['id']}",
        }


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
            # Cover URL from cover ID
            cover_id = item.get("cover_i")
            cover_url = f"{self.COVERS_URL}/id/{cover_id}-L.jpg" if cover_id else None

            # Authors
            authors = item.get("author_name", [])[:3]

            # Subjects as tags (limit to popular ones)
            subjects = item.get("subject", [])[:5]

            # Publishers
            publishers = item.get("publisher", [])[:2]

            # ISBNs
            isbns = item.get("isbn", [])[:3]

            # Edition count
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
        
        import re
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

        # Subjects as tags
        subjects = data.get("subjects", [])[:10]
        if subjects and isinstance(subjects[0], dict):
            subjects = [s.get("name", str(s)) for s in subjects]
        else:
            subjects = [str(s) for s in subjects]

        # Page count improvements
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


class ExternalAPIService:
    """
    Unified service for all external API operations.
    
    Routes requests to the appropriate client based on media type.
    """

    def __init__(self, tmdb_api_key: Optional[str] = None):
        self.anilist = AniListClient()
        self.tmdb = TMDBClient(api_key=tmdb_api_key)
        self.openlibrary = OpenLibraryClient()

    def search(self, query: str, media_type: str) -> List[Dict[str, Any]]:
        """
        Search for media items across appropriate external APIs.
        
        Args:
            query: Search query string
            media_type: One of 'Anime', 'Manga', 'Book', 'Movie', 'Series'
            
        Returns:
            List of search results with normalized structure
        """
        if not query or not query.strip():
            return []

        query = query.strip()

        if media_type in ("Anime", "Manga"):
            return self.anilist.search(query, media_type)
        elif media_type in ("Movie", "Series"):
            return self.tmdb.search(query, media_type)
        elif media_type == "Book":
            return self.openlibrary.search(query)
        else:
            logger.warning(f"Unknown media type for search: {media_type}")
            return []

    def get_details(self, external_id: str, media_type: str, source: str) -> Optional[Dict[str, Any]]:
        """
        Get full details for importing an item.
        
        Args:
            external_id: The external service's ID for the item
            media_type: One of 'Anime', 'Manga', 'Book', 'Movie', 'Series'
            source: 'anilist', 'tmdb', or 'openlibrary'
            
        Returns:
            Full item details normalized for UpNext, or None if not found
        """
        if source == "anilist":
            return self.anilist.get_details(external_id)
        elif source == "tmdb":
            return self.tmdb.get_details(external_id, media_type)
        elif source == "openlibrary":
            return self.openlibrary.get_details(external_id)
        else:
            logger.warning(f"Unknown source: {source}")
            return None

    def set_tmdb_api_key(self, api_key: str):
        """Update the TMDB API key at runtime."""
        self.tmdb.api_key = api_key
