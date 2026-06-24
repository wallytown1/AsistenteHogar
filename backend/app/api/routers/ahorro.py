import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_ahorro_service, get_hogar_id, requiere_premium
from app.schemas.schemas import AhorroPreviewResponse, AhorroResumenResponse
from app.services.ahorro import AhorroService

router = APIRouter(tags=["Ahorro"])


@router.get(
    "/ahorro/resumen",
    response_model=AhorroResumenResponse,
    dependencies=[Depends(requiere_premium)],
)
async def get_ahorro_resumen(
    mes: date = Query(
        default=None,
        description="Primer día del mes a analizar (YYYY-MM-DD). Omitir = mes actual.",
    ),
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    service: AhorroService = Depends(get_ahorro_service),
) -> AhorroResumenResponse:
    """Informe completo de ahorro mensual (Premium).

    Cruza los consumos del mes con los precios de tickets importados para calcular
    el valor real de los alimentos aprovechados. Devuelve el desglose por ingrediente
    y la comparativa con la media española de desperdicio (MAPA 2024)."""
    if mes is None:
        hoy = date.today()
        mes = date(hoy.year, hoy.month, 1)
    return await service.calcular_resumen(hogar_id, mes)


@router.get(
    "/ahorro/resumen/preview",
    response_model=AhorroPreviewResponse,
)
async def get_ahorro_preview(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    service: AhorroService = Depends(get_ahorro_service),
) -> AhorroPreviewResponse:
    """Resumen ligero del ahorro del mes actual (Free).

    Devuelve únicamente el número de recetas cocinadas y el ahorro estimado
    (recetas x €3.50 media española) para mostrar en el Dashboard como CTA
    hacia el Informe Premium."""
    hoy = date.today()
    return await service.calcular_preview(hogar_id, date(hoy.year, hoy.month, 1))
