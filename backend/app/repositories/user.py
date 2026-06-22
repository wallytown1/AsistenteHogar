import uuid

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import Hogar, RegistroBorrado, Usuario
from app.repositories.exceptions import DatabaseIntegrityError


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_email(self, email: str) -> Usuario | None:
        """Busca un usuario activo por su email (case-insensitive).
        Carga eager la relación hogar (requerido en contexto asíncrono)."""
        stmt = (
            select(Usuario)
            .where(Usuario.email == email.lower().strip(), Usuario.is_active == True)
            .options(selectinload(Usuario.hogar))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_id(self, usuario_id: uuid.UUID) -> Usuario | None:
        """Busca un usuario activo por su ID.
        Carga eager la relación hogar (requerido en contexto asíncrono)."""
        stmt = (
            select(Usuario)
            .where(Usuario.id == usuario_id, Usuario.is_active == True)
            .options(selectinload(Usuario.hogar))
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_with_hogar(
        self, nombre_hogar: str, nombre: str, email: str, hashed_password: str
    ) -> tuple[Usuario, Hogar]:
        """Crea atómicamente un nuevo Hogar y su primer Usuario.
        El commit es único: o se crean ambos o ninguno."""
        hogar = Hogar(nombre=nombre_hogar)
        usuario = Usuario(
            hogar=hogar,
            email=email.lower().strip(),
            nombre=nombre,
            hashed_password=hashed_password,
            is_active=True,
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
        except IntegrityError as e:
            await self.session.rollback()
            raise DatabaseIntegrityError(
                "El email indicado ya está registrado en otro hogar."
            ) from e
        except Exception:
            await self.session.rollback()
            raise
        return usuario, hogar

    async def delete_hogar_fisico(self, hogar_id: uuid.UUID) -> int:
        """Destrucción FÍSICA y definitiva del hogar y todos sus datos vinculados
        (usuarios, inventario, historial, perfiles y lista de compra, incluidos los soft-deleted).

        RGPD art. 17 + requisito de eliminación de cuenta de App Store/Google Play.
        Se borra vía ORM (cascade="all, delete-orphan") y no con DELETE directo:
        SQLite no aplica ON DELETE CASCADE sin PRAGMA foreign_keys, y el cascade
        en Python funciona igual en ambos motores. Borrado + auditoría agregada
        (sin datos personales) se confirman en una única transacción."""
        stmt = (
            select(Hogar)
            .where(Hogar.id == hogar_id)
            .options(
                selectinload(Hogar.usuarios),
                selectinload(Hogar.alimentos),
            )
        )
        result = await self.session.execute(stmt)
        hogar = result.scalar_one_or_none()
        if hogar is None:
            return 0

        afectados = 1 + len(hogar.usuarios) + len(hogar.alimentos)
        try:
            await self.session.delete(hogar)
            self.session.add(
                RegistroBorrado(
                    tipo_evento="eliminacion_cuenta",
                    motivo="solicitud_usuario",
                    registros_afectados=afectados,
                )
            )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise
        return afectados
