import logging
import sys
import os
from app.config import DATA_DIR

def setup_logging(app_name: str = "app") -> None:
    """
    Configures basic logging for the application.
    
    Sets the log level to WARNING for frozen (production) builds and DEBUG 
    for source (development) runs.

    Args:
        app_name (str): The name of the logger.
    """
    # Determine running mode
    if getattr(sys, "frozen", False):
        log_level = logging.WARNING
    else:
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
