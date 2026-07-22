"""
OpenPMX Edge Agent
Runs on Raspberry Pi — reads sensor data and sends to backend
"""

import time
import json
import requests
import random
import os
from datetime import datetime
from config import (
    API_URL, MACHINE_ID, READ_INTERVAL,
    BUFFER_FILE, BUFFER_MAX
)

# ─────────────────────────────────────────
# Sensor reading functions
# ─────────────────────────────────────────

def read_simulated_sensors():
    """
    Simulates sensor readings for testing.
    Starts healthy and gradually degrades over time.
    Replace this with real PLC reading function in Step 5.
    """
    # Use seconds since startup for gradual degradation
    if not hasattr(read_simulated_sensors, "start_time"):
        read_simulated_sensors.start_time = time.time()
    
    elapsed = time.time() - read_simulated_sensors.start_time
    # Degrade over 5 minutes (300 seconds) for demo purposes
    degradation = min(elapsed / 300, 1.0)

    return {
        "bearing1_rms": round(0.13 + degradation * 0.05 + random.uniform(-0.005, 0.005), 4),
        "bearing2_rms": round(0.13 + degradation * 0.04 + random.uniform(-0.005, 0.005), 4),
        "bearing3_rms": round(0.13 + degradation * 0.45 + random.uniform(-0.005, 0.005), 4),
        "bearing4_rms": round(0.12 + degradation * 0.08 + random.uniform(-0.005, 0.005), 4),
    }

def read_sensors():
    """
    Main sensor reading function.
    Currently uses simulation — will use PLC in Step 5.
    """
    return read_simulated_sensors()

# ─────────────────────────────────────────
# Network functions
# ─────────────────────────────────────────

def send_reading(reading):
    """Send a reading to the backend API"""
    payload = {
        "machine_id": MACHINE_ID,
        "timestamp": datetime.utcnow().isoformat(),
        **reading
    }

    try:
        response = requests.post(
            f"{API_URL}/ingest",
            json=payload,
            timeout=5
        )
        if response.status_code == 200:
            result = response.json()
            print(f"[{datetime.now().strftime('%H:%M:%S')}] "
                  f"Health: {result['overall_health']}/100 | "
                  f"Alert: {result['alert']} | "
                  f"Message: {result['message']}")
            return True
        else:
            print(f"API error: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] "
              f"Cannot reach backend — buffering locally")
        return False
    except Exception as e:
        print(f"Error sending reading: {e}")
        return False

# ─────────────────────────────────────────
# Local buffer functions
# ─────────────────────────────────────────

def save_to_buffer(reading):
    """Save reading to local buffer when network is down"""
    buffer = load_buffer()
    buffer.append({
        "timestamp": datetime.utcnow().isoformat(),
        **reading
    })
    # Keep only last N readings
    buffer = buffer[-BUFFER_MAX:]
    with open(BUFFER_FILE, 'w') as f:
        json.dump(buffer, f)

def load_buffer():
    """Load buffered readings"""
    if os.path.exists(BUFFER_FILE):
        with open(BUFFER_FILE, 'r') as f:
            return json.load(f)
    return []

def flush_buffer():
    """Send all buffered readings when network comes back"""
    buffer = load_buffer()
    if not buffer:
        return

    print(f"Flushing {len(buffer)} buffered readings...")
    sent = 0
    for reading in buffer:
        payload = {"machine_id": MACHINE_ID, **reading}
        try:
            response = requests.post(
                f"{API_URL}/ingest",
                json=payload,
                timeout=5
            )
            if response.status_code == 200:
                sent += 1
        except Exception:
            break

    # Clear buffer if all sent
    if sent == len(buffer):
        os.remove(BUFFER_FILE)
        print(f"Buffer flushed successfully — {sent} readings sent")
    else:
        # Keep unsent readings
        with open(BUFFER_FILE, 'w') as f:
            json.dump(buffer[sent:], f)
        print(f"Partially flushed — {sent}/{len(buffer)} sent")

# ─────────────────────────────────────────
# Health check
# ─────────────────────────────────────────

def check_backend():
    """Check if backend is reachable and model is trained"""
    try:
        response = requests.get(f"{API_URL}/health", timeout=5)
        data = response.json()
        return data.get("predictor_trained", False)
    except Exception:
        return False

# ─────────────────────────────────────────
# Main loop
# ─────────────────────────────────────────

def main():
    print("=" * 50)
    print("OpenPMX Edge Agent Starting...")
    print(f"Machine ID: {MACHINE_ID}")
    print(f"Backend: {API_URL}")
    print(f"Read interval: {READ_INTERVAL} seconds")
    print("=" * 50)

    # Wait for backend to be ready
    print("Checking backend connection...")
    while not check_backend():
        print("Backend not ready — retrying in 10 seconds...")
        time.sleep(10)

    print("Backend connected and model is trained!")
    print("Starting sensor readings...\n")

    # Flush any buffered readings
    flush_buffer()

    # Main reading loop
    while True:
        try:
            # Read sensors
            reading = read_sensors()

            # Try to send — buffer if fails
            success = send_reading(reading)
            if not success:
                save_to_buffer(reading)
                # Try to flush buffer on next success
                time.sleep(READ_INTERVAL)
                if check_backend():
                    flush_buffer()
            
            time.sleep(READ_INTERVAL)

        except KeyboardInterrupt:
            print("\nEdge agent stopped by user")
            break
        except Exception as e:
            print(f"Unexpected error: {e}")
            time.sleep(READ_INTERVAL)

if __name__ == "__main__":
    main()