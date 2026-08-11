"""
OpenPMX Configuration Loader
Loads settings from config.yaml
"""

import yaml
import os
from app.core.logger import logger

CONFIG_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "config.yaml"
)
CONFIG_PATH = os.path.abspath(CONFIG_PATH)

def load_config():
    """Load configuration from config.yaml"""
    if not os.path.exists(CONFIG_PATH):
        logger.warning(f"Config file not found at {CONFIG_PATH} — using defaults")
        return get_defaults()
    
    try:
        with open(CONFIG_PATH, "r") as f:
            config = yaml.safe_load(f)
        logger.info(f"Configuration loaded from {CONFIG_PATH}")
        return config
    except Exception as e:
        logger.error(f"Failed to load config: {e} — using defaults")
        return get_defaults()

def get_defaults():
    """Default configuration values"""
    return {
        "machine": {
            "id": "machine_001",
            "name": "Production Line 1",
            "location": "Factory Floor A",
            "read_interval": 10
        },
        "backend": {
            "host": "0.0.0.0",
            "port": 8000,
            "debug": False
        },
        "database": {
            "path": "data/openpmx.db",
            "retention_days": 90
        },
        "model": {
            "path": "data/model.json",
            "baseline_samples": 500,
            "anomaly_threshold_multiplier": 2.0,
            "health_alert_threshold": 50
        },
        "alerts": {
            "email_cooldown_hours": 1,
            "downtime_threshold": 25
        },
        "edge": {
            "api_url": "http://localhost:8000",
            "read_interval": 10,
            "buffer_max": 1000
        },
        "dashboard": {
            "api_url": "http://localhost:8000",
            "refresh_interval": 10,
            "kiosk_mode": False
        }
    }

# Global config instance
config = load_config()

# Easy access helpers
MACHINE_ID = config["machine"]["id"]
MACHINE_NAME = config["machine"]["name"]
RETENTION_DAYS = config["database"]["retention_days"]
ALERT_THRESHOLD = config["model"]["health_alert_threshold"]
DOWNTIME_THRESHOLD = config["alerts"]["downtime_threshold"]
EMAIL_COOLDOWN_HOURS = config["alerts"]["email_cooldown_hours"]