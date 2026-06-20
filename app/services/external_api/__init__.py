"""
Unified External API Service interface for UpNext.
"""

import logging
from typing import Any, Dict, List, Optional

from .anilist import AniListClient
from .tmdb import TMDBClient
from .tvmaze import TVMazeAPI
from .openlibrary import OpenLibraryClient
from .mangadex import MangaDexClient
from .googlebooks import GoogleBooksClient
from .comicvine import ComicVineClient

logger = logging.getLogger(__name__)


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
        
        # Additional specialized clients
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
                return self.comicvine.search(query, media_type)
            return []

        # Default routing logic with priority config
        from app.utils.config_manager import load_config
        config = load_config()
        priorities = config.get('searchPriorities', {})
        
        # Get priority for this media type
        priority_source = priorities.get(media_type)

        if media_type == "Anime":
            if priority_source == 'tmdb': return self.tmdb.search(query, 'Series')
            elif priority_source == 'tvmaze': return self.tvmaze.search(query, 'Series')
            return self.anilist.search(query, media_type)
            
        elif media_type == "Manga":
            if priority_source == 'anilist': return self.anilist.search(query, media_type)
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
