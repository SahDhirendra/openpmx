# OpenPMX — Open-Source Predictive Maintenance Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.13-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)

An open-source predictive maintenance platform for small and mid-sized 
manufacturers. Built to democratize industrial AI for the 300,000+ SMB 
manufacturers in the US who can't afford enterprise solutions like 
Siemens MindSphere or PTC ThingWorx.

## 🚀 Live Demo

**Try it now — no installation required:**
👉 **[https://openpmx-frontend.onrender.com](https://openpmx-frontend.onrender.com)**

API Documentation: [https://openpmx-backend.onrender.com/docs](https://openpmx-backend.onrender.com/docs)

## What it does

- 🔍 **Anomaly Detection** — Detects machine anomalies before they become failures
- ⏱️ **Remaining Useful Life** — Predicts how many days before equipment failure
- 🏥 **Health Scoring** — Real-time health score (0-100) for each bearing
- 🚨 **Instant Alerts** — Critical alerts when machines need immediate attention
- 📊 **Visual Dashboard** — Factory managers see machine health at a glance
- 🔒 **On-premise Ready** — Runs fully on your own infrastructure

## Tech Stack

- **Backend:** Python · FastAPI · Scikit-learn · NumPy · Pandas
- **Frontend:** React 19 · Recharts · Vite
- **ML:** Statistical anomaly detection · RMS analysis · Health scoring
- **Deployment:** Docker · Render · GitHub Actions
- **Data:** NASA IMS Bearing Dataset (University of Cincinnati)

## Results on NASA Bearing Dataset

| Bearing | Final Health | Status |
|---------|-------------|--------|
| Bearing 1 | 80/100 | Healthy |
| Bearing 2 | 86/100 | Healthy |
| Bearing 3 | 0/100 | **Failed** ✓ Correctly identified |
| Bearing 4 | 39/100 | Warning |

Platform detected **908% vibration increase** in Bearing 3 and correctly 
triggered a critical alert.

## Quick Start

### Option 1 — Use the live demo (no installation)
👉 **[https://openpmx-frontend.onrender.com](https://openpmx-frontend.onrender.com)**

### Option 2 — Run locally with Docker (one command)
```bash
git clone https://github.com/SahDhirendra/openpmx
cd openpmx
docker-compose up
```
Open **http://localhost:5173** in your browser.
That's it — no Python, no Node.js, no setup required.

### Option 3 — Run without Docker (development mode)
```bash
# Terminal 1 — Backend
git clone https://github.com/SahDhirendra/openpmx
cd openpmx
pip install -r requirements.txt
uvicorn app.main:app --reload

# Terminal 2 — Frontend
cd dashboard
npm install --legacy-peer-deps
npm run dev
```
Open **http://localhost:5173**

## Development Phases

- [x] Phase 1 — Data exploration & NASA bearing dataset analysis
- [x] Phase 2 — Anomaly detection & RUL predictor
- [x] Phase 3 — FastAPI backend with ML engine
- [x] Phase 4 — React dashboard with real-time alerts
- [x] Phase 5 — Cloud deployment on Render
- [ ] Phase 6 — CSV upload for custom machine data
- [ ] Phase 7 — Federated learning across factories

## Author

**Dhirendra K. Sah**  
Controls & Automation Engineer | MS Mechatronics, NDSU  
[LinkedIn](https://linkedin.com/in/dhirendrasah) · [GitHub](https://github.com/SahDhirendra)

## Contributing

Contributions welcome! This project is built for the US manufacturing 
community. See [PHASES.md](PHASES.md) for roadmap.

## License

MIT License — free to use, modify, and distribute.