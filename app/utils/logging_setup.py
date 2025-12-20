import logging
import sys
import os
from app.config import DATA_DIR

def setup_logging(app_name: str = "app") -> None:
    """
    Configures basic logging for the application.
    
    Args:
        app_name (str): The name of the logger.
    """
    # Determine running mode
    if getattr(sys, "frozen", False):
        # Production / Built Exe -> Less verbose
        log_level = logging.WARNING
    else:
        # Dev / Source -> Very verbose
        log_level = logging.DEBUG

    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(os.path.join(DATA_DIR, 'app.log'))
        ]
    )
