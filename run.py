"""
OpenPMX Entry Point
This file is used by PyInstaller to create the executable
"""

import uvicorn
import sys
import os

# Add the current directory to path
if getattr(sys, 'frozen', False):
    # Running as compiled executable
    base_dir = os.path.dirname(sys.executable)
else:
    # Running as script
    base_dir = os.path.dirname(os.path.abspath(__file__))

os.chdir(base_dir)

if __name__ == "__main__":
    print("Starting OpenPMX Backend...")
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )