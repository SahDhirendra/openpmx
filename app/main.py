from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.health import router
from app.core.database import init_db
from app.core.logger import logger
from app.core.predictor import predictor


from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    logger.info("OpenPMX backend started successfully!")
    logger.info(f"Model trained: {predictor.is_trained}")
    
    # Run database cleanup on startup
    try:
        from app.core.database import cleanup_old_data
        result = cleanup_old_data(days_to_keep=90)
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
        "https://openpmx-frontend.onrender.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)