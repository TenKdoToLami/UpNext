import logging
import time
from typing import Any, Dict, List, Optional
import requests

from .base import BaseAPIClient

logger = logging.getLogger(__name__)

_last_anilist_request = 0.0
ANILIST_MIN_INTERVAL = 0.7  # ~85 req/min


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
