import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.core.config import ACCESS_TOKEN_EXPIRE_MINUTES, JWT_ALGORITHM, JWT_SECRET_KEY


def hash_password(password: str) -> str:
    """Genera el hash bcrypt de una contraseña en texto plano."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """Compara una contraseña en texto plano contra su hash bcrypt almacenado."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except ValueError:
        # Hash corrupto o con formato inválido: nunca autenticar
        return False


def create_access_token(usuario_id: uuid.UUID, hogar_id: uuid.UUID) -> str:
    """Crea un token JWT firmado con el usuario y su hogar como claims."""
    now = datetime.now(UTC)
    payload = {
        "sub": str(usuario_id),
        "hogar_id": str(hogar_id),
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    token: str = jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return token


def decode_access_token(token: str) -> dict[str, Any]:
    """Decodifica y valida un token JWT. Lanza jwt.PyJWTError si es inválido o expiró."""
    payload: dict[str, Any] = jwt.decode(
        token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM]
    )
    return payload
