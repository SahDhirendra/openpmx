"""
OpenPMX Edge Agent
Runs on Raspberry Pi — reads from PLC or sensors and sends to backend
"""

import time
import json
import requests
import random
import os
from datetime import datetime
from config import (
    API_URL, MACHINE_ID, READ_INTERVAL,
    BUFFER_FILE, BUFFER_MAX, PLC_TYPE,
    PLC_IP, PLC_SLOT, PLC_TAGS,
    OPCUA_ENDPOINT, MODBUS_PORT
)

# ─────────────────────────────────────────
# PLC Reader functions
# ─────────────────────────────────────────

def read_allen_bradley():
    """Read tags from Allen-Bradley PLC via EtherNet/IP"""
    try:
        from pycomm3 import LogixDriver
        with LogixDriver(f"{PLC_IP}/{PLC_SLOT}") as plc:
            results = {}
            for sensor_name, tag_name in PLC_TAGS.items():
                tag = plc.read(tag_name)
                if tag and tag.error is None:
                    results[sensor_name] = round(float(tag.value), 4)
                else:
                    print(f"Failed to read tag {tag_name}: {tag.error if tag else 'No response'}")
                    results[sensor_name] = 0.0
            return results
    except Exception as e:
        print(f"Allen-Bradley connection error: {e}")
        return None

def read_modbus():
    """Read registers from Modbus TCP PLC"""
    try:
        from pymodbus.client import ModbusTcpClient
        client = ModbusTcpClient(PLC_IP, port=MODBUS_PORT)
        client.connect()
        results = {}
        for sensor_name, register in PLC_TAGS.items():
            response = client.read_holding_registers(int(register), count=1)
            if not response.isError():
                # Convert register value to float (scale by 1000)
                results[sensor_name] = round(response.registers[0] / 1000.0, 4)
            else:
                results[sensor_name] = 0.0
        client.close()
        return results
    except Exception as e:
        print(f"Modbus connection error: {e}")
        return None

def read_opcua():
    """Read tags from OPC-UA server"""
    try:
        from asyncua.sync import Client
        with Client(url=OPCUA_ENDPOINT) as client:
            results = {}
            for sensor_name, node_id in PLC_TAGS.items():
                node = client.get_node(node_id)
                value = node.read_value()
                results[sensor_name] = round(float(value), 4)
            return results
    except Exception as e:
        print(f"OPC-UA connection error: {e}")
        return None

def read_simulated_sensors():
    """Simulate sensor readings for testing"""
    if not hasattr(read_simulated_sensors, "start_time"):
        read_simulated_sensors.start_time = time.time()

    elapsed = time.time() - read_simulated_sensors.start_time
    degradation = min(elapsed / 300, 1.0)

    return {
        "bearing1_rms": round(0.13 + degradation * 0.05 + random.uniform(-0.005, 0.005), 4),
        "bearing2_rms": round(0.13 + degradation * 0.04 + random.uniform(-0.005, 0.005), 4),
        "bearing3_rms": round(0.13 + degradation * 0.45 + random.uniform(-0.005, 0.005), 4),
        "bearing4_rms": round(0.12 + degradation * 0.08 + random.uniform(-0.005, 0.005), 4),
    }

def read_sensors():
    """Main sensor reading function — selects correct PLC protocol"""
    print(f"Reading sensors via: {PLC_TYPE}")

    if PLC_TYPE == "allen_bradley":
        result = read_allen_bradley()
        if result is None:
            print("Allen-Bradley read failed — falling back to simulation")
            return read_simulated_sensors()
        return result

    elif PLC_TYPE == "modbus":
        result = read_modbus()
        if result is None:
            print("Modbus read failed — falling back to simulation")
            return read_simulated_sensors()
        return result

    elif PLC_TYPE == "opcua":
        result = read_opcua()
        if result is None:
            print("OPC-UA read failed — falling back to simulation")
            return read_simulated_sensors()
        return result

    else:
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
                  f"PLC: {PLC_TYPE}")
            return True
        else:
            print(f"API error: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Cannot reach backend — buffering")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

def save_to_buffer(reading):
    """Save reading locally when network is down"""
    buffer = load_buffer()
    buffer.append({"timestamp": datetime.utcnow().isoformat(), **reading})
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
    """Send all buffered readings"""
    buffer = load_buffer()
    if not buffer:
        return
    print(f"Flushing {len(buffer)} buffered readings...")
    sent = 0
    for reading in buffer:
        payload = {"machine_id": MACHINE_ID, **reading}
        try:
            response = requests.post(f"{API_URL}/ingest", json=payload, timeout=5)
            if response.status_code == 200:
                sent += 1
        except Exception:
            break
    if sent == len(buffer):
        os.remove(BUFFER_FILE)
        print(f"Buffer flushed — {sent} readings sent")
    else:
        with open(BUFFER_FILE, 'w') as f:
            json.dump(buffer[sent:], f)

def check_backend():
    """Check if backend is ready"""
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
    print(f"Machine ID : {MACHINE_ID}")
    print(f"Backend    : {API_URL}")
    print(f"PLC Type   : {PLC_TYPE}")
    if PLC_TYPE != "simulation":
        print(f"PLC IP     : {PLC_IP}")
    print(f"Interval   : {READ_INTERVAL} seconds")
    print("=" * 50)

    print("Checking backend connection...")
    while not check_backend():
        print("Backend not ready — retrying in 10 seconds...")
        time.sleep(10)

    print("Backend connected and model is trained!")
    flush_buffer()
    print("Starting sensor readings...\n")

    while True:
        try:
            reading = read_sensors()
            success = send_reading(reading)
            if not success:
                save_to_buffer(reading)
                time.sleep(READ_INTERVAL)
                if check_backend():
                    flush_buffer()
            time.sleep(READ_INTERVAL)
        except KeyboardInterrupt:
            print("\nEdge agent stopped")
            break
        except Exception as e:
            print(f"Unexpected error: {e}")
            time.sleep(READ_INTERVAL)

if __name__ == "__main__":
    main()