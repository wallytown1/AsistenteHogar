import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import AdminUser


class AdminUserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_email(self, email: str) -> AdminUser | None:
        result = await self._session.execute(
            select(AdminUser).where(AdminUser.email == email)
        )
        return result.scalar_one_or_none()

    async def get_by_id(self, admin_id: uuid.UUID) -> AdminUser | None:
        result = await self._session.execute(
            select(AdminUser).where(AdminUser.id == admin_id)
        )
        return result.scalar_one_or_none()

    async def create(self, email: str, hashed_password: str, nombre: str) -> AdminUser:
        admin = AdminUser(email=email, hashed_password=hashed_password, nombre=nombre)
        self._session.add(admin)
        await self._session.flush()
        await self._session.refresh(admin)
        return admin

    async def count(self) -> int:
        result = await self._session.execute(select(func.count(AdminUser.id)))
        return result.scalar_one()
