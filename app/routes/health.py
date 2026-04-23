from fastapi import APIRouter, HTTPException
from datetime import datetime
from app.models.sensor import SensorReading, HealthResponse
from app.core.predictor import predictor

router = APIRouter()

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
        "predictor_trained": predictor.is_trained
    }

@router.post("/predict", response_model=HealthResponse)
def predict_health(reading: SensorReading):
    """
    Receive sensor readings and return health scores
    """
    if not predictor.is_trained:
        raise HTTPException(
            status_code=503,
            detail="Predictor not trained yet. Call /train first."
        )

    # Run prediction
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