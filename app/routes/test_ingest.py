import requests

readings = [
    {'machine_id': 'machine_001', 'timestamp': '2026-01-15T06:00:00', 'bearing1_rms': 0.13, 'bearing2_rms': 0.13, 'bearing3_rms': 0.13, 'bearing4_rms': 0.12},
    {'machine_id': 'machine_001', 'timestamp': '2026-01-15T07:00:00', 'bearing1_rms': 0.14, 'bearing2_rms': 0.14, 'bearing3_rms': 0.15, 'bearing4_rms': 0.13},
    {'machine_id': 'machine_001', 'timestamp': '2026-01-15T08:00:00', 'bearing1_rms': 0.16, 'bearing2_rms': 0.15, 'bearing3_rms': 0.25, 'bearing4_rms': 0.18},
    {'machine_id': 'machine_001', 'timestamp': '2026-01-15T08:30:00', 'bearing1_rms': 0.172, 'bearing2_rms': 0.165, 'bearing3_rms': 0.5936, 'bearing4_rms': 0.210},
]

for r in readings:
    response = requests.post('http://127.0.0.1:8000/ingest', json=r)
    print("Status:", response.status_code)
    print("Response:", response.json())
    print("---")