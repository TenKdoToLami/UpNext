import logging
import re
from typing import Any, Dict, List, Optional
import requests

from .base import BaseAPIClient

logger = logging.getLogger(__name__)


class TVMazeAPI(BaseAPIClient):
    """API Client for TVMaze (Series). No API key required."""
    
    BASE_URL = "https://api.tvmaze.com"

    def search(self, query: str, media_type: str = "Series") -> List[Dict[str, Any]]:
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
            if not show: continue
            
            premiered = show.get("premiered")
            year = premiered[:4] if premiered and len(premiered) >= 4 else None
            
            summary = show.get("summary") or ""
            # Basic tag stripping
            desc_preview = re.sub(r'<[^>]+>', '', summary)[:200]
            
            results.append({
                "id": str(show.get("id")),
                "source": "tvmaze",
                "title": show.get("name"),
                "cover_url": show.get("image", {}).get("medium"),
                "year": year,
                "description_preview": desc_preview,
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
