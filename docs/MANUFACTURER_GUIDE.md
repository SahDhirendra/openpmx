# OpenPMX — Manufacturer's Guide

This guide is written for manufacturing plant managers and maintenance 
teams. No coding knowledge required.

---

## What is OpenPMX?

OpenPMX is a free, open-source platform that monitors your industrial 
machines and warns you before they break down.

Instead of waiting for a machine to fail — causing costly unplanned 
downtime — OpenPMX analyzes vibration, temperature, and other sensor 
data to predict failures days in advance.

**What it costs:** $0. Free forever. No subscription, no vendor lock-in.

---

## What problems does it solve?

| Problem | How OpenPMX helps |
|---------|------------------|
| Unexpected machine breakdowns | Alerts you days before failure |
| Costly unplanned downtime | Schedule maintenance at convenient times |
| Guesswork maintenance schedules | Data-driven decisions based on actual machine health |
| Expensive enterprise software | Free, self-hosted alternative |
| No visibility into machine health | Real-time health scores for every machine |

---

## How does it work?

1. Your machines have sensors that measure vibration, temperature, or other signals
2. OpenPMX reads those sensor readings
3. It compares them to what "healthy" looks like for your specific machine
4. It gives each machine a health score from 0 to 100
5. If something looks wrong it sends an alert immediately

---

## Health score explained

| Score | Color | Meaning | Action |
|-------|-------|---------|--------|
| 75–100 | Green | Healthy | No action needed |
| 50–74 | Blue | Monitor | Keep an eye on it |
| 25–49 | Orange | Warning | Schedule inspection soon |
| 0–24 | Red | Critical | Stop machine, inspect immediately |

---

## Option 1 — Try the live demo (no installation)

Visit: **https://openpmx-frontend.onrender.com**

1. Click **"Train Model"** — wait 2-3 minutes
2. Click **"Simulate Failure"** — see what a critical alert looks like
3. Click **"Simulate Healthy"** — see what a healthy machine looks like

This uses NASA test data so you can see how the platform works before 
connecting your own machines.

---

## Option 2 — Run on your own network (recommended for production)

### What you need
- A computer or server running Windows, Mac, or Linux
- Docker Desktop installed (free): https://www.docker.com/products/docker-desktop
- Internet connection for first-time setup

### Installation steps

**Step 1** — Download OpenPMX
```bash
git clone https://github.com/SahDhirendra/openpmx
cd openpmx
```

**Step 2** — Start the platform
```bash
docker-compose up
```

**Step 3** — Open in your browser

http://localhost:5173

That's it. The entire platform is now running on your own network.

---

## Connecting your machine data

Currently OpenPMX accepts sensor readings via API. Your PLC or sensor 
system sends readings in this format:

```json
{
  "machine_id": "press_line_1",
  "timestamp": "2026-01-15T08:30:00",
  "bearing1_rms": 0.142,
  "bearing2_rms": 0.138,
  "bearing3_rms": 0.151,
  "bearing4_rms": 0.129
}
```

Send this to: `http://your-server:8000/predict`

Your IT team or controls engineer can set this up in under an hour.

---

## What sensor data does it need?

OpenPMX works with any sensor that produces numerical readings:

- Vibration accelerometers
- Temperature sensors
- Current/power monitors
- Pressure sensors
- Any 4-20mA analog sensor

The only requirement is that readings are numerical values sent at 
regular intervals (every few seconds to every few minutes).

---

## Frequently asked questions

**Does my data leave my facility?**
Only if you use the cloud demo. If you run OpenPMX locally with 
Docker, all data stays on your own network.

**What machines can it monitor?**
Any machine with sensors: motors, pumps, conveyors, compressors, 
fans, gearboxes, CNC machines, and more.

**How accurate is it?**
On the NASA benchmark dataset it correctly identified bearing failure 
with a 908% vibration increase and gave advance warning before 
catastrophic failure.

**How many machines can it monitor?**
The current version monitors one machine at a time. Multi-machine 
support is on the roadmap.

**Is it really free?**
Yes. MIT license. Use it, modify it, deploy it — no cost, no 
restrictions.

---

## Getting help

- GitHub Issues: https://github.com/SahDhirendra/openpmx/issues
- LinkedIn: https://linkedin.com/in/dhirendrasah

---

*Built by Dhirendra K. Sah — Controls & Automation Engineer with 
experience at US and international manufacturing facilities.*