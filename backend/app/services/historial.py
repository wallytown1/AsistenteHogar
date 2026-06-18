import uuid

from app.repositories.historial import RecetaHistorialRepository
from app.schemas.schemas import RecetaHistorialCreate, RecetaHistorialResponse


class RecetaHistorialService:
    def __init__(self, repo: RecetaHistorialRepository):
        self.repo = repo

    async def registrar_accion(
        self, hogar_id: uuid.UUID, schema: RecetaHistorialCreate
    ) -> RecetaHistorialResponse:
        entrada = await self.repo.registrar(hogar_id, schema)
        return RecetaHistorialResponse.model_validate(entrada)

    async def get_historial(
        self, hogar_id: uuid.UUID, limit: int = 20
    ) -> list[RecetaHistorialResponse]:
        entradas = await self.repo.get_recientes(hogar_id, limit)
        return [RecetaHistorialResponse.model_validate(e) for e in entradas]
