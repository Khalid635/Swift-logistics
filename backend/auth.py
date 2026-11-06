import logging
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

import models
from database import get_db

logger = logging.getLogger(__name__)

# The signing key must come from the environment. There is deliberately no
# public fallback: a deploy that forgets SECRET_KEY must fail loudly instead
# of issuing tokens anyone who read this repo can forge. For local-only
# development, set ALLOW_INSECURE_DEV_KEY=1 to use an insecure built-in key
# (never set it on a server).
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if os.getenv("ALLOW_INSECURE_DEV_KEY") == "1":
        SECRET_KEY = "local-dev-key-not-for-live"
        logger.warning(
            "SECRET_KEY is not set; using an insecure local dev key. "
            "Never set ALLOW_INSECURE_DEV_KEY=1 on a server."
        )
    else:
        raise RuntimeError(
            "SECRET_KEY environment variable is not set. Set it to a long "
            "random value (and, for local development only, "
            "ALLOW_INSECURE_DEV_KEY=1 to use an insecure built-in key)."
        )

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain_password, hashed_password):
    # Hashes created by passlib (the old auth stack) are standard bcrypt
    # hashes, so existing users keep working after this swap.
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def get_password_hash(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise credentials_exception
    return user


def get_current_active_user(
    current_user: models.User = Depends(get_current_user),
):
    return current_user
