import uuid
from datetime import datetime, date, time, timedelta
from typing import Dict, Any, List
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import InventarioAlimento, EventoCalendario

class DashboardRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_briefing_context(self, hogar_id: uuid.UUID) -> Dict[str, Any]:
        """Obtiene un contexto unificado de los datos activos del hogar hoy (eventos del día
        y alimentos que caducan en los próximos 2 días) para alimentar la generación del briefing por la IA."""
        hoy_fecha = date.today()
        limite_caducidad = hoy_fecha + timedelta(days=2)

        # Rango de tiempo para eventos de hoy (desde 00:00:00 hasta 23:59:59)
        inicio_dia = datetime.combine(hoy_fecha, time.min)
        fin_dia = datetime.combine(hoy_fecha, time.max)

        # 1. Consultar alimentos activos próximos a caducar (hoy, mañana, o ya caducados)
        stmt_alimentos = select(InventarioAlimento).where(
            InventarioAlimento.hogar_id == hogar_id,
            InventarioAlimento.is_deleted == False,
            InventarioAlimento.fecha_caducidad != None,
            InventarioAlimento.fecha_caducidad <= limite_caducidad
        ).order_by(InventarioAlimento.fecha_caducidad.asc())

        # 2. Consultar eventos activos agendados para hoy
        stmt_eventos = select(EventoCalendario).where(
            EventoCalendario.hogar_id == hogar_id,
            EventoCalendario.is_deleted == False,
            EventoCalendario.fecha_inicio >= inicio_dia,
            EventoCalendario.fecha_inicio <= fin_dia
        ).order_by(EventoCalendario.fecha_inicio.asc())

        # Ejecución paralela simulada por asincronía secuencial eficiente en la misma sesión
        result_alimentos = await self.session.execute(stmt_alimentos)
        alimentos_criticos = list(result_alimentos.scalars().all())

        result_eventos = await self.session.execute(stmt_eventos)
        eventos_hoy = list(result_eventos.scalars().all())

        return {
            "fecha": hoy_fecha.isoformat(),
            "alimentos_proximos_a_caducar": alimentos_criticos,
            "eventos_hoy": eventos_hoy,
        }
