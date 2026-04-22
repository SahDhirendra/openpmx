from fastapi import FastAPI
from app.routes.health import router

# Create FastAPI app
app = FastAPI(
    title="OpenPMX",
    description="Open-source predictive maintenance platform for manufacturing",
    version="0.1.0"
)

# Include routes
app.include_router(router)