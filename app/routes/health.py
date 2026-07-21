from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from app.models.sensor import SensorReading, HealthResponse
from app.core.predictor import predictor
from app.core.database import get_db, SensorReadingDB, AlertDB
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
async def ingest_reading(reading: SensorReading, db: Session = Depends(get_db)):
    """
    Receive sensor readings from edge device (Raspberry Pi)
    Automatically scores, saves to database, and broadcasts to all dashboards
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

    # Save reading to database
    db_reading = SensorReadingDB(
        machine_id=reading.machine_id,
        timestamp=reading.timestamp,
        bearing1_rms=reading.bearing1_rms,
        bearing2_rms=reading.bearing2_rms,
        bearing3_rms=reading.bearing3_rms,
        bearing4_rms=reading.bearing4_rms,
        bearing1_health=result["bearings"]["bearing1"]["health_score"],
        bearing2_health=result["bearings"]["bearing2"]["health_score"],
        bearing3_health=result["bearings"]["bearing3"]["health_score"],
        bearing4_health=result["bearings"]["bearing4"]["health_score"],
        overall_health=result["overall_health"],
        alert=result["alert"],
        message=message
    )
    db.add(db_reading)

    # Save alert to database if triggered
    if result["alert"]:
        # Find which bearing is most critical
        critical_bearing = min(
            result["bearings"].items(),
            key=lambda x: x[1]["health_score"]
        )[0]
        db_alert = AlertDB(
            machine_id=reading.machine_id,
            timestamp=reading.timestamp,
            overall_health=result["overall_health"],
            message=message,
            bearing_affected=critical_bearing
        )
        db.add(db_alert)

    db.commit()

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

@router.get("/history/{machine_id}")
def get_history(machine_id: str, limit: int = 100, db: Session = Depends(get_db)):
    """Get last N readings for a machine — used by dashboard charts"""
    readings = db.query(SensorReadingDB)\
        .filter(SensorReadingDB.machine_id == machine_id)\
        .order_by(SensorReadingDB.timestamp.desc())\
        .limit(limit)\
        .all()

    return {
        "machine_id": machine_id,
        "readings": [
            {
                "timestamp": r.timestamp.isoformat(),
                "overall_health": r.overall_health,
                "bearing1_health": r.bearing1_health,
                "bearing2_health": r.bearing2_health,
                "bearing3_health": r.bearing3_health,
                "bearing4_health": r.bearing4_health,
                "alert": r.alert
            }
            for r in reversed(readings)
        ]
    }

@router.get("/alerts/{machine_id}")
def get_alerts(machine_id: str, limit: int = 50, db: Session = Depends(get_db)):
    """Get recent alerts for a machine"""
    alerts = db.query(AlertDB)\
        .filter(AlertDB.machine_id == machine_id)\
        .order_by(AlertDB.timestamp.desc())\
        .limit(limit)\
        .all()

    return {
        "machine_id": machine_id,
        "alerts": [
            {
                "timestamp": a.timestamp.isoformat(),
                "overall_health": a.overall_health,
                "message": a.message,
                "bearing_affected": a.bearing_affected
            }
            for a in alerts
        ]
    }

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