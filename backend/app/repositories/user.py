import uuid
from typing import Optional, Tuple
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.models import Hogar, Usuario
from app.repositories.exceptions import DatabaseIntegrityError


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_email(self, email: str) -> Optional[Usuario]:
        """Busca un usuario activo por su email (case-insensitive).
        Carga eager la relación hogar (requerido en contexto asíncrono)."""
        stmt = select(Usuario).where(
            Usuario.email == email.lower().strip(),
            Usuario.is_active == True
        ).options(selectinload(Usuario.hogar))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, usuario_id: uuid.UUID) -> Optional[Usuario]:
        """Busca un usuario activo por su ID.
        Carga eager la relación hogar (requerido en contexto asíncrono)."""
        stmt = select(Usuario).where(
            Usuario.id == usuario_id,
            Usuario.is_active == True
        ).options(selectinload(Usuario.hogar))
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_with_hogar(
        self,
        nombre_hogar: str,
        nombre: str,
        email: str,
        hashed_password: str
    ) -> Tuple[Usuario, Hogar]:
        """Crea atómicamente un nuevo Hogar y su primer Usuario.
        El commit es único: o se crean ambos o ninguno."""
        hogar = Hogar(nombre=nombre_hogar)
        usuario = Usuario(
            hogar=hogar,
            email=email.lower().strip(),
            nombre=nombre,
            hashed_password=hashed_password,
            is_active=True
        )
        self.session.add(hogar)
        self.session.add(usuario)
        try:
            await self.session.commit()
            # Orden importante: refrescar hogar primero. Su relación 'usuarios' tiene
            # cascade="all" (incluye refresh-expire) y expiraría al usuario si se
            # refrescara después, provocando un lazy load síncrono (MissingGreenlet).
            await self.session.refresh(hogar)
            await self.session.refresh(usuario)
        except IntegrityError:
            await self.session.rollback()
            raise DatabaseIntegrityError("El email indicado ya está registrado en otro hogar.")
        return usuario, hogar
