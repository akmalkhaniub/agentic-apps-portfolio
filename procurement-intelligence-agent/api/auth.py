"""
JWT Authentication — Issues and validates JWT tokens with tier claims.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
import bcrypt

from api.schemas import TokenPayload
from guardrails.tiers import TierType

logger = structlog.get_logger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "CHANGE_ME_IN_PRODUCTION")
ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

# ── Demo user store (replace with RDS lookup in production) ──────────────────
# Format: username → {"hashed_password": ..., "tier": ...}
DEMO_USERS: dict[str, dict] = {
    "analyst": {
        "hashed_password": hash_password("analyst123"),
        "tier": "INTERNAL",
    },
    "partner_user": {
        "hashed_password": hash_password("partner123"),
        "tier": "PARTNER",
    },
    "guest": {
        "hashed_password": hash_password("guest123"),
        "tier": "PUBLIC",
    },
}


# ── Token functions ───────────────────────────────────────────────────────────

def create_access_token(user_id: str, tier: TierType) -> str:
    """Create a signed JWT with user_id and tier claims."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": user_id,
        "tier": tier,
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def authenticate_user(username: str, password: str) -> dict | None:
    user = DEMO_USERS.get(username)
    if not user:
        return None
    if not verify_password(password, user["hashed_password"]):
        return None
    return {"username": username, **user}


# ── FastAPI dependency ────────────────────────────────────────────────────────

async def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenPayload:
    """FastAPI dependency — validates JWT and returns decoded payload."""
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub", "")
        tier: str = payload.get("tier", "PUBLIC")
        exp: int = payload.get("exp", 0)

        if not user_id:
            raise credentials_exc

        return TokenPayload(sub=user_id, tier=tier, exp=exp)  # type: ignore[arg-type]

    except JWTError as exc:
        logger.warning("auth.jwt_error", error=str(exc))
        raise credentials_exc
