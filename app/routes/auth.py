"""
OpenPMX Authentication Routes
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db, UserDB
from app.core.auth import (
    verify_password, get_password_hash,
    create_access_token, get_current_user,
    get_admin_user
)
from app.core.logger import logger

router = APIRouter(prefix="/auth", tags=["auth"])

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: str = "viewer"

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

@router.post("/login")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Login and get JWT token"""
    user = db.query(UserDB).filter(
        UserDB.username == form_data.username,
        UserDB.is_active == True
    ).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        logger.warning(f"Failed login attempt for username: {form_data.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()

    access_token = create_access_token(
        data={"sub": user.username, "role": user.role}
    )

    logger.info(f"User logged in: {user.username} (role: {user.role})")

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role,
        "email": user.email
    }

@router.get("/me")
async def get_me(current_user = Depends(get_current_user)):
    """Get current user info"""
    return {
        "username": current_user.username,
        "email": current_user.email,
        "role": current_user.role,
        "last_login": current_user.last_login
    }

@router.post("/change-password")
async def change_password(
    data: PasswordChange,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change password"""
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    logger.info(f"Password changed for user: {current_user.username}")
    return {"status": "password changed successfully"}

@router.get("/users")
async def get_users(
    current_user = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Get all users — admin only"""
    users = db.query(UserDB).all()
    return {
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "role": u.role,
                "is_active": u.is_active,
                "last_login": u.last_login.isoformat() if u.last_login else None
            }
            for u in users
        ]
    }

@router.post("/users")
async def create_user(
    user_data: UserCreate,
    current_user = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Create new user — admin only"""
    existing = db.query(UserDB).filter(
        UserDB.username == user_data.username
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = UserDB(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        role=user_data.role
    )
    db.add(new_user)
    db.commit()
    logger.info(f"New user created: {user_data.username} (role: {user_data.role})")
    return {"status": "created", "username": user_data.username}

@router.delete("/users/{username}")
async def delete_user(
    username: str,
    current_user = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    """Deactivate user — admin only"""
    if username == current_user.username:
        raise HTTPException(status_code=400, detail="Cannot deactivate yourself")

    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_active = False
    db.commit()
    return {"status": "deactivated", "username": username}