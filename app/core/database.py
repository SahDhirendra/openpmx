from sqlalchemy import create_engine, Column, Float, String, Boolean, DateTime, Integer
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime
import os

# Database file location
DB_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "openpmx.db")
DB_PATH = os.path.abspath(DB_PATH)

# Create engine
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})

# Base class for models
Base = declarative_base()

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# --- Database Models ---

class SensorReadingDB(Base):
    __tablename__ = "readings"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    bearing1_rms = Column(Float)
    bearing2_rms = Column(Float)
    bearing3_rms = Column(Float)
    bearing4_rms = Column(Float)
    bearing1_health = Column(Float)
    bearing2_health = Column(Float)
    bearing3_health = Column(Float)
    bearing4_health = Column(Float)
    overall_health = Column(Float)
    alert = Column(Boolean, default=False)
    message = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

class AlertDB(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    overall_health = Column(Float)
    message = Column(String)
    bearing_affected = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

def init_db():
    """Create all tables if they don't exist"""
    Base.metadata.create_all(bind=engine)
    print(f"Database initialized at: {DB_PATH}")

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()