# OpenPMX — Open-Source Predictive Maintenance Platform

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.13-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev)
[![Version](https://img.shields.io/badge/Version-1.1.0-brightgreen)](https://github.com/SahDhirendra/openpmx/releases)
[![Website](https://img.shields.io/badge/Website-Live-brightgreen)](https://sahdhirendra.github.io/openpmx)

An open-source predictive maintenance platform built for small and mid-sized US manufacturers. Delivers the same AI-powered capabilities that Fortune 500 companies pay $100,000+/year for — completely free.

---

## 🚀 Live Demo

**Try it now — no installation required:**  
👉 **[https://openpmx-frontend.onrender.com](https://openpmx-frontend.onrender.com)**

API Documentation: [https://openpmx-backend.onrender.com/docs](https://openpmx-backend.onrender.com/docs)  
Project Website: [https://sahdhirendra.github.io/openpmx](https://sahdhirendra.github.io/openpmx)

---

## ⬇️ Download

### Windows Installer (Recommended)
[![Download](https://img.shields.io/badge/Download-Windows%20Installer-blue?style=for-the-badge&logo=windows)](https://github.com/SahDhirendra/openpmx/releases/download/v1.1.0/OpenPMX-Setup-v1.1.0.exe)

**[Download OpenPMX-Setup-v1.1.0.exe](https://github.com/SahDhirendra/openpmx/releases/download/v1.1.0/OpenPMX-Setup-v1.1.0.exe)**

1. Download the installer above
2. Right-click → **Run as Administrator**
3. Follow the setup wizard
4. OpenPMX opens automatically in your browser

> No Python, Node.js or any other software needed — everything is included.

---

## What it does

### Core ML
- 🔍 **Anomaly Detection** — Detects machine anomalies before they become failures
- ⏱️ **Remaining Useful Life** — Predicts days before equipment reaches failure threshold
- 🏥 **Health Scoring** — Real-time health score (0–100) per machine component
- 📈 **Historical Trend Analysis** — View data over 1h, 24h, 7d, 30d or all time

### Operations
- 🚨 **Real-time Alerts** — Critical alerts pushed via WebSocket instantly
- ✅ **Alert Acknowledgement** — Technicians acknowledge alerts with notes and timestamps
- 📊 **OEE Calculator** — Tracks Overall Equipment Effectiveness automatically
- 📉 **Downtime Tracker** — Logs every downtime event with timestamp and cause
- 📝 **Maintenance Log** — Technicians log notes with categories per machine
- 📋 **Work Order Generator** — Auto-generates PDF maintenance work orders
- 📊 **Monthly PDF Reports** — Professional monthly maintenance reports
- 💰 **Cost Savings Calculator** — Shows dollar value of prevented failures
- 📥 **CSV Export** — Export sensor data for any time range

### Connectivity
- 🔌 **Universal PLC Connector** — Connects to Allen-Bradley, Siemens, Modbus TCP, OPC-UA
- 🏷️ **Auto Tag Discovery** — Browse and select PLC tags directly from dashboard
- 🔄 **Auto Config Detection** — Edge agent detects PLC config changes automatically
- 📂 **CSV Upload** — Upload any sensor data CSV — platform auto-detects columns
- 🔌 **Edge Agent** — Raspberry Pi agent reads from PLCs and sends live data

### Platform
- 👤 **User Authentication** — JWT login with Admin, Technician, Viewer roles
- 🏭 **Multi-Machine Fleet** — Monitor multiple machines from one dashboard
- 📐 **Threshold Customization** — Adjust alert thresholds per sensor
- 📱 **Mobile Responsive** — Works on phone, tablet, and desktop
- 📺 **TV Kiosk Mode** — Auto-starts on Pi boot, fullscreen dashboard on TV
- 🔄 **Auto-Update Checker** — Notifies users when new version available
- 🔒 **On-Premise Ready** — Runs fully on your own network
- ⚡ **One Command Deploy** — `docker-compose up`

---

## Tech Stack

- **Backend:** Python · FastAPI · SQLAlchemy · SQLite · WebSockets · JWT Auth
- **Frontend:** React 19 · Vite · Custom SVG charts
- **ML:** Statistical anomaly detection · RMS analysis · Health scoring
- **PLC:** pycomm3 (Allen-Bradley) · asyncua (OPC-UA) · pymodbus (Modbus) · python-snap7 (Siemens)
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

## User Roles

| Feature | Admin | Technician | Viewer |
|---------|-------|------------|--------|
| Train model / Upload CSV | ✅ | ❌ | ❌ |
| Simulate / Work orders | ✅ | ✅ | ❌ |
| Alert acknowledgement | ✅ | ✅ | ❌ |
| Maintenance notes | ✅ | ✅ | ❌ |
| Email alerts / Reports | ✅ | ✅ | ❌ |
| User management | ✅ | ❌ | ❌ |
| PLC configuration | ✅ | ❌ | ❌ |
| Threshold customization | ✅ | ❌ | ❌ |
| View dashboard | ✅ | ✅ | ✅ |

Default credentials: `admin` / `admin123` — **change after first login**

---

## Quick Start

### Option 1 — Live demo (no installation)
Visit **[https://openpmx-frontend.onrender.com](https://openpmx-frontend.onrender.com)**

### Option 2 — Windows installer
Download and run **[OpenPMX-Setup-v1.1.0.exe](https://github.com/SahDhirendra/openpmx/releases/download/v1.1.0/OpenPMX-Setup-v1.1.0.exe)**

### Option 3 — Docker
```bash
git clone https://github.com/SahDhirendra/openpmx
cd openpmx
docker-compose up
```
Open **http://localhost:5173**

### Option 4 — Manual setup

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
npm run dev -- --host
```

Open **http://localhost:5173** and login with `admin` / `admin123`

### Option 5 — Raspberry Pi edge agent
```bash
cd edge
pip3 install requests pycomm3 asyncua pymodbus
python3 agent.py
```

---

## PLC Connection

OpenPMX connects to any PLC brand:

| Brand | Protocol | Library |
|-------|----------|---------|
| Allen-Bradley | EtherNet/IP | pycomm3 |
| Siemens | S7 | python-snap7 |
| Any brand | Modbus TCP | pymodbus |
| Modern PLCs | OPC-UA | asyncua |

**Setup:** Dashboard → 🔌 PLC → Select brand → Enter IP → Browse Tags → Select → Save  
Edge agent auto-detects config changes within 30 seconds — no manual steps needed.

---

## Architecture
Factory Floor (PLC/Sensors)
↓ OPC-UA / EtherNet-IP / Modbus
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
| [Contributing](CONTRIBUTING.md) | How to contribute |
| [Development Phases](PHASES.md) | Project roadmap |

---

## Development Phases

- [x] Phase 1 — Data exploration & NASA bearing dataset analysis
- [x] Phase 2 — Anomaly detection & RUL predictor
- [x] Phase 3 — FastAPI backend with ML engine & WebSocket
- [x] Phase 4 — React dashboard with real-time alerts & charts
- [x] Phase 5 — Docker + Render cloud deployment
- [x] Phase 6 — Raspberry Pi edge agent + TV kiosk mode
- [x] Phase 7 — CSV upload, OEE, email alerts, work orders, cost calculator
- [x] Phase 8 — User auth, PLC connector, mobile responsive, auto-update
- [x] Phase 9 — Alert acknowledgement, maintenance log, threshold customization, CSV export

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- Federated learning across factories
- Computer vision defect detection
- Digital twin integration
- Additional PLC protocol support

---

## Author

**Dhirendra K. Sah**  
Controls & Automation Engineer | MS Mechatronics, NDSU  
[LinkedIn](https://linkedin.com/in/dhirendrasah) · [GitHub](https://github.com/SahDhirendra) · [Project Website](https://sahdhirendra.github.io/openpmx)

---

## License

Copyright 2026 Dhirendra K. Sah

Licensed under the **Apache License 2.0** — free to use, modify, and distribute with attribution.

You must:
- Give appropriate credit to **Dhirendra K. Sah**
- Include a copy of this license
- State any changes you made

See [LICENSE](LICENSE) for full details.