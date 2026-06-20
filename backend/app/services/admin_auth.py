import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app import core
from app.models.models import AdminUser
from app.repositories.admin_user import AdminUserRepository


class AdminAuthService:
    def __init__(self, repo: AdminUserRepository) -> None:
        self._repo = repo

    def _verify_password(self, plain: str, hashed: str) -> bool:
        return bcrypt.checkpw(plain.encode(), hashed.encode())

    def _hash_password(self, plain: str) -> str:
        return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

    async def authenticate(self, email: str, password: str) -> AdminUser | None:
        admin = await self._repo.get_by_email(email)
        if admin is None or not admin.is_active:
            return None
        if not self._verify_password(password, admin.hashed_password):
            return None
        return admin

    async def create_admin(self, email: str, password: str, nombre: str) -> AdminUser:
        hashed = self._hash_password(password)
        return await self._repo.create(
            email=email, hashed_password=hashed, nombre=nombre
        )

    def create_admin_token(self, admin: AdminUser) -> str:
        secret = core.config.ADMIN_JWT_SECRET_KEY
        if not secret:
            raise RuntimeError("ADMIN_JWT_SECRET_KEY no configurada")
        expire = datetime.now(UTC) + timedelta(
            minutes=core.config.ADMIN_JWT_EXPIRE_MINUTES
        )
        payload = {
            "sub": str(admin.id),
            "email": admin.email,
            "role": "admin",
            "jti": uuid.uuid4().hex,
            "exp": expire,
        }
        return jwt.encode(payload, secret, algorithm=core.config.JWT_ALGORITHM)
