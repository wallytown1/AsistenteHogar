import uuid

from app.repositories.historial import RecetaHistorialRepository
from app.schemas.schemas import RecetaHistorialCreate, RecetaHistorialResponse
from app.services.memoria import MemoriaService


class RecetaHistorialService:
    def __init__(
        self,
        repo: RecetaHistorialRepository,
        memoria_service: MemoriaService | None = None,
    ):
        self.repo = repo
        self.memoria_service = memoria_service

    async def registrar_accion(
        self, hogar_id: uuid.UUID, schema: RecetaHistorialCreate
    ) -> RecetaHistorialResponse:
        entrada = await self.repo.registrar(hogar_id, schema)
        # El feedback del hogar es la señal de aprendizaje: refresca la memoria de
        # gustos cuando esté obsoleta (best-effort; no rompe si Gemini no está).
        if self.memoria_service is not None:
            await self.memoria_service.refrescar_si_obsoleta(hogar_id)
        return RecetaHistorialResponse.model_validate(entrada)

    async def get_historial(
        self, hogar_id: uuid.UUID, limit: int = 20
    ) -> list[RecetaHistorialResponse]:
        entradas = await self.repo.get_recientes(hogar_id, limit)
        return [RecetaHistorialResponse.model_validate(e) for e in entradas]
