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
import re

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
            titles = item.get("title", {})
            title = titles.get("english") or titles.get("romaji") or titles.get("native") or "Unknown"
            
            start_date = item.get("startDate", {})
            year = start_date.get("year")

            studios_data = item.get("studios") or {}
            studios = [s["name"] for s in studios_data.get("nodes") or [] if s and s.get("name")]
            
            staff_data = item.get("staff") or {}
            staff = [s["name"]["full"] for s in staff_data.get("nodes") or [] if s and s.get("name") and s["name"].get("full")]

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
        
        # Force English language
        params["language"] = "en-US"
        
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
            year = None
            if len(date_str) >= 4 and date_str[:4].isdigit():
                year = int(date_str[:4])

            poster_path = item.get("poster_path")
            cover_url = f"{self.IMAGE_BASE}/w780{poster_path}" if poster_path else None

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
        cover_url = f"{self.IMAGE_BASE}/original{poster_path}" if poster_path else None

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
                    if s.get("season_number") == 0: continue 
                    
                    seasons_list.append({
                        "number": s.get("season_number"),
                        "episodes": s.get("episode_count") or 0,
                        "duration": runtime or 0,
                        "release_date": s.get("air_date")
                    })
            
            # Fallback: If no season details but we have a season count, generate placeholders
            # This handles cases where API returns "number_of_seasons" but empty "seasons" list or we want to ensure count matches
            elif seasons and seasons > 0:
                for i in range(1, seasons + 1):
                    seasons_list.append({
                        "number": i,
                        "episodes": 0,
                        "duration": runtime or 0,
                        "release_date": None
                    })

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
            "seasons": seasons_list, # Full list for auto-population
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

class TVMazeAPI(BaseAPIClient):
    """API Client for TVMaze (Series). No API key required."""
    
    BASE_URL = "https://api.tvmaze.com"

    def search(self, query: str, media_type: str) -> List[Dict[str, Any]]:
        if media_type != "Series":
            return []
            
        try:
            response = requests.get(f"{self.BASE_URL}/search/shows", params={"q": query}, timeout=10)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            logger.error(f"TVMaze search failed: {e}")
            return []

        results = []
        for entry in data:
            show = entry.get("show", {})
            show = entry.get("show", {})
            if not show: continue
            
            premiered = show.get("premiered")
            year = premiered[:4] if premiered and len(premiered) >= 4 else None
            
            results.append({
                "id": str(show.get("id")),
                "source": "tvmaze",
                "title": show.get("name"),
                "cover_url": show.get("image", {}).get("medium"),
                "year": year,
                "description_preview": (show.get("summary") or "").replace("<p>", "").replace("</p>", "").replace("<b>", "").replace("</b>", "").replace("<i>", "").replace("</i>", "")[:200],
                "genres": show.get("genres", []),
            })
        return results

    def get_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        try:
            # Use embed=seasons to get all seasons in one request
            response = requests.get(f"{self.BASE_URL}/shows/{external_id}?embed=seasons", timeout=10)
            response.raise_for_status()
            show = response.json()
        except Exception as e:
            logger.error(f"TVMaze details fetch failed: {e}")
            return None

        # Clean HTML from summary
        summary = show.get("summary") or ""
        summary = re.sub(r'<[^>]+>', '', summary)

        seasons_data = []
        total_episodes = 0
        embedded = show.get("_embedded", {})
        
        # Check if we need to fetch episodes manually (if any season lacks episodeOrder)
        needs_manual_count = False
        for s in embedded.get("seasons", []):
            if s.get("episodeOrder") is None:
                needs_manual_count = True
                break
        
        episode_counts = {}
        if needs_manual_count:
            try:
                ep_resp = requests.get(f"{self.BASE_URL}/shows/{external_id}/episodes", timeout=10)
                ep_resp.raise_for_status()
                all_eps = ep_resp.json()
                for ep in all_eps:
                    s_num = ep.get("season")
                    if s_num:
                        episode_counts[s_num] = episode_counts.get(s_num, 0) + 1
            except Exception as e:
                logger.warning(f"Failed to fetch manual episode counts for TVMaze: {e}")

        for s in embedded.get("seasons", []):
            s_num = s.get("number")
            ep_count = s.get("episodeOrder")
            
            # Use manual count if explicit order is missing
            if ep_count is None and s_num in episode_counts:
                ep_count = episode_counts[s_num]
            
            if ep_count:
                total_episodes += ep_count
                
            seasons_data.append({
                "number": s_num,
                "episodes": ep_count, 
                "duration": show.get("averageRuntime"),
                "release_date": s.get("premiereDate")
            })

        return {
            "id": str(show["id"]),
            "source": "tvmaze",
            "title": show.get("name"),
            "alternate_titles": [], 
            "cover_url": show.get("image", {}).get("original") or show.get("image", {}).get("medium"),
            "description": summary,
            "release_date": show.get("premiered"),
            "avg_duration_minutes": show.get("averageRuntime"),
            "genres": show.get("genres", []),
            "external_link": show.get("url"),
            "seasons": seasons_data,
            "episodes": total_episodes if total_episodes > 0 else None,
            "volumes": len(seasons_data) if seasons_data else None,
        }

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
                timeout=10
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Comic Vine API request failed: {e}")
            return None

    def search(self, query: str, media_type: Optional[str] = None) -> List[Dict[str, Any]]:
        # We assume media_type=Book (or maybe Manga if user really wants)
        # We search 'volumes' resource for series/books
        data = self._request("/search", {"query": query, "resources": "volume", "limit": 10})
        if not data or "results" not in data:
            return []

        results = []
        for item in data["results"]:
            info = item
            
            # Year
            year = item.get("start_year")
            
            # Description
            desc = item.get("deck") or item.get("description") or ""
            desc = re.sub(r'<[^>]+>', '', desc)
            
            results.append({
                "id": str(item["id"]),
                "source": "comicvine",
                "title": item.get("name", "Unknown"),
                "cover_url": item.get("image", {}).get("medium_url"),
                "year": int(year) if year and str(year).isdigit() else None,
                "description_preview": desc[:200] + "..." if len(desc) > 200 else desc,
                "publisher": item.get("publisher", {}).get("name"),
                "issues": item.get("count_of_issues")
            })
            
        return results

    def get_details(self, external_id: str) -> Optional[Dict[str, Any]]:
        # Comic Vine detail resource ID needs type prefix "4050-" for volumes
        # Search returns ID like 12345, detail needs 4050-12345
        resource_id = f"4050-{external_id}"
        
        data = self._request(f"/volume/{resource_id}/")
        if not data or "results" not in data:
            return None

        item = data["results"]
        
        # Calculate approximate release date
        year = item.get("start_year")
        release_date = f"{year}-01-01" if year else None

        # Clean description
        desc = item.get("description") or item.get("deck") or ""
        desc = re.sub(r'<[^>]+>', '', desc) # Remove HTML tags

        # Map Publisher to Authors list (User Request)
        authors = []
        publisher = item.get("publisher", {}).get("name")
        if publisher:
            authors.append(publisher)

        return {
            "id": external_id, # Use raw ID
            "source": "comicvine",
            "title": item.get("name", "Unknown"),
            "cover_url": item.get("image", {}).get("original_url") or item.get("image", {}).get("medium_url"),
            "description": desc,
            "release_date": release_date,
            "publisher": publisher,
            "authors": authors, # Mapped from publisher
            "volumes": 1, # It's a volume
            "episodes": item.get("count_of_issues"), # Issues count
            "external_link": item.get("site_detail_url")
        }


class ExternalAPIService:
    """
    Unified service for all external API operations.
    
    Routes requests to the appropriate client based on media type.
    """

    def __init__(self, tmdb_api_key: Optional[str] = None):
        from app.utils.config_manager import load_config
        config = load_config()
        api_keys = config.get('apiKeys', {})
        
        self.anilist = AniListClient()
        self.tmdb = TMDBClient(api_key=tmdb_api_key or api_keys.get('tmdb'))
        self.tvmaze = TVMazeAPI()
        self.openlibrary = OpenLibraryClient()
        
        # New Clients
        self.mangadex = MangaDexClient()
        self.googlebooks = GoogleBooksClient(api_key=api_keys.get('googlebooks'))
        self.comicvine = ComicVineClient(api_key=api_keys.get('comicvine'))

    def search(self, query: str, media_type: str, source: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Search for media items across appropriate external APIs.
        
        Args:
            query: Search query string
            media_type: One of 'Anime', 'Manga', 'Book', 'Movie', 'Series'
            source: Optional specific source ('tmdb', 'tvmaze', 'anilist', 'openlibrary')
            
        Returns:
            List of search results with normalized structure
        """
        if not query or not query.strip():
            return []

        query = query.strip()

        # Explicit source request
        # Explicit source request
        if source:
            if source == 'tmdb':
                # Map Anime to Series for TMDB search
                tmdb_type = 'Series' if media_type == 'Anime' else media_type
                if tmdb_type not in ('Movie', 'Series'): return []
                return self.tmdb.search(query, tmdb_type)
            elif source == 'tvmaze':
                if media_type not in ('Series', 'Anime'): return []
                try:
                    return self.tvmaze.search(query, 'Series')
                except Exception:
                    return []
            elif source == 'anilist':
                if media_type not in ('Anime', 'Manga', 'Movie', 'Series'): return []
                search_type = 'Anime' if media_type in ('Movie', 'Series') else media_type
                return self.anilist.search(query, search_type)
            elif source == 'openlibrary':
                return self.openlibrary.search(query)
            elif source == 'mangadex':
                return self.mangadex.search(query, media_type)
            elif source == 'googlebooks':
                return self.googlebooks.search(query, media_type)
            elif source == 'comicvine':
                # Map Manga to 'Book' concept or just pass through if client handles it (it handles generic queries)
                return self.comicvine.search(query, media_type)
            return []

        # Default routing logic with priority config
        from app.utils.config_manager import load_config
        config = load_config()
        priorities = config.get('searchPriorities', {})
        
        # Get priority for this media type, defaulting to standard behavior
        # Get priority for this media type
        priority_source = priorities.get(media_type)

        if media_type == "Anime":
            if priority_source == 'tmdb': return self.tmdb.search(query, 'Series')
            elif priority_source == 'tvmaze': return self.tvmaze.search(query, 'Series')
            return self.anilist.search(query, media_type)
            
        elif media_type == "Manga":
            if priority_source == 'anilist': return self.anilist.search(query, media_type)
            # Default to MangaDex
            return self.mangadex.search(query, media_type)
            
        elif media_type == "Movie":
            if priority_source == 'anilist': return self.anilist.search(query, 'Anime')
            return self.tmdb.search(query, media_type)
            
        elif media_type == "Series":
            if priority_source == 'anilist': return self.anilist.search(query, 'Anime')
            elif priority_source == 'tvmaze': return self.tvmaze.search(query, media_type)
            elif priority_source == 'tmdb' and self.tmdb.api_key: return self.tmdb.search(query, media_type)
            
            # Default fallback
            if self.tmdb.api_key: return self.tmdb.search(query, media_type)
            return self.tvmaze.search(query, media_type)

        elif media_type == "Book":
            if priority_source == 'googlebooks': return self.googlebooks.search(query, media_type)
            elif priority_source == 'comicvine': return self.comicvine.search(query, media_type)
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
        elif source == "tvmaze":
            return self.tvmaze.get_details(external_id)
        elif source == "openlibrary":
            return self.openlibrary.get_details(external_id)
        elif source == 'mangadex':
            return self.mangadex.get_details(external_id)
        elif source == "googlebooks":
            return self.googlebooks.get_details(external_id)
        elif source == "comicvine":
            return self.comicvine.get_details(external_id)
        else:
            logger.warning(f"Unknown source: {source}")
            return None

    def set_tmdb_api_key(self, api_key: str):
        """Update the TMDB API key at runtime."""
        self.tmdb.api_key = api_key
        
    def update_keys(self, **keys):
        """Update API keys at runtime."""
        if 'tmdb' in keys: self.tmdb.api_key = keys['tmdb']
        if 'googlebooks' in keys: self.googlebooks.api_key = keys['googlebooks']
        if 'comicvine' in keys: self.comicvine.api_key = keys['comicvine']
