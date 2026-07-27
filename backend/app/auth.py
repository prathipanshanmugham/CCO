import os
from datetime import datetime, timedelta, timezone
from typing import Callable

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


security = HTTPBearer(auto_error=False)
ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user: dict) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    payload = {
        "sub": user["id"],
        "role": user["role"],
        "email": user["email"],
        "exp": expires_at,
        "type": "access",
    }
    return jwt.encode(payload, os.environ.get("JWT_SECRET", "development-only-change-me"), algorithm=ALGORITHM)


def read_token(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> dict:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in is required")
    try:
        payload = jwt.decode(
            credentials.credentials,
            os.environ.get("JWT_SECRET", "development-only-change-me"),
            algorithms=[ALGORITHM],
        )
    except jwt.PyJWTError as error:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Your session is invalid or expired") from error
    if payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session token")
    return payload


def require_roles(*roles: str) -> Callable:
    def role_check(token: dict = Depends(read_token)) -> dict:
        if token.get("role") not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not have permission for this action")
        return token

    return role_check


def request_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"