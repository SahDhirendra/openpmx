@echo off
cd /d E:\Github_Projects\openpmx
call venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
