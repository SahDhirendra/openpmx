"""
OpenPMX Build Script
Bundles the backend into a standalone executable
"""

import subprocess
import os
import shutil
import json

VERSION = "1.0.0"

print("=" * 50)
print(f"Building OpenPMX v{VERSION}")
print("=" * 50)

# Step 1 — Build React frontend
print("\n[1/4] Building React frontend...")
os.chdir("dashboard")
subprocess.run(["npm", "run", "build"], check=True, shell=True)
os.chdir("..")
print("Frontend built successfully!")

# Step 2 — Bundle Python backend with PyInstaller
print("\n[2/4] Bundling Python backend...")
subprocess.run([
    "pyinstaller",
    "--onefile",
    "--name", "openpmx-backend",
    "--add-data", "app;app",
    "--add-data", "config.yaml;.",
    "--hidden-import", "uvicorn.logging",
    "--hidden-import", "uvicorn.loops",
    "--hidden-import", "uvicorn.loops.auto",
    "--hidden-import", "uvicorn.protocols",
    "--hidden-import", "uvicorn.protocols.http",
    "--hidden-import", "uvicorn.protocols.http.auto",
    "--hidden-import", "uvicorn.protocols.websockets",
    "--hidden-import", "uvicorn.protocols.websockets.auto",
    "--hidden-import", "uvicorn.lifespan",
    "--hidden-import", "uvicorn.lifespan.on",
    "--hidden-import", "sqlalchemy.dialects.sqlite",
    "--hidden-import", "sklearn.tree._utils",
    "--hidden-import", "sklearn.neighbors._typedefs",
    "--hidden-import", "sklearn.utils._cython_blas",
    "--hidden-import", "sklearn.utils._weight_vector",
    "--hidden-import", "email_validator",
    "--hidden-import", "aiosmtplib",
    "--collect-all", "fastapi_mail",
    "--collect-all", "sklearn",
    "--noconfirm",
    "run.py"
], check=True, shell=True)
print("Backend bundled successfully!")

# Step 3 — Copy frontend build to dist
print("\n[3/4] Copying frontend files...")
frontend_src = os.path.join("dashboard", "dist")
frontend_dst = os.path.join("dist", "frontend")
if os.path.exists(frontend_dst):
    shutil.rmtree(frontend_dst)
shutil.copytree(frontend_src, frontend_dst)
print("Frontend files copied!")

# Step 4 — Copy config and data folder
print("\n[4/4] Copying config files...")
shutil.copy("config.yaml", "dist/config.yaml")
os.makedirs("dist/data", exist_ok=True)
os.makedirs("dist/logs", exist_ok=True)
print("Config files copied!")

print("\n" + "=" * 50)
print(f"Build complete! Output in: dist/")
print(f"Files:")
print(f"  dist/openpmx-backend.exe")
print(f"  dist/frontend/")
print(f"  dist/config.yaml")
print("=" * 50)