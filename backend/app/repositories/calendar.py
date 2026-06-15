import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from sqlalchemy import CursorResult, delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import EventoCalendario
from app.repositories.exceptions import DatabaseIntegrityError, EventoNotFoundError
from app.schemas.schemas import EventoCalendarioCreate, EventoCalendarioUpdate


class CalendarRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(
        self, evento_id: uuid.UUID, hogar_id: uuid.UUID, lock: bool = False
    ) -> EventoCalendario:
        """Obtiene un evento de calendario por su ID y Hogar ID.
        Permite aplicar row-level locking (FOR UPDATE) para prevenir condiciones de carrera."""
        stmt = select(EventoCalendario).where(
            EventoCalendario.id == evento_id,
            EventoCalendario.hogar_id == hogar_id,
            EventoCalendario.is_deleted == False,
        )
        if lock:
            stmt = stmt.with_for_update()

        result = await self.session.execute(stmt)
        evento = result.scalar_one_or_none()
        if not evento:
            raise EventoNotFoundError(str(evento_id), str(hogar_id))
        return evento

    async def get_all(self, hogar_id: uuid.UUID) -> list[EventoCalendario]:
        """Obtiene todos los eventos activos de calendario para un hogar específico."""
        stmt = (
            select(EventoCalendario)
            .where(
                EventoCalendario.hogar_id == hogar_id,
                EventoCalendario.is_deleted == False,
            )
            .order_by(EventoCalendario.fecha_inicio.asc())
        )

        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def check_overlap(
        self,
        hogar_id: uuid.UUID,
        fecha_inicio: datetime,
        fecha_fin: datetime,
        exclude_id: uuid.UUID | None = None,
    ) -> EventoCalendario | None:
        """Verifica si existe algún evento activo en el mismo hogar que se solape con el rango de fechas indicado.
        Aplica bloqueo de fila sobre los registros leídos para prevenir condiciones de carrera en inserciones paralelas."""
        # Se solapan si: inicio_A < fin_B AND fin_A > inicio_B
        stmt = select(EventoCalendario).where(
            EventoCalendario.hogar_id == hogar_id,
            EventoCalendario.is_deleted == False,
            EventoCalendario.fecha_inicio < fecha_fin,
            EventoCalendario.fecha_fin > fecha_inicio,
        )
        if exclude_id:
            stmt = stmt.where(EventoCalendario.id != exclude_id)

        stmt = stmt.with_for_update()  # Prevenir inserción concurrente de solapamiento
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def create(
        self, hogar_id: uuid.UUID, schema: EventoCalendarioCreate
    ) -> EventoCalendario:
        """Crea un nuevo evento en el calendario familiar."""
        db_evento = EventoCalendario(
            hogar_id=hogar_id,
            titulo=schema.titulo,
            descripcion=schema.descripcion,
            fecha_inicio=schema.fecha_inicio,
            fecha_fin=schema.fecha_fin,
            participantes=schema.participantes,
            is_deleted=False,
        )
        self.session.add(db_evento)
        try:
            await self.session.commit()
            await self.session.refresh(db_evento)
        except IntegrityError as e:
            await self.session.rollback()
            raise DatabaseIntegrityError(str(e.orig)) from e
        return db_evento

    async def update(
        self, evento_id: uuid.UUID, hogar_id: uuid.UUID, schema: EventoCalendarioUpdate
    ) -> EventoCalendario:
        """Actualiza un evento existente aplicando row-level locking."""
        db_evento = await self.get_by_id(evento_id, hogar_id, lock=True)

        update_data = schema.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_evento, key, value)

        try:
            await self.session.commit()
            await self.session.refresh(db_evento)
        except IntegrityError as e:
            await self.session.rollback()
            raise DatabaseIntegrityError(str(e.orig)) from e
        return db_evento

    async def delete(
        self, evento_id: uuid.UUID, hogar_id: uuid.UUID
    ) -> EventoCalendario:
        """Elimina de forma lógica un evento de calendario."""
        db_evento = await self.get_by_id(evento_id, hogar_id, lock=True)
        db_evento.is_deleted = True

        try:
            await self.session.commit()
            await self.session.refresh(db_evento)
        except IntegrityError as e:
            await self.session.rollback()
            raise DatabaseIntegrityError(str(e.orig)) from e
        return db_evento

    async def purge_expired(self, retention_days: int = 30) -> int:
        """Borrado FÍSICO de eventos con is_deleted=true más antiguos que el plazo
        de retención (RGPD art. 5.1.e). Operación de mantenimiento cross-tenant:
        única excepción autorizada al hogar_id obligatorio y al soft delete
        (ver 01_CONTEXTO_Y_ARQUITECTURA_APP.md §3.3). Sin commit: lo agrupa el
        PurgeService en una transacción única."""
        cutoff = datetime.now(UTC) - timedelta(days=retention_days)
        stmt = delete(EventoCalendario).where(
            EventoCalendario.is_deleted == True, EventoCalendario.updated_at < cutoff
        )
        result = await self.session.execute(stmt)
        return cast("CursorResult[Any]", result).rowcount or 0
