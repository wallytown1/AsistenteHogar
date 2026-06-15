"""Purga física programada (RGPD art. 5.1.e — limitación del plazo de conservación).

Elimina definitivamente las filas con is_deleted=true cuya última modificación
supera el plazo de retención, y deja constancia agregada (sin datos personales)
en registros_borrado. Es, junto a la eliminación de cuenta, el único camino
autorizado de borrado físico (01_CONTEXTO_Y_ARQUITECTURA_APP.md §3.3).

Ejecución manual/CLI:  python -m app.jobs.purge
Ejecución programada:  tarea asyncio lanzada desde el lifespan de FastAPI (24 h).
"""
import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import RegistroBorrado
from app.repositories.calendar import CalendarRepository
from app.repositories.pantry import PantryRepository
from app.repositories.task import TaskRepository

logger = logging.getLogger("app.jobs.purge")

RETENTION_DAYS = 30
PURGE_INTERVAL_SECONDS = 24 * 60 * 60  # una pasada diaria


class PurgeService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.pantry_repo = PantryRepository(session)
        self.task_repo = TaskRepository(session)
        self.calendar_repo = CalendarRepository(session)

    async def run(self, retention_days: int = RETENTION_DAYS) -> int:
        """Purga las tres tablas de negocio en una única transacción y registra
        la evidencia agregada. Devuelve el total de filas eliminadas."""
        try:
            total = (
                await self.pantry_repo.purge_expired(retention_days)
                + await self.task_repo.purge_expired(retention_days)
                + await self.calendar_repo.purge_expired(retention_days)
            )
            if total > 0:
                # Auditoría sin datos personales: solo tipo, motivo y recuento
                self.session.add(
                    RegistroBorrado(
                        tipo_evento="purga_programada",
                        motivo=f"retencion_{retention_days}_dias",
                        registros_afectados=total,
                    )
                )
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            raise

        if total > 0:
            logger.info(
                f"Purga física completada: {total} registro(s) eliminados definitivamente."
            )
        else:
            logger.info(
                "Purga física completada: ningún registro superaba el plazo de retención."
            )
        return total


async def run_purge_once(retention_days: int = RETENTION_DAYS) -> int:
    """Abre su propia sesión y ejecuta una pasada de purga (CLI y scheduler)."""
    # Import diferido: app.database aborta el proceso si falta DATABASE_URL,
    # y este módulo se importa también desde main.py durante el arranque.
    from app.database import async_session_maker

    async with async_session_maker() as session:
        return await PurgeService(session).run(retention_days)


async def purge_scheduler() -> None:
    """Bucle infinito para el lifespan de FastAPI: una pasada al arrancar y
    luego cada 24 h. Los errores se registran y no tumban el scheduler."""
    while True:
        try:
            await run_purge_once()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"Error durante la purga programada: {e}")
        await asyncio.sleep(PURGE_INTERVAL_SECONDS)


if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()
    total = asyncio.run(run_purge_once())
    print(f"Purga finalizada: {total} registro(s) eliminados.")
