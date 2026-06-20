from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional

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
