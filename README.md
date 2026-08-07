# OpenPMX — Open-Source Predictive Maintenance Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.13-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)
[![Website](https://img.shields.io/badge/Website-Live-brightgreen)](https://sahdhirendra.github.io/openpmx)

An open-source predictive maintenance platform for small and mid-sized 
manufacturers. Built to democratize industrial AI for the 300,000+ SMB 
manufacturers in the US who can't afford enterprise solutions like 
Siemens MindSphere or PTC ThingWorx — which cost $100,000+/year.

---

## 🚀 Live Demo

**Try it now — no installation required:**  
👉 **[https://openpmx-frontend.onrender.com](https://openpmx-frontend.onrender.com)**

API Documentation: [https://openpmx-backend.onrender.com/docs](https://openpmx-backend.onrender.com/docs)  
Project Website: [https://sahdhirendra.github.io/openpmx](https://sahdhirendra.github.io/openpmx)

---

## What it does

- 🔍 **Anomaly Detection** — Detects machine anomalies before they become failures
- ⏱️ **Remaining Useful Life** — Predicts how many days before equipment failure
- 🏥 **Health Scoring** — Real-time health score (0–100) for each sensor/bearing
- 🚨 **Instant Alerts** — Critical alerts pushed via WebSocket in real time
- 📊 **OEE Calculator** — Tracks Overall Equipment Effectiveness automatically
- 📉 **Downtime Tracker** — Logs every downtime event with timestamp and cause
- 📧 **Email Notifications** — Configurable alerts to maintenance team (any SMTP)
- 📋 **Work Order Generator** — Auto-generates PDF maintenance work orders
- 💰 **Cost Savings Calculator** — Shows dollar value of prevented failures
- 📂 **CSV Upload** — Upload any sensor data CSV — platform auto-detects columns
- 🔌 **Edge Agent** — Raspberry Pi agent reads from PLCs and sends live data
- 📺 **TV Kiosk Mode** — Auto-starts on Pi boot, fullscreen dashboard on TV
- 🔒 **On-Premise Ready** — Runs fully on your own network via Docker
- ⚡ **One Command Deploy** — `docker-compose up` — that's it

---

## Tech Stack

- **Backend:** Python · FastAPI · SQLAlchemy · SQLite · WebSockets
- **Frontend:** React 19 · Vite · Custom SVG charts
- **ML:** Statistical anomaly detection · RMS analysis · Health scoring
- **Edge:** Raspberry Pi · Python agent · Auto-reconnect · Local buffering
- **Notifications:** FastAPI-Mail · SMTP · PDF generation with ReportLab
- **Deployment:** Docker · docker-compose · Render.com · GitHub Pages

---

## Results on NASA IMS Bearing Dataset

| Bearing | Final Health | Status | Result |
|---------|-------------|--------|--------|
| Bearing 1 | 80/100 | Healthy | ✅ Correctly identified |
| Bearing 2 | 86/100 | Healthy | ✅ Correctly identified |
| Bearing 3 | 0/100 | Critical | ✅ Failure detected — 908% vibration increase |
| Bearing 4 | 39/100 | Warning | ✅ Degradation flagged weeks early |

---

## Quick Start

### Option 1 — Live demo (no installation)
Visit **[https://openpmx-frontend.onrender.com](https://openpmx-frontend.onrender.com)**

### Option 2 — One command with Docker
```bash
git clone https://github.com/SahDhirendra/openpmx
cd openpmx
docker-compose up
```
Open **http://localhost:5173**

### Option 3 — Manual setup

**Backend:**
```bash
git clone https://github.com/SahDhirendra/openpmx
cd openpmx
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Frontend (new terminal):**
```bash
cd dashboard
npm install --legacy-peer-deps
npm run dev
```

Open **http://localhost:5173**

### Option 4 — Raspberry Pi edge agent
```bash
cd edge
pip3 install requests
python3 agent.py
```

---

## How to use CSV upload

1. Export sensor data from your SCADA or historian as CSV
2. CSV can have any column names — temperature, pressure, vibration, current, etc.
3. Click **"📂 Upload Your CSV"** on the dashboard
4. Platform auto-detects columns and trains model on your data
5. Get instant health scores for your specific machine

**Example CSV format:**
```csv
timestamp,temperature,vibration,pressure,current
2026-01-01 08:00:00,45.2,0.12,4.3,8.1
2026-01-01 08:10:00,45.5,0.13,4.2,8.2
```

---

## Architecture
Factory Floor (PLC/Sensors)
↓ OPC-UA / Modbus / EtherNet-IP
Raspberry Pi (Edge Agent)
↓ HTTPS + WebSocket
FastAPI Backend (PC or Cloud)
↓ WebSocket real-time push
React Dashboard (Browser or TV)

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Manufacturer Guide](docs/MANUFACTURER_GUIDE.md) | For plant managers — no coding required |
| [Setup Guide](docs/SETUP.md) | For developers and IT teams |
| [API Reference](docs/API.md) | Full API documentation |
| [Contributing](CONTRIBUTING.md) | How to contribute to the project |
| [Development Phases](PHASES.md) | Project roadmap and progress |

---

## Development Phases

## Development Phases

- [x] Phase 1 — Data exploration & NASA bearing dataset analysis
- [x] Phase 2 — Anomaly detection & RUL predictor
- [x] Phase 3 — FastAPI backend with ML engine & WebSocket
- [x] Phase 4 — React dashboard with real-time alerts & charts
- [x] Phase 5 — Docker + Render cloud deployment
- [x] Phase 6 — Raspberry Pi edge agent + TV kiosk mode
- [x] Phase 7 — CSV upload, OEE, email alerts, work orders, cost calculator

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- OPC-UA protocol adapter
- Multi-machine fleet dashboard
- Mobile responsive design
- Federated learning module

---

## Author

**Dhirendra K. Sah**  
Controls & Automation Engineer | MS Mechatronics, NDSU  
[LinkedIn](https://linkedin.com/in/dhirendrasah) · [GitHub](https://github.com/SahDhirendra) · [Project Website](https://sahdhirendra.github.io/openpmx)

---

## License

MIT License — free to use, modify, and distribute.