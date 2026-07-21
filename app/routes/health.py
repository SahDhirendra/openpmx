from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from datetime import datetime
from typing import List
from app.models.sensor import SensorReading, HealthResponse
from app.core.predictor import predictor
import json

router = APIRouter()

# Store all connected WebSocket clients
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"Client connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"Client disconnected. Total connections: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Send data to ALL connected dashboards simultaneously"""
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        # Clean up disconnected clients
        for conn in disconnected:
            self.active_connections.remove(conn)

manager = ConnectionManager()

@router.get("/")
def root():
    return {
        "name": "OpenPMX",
        "version": "0.1.0",
        "description": "Open-source predictive maintenance platform",
        "status": "running"
    }

@router.get("/health")
def api_health():
    return {
        "status": "ok",
        "predictor_trained": predictor.is_trained,
        "active_connections": len(manager.active_connections)
    }

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint — dashboard connects here for real-time updates"""
    await manager.connect(websocket)
    try:
        # Send welcome message
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to OpenPMX real-time feed",
            "predictor_trained": predictor.is_trained
        })
        # Keep connection alive
        while True:
            # Wait for any message from client (ping/pong)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@router.post("/ingest")
async def ingest_reading(reading: SensorReading):
    """
    Receive sensor readings from edge device (Raspberry Pi)
    Automatically scores and broadcasts to all connected dashboards
    """
    if not predictor.is_trained:
        raise HTTPException(
            status_code=503,
            detail="Predictor not trained yet. Call /train first."
        )

    # Run ML prediction
    result = predictor.predict(
        bearing1=reading.bearing1_rms,
        bearing2=reading.bearing2_rms,
        bearing3=reading.bearing3_rms,
        bearing4=reading.bearing4_rms
    )

    # Build message
    if result["overall_health"] >= 75:
        message = "All bearings healthy. No action required."
    elif result["overall_health"] >= 50:
        message = "Some bearings showing wear. Schedule inspection soon."
    elif result["overall_health"] >= 25:
        message = "Warning! Bearing degradation detected. Inspect immediately."
    else:
        message = "Critical! Imminent bearing failure. Stop machine now."

    # Build response
    response = {
        "type": "reading",
        "machine_id": reading.machine_id,
        "timestamp": reading.timestamp.isoformat(),
        "overall_health": result["overall_health"],
        "alert": result["alert"],
        "bearings": result["bearings"],
        "message": message
    }

    # Broadcast to ALL connected dashboards in real-time
    await manager.broadcast(response)

    return response

@router.post("/predict", response_model=HealthResponse)
def predict_health(reading: SensorReading):
    """Manual prediction endpoint — used by dashboard buttons"""
    if not predictor.is_trained:
        raise HTTPException(
            status_code=503,
            detail="Predictor not trained yet. Call /train first."
        )

    result = predictor.predict(
        bearing1=reading.bearing1_rms,
        bearing2=reading.bearing2_rms,
        bearing3=reading.bearing3_rms,
        bearing4=reading.bearing4_rms
    )

    if result["overall_health"] >= 75:
        message = "All bearings healthy. No action required."
    elif result["overall_health"] >= 50:
        message = "Some bearings showing wear. Schedule inspection soon."
    elif result["overall_health"] >= 25:
        message = "Warning! Bearing degradation detected. Inspect immediately."
    else:
        message = "Critical! Imminent bearing failure. Stop machine now."

    return HealthResponse(
        machine_id=reading.machine_id,
        timestamp=reading.timestamp,
        overall_health=result["overall_health"],
        alert=result["alert"],
        bearings=result["bearings"],
        message=message
    )

@router.post("/train")
def train_predictor():
    """Train the predictor on NASA bearing dataset"""
    import os
    import traceback

    data_path = os.path.join(os.path.dirname(__file__),
                             "..", "..", "data")
    data_path = os.path.abspath(data_path)

    print(f"Looking for data at: {data_path}")
    print(f"Data path exists: {os.path.exists(data_path)}")

    if os.path.exists(data_path):
        print(f"Contents: {os.listdir(data_path)}")

    try:
        if not os.path.exists(data_path):
            raise HTTPException(
                status_code=404,
                detail=f"Data folder not found at {data_path}"
            )

        predictor.train(data_path)

        return {
            "status": "trained",
            "message": "Predictor trained successfully on NASA bearing dataset",
            "baseline_mean": predictor.baseline_mean.tolist(),
            "thresholds": predictor.dynamic_thresholds.tolist()
        }
    except Exception as e:
        print(f"Training error: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))