# OpenPMX API Reference

Base URL (cloud): `https://openpmx-backend.onrender.com`  
Base URL (local): `http://localhost:8000`  
Interactive docs: `{base_url}/docs`

---

## GET /

Check if the API is running.

**Response:**
```json
{
  "name": "OpenPMX",
  "version": "0.1.0",
  "description": "Open-source predictive maintenance platform",
  "status": "running"
}
```

---

## GET /health

Check if the ML model is trained and ready.

**Response:**
```json
{
  "status": "ok",
  "predictor_trained": true
}
```

---

## POST /train

Train the ML model on the NASA IMS bearing dataset.
Downloads dataset automatically on first run (requires Kaggle credentials).

**Response:**
```json
{
  "status": "trained",
  "message": "Predictor trained successfully on NASA bearing dataset",
  "baseline_mean": [0.1439, 0.1443, 0.1507, 0.1302],
  "thresholds": [0.2879, 0.2886, 0.3014, 0.2604]
}
```

---

## POST /predict

Submit sensor readings and get health scores.

**Request body:**
```json
{
  "machine_id": "string",
  "timestamp": "2026-01-15T08:30:00",
  "bearing1_rms": 0.142,
  "bearing2_rms": 0.138,
  "bearing3_rms": 0.151,
  "bearing4_rms": 0.129
}
```

**Response:**
```json
{
  "machine_id": "press_line_1",
  "timestamp": "2026-01-15T08:30:00",
  "overall_health": 95.2,
  "alert": false,
  "bearings": {
    "bearing1": {
      "rms": 0.142,
      "health_score": 96.1,
      "status": "healthy",
      "threshold": 0.2879
    }
  },
  "message": "All bearings healthy. No action required."
}
```

**Status values:**
- `healthy` — health score ≥ 75
- `monitor` — health score ≥ 50
- `warning` — health score ≥ 25
- `critical` — health score < 25

---

## Error responses

| Code | Meaning |
|------|---------|
| 422 | Invalid request data — check field types |
| 500 | Internal error — check server logs |
| 503 | Model not trained — call /train first |