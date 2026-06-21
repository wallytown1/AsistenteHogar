import uuid
from datetime import UTC, datetime

from app.repositories.lista_compra import ListaCompraRepository
from app.repositories.movimientos import MovimientoDespensaRepository
from app.repositories.pantry import PantryRepository
from app.schemas.schemas import SugerenciaCompra


class ListaCompraService:
    """Lógica de la lista de la compra inteligente: a partir de la cadencia de compra
    del hogar (ledger de movimientos), sugiere lo que probablemente toca reponer."""

    MAX_SUGERENCIAS = 10

    def __init__(
        self,
        movimientos_repo: MovimientoDespensaRepository,
        pantry_repo: PantryRepository,
        lista_repo: ListaCompraRepository,
    ) -> None:
        self.movimientos_repo = movimientos_repo
        self.pantry_repo = pantry_repo
        self.lista_repo = lista_repo

    async def sugerencias(self, hogar_id: uuid.UUID) -> list[SugerenciaCompra]:
        """Sugiere alimentos a reponer: para cada alimento con ≥2 compras, si han pasado
        al menos sus días de cadencia media desde la última compra y NO está ya en la
        despensa ni en la lista, se sugiere. Sin IA (100% derivado del ledger)."""
        habitos = await self.movimientos_repo.habitos_compra(hogar_id)
        if not habitos:
            return []

        en_stock = {
            i.nombre.strip().lower() for i in await self.pantry_repo.get_all(hogar_id)
        }
        en_lista = {
            i.nombre.strip().lower()
            for i in await self.lista_repo.list_by_hogar(hogar_id)
        }

        ahora = datetime.now(UTC)
        sugerencias: list[SugerenciaCompra] = []
        for h in habitos:
            if h.intervalo_medio_dias is None or h.ultima_compra is None:
                continue
            if h.nombre in en_stock or h.nombre in en_lista:
                continue
            dias_desde = (ahora - h.ultima_compra).total_seconds() / 86400.0
            if dias_desde < h.intervalo_medio_dias:
                continue
            sugerencias.append(
                SugerenciaCompra(
                    nombre=h.nombre,
                    cantidad_habitual=h.cantidad_habitual,
                    unidad=None,
                    motivo=(
                        f"Sueles comprarla cada ~{h.intervalo_medio_dias:.0f} días "
                        f"(hace {dias_desde:.0f})."
                    ),
                )
            )
            if len(sugerencias) >= self.MAX_SUGERENCIAS:
                break
        return sugerencias
