# OpenPMX — Development Phases

## Phase 1 — Data Exploration & Analysis
**Folder:** `01_bearing_data_exploration.ipynb`  
**Completed:** April 2026

- Downloaded and explored NASA IMS Bearing Dataset
- Analyzed vibration signals from 4 industrial bearings
- Identified Bearing 3 failure with 908% vibration increase
- Visualized degradation patterns over 34-day test period

---

## Phase 2 — Anomaly Detection & RUL Predictor
**Folder:** `02_anomaly_detection.ipynb`  
**Completed:** April 2026

- Built anomaly detection using statistical thresholds
- Developed Remaining Useful Life (RUL) predictor
- Created health scoring system (100 = healthy, 0 = failed)
- Generated professional visualizations for all 4 bearings

---

## Phase 3 — FastAPI Backend & ML Engine
**Folder:** `app/`  
**Completed:** April 2026

- Built FastAPI backend with 4 REST endpoints
- Wrapped ML model into a reusable BearingPredictor class
- Implemented health scoring and alert generation
- Added CORS support for frontend integration
- Interactive API documentation at `/docs`

---

## Phase 4 — React Dashboard
**Folder:** `dashboard/`  
**Completed:** April 2026

- Built React dashboard with real-time health cards
- Added critical alert banner with machine-specific messages
- Implemented bearing degradation history chart
- Simulate Healthy and Simulate Failure demo buttons
- Connects live to FastAPI backend

---

## Phase 5 — Deployment, Documentation & Community
**Status:** 🔜 Coming soon

- Docker containerization for easy self-hosting
- Full documentation and setup guides
- Project website
- NIST MEP network outreach
- Manufacturing AI research paper