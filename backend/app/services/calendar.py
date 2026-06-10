import uuid
from datetime import datetime
from typing import List, Tuple

from app.repositories.calendar import CalendarRepository
from app.schemas.schemas import (
    EventoCalendarioCreate, 
    EventoCalendarioUpdate, 
    EventoCalendarioResponse, 
    ConflictoDetalle
)

class CalendarService:
    def __init__(self, calendar_repo: CalendarRepository):
        self.calendar_repo = calendar_repo

    async def get_event(self, evento_id: uuid.UUID, hogar_id: uuid.UUID) -> EventoCalendarioResponse:
        """Obtiene un evento por su ID."""
        evento = await self.calendar_repo.get_by_id(evento_id, hogar_id)
        return EventoCalendarioResponse.model_validate(evento)

    async def add_event(self, hogar_id: uuid.UUID, schema: EventoCalendarioCreate) -> EventoCalendarioResponse:
        """Registra un nuevo evento en el calendario familiar."""
        # Nota: La validación de solapamiento a nivel de base de datos se realiza en el repositorio si es crítica,
        # o a nivel de servicio. Para el MVP, creamos el evento directamente y reportamos solapamientos en la agenda.
        evento = await self.calendar_repo.create(hogar_id, schema)
        return EventoCalendarioResponse.model_validate(evento)

    async def update_event(self, evento_id: uuid.UUID, hogar_id: uuid.UUID, schema: EventoCalendarioUpdate) -> EventoCalendarioResponse:
        """Actualiza un evento existente."""
        evento = await self.calendar_repo.update(evento_id, hogar_id, schema)
        return EventoCalendarioResponse.model_validate(evento)

    async def remove_event(self, evento_id: uuid.UUID, hogar_id: uuid.UUID) -> EventoCalendarioResponse:
        """Elimina de forma lógica un evento."""
        evento = await self.calendar_repo.delete(evento_id, hogar_id)
        return EventoCalendarioResponse.model_validate(evento)

    async def get_household_agenda(self, hogar_id: uuid.UUID) -> Tuple[List[EventoCalendarioResponse], List[ConflictoDetalle]]:
        """Recupera la agenda completa y ejecuta un algoritmo de barrido lineal eficiente
        en O(N log N) para identificar e indexar los conflictos de agenda (solapamientos)."""
        db_eventos = await self.calendar_repo.get_all(hogar_id)
        eventos = [EventoCalendarioResponse.model_validate(e) for e in db_eventos]

        # 1. Ordenar por fecha_inicio (complejidad O(N log N))
        eventos_ordenados = sorted(eventos, key=lambda x: x.fecha_inicio)

        conflictos: List[ConflictoDetalle] = []
        n = len(eventos_ordenados)

        # 2. Barrido lineal optimizado
        for i in range(n):
            evento_a = eventos_ordenados[i]
            
            # Buscar eventos subsiguientes que comiencen antes de que termine el evento A
            for j in range(i + 1, n):
                evento_b = eventos_ordenados[j]
                
                # Si el evento B inicia después o al momento de finalizar A,
                # ya no hay posibilidad de solapamiento para ningún evento posterior (por estar ordenados).
                if evento_b.fecha_inicio >= evento_a.fecha_fin:
                    break
                
                # Existe solapamiento si inicio_B < fin_A (ya garantizado arriba)
                # Calculemos el intervalo de coincidencia temporal
                inicio_solapamiento = max(evento_a.fecha_inicio, evento_b.fecha_inicio)
                fin_solapamiento = min(evento_a.fecha_fin, evento_b.fecha_fin)
                
                duracion = (fin_solapamiento - inicio_solapamiento).total_seconds()
                
                if duracion > 0:
                    conflictos.append(
                        ConflictoDetalle(
                            evento_a=evento_a,
                            evento_b=evento_b,
                            duracion_solapamiento_segundos=duracion
                        )
                    )

        return eventos_ordenados, conflictos
