"""
OpenPMX Edge Agent
Runs on Raspberry Pi — reads from PLC or sensors and sends to backend
Auto-detects PLC configuration changes from backend
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
# Dynamic config — loaded from backend
# ─────────────────────────────────────────

current_config = {
    "plc_type": "simulation",
    "plc_ip": "",
    "plc_slot": 0,
    "opcua_endpoint": "",
    "modbus_port": 502,
    "tags": {
        "bearing1_rms": "",
        "bearing2_rms": "",
        "bearing3_rms": "",
        "bearing4_rms": ""
    },
    "updated_at": 0
}

def fetch_plc_config():
    """Fetch latest PLC config from backend"""
    global current_config
    try:
        response = requests.get(f"{API_URL}/plc-config", timeout=5)
        if response.status_code == 200:
            new_config = response.json()
            # Check if config changed
            if new_config.get("updated_at", 0) != current_config.get("updated_at", 0):
                old_type = current_config.get("plc_type", "simulation")
                new_type = new_config.get("plc_type", "simulation")
                current_config = new_config
                print(f"[CONFIG] PLC config updated: {old_type} → {new_type}")
                if new_type != "simulation":
                    print(f"[CONFIG] PLC IP: {new_config.get('plc_ip')}")
                return True  # Config changed
    except Exception as e:
        print(f"[CONFIG] Failed to fetch config: {e}")
    return False  # No change

# ─────────────────────────────────────────
# PLC Reader functions
# ─────────────────────────────────────────

def read_allen_bradley():
    """Read tags from Allen-Bradley PLC via EtherNet/IP"""
    try:
        from pycomm3 import LogixDriver
        plc_ip = current_config.get("plc_ip")
        plc_slot = current_config.get("plc_slot", 0)
        tags = current_config.get("tags", {})

        with LogixDriver(f"{plc_ip}/{plc_slot}") as plc:
            results = {}
            for sensor_name, tag_name in tags.items():
                if not tag_name:
                    results[sensor_name] = 0.0
                    continue
                tag = plc.read(tag_name)
                if tag and tag.error is None:
                    results[sensor_name] = round(float(tag.value), 4)
                else:
                    print(f"[PLC] Failed to read tag {tag_name}")
                    results[sensor_name] = 0.0
            return results
    except Exception as e:
        print(f"[PLC] Allen-Bradley error: {e}")
        return None

def read_modbus():
    """Read registers from Modbus TCP PLC"""
    try:
        from pymodbus.client import ModbusTcpClient
        plc_ip = current_config.get("plc_ip")
        modbus_port = current_config.get("modbus_port", 502)
        tags = current_config.get("tags", {})

        client = ModbusTcpClient(plc_ip, port=modbus_port)
        client.connect()
        results = {}
        for sensor_name, register in tags.items():
            if not register:
                results[sensor_name] = 0.0
                continue
            response = client.read_holding_registers(int(register), count=1)
            if not response.isError():
                results[sensor_name] = round(response.registers[0] / 1000.0, 4)
            else:
                results[sensor_name] = 0.0
        client.close()
        return results
    except Exception as e:
        print(f"[PLC] Modbus error: {e}")
        return None

def read_opcua():
    """Read tags from OPC-UA server"""
    try:
        from asyncua.sync import Client
        endpoint = current_config.get("opcua_endpoint")
        tags = current_config.get("tags", {})

        with Client(url=endpoint) as client:
            results = {}
            for sensor_name, node_id in tags.items():
                if not node_id:
                    results[sensor_name] = 0.0
                    continue
                node = client.get_node(node_id)
                value = node.read_value()
                results[sensor_name] = round(float(value), 4)
            return results
    except Exception as e:
        print(f"[PLC] OPC-UA error: {e}")
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
    """Main sensor reading function"""
    plc_type = current_config.get("plc_type", "simulation")

    if plc_type == "allen_bradley":
        result = read_allen_bradley()
        if result is None:
            print("[PLC] Falling back to simulation")
            return read_simulated_sensors()
        return result

    elif plc_type == "modbus":
        result = read_modbus()
        if result is None:
            print("[PLC] Falling back to simulation")
            return read_simulated_sensors()
        return result

    elif plc_type == "opcua":
        result = read_opcua()
        if result is None:
            print("[PLC] Falling back to simulation")
            return read_simulated_sensors()
        return result

    else:
        return read_simulated_sensors()

# ─────────────────────────────────────────
# Network functions
# ─────────────────────────────────────────

def send_reading(reading):
    """Send reading to backend"""
    payload = {
        "machine_id": MACHINE_ID,
        "timestamp": datetime.utcnow().isoformat(),
        **reading
    }
    try:
        response = requests.post(f"{API_URL}/ingest", json=payload, timeout=5)
        if response.status_code == 200:
            result = response.json()
            plc_type = current_config.get("plc_type", "simulation")
            print(f"[{datetime.now().strftime('%H:%M:%S')}] "
                  f"Health: {result['overall_health']}/100 | "
                  f"Alert: {result['alert']} | "
                  f"PLC: {plc_type}")
            return True
        return False
    except requests.exceptions.ConnectionError:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Cannot reach backend — buffering")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

def save_to_buffer(reading):
    buffer = load_buffer()
    buffer.append({"timestamp": datetime.utcnow().isoformat(), **reading})
    buffer = buffer[-BUFFER_MAX:]
    with open(BUFFER_FILE, 'w') as f:
        json.dump(buffer, f)

def load_buffer():
    if os.path.exists(BUFFER_FILE):
        with open(BUFFER_FILE, 'r') as f:
            return json.load(f)
    return []

def flush_buffer():
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
    print("=" * 50)

    print("Checking backend connection...")
    while not check_backend():
        print("Backend not ready — retrying in 10 seconds...")
        time.sleep(10)

    print("Backend connected!")

    # Load initial PLC config from backend
    fetch_plc_config()
    print(f"PLC Type   : {current_config.get('plc_type', 'simulation')}")

    flush_buffer()
    print("Starting sensor readings...\n")

    config_check_counter = 0
    CONFIG_CHECK_INTERVAL = 3  # Check config every 3 readings (30 seconds)

    while True:
        try:
            # Periodically check for config changes
            config_check_counter += 1
            if config_check_counter >= CONFIG_CHECK_INTERVAL:
                config_check_counter = 0
                fetch_plc_config()

            # Read sensors using current config
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