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

class DowntimeEventDB(Base):
    __tablename__ = "downtime_events"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, index=True)
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Float, nullable=True)
    cause = Column(String, nullable=True)
    health_at_start = Column(Float, nullable=True)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class MachineDB(Base):
    __tablename__ = "machines"

    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String, unique=True, index=True)
    name = Column(String)
    location = Column(String, nullable=True)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, nullable=True)
    overall_health = Column(Float, nullable=True)
    status = Column(String, default="unknown")

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


def cleanup_old_data(days_to_keep: int = 90):
    """
    Delete readings and alerts older than N days
    Runs automatically to prevent database from growing too large
    """
    from datetime import timedelta
    
    db = SessionLocal()
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
        
        # Delete old readings
        old_readings = db.query(SensorReadingDB)\
            .filter(SensorReadingDB.created_at < cutoff_date)\
            .count()
        
        db.query(SensorReadingDB)\
            .filter(SensorReadingDB.created_at < cutoff_date)\
            .delete()

        # Delete old alerts
        old_alerts = db.query(AlertDB)\
            .filter(AlertDB.created_at < cutoff_date)\
            .count()
        
        db.query(AlertDB)\
            .filter(AlertDB.created_at < cutoff_date)\
            .delete()

        # Delete old resolved downtime events
        old_downtime = db.query(DowntimeEventDB)\
            .filter(
                DowntimeEventDB.created_at < cutoff_date,
                DowntimeEventDB.resolved == True
            ).count()

        db.query(DowntimeEventDB)\
            .filter(
                DowntimeEventDB.created_at < cutoff_date,
                DowntimeEventDB.resolved == True
            ).delete()

        db.commit()

        print(f"Database cleanup complete:")
        print(f"  Deleted {old_readings} old readings")
        print(f"  Deleted {old_alerts} old alerts")
        print(f"  Deleted {old_downtime} old downtime events")

        return {
            "deleted_readings": old_readings,
            "deleted_alerts": old_alerts,
            "deleted_downtime": old_downtime,
            "cutoff_date": cutoff_date.isoformat()
        }
    except Exception as e:
        db.rollback()
        print(f"Cleanup failed: {e}")
        raise e
    finally:
        db.close()