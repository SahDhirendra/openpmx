from pydantic import BaseModel
from datetime import datetime

class SensorReading(BaseModel):
    """Incoming sensor data from a machine"""
    machine_id: str
    timestamp: datetime
    bearing1_rms: float
    bearing2_rms: float
    bearing3_rms: float
    bearing4_rms: float

class HealthResponse(BaseModel):
    """Response sent back to the factory device"""
    machine_id: str
    timestamp: datetime
    overall_health: float
    alert: bool
    bearings: dict
    message: str