import requests
import logging

logger = logging.getLogger(__name__)

REPO_OWNER = "TenKdoToLami"
REPO_NAME = "UpNext"

def get_latest_release():
    """
    Fetches the latest release information from GitHub.
    """
    try:
        url = f"https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/releases/latest"
        resp = requests.get(url, timeout=5)
        
        if resp.status_code == 200:
            data = resp.json()
            return {
                "tag_name": data.get("tag_name", "").lstrip("v"),
                "html_url": data.get("html_url"),
                "name": data.get("name"),
                "body": data.get("body"),
                "published_at": data.get("published_at")
            }
        elif resp.status_code == 404:
            logger.warning("No releases found for this repository.")
            return None
        else:
            logger.error(f"GitHub API returned status {resp.status_code}")
            return None
            
    except Exception as e:
        logger.error(f"Failed to check for updates: {e}")
        return None
