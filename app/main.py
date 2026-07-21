from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.health import router
from app.core.database import init_db

# Create FastAPI app
app = FastAPI(
    title="OpenPMX",
    description="Open-source predictive maintenance platform for manufacturing",
    version="0.1.0"
)

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    init_db()
    print("OpenPMX started successfully!")

# Allow React dashboard to talk to the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://openpmx-frontend.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)