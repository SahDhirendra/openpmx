from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.health import router

# Create FastAPI app
app = FastAPI(
    title="OpenPMX",
    description="Open-source predictive maintenance platform for manufacturing",
    version="0.1.0"
)

# Allow React dashboard to talk to the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)