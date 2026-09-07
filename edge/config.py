# OpenPMX Edge Agent Configuration

# Backend API URL
API_URL = "http://192.168.1.3:8000"

# Machine identification
MACHINE_ID = "machine_001"

# How often to read sensors (seconds)
READ_INTERVAL = 10

# ─────────────────────────────────────────
# PLC Configuration
# ─────────────────────────────────────────
# PLC type: "simulation", "allen_bradley", "siemens", "modbus", "opcua"
PLC_TYPE = "simulation"

# PLC IP address
PLC_IP = "192.168.1.10"

# PLC slot (Allen-Bradley only)
PLC_SLOT = 0

# OPC-UA endpoint (OPC-UA only)
OPCUA_ENDPOINT = "opc.tcp://192.168.1.10:4840"

# Modbus port (Modbus TCP only)
MODBUS_PORT = 502

# Tag names to read from PLC
# Format depends on PLC type:
# Allen-Bradley: "Program:MainProgram.TagName"
# Siemens: "DB1.DBD0"
# Modbus: register number (integer)
# OPC-UA: "ns=2;s=TagName"
PLC_TAGS = {
    "bearing1_rms": "Program:MainProgram.Bearing1_RMS",
    "bearing2_rms": "Program:MainProgram.Bearing2_RMS",
    "bearing3_rms": "Program:MainProgram.Bearing3_RMS",
    "bearing4_rms": "Program:MainProgram.Bearing4_RMS",
}

# Local buffer
BUFFER_FILE = "buffer.json"
BUFFER_MAX = 1000