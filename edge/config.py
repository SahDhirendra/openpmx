# OpenPMX Edge Agent Configuration
# Edit these settings for your factory setup

# Backend API URL
# Change this to your server's IP when deploying to factory
API_URL = "http://localhost:8000"

# Machine identification
MACHINE_ID = "machine_001"

# How often to read sensors (seconds)
READ_INTERVAL = 10

# PLC Configuration (for Step 5)
PLC_IP = "192.168.1.10"  # Your PLC's IP address
PLC_TYPE = "allen_bradley"  # allen_bradley, siemens, modbus

# Tag names to read from PLC (Allen-Bradley format)
PLC_TAGS = {
    "bearing1_rms": "Program:MainProgram.Bearing1_RMS",
    "bearing2_rms": "Program:MainProgram.Bearing2_RMS",
    "bearing3_rms": "Program:MainProgram.Bearing3_RMS",
    "bearing4_rms": "Program:MainProgram.Bearing4_RMS",
}

# Local buffer file — stores readings if network is down
BUFFER_FILE = "buffer.json"

# Number of readings to keep in buffer
BUFFER_MAX = 1000