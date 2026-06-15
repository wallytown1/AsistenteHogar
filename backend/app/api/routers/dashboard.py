import uuid

from fastapi import APIRouter, Depends

from app.api.deps import get_dashboard_service, get_hogar_id
from app.schemas.schemas import DashboardUnifiedContext
from app.services.dashboard import DashboardService

router = APIRouter(tags=["Dashboard"])


@router.get("/dashboard", response_model=DashboardUnifiedContext)
async def get_dashboard(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
) -> DashboardUnifiedContext:
    """Obtiene el estado unificado del hogar para el Dashboard de hoy."""
    return await dashboard_service.get_unified_dashboard(hogar_id)
