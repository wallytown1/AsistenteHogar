import logging
import uuid
from datetime import UTC, datetime, timedelta

from app.repositories.historial import RecetaHistorialRepository
from app.repositories.memoria import MemoriaGustosRepository
from app.repositories.movimientos import MovimientoDespensaRepository
from app.repositories.perfil import PerfilHogarRepository
from app.repositories.perfiles_individual import PerfilIndividualRepository
from app.schemas.schemas import (
    MemoriaGustosResponse,
    PerfilHogarResponse,
    PerfilIndividualResponse,
    RecetaHistorialResponse,
)
from app.services.llm import distill_taste_memory

logger = logging.getLogger("app.memoria")


class MemoriaService:
    """Gestiona la memoria de gustos destilada del hogar: la lee (rápido, para inyectar
    en los prompts) y la recalcula cuando está obsoleta (al recibir nuevo feedback)."""

    UMBRAL_EVENTOS_NUEVOS = 5
    DIAS_FRESCURA = 7
    LIMITE_HISTORIAL_DISTILACION = 30

    def __init__(
        self,
        memoria_repo: MemoriaGustosRepository,
        perfil_repo: PerfilHogarRepository,
        perfiles_repo: PerfilIndividualRepository,
        historial_repo: RecetaHistorialRepository,
        movimientos_repo: MovimientoDespensaRepository | None = None,
    ) -> None:
        self.memoria_repo = memoria_repo
        self.perfil_repo = perfil_repo
        self.perfiles_repo = perfiles_repo
        self.historial_repo = historial_repo
        self.movimientos_repo = movimientos_repo

    async def obtener(self, hogar_id: uuid.UUID) -> MemoriaGustosResponse | None:
        """Lee la memoria del hogar (para inyectar en sugerencias/plan/chat). Rápido."""
        memoria = await self.memoria_repo.get_by_hogar(hogar_id)
        return MemoriaGustosResponse.model_validate(memoria) if memoria else None

    async def refrescar_si_obsoleta(self, hogar_id: uuid.UUID) -> None:
        """Recalcula la memoria si hay señales nuevas sin destilar. Best-effort: cualquier
        fallo (sin API key, error de Gemini) se ignora y no rompe el flujo que lo invoca."""
        try:
            memoria = await self.memoria_repo.get_by_hogar(hogar_id)
            total = await self.historial_repo.contar(hogar_id)
            if not self._obsoleta(memoria, total):
                return

            perfil_orm = await self.perfil_repo.get_by_hogar(hogar_id)
            perfil = (
                PerfilHogarResponse.model_validate(perfil_orm) if perfil_orm else None
            )
            perfiles_orm = await self.perfiles_repo.list_by_hogar(hogar_id)
            perfiles = [
                PerfilIndividualResponse.model_validate(p) for p in perfiles_orm
            ] or None
            historial_orm = await self.historial_repo.get_recientes(
                hogar_id, limit=self.LIMITE_HISTORIAL_DISTILACION
            )
            historial = [
                RecetaHistorialResponse.model_validate(h) for h in historial_orm
            ] or None

            habitos = None
            consumo = None
            if self.movimientos_repo is not None:
                habitos = await self.movimientos_repo.habitos_compra(hogar_id) or None
                consumo = await self.movimientos_repo.ritmo_consumo(hogar_id) or None

            resumen = await distill_taste_memory(
                perfil, perfiles, historial, habitos, consumo
            )
            if resumen:
                await self.memoria_repo.upsert(hogar_id, resumen, total)
        except Exception as e:  # — best-effort, no debe romper el caller
            logger.warning(f"No se pudo refrescar la memoria de gustos: {e}")

    def _obsoleta(self, memoria: object | None, total_eventos: int) -> bool:
        if memoria is None or not getattr(memoria, "resumen", "").strip():
            # Solo merece destilar si hay algún dato de comportamiento.
            return total_eventos > 0
        eventos_fuente = getattr(memoria, "eventos_fuente", 0)
        if (total_eventos - eventos_fuente) >= self.UMBRAL_EVENTOS_NUEVOS:
            return True
        umbral = datetime.now(UTC) - timedelta(days=self.DIAS_FRESCURA)
        updated_at = getattr(memoria, "updated_at", None)
        if updated_at is not None and updated_at < umbral:
            return True
        return False
