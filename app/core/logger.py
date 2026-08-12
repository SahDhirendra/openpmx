"""
OpenPMX Logging System
Logs all system events, errors, predictions and alerts to file
"""

import logging
import os
from logging.handlers import RotatingFileHandler
from datetime import datetime

# Log file location
import sys

def get_base_dir():
    if getattr(sys, 'frozen', False):
        # When running as exe, use AppData for writable files
        return os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'OpenPMX')
    else:
        return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

BASE_DIR = get_base_dir()
LOG_DIR = os.path.join(BASE_DIR, "logs")
LOG_FILE = os.path.join(LOG_DIR, "openpmx.log")

def setup_logger():
    """Set up the logging system"""
    
    # Create logs directory
    os.makedirs(LOG_DIR, exist_ok=True)

    # Create logger
    logger = logging.getLogger("openpmx")
    logger.setLevel(logging.DEBUG)

    # Prevent duplicate handlers
    if logger.handlers:
        return logger

    # File handler — rotates at 10MB, keeps 5 backup files
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)

    # Console handler — shows INFO and above
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)

    # Format
    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    # Add handlers
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    logger.info(f"OpenPMX logging initialized — log file: {LOG_FILE}")
    return logger

# Global logger instance
logger = setup_logger()