from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
from app.models.sensor import SensorReading, HealthResponse
from app.core.predictor import predictor
from app.core.database import get_db, SensorReadingDB, AlertDB
import json
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends, UploadFile, File
import pandas as pd
import io
from app.core.database import get_db, SensorReadingDB, AlertDB, DowntimeEventDB
from app.core.notifications import send_alert_email, send_daily_summary_email
from typing import List
from app.core.work_order import generate_work_order
from fastapi.responses import FileResponse
import os
from app.core.monthly_report import generate_monthly_report
from app.core.version import get_version, check_for_updates
from app.core.logger import logger
from app.core.database import get_db, SensorReadingDB, AlertDB, DowntimeEventDB, MachineDB
from app.core.database import get_db, SensorReadingDB, AlertDB, DowntimeEventDB, MachineDB, UserDB, MachineNoteDB
from fastapi.responses import StreamingResponse
import csv
import io


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
    logger.debug(f"Ingest received from {reading.machine_id} — B1:{reading.bearing1_rms} B2:{reading.bearing2_rms} B3:{reading.bearing3_rms} B4:{reading.bearing4_rms}")

    # Auto-register machine if not exists
    machine = db.query(MachineDB).filter(
        MachineDB.machine_id == reading.machine_id
    ).first()

    if not machine:
        machine = MachineDB(
            machine_id=reading.machine_id,
            name=reading.machine_id,
            location="Unknown",
            status="active"
        )
        db.add(machine)
        logger.info(f"Auto-registered new machine: {reading.machine_id}")

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
    if result["alert"]:
        logger.warning(f"ALERT triggered for {reading.machine_id} — Health: {result['overall_health']}/100 — {message}")



 # Downtime detection
    # If health drops below 25 — machine is effectively down
    DOWNTIME_THRESHOLD = 25
    
    # Check if there's an active downtime event
    active_downtime = db.query(DowntimeEventDB).filter(
        DowntimeEventDB.machine_id == reading.machine_id,
        DowntimeEventDB.resolved == False
    ).first()

    if result["overall_health"] < DOWNTIME_THRESHOLD:
        # Machine is down — create downtime event if not already active
        if not active_downtime:
            db_downtime = DowntimeEventDB(
                machine_id=reading.machine_id,
                start_time=reading.timestamp,
                health_at_start=result["overall_health"],
                cause=message,
                resolved=False
            )
            db.add(db_downtime)
    else:
        # Machine is back up — resolve active downtime event
        if active_downtime:
            active_downtime.end_time = reading.timestamp
            duration = (reading.timestamp - active_downtime.start_time).total_seconds() / 60
            active_downtime.duration_minutes = round(duration, 2)
            active_downtime.resolved = True

        # Update machine last seen and health
    if machine:
        machine.last_seen = reading.timestamp
        machine.overall_health = result["overall_health"]
        machine.status = "critical" if result["alert"] else "healthy"

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

# Send email alert if critical — with 1 hour cooldown
    if result["alert"]:
        try:
            import json
            import os
            from datetime import timedelta
            from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType

            if os.path.exists("alert_config.json"):
                with open("alert_config.json", "r") as f:
                    config = json.load(f)

                if config.get("emails") and config.get("smtp_username"):
                    # Check cooldown — only send once per hour
                    last_alert_file = "last_alert.json"
                    should_send = True

                    if os.path.exists(last_alert_file):
                        with open(last_alert_file, "r") as f:
                            last_alert = json.load(f)
                        last_sent = datetime.fromisoformat(last_alert["timestamp"])
                        if datetime.utcnow() - last_sent < timedelta(hours=1):
                            should_send = False
                            print("Email cooldown active — skipping alert email")

                    if should_send:
                        dynamic_conf = ConnectionConfig(
                            MAIL_USERNAME=config["smtp_username"],
                            MAIL_PASSWORD=config["smtp_password"],
                            MAIL_FROM=config["smtp_username"],
                            MAIL_PORT=int(config.get("smtp_port", 465)),
                            MAIL_SERVER=config.get("smtp_server", "smtp.gmail.com"),
                            MAIL_FROM_NAME="OpenPMX Alert System",
                            MAIL_STARTTLS=False,
                            MAIL_SSL_TLS=bool(config.get("use_ssl", True)),
                            USE_CREDENTIALS=True,
                            VALIDATE_CERTS=True
                        )
                        await send_alert_email(
                            recipients=config["emails"],
                            machine_id=reading.machine_id,
                            overall_health=result["overall_health"],
                            message=message,
                            bearings=result["bearings"],
                            timestamp=reading.timestamp.isoformat(),
                            conf=dynamic_conf
                        )
                        # Save last alert timestamp
                        with open(last_alert_file, "w") as f:
                            json.dump({"timestamp": datetime.utcnow().isoformat()}, f)
        except Exception as e:
            print(f"Email notification failed: {e}")
            
    # Broadcast to ALL connected dashboards in real-time
    await manager.broadcast(response)

    return response

@router.get("/history/{machine_id}")
def get_history(
    machine_id: str,
    limit: int = 100,
    hours: int = None,
    db: Session = Depends(get_db)
):
    """Get readings for a machine with optional time range"""
    query = db.query(SensorReadingDB)\
        .filter(SensorReadingDB.machine_id == machine_id)

    if hours:
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        query = query.filter(SensorReadingDB.timestamp >= cutoff)

    readings = query.order_by(SensorReadingDB.timestamp.desc())\
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
    import os
    import sys
    import traceback

    if getattr(sys, 'frozen', False):
        base_dir = os.path.join(os.environ.get('APPDATA', os.path.expanduser('~')), 'OpenPMX')
    else:
        base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

    data_path = os.path.join(base_dir, "data")
    os.makedirs(data_path, exist_ok=True)
    
    # ... rest of function

    print(f"Looking for data at: {data_path}")
    print(f"Data path exists: {os.path.exists(data_path)}")

    if os.path.exists(data_path):
        print(f"Contents: {os.listdir(data_path)}")

    try:
        if not os.path.exists(data_path):
            os.makedirs(data_path, exist_ok=True)

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

@router.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload a CSV file with sensor data.
    Auto-detects sensor columns and trains model on manufacturer's own data.
    """
    # Read the uploaded file
    contents = await file.read()
    
    try:
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid CSV file: {str(e)}")

    # Check minimum rows
    if len(df) < 10:
        raise HTTPException(
            status_code=400,
            detail="CSV needs at least 10 rows of data"
        )

    # Auto-detect numeric sensor columns
    numeric_cols = df.select_dtypes(include=['float64', 'int64']).columns.tolist()
    
    # Remove timestamp-like columns
    sensor_cols = [c for c in numeric_cols if not any(
        t in c.lower() for t in ['time', 'date', 'index', 'id', 'unnamed']
    )]

    if len(sensor_cols) == 0:
        raise HTTPException(
            status_code=400,
            detail="No numeric sensor columns found in CSV"
        )

    # Limit to 4 columns for now
    sensor_cols = sensor_cols[:4]

    # Train model on uploaded data
    sensor_data = df[sensor_cols].dropna().values

    # Calculate baseline from first 50% of data
    split = max(int(len(sensor_data) * 0.5), 5)
    baseline = sensor_data[:split]

    baseline_mean = baseline.mean(axis=0)
    baseline_std = baseline.std(axis=0)
    dynamic_thresholds = baseline_mean + 3 * baseline_std

    # Pad to 4 sensors if less than 4 columns
    while len(baseline_mean) < 4:
        baseline_mean = list(baseline_mean) + [baseline_mean[0]]
        baseline_std = list(baseline_std) + [baseline_std[0]]
        dynamic_thresholds = list(dynamic_thresholds) + [dynamic_thresholds[0]]

    import numpy as np
    predictor.baseline_mean = np.array(baseline_mean[:4])
    predictor.baseline_std = np.array(baseline_std[:4])
    predictor.dynamic_thresholds = np.array(dynamic_thresholds[:4])
    predictor.is_trained = True

    # Return analysis results
    latest = sensor_data[-1]
    while len(latest) < 4:
        latest = list(latest) + [latest[0]]
    latest = latest[:4]

    result = predictor.predict(
        bearing1=float(latest[0]),
        bearing2=float(latest[1]),
        bearing3=float(latest[2]),
        bearing4=float(latest[3])
    )

    return {
        "status": "trained",
        "message": f"Model trained on {len(sensor_data)} rows of your data",
        "columns_detected": sensor_cols,
        "total_rows": len(df),
        "training_rows": split,
        "baseline_mean": predictor.baseline_mean.tolist(),
        "thresholds": predictor.dynamic_thresholds.tolist(),
        "latest_health": result
    }

@router.get("/downtime/{machine_id}")
def get_downtime(machine_id: str, limit: int = 20, db: Session = Depends(get_db)):
    """Get downtime events for a machine"""
    events = db.query(DowntimeEventDB)\
        .filter(DowntimeEventDB.machine_id == machine_id)\
        .order_by(DowntimeEventDB.start_time.desc())\
        .limit(limit)\
        .all()

    return {
        "machine_id": machine_id,
        "downtime_events": [
            {
                "id": e.id,
                "start_time": e.start_time.isoformat(),
                "end_time": e.end_time.isoformat() if e.end_time else None,
                "duration_minutes": e.duration_minutes,
                "cause": e.cause,
                "health_at_start": e.health_at_start,
                "resolved": e.resolved
            }
            for e in events
        ]
    }

@router.get("/oee/{machine_id}")
def get_oee(machine_id: str, hours: int = 24, db: Session = Depends(get_db)):
    """Calculate OEE for a machine over the last N hours"""
    from datetime import timedelta
    
    now = datetime.utcnow()
    start_time = now - timedelta(hours=hours)
    total_minutes = hours * 60

    # Get all downtime events in the period
    downtime_events = db.query(DowntimeEventDB).filter(
        DowntimeEventDB.machine_id == machine_id,
        DowntimeEventDB.start_time >= start_time
    ).all()

    # Calculate total downtime
    total_downtime = sum(
        e.duration_minutes for e in downtime_events
        if e.duration_minutes is not None
    )

    # Add ongoing downtime if machine is currently down
    active = db.query(DowntimeEventDB).filter(
        DowntimeEventDB.machine_id == machine_id,
        DowntimeEventDB.resolved == False
    ).first()

    if active:
        ongoing = (now - active.start_time).total_seconds() / 60
        total_downtime += ongoing

    # Calculate OEE components
    uptime_minutes = max(total_minutes - total_downtime, 0)
    availability = round((uptime_minutes / total_minutes) * 100, 1)

    # For now performance and quality default to 100%
    # These can be connected to production data later
    performance = 100.0
    quality = 100.0
    oee = round((availability / 100) * (performance / 100) * (quality / 100) * 100, 1)

    return {
        "machine_id": machine_id,
        "period_hours": hours,
        "oee": oee,
        "availability": availability,
        "performance": performance,
        "quality": quality,
        "total_downtime_minutes": round(total_downtime, 1),
        "uptime_minutes": round(uptime_minutes, 1),
        "downtime_events_count": len(downtime_events),
        "machine_currently_down": active is not None
    }

@router.post("/configure-alerts")
async def configure_alerts(request: dict):
    """Configure email settings for alerts"""
    import json
    config = {
        "emails": request.get("emails", []),
        "machine_id": request.get("machine_id", "machine_001"),
        "smtp_server": request.get("smtp_server", "smtp.gmail.com"),
        "smtp_port": request.get("smtp_port", 465),
        "smtp_username": request.get("smtp_username", ""),
        "smtp_password": request.get("smtp_password", ""),
        "use_ssl": request.get("use_ssl", True)
    }
    with open("alert_config.json", "w") as f:
        json.dump(config, f)
    return {"status": "configured", "emails": config["emails"]}

@router.get("/configure-alerts")
async def get_alert_config():
    """Get current email configuration"""
    import json
    import os
    if os.path.exists("alert_config.json"):
        with open("alert_config.json", "r") as f:
            config = json.load(f)
        # Hide password
        config["smtp_password"] = "***" if config.get("smtp_password") else ""
        return config
    return {"emails": [], "configured": False}

@router.post("/test-alert")
async def test_alert(email: str):
    """Send a test alert email"""
    try:
        await send_alert_email(
            recipients=[email],
            machine_id="machine_001",
            overall_health=0.0,
            message="Critical! Imminent bearing failure. Stop machine now.",
            bearings={
                "bearing1": {"health_score": 80.5, "status": "healthy"},
                "bearing2": {"health_score": 85.7, "status": "healthy"},
                "bearing3": {"health_score": 0.0, "status": "critical"},
                "bearing4": {"health_score": 38.7, "status": "warning"}
            },
            timestamp="2026-01-15T08:30:00"
        )
        return {"status": "sent", "email": email}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-work-order")
async def create_work_order(reading: SensorReading):
    """Generate a PDF maintenance work order"""
    if not predictor.is_trained:
        raise HTTPException(status_code=503, detail="Predictor not trained yet")

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

    pdf_path = generate_work_order(
        machine_id=reading.machine_id,
        overall_health=result["overall_health"],
        message=message,
        bearings=result["bearings"],
        timestamp=reading.timestamp.isoformat()
    )

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=os.path.basename(pdf_path)
    )

@router.post("/cleanup-database")
def cleanup_database(days_to_keep: int = 90):
    """Manually trigger database cleanup"""
    try:
        from app.core.database import cleanup_old_data
        result = cleanup_old_data(days_to_keep=days_to_keep)
        logger.info(f"Manual database cleanup triggered: {result}")
        return {
            "status": "success",
            "message": f"Deleted data older than {days_to_keep} days",
            **result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/database-stats")
def database_stats(db: Session = Depends(get_db)):
    """Get database size and record counts"""
    import os
    
    readings_count = db.query(SensorReadingDB).count()
    alerts_count = db.query(AlertDB).count()
    downtime_count = db.query(DowntimeEventDB).count()
    
    # Get database file size
    db_path = os.path.join(os.path.dirname(__file__), 
                           "..", "..", "data", "openpmx.db")
    db_path = os.path.abspath(db_path)
    db_size_mb = os.path.getsize(db_path) / (1024 * 1024) if os.path.exists(db_path) else 0

    return {
        "readings_count": readings_count,
        "alerts_count": alerts_count,
        "downtime_events_count": downtime_count,
        "database_size_mb": round(db_size_mb, 2),
        "database_path": db_path
    }

@router.get("/config")
def get_config():
    """Get current configuration"""
    from app.core.config import config
    # Return config without sensitive data
    safe_config = {
        "machine": config["machine"],
        "backend": config["backend"],
        "database": {"retention_days": config["database"]["retention_days"]},
        "model": config["model"],
        "alerts": {"downtime_threshold": config["alerts"]["downtime_threshold"],
                   "email_cooldown_hours": config["alerts"]["email_cooldown_hours"]},
        "edge": config["edge"],
        "dashboard": config["dashboard"]
    }
    return safe_config

@router.get("/machines")
def get_machines(db: Session = Depends(get_db)):
    """Get all registered machines"""
    machines = db.query(MachineDB).filter(MachineDB.is_active == True).all()
    return {
        "machines": [
            {
                "machine_id": m.machine_id,
                "name": m.name,
                "location": m.location,
                "description": m.description,
                "overall_health": m.overall_health,
                "status": m.status,
                "last_seen": m.last_seen.isoformat() if m.last_seen else None,
                "created_at": m.created_at.isoformat()
            }
            for m in machines
        ]
    }

@router.post("/machines")
def register_machine(
    machine_id: str,
    name: str,
    location: str = "",
    description: str = "",
    db: Session = Depends(get_db)
):
    """Register a new machine"""
    # Check if already exists
    existing = db.query(MachineDB).filter(
        MachineDB.machine_id == machine_id
    ).first()

    if existing:
        existing.name = name
        existing.location = location
        existing.description = description
        existing.is_active = True
        db.commit()
        return {"status": "updated", "machine_id": machine_id}

    machine = MachineDB(
        machine_id=machine_id,
        name=name,
        location=location,
        description=description
    )
    db.add(machine)
    db.commit()
    logger.info(f"New machine registered: {machine_id} — {name}")
    return {"status": "registered", "machine_id": machine_id}

@router.delete("/machines/{machine_id}")
def delete_machine(machine_id: str, db: Session = Depends(get_db)):
    """Deactivate a machine"""
    machine = db.query(MachineDB).filter(
        MachineDB.machine_id == machine_id
    ).first()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    machine.is_active = False
    db.commit()
    return {"status": "deactivated", "machine_id": machine_id}

@router.get("/version")
def get_current_version():
    """Get current version"""
    return {"version": get_version()}

@router.get("/check-updates")
async def check_updates():
    """Check GitHub for latest version"""
    return await check_for_updates()

@router.post("/generate-monthly-report")
async def create_monthly_report(
    machine_id: str = "machine_001",
    hourly_rate: float = 1000,
    repair_cost: float = 5000,
    db: Session = Depends(get_db)
):
    """Generate a monthly PDF maintenance report"""
    import os

    # Get OEE data
    from datetime import timedelta
    now = datetime.utcnow()
    start_time = now - timedelta(days=30)
    total_minutes = 30 * 24 * 60

    downtime_events_db = db.query(DowntimeEventDB).filter(
        DowntimeEventDB.machine_id == machine_id,
        DowntimeEventDB.start_time >= start_time
    ).all()

    total_downtime = sum(e.duration_minutes for e in downtime_events_db if e.duration_minutes)
    uptime_minutes = max(total_minutes - total_downtime, 0)
    availability = round((uptime_minutes / total_minutes) * 100, 1)
    oee = round((availability / 100) * 100, 1)

    oee_data = {
        "oee": oee,
        "availability": availability,
        "uptime_minutes": uptime_minutes,
        "total_downtime_minutes": total_downtime,
        "downtime_events_count": len(downtime_events_db)
    }

    # Get downtime events
    downtime_list = [
        {
            "start_time": e.start_time.isoformat(),
            "duration_minutes": e.duration_minutes,
            "resolved": e.resolved,
            "cause": e.cause
        }
        for e in downtime_events_db
    ]

    # Get alerts
    alerts_db = db.query(AlertDB).filter(
        AlertDB.machine_id == machine_id,
        AlertDB.timestamp >= start_time
    ).order_by(AlertDB.timestamp.desc()).limit(20).all()

    alerts_list = [
        {
            "timestamp": a.timestamp.isoformat(),
            "overall_health": a.overall_health,
            "bearing_affected": a.bearing_affected,
            "message": a.message
        }
        for a in alerts_db
    ]

    # Get readings count
    readings_count = db.query(SensorReadingDB).filter(
        SensorReadingDB.machine_id == machine_id,
        SensorReadingDB.timestamp >= start_time
    ).count()

    # Generate PDF
    pdf_path = generate_monthly_report(
        machine_id=machine_id,
        oee_data=oee_data,
        downtime_events=downtime_list,
        alerts=alerts_list,
        readings_count=readings_count,
        hourly_rate=hourly_rate,
        repair_cost=repair_cost
    )

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=os.path.basename(pdf_path)
    )

@router.get("/plc-config")
def get_plc_config():
    """Get current PLC configuration"""
    import json
    import os
    if os.path.exists("plc_config.json"):
        with open("plc_config.json", "r") as f:
            return json.load(f)
    return {
        "plc_type": "simulation",
        "plc_ip": "",
        "plc_slot": 0,
        "opcua_endpoint": "",
        "modbus_port": 502,
        "tags": {
            "bearing1_rms": "",
            "bearing2_rms": "",
            "bearing3_rms": "",
            "bearing4_rms": ""
        }
    }

@router.post("/plc-config")
def save_plc_config(config: dict):
    """Save PLC configuration"""
    import json
    import time
    
    # Add timestamp so edge agent knows config changed
    config["updated_at"] = time.time()
    
    with open("plc_config.json", "w") as f:
        json.dump(config, f, indent=2)
    logger.info(f"PLC config saved: {config.get('plc_type')} at {config.get('plc_ip')}")
    return {"status": "saved", "config": config}

@router.post("/browse-plc-tags")
async def browse_plc_tags(config: dict):
    """
    Connect to PLC and return list of available tags
    """
    plc_type = config.get("plc_type")
    plc_ip = config.get("plc_ip")
    plc_slot = config.get("plc_slot", 0)

    if not plc_ip:
        raise HTTPException(status_code=400, detail="PLC IP address required")

    # Test mode
    if plc_ip == "0.0.0.0":
        print("TEST MODE - returning simulated tags")
        test_tags = [
            {"name": "Machine_Insight_B1", "type": "REAL", "dimensions": 0},
            {"name": "Machine_Insight_B2", "type": "REAL", "dimensions": 0},
            {"name": "Machine_Insight_B3", "type": "REAL", "dimensions": 0},
            {"name": "Machine_Insight_B4", "type": "REAL", "dimensions": 0},
            {"name": "Motor_Temperature", "type": "REAL", "dimensions": 0},
            {"name": "Pump_Pressure", "type": "REAL", "dimensions": 0},
            {"name": "Conveyor_Speed", "type": "REAL", "dimensions": 0},
            {"name": "Vibration_X", "type": "REAL", "dimensions": 0},
            {"name": "Vibration_Y", "type": "REAL", "dimensions": 0},
            {"name": "Current_Draw", "type": "REAL", "dimensions": 0},
        ]
        return {"status": "connected", "tags": test_tags, "count": len(test_tags)}

    if plc_type == "allen_bradley":
        try:
            from pycomm3 import LogixDriver
            tags = []
            with LogixDriver(f"{plc_ip}/{plc_slot}", init_tags=True, init_program_tags=True) as plc:
                if not plc.connected:
                    raise HTTPException(status_code=500, detail=f"Could not connect to PLC at {plc_ip}")
                plc_tags = plc.get_tag_list()
                for tag in plc_tags:
                    tags.append({
                        "name": tag.tag_name,
                        "type": str(tag.data_type),
                        "dimensions": tag.dimensions
                    })
            logger.info(f"Found {len(tags)} tags on PLC {plc_ip}")
            return {"status": "connected", "tags": tags, "count": len(tags)}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PLC connection failed: {str(e)}")

    elif plc_type == "modbus":
        tags = [{"name": str(i), "type": "HOLDING_REGISTER", "dimensions": 0}
                for i in range(1, 101)]
        return {"status": "connected", "tags": tags, "count": len(tags)}

    elif plc_type == "opcua":
        try:
            from asyncua.sync import Client
            endpoint = config.get("opcua_endpoint")
            tags = []
            with Client(url=endpoint) as client:
                root = client.get_root_node()
                objects = root.get_child(["0:Objects"])
                for node in objects.get_children():
                    try:
                        name = node.read_browse_name().Name
                        tags.append({
                            "name": f"ns=2;s={name}",
                            "type": "OPC-UA Node",
                            "dimensions": 0
                        })
                    except Exception:
                        pass
            return {"status": "connected", "tags": tags, "count": len(tags)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"OPC-UA connection failed: {str(e)}")

    else:
        raise HTTPException(status_code=400, detail="Unsupported PLC type for tag browsing")


@router.post("/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    acknowledged_by: str,
    note: str = "",
    db: Session = Depends(get_db)
):
    """Acknowledge an alert"""
    alert = db.query(AlertDB).filter(AlertDB.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.acknowledged = True
    alert.acknowledged_by = acknowledged_by
    alert.acknowledged_at = datetime.utcnow()
    alert.acknowledgement_note = note
    db.commit()

    logger.info(f"Alert {alert_id} acknowledged by {acknowledged_by}")
    return {"status": "acknowledged", "alert_id": alert_id}

@router.get("/alerts/{machine_id}/unacknowledged")
def get_unacknowledged_alerts(machine_id: str, db: Session = Depends(get_db)):
    """Get unacknowledged alerts for a machine"""
    alerts = db.query(AlertDB).filter(
        AlertDB.machine_id == machine_id,
        AlertDB.acknowledged == False
    ).order_by(AlertDB.timestamp.desc()).all()

    return {
        "machine_id": machine_id,
        "unacknowledged_count": len(alerts),
        "alerts": [
            {
                "id": a.id,
                "timestamp": a.timestamp.isoformat(),
                "overall_health": a.overall_health,
                "message": a.message,
                "bearing_affected": a.bearing_affected
            }
            for a in alerts
        ]
    }

@router.get("/thresholds")
def get_thresholds():
    """Get current sensor thresholds"""
    if not predictor.is_trained:
        raise HTTPException(status_code=503, detail="Predictor not trained yet")
    
    return {
        "baseline_mean": predictor.baseline_mean.tolist(),
        "dynamic_thresholds": predictor.dynamic_thresholds.tolist(),
        "bearings": {
            f"bearing{i+1}": {
                "baseline_mean": round(float(predictor.baseline_mean[i]), 4),
                "threshold": round(float(predictor.dynamic_thresholds[i]), 4)
            }
            for i in range(4)
        }
    }

@router.post("/thresholds")
def update_thresholds(thresholds: dict):
    """Update sensor thresholds manually"""
    import numpy as np
    
    if not predictor.is_trained:
        raise HTTPException(status_code=503, detail="Predictor not trained yet")

    try:
        new_thresholds = [
            float(thresholds.get("bearing1", predictor.dynamic_thresholds[0])),
            float(thresholds.get("bearing2", predictor.dynamic_thresholds[1])),
            float(thresholds.get("bearing3", predictor.dynamic_thresholds[2])),
            float(thresholds.get("bearing4", predictor.dynamic_thresholds[3]))
        ]
        predictor.dynamic_thresholds = np.array(new_thresholds)
        predictor.save_model()
        logger.info(f"Thresholds updated: {new_thresholds}")
        return {
            "status": "updated",
            "thresholds": new_thresholds
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/notes/{machine_id}")
def get_notes(machine_id: str, limit: int = 50, db: Session = Depends(get_db)):
    """Get maintenance notes for a machine"""
    notes = db.query(MachineNoteDB)\
        .filter(MachineNoteDB.machine_id == machine_id)\
        .order_by(MachineNoteDB.created_at.desc())\
        .limit(limit)\
        .all()
    return {
        "machine_id": machine_id,
        "notes": [
            {
                "id": n.id,
                "note": n.note,
                "author": n.author,
                "category": n.category,
                "created_at": n.created_at.isoformat()
            }
            for n in notes
        ]
    }

@router.post("/notes/{machine_id}")
def add_note(
        machine_id: str,
        note: str,
        author: str,
        category: str = "general",
        db: Session = Depends(get_db)
    ):
        """Add a maintenance note for a machine"""
        db_note = MachineNoteDB(
            machine_id=machine_id,
            note=note,
            author=author,
            category=category
        )
        db.add(db_note)
        db.commit()
        logger.info(f"Note added for {machine_id} by {author}")
        return {"status": "added", "machine_id": machine_id}

@router.delete("/notes/{note_id}")
def delete_note(note_id: int, db: Session = Depends(get_db)):
        """Delete a maintenance note"""
        note = db.query(MachineNoteDB).filter(MachineNoteDB.id == note_id).first()
        if not note:
            raise HTTPException(status_code=404, detail="Note not found")
        db.delete(note)
        db.commit()
        return {"status": "deleted"}


@router.get("/export/{machine_id}")
def export_data(
    machine_id: str,
    hours: int = 24,
    db: Session = Depends(get_db)
):
    """Export sensor readings to CSV"""
    from datetime import timedelta

    cutoff = datetime.utcnow() - timedelta(hours=hours)
    readings = db.query(SensorReadingDB)\
        .filter(
            SensorReadingDB.machine_id == machine_id,
            SensorReadingDB.timestamp >= cutoff
        )\
        .order_by(SensorReadingDB.timestamp.asc())\
        .all()

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Timestamp", "Machine ID",
        "Bearing 1 RMS", "Bearing 2 RMS", "Bearing 3 RMS", "Bearing 4 RMS",
        "Bearing 1 Health", "Bearing 2 Health", "Bearing 3 Health", "Bearing 4 Health",
        "Overall Health", "Alert", "Message"
    ])

    # Data rows
    for r in readings:
        writer.writerow([
            r.timestamp.isoformat(),
            r.machine_id,
            r.bearing1_rms, r.bearing2_rms, r.bearing3_rms, r.bearing4_rms,
            r.bearing1_health, r.bearing2_health, r.bearing3_health, r.bearing4_health,
            r.overall_health,
            "Yes" if r.alert else "No",
            r.message
        ])

    output.seek(0)
    filename = f"openpmx_{machine_id}_{hours}h_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )