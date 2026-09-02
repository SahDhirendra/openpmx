from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.health import router
from app.core.database import init_db, cleanup_old_data
from app.core.logger import logger
from app.core.predictor import predictor
from app.core.config import config, MACHINE_ID, RETENTION_DAYS

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("=" * 50)
    logger.info("OpenPMX Starting...")
    logger.info(f"Machine: {config['machine']['name']} ({MACHINE_ID})")
    logger.info(f"Location: {config['machine']['location']}")
    logger.info("=" * 50)
    
    init_db()
    logger.info("OpenPMX backend started successfully!")
    logger.info(f"Model trained: {predictor.is_trained}")

    # Run database cleanup on startup
    try:
        result = cleanup_old_data(days_to_keep=RETENTION_DAYS)
        logger.info(f"Database cleanup: {result}")
    except Exception as e:
        logger.error(f"Database cleanup failed: {e}")

    yield
    # Shutdown
    logger.info("OpenPMX backend shutting down")

# Create FastAPI app
app = FastAPI(
    title="OpenPMX",
    description="Open-source predictive maintenance platform for manufacturing",
    version="0.1.0",
    lifespan=lifespan
)

# Allow React dashboard to talk to the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://192.168.1.3:5173",
        "https://openpmx-frontend.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)