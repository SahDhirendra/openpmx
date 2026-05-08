# OpenPMX — Technical Setup Guide

This guide is for developers and IT teams setting up OpenPMX.

---

## System requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Disk | 10 GB | 20+ GB |
| OS | Windows 10, Ubuntu 20.04, macOS 11 | Latest versions |
| Python | 3.11+ | 3.13 |
| Node.js | 18+ | 20+ |

---

## Installation methods

### Method 1 — Docker (recommended)
Requires Docker Desktop installed.

```bash
git clone https://github.com/SahDhirendra/openpmx
cd openpmx
docker-compose up
```

Access at: `http://localhost:5173`

### Method 2 — Manual setup

**Backend:**
```bash
git clone https://github.com/SahDhirendra/openpmx
cd openpmx
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # Mac/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend (new terminal):**
```bash
cd dashboard
npm install --legacy-peer-deps
npm run dev
```

### Method 3 — Cloud deployment (Render.com)
See full deployment guide at: https://render.com/docs

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `KAGGLE_USERNAME` | Yes (first run) | Your Kaggle username |
| `KAGGLE_KEY` | Yes (first run) | Your Kaggle API key |
| `VITE_API_URL` | Frontend only | Backend API URL |

---

## Project structure

openpmx/
├── app/                    # FastAPI backend
│   ├── main.py            # App entry point, CORS config
│   ├── core/
│   │   └── predictor.py   # ML model — BearingPredictor class
│   ├── models/
│   │   └── sensor.py      # Pydantic data models
│   └── routes/
│       └── health.py      # API endpoints
├── dashboard/              # React frontend
│   ├── src/
│   │   └── App.jsx        # Main dashboard component
│   ├── package.json
│   └── Dockerfile
├── data/                   # Dataset folder
│   └── README.md          # Dataset download instructions
├── docs/                   # Documentation
├── Dockerfile              # Backend Docker config
├── docker-compose.yml      # Full stack orchestration
├── requirements.txt        # Python dependencies
├── PHASES.md              # Development roadmap
└── CONTRIBUTING.md        # Contribution guide

---

## API endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API status check |
| GET | `/health` | Predictor status |
| POST | `/train` | Train model on dataset |
| POST | `/predict` | Get health scores |

Full interactive docs: `http://localhost:8000/docs`

---

## Troubleshooting

**Training fails with Kaggle error**
- Check KAGGLE_USERNAME and KAGGLE_KEY are set correctly
- Verify your Kaggle account has accepted the dataset terms

**Frontend shows "Cannot connect to API"**
- Make sure backend is running on port 8000
- Check CORS settings in app/main.py include your frontend URL

**Docker build is slow**
- First build downloads all dependencies — takes 5-10 minutes
- Subsequent runs use cache and start in under 60 seconds

**Port already in use**
- Change ports in docker-compose.yml
- Backend: change `8000:8000` to `8001:8000`
- Frontend: change `5173:80` to `5174:80`