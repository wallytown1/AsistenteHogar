from fastapi import APIRouter, Depends
import uuid

from app.api.deps import get_hogar_id, get_dashboard_service
from app.services.dashboard import DashboardService
from app.schemas.schemas import DashboardUnifiedContext

router = APIRouter(tags=["Dashboard"])

@router.get("/dashboard", response_model=DashboardUnifiedContext)
async def get_dashboard(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    dashboard_service: DashboardService = Depends(get_dashboard_service)
):
    """Obtiene el estado unificado del hogar para el Dashboard hoy, filtrado por la cabecera X-Hogar-ID."""
    context = await dashboard_service.get_unified_dashboard(hogar_id)
    
    # Asignar explícitamente los datos de clima de Madrid requeridos por el mockup
    context.clima_temperatura = "22°C"
    context.clima_estado = "Parcialmente nublado"
    
    return context
