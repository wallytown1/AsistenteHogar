import uuid

from app.repositories.calendar import CalendarRepository
from app.repositories.exceptions import ReglaNegocioError
from app.schemas.schemas import (
    ConflictoDetalle,
    EventoCalendarioCreate,
    EventoCalendarioResponse,
    EventoCalendarioUpdate,
)


class CalendarService:
    def __init__(self, calendar_repo: CalendarRepository):
        self.calendar_repo = calendar_repo

    async def add_event(
        self, hogar_id: uuid.UUID, schema: EventoCalendarioCreate
    ) -> EventoCalendarioResponse:
        """Registra un nuevo evento en el calendario familiar."""
        # Nota: La validación de solapamiento a nivel de base de datos se realiza en el repositorio si es crítica,
        # o a nivel de servicio. Para el MVP, creamos el evento directamente y reportamos solapamientos en la agenda.
        evento = await self.calendar_repo.create(hogar_id, schema)
        return EventoCalendarioResponse.model_validate(evento)

    async def update_event(
        self, evento_id: uuid.UUID, hogar_id: uuid.UUID, schema: EventoCalendarioUpdate
    ) -> EventoCalendarioResponse:
        """Actualiza un evento existente.

        El validador del schema solo compara fecha_inicio/fecha_fin cuando AMBAS llegan en
        el PATCH. Si solo llega una, hay que validar la consistencia contra el valor ya
        persistido (estado resultante = evento actual + campos del PATCH). De lo contrario
        un PATCH parcial podría dejar fecha_fin <= fecha_inicio."""
        cambios = schema.model_dump(exclude_unset=True)
        if "fecha_inicio" in cambios or "fecha_fin" in cambios:
            actual = await self.calendar_repo.get_by_id(evento_id, hogar_id)
            nuevo_inicio = cambios.get("fecha_inicio", actual.fecha_inicio)
            nuevo_fin = cambios.get("fecha_fin", actual.fecha_fin)
            if nuevo_fin <= nuevo_inicio:
                raise ReglaNegocioError(
                    "La fecha de fin debe ser posterior a la fecha de inicio"
                )

        evento = await self.calendar_repo.update(evento_id, hogar_id, schema)
        return EventoCalendarioResponse.model_validate(evento)

    async def remove_event(
        self, evento_id: uuid.UUID, hogar_id: uuid.UUID
    ) -> EventoCalendarioResponse:
        """Elimina de forma lógica un evento."""
        evento = await self.calendar_repo.delete(evento_id, hogar_id)
        return EventoCalendarioResponse.model_validate(evento)

    async def get_household_agenda(
        self, hogar_id: uuid.UUID
    ) -> tuple[list[EventoCalendarioResponse], list[ConflictoDetalle]]:
        """Recupera la agenda completa y detecta solapamientos. Sorting O(N log N) + barrido
        con early-exit: O(N) promedio para eventos no solapados, O(N²) peor caso."""
        db_eventos = await self.calendar_repo.get_all(hogar_id)
        eventos = [EventoCalendarioResponse.model_validate(e) for e in db_eventos]

        # 1. Ordenar por fecha_inicio (complejidad O(N log N))
        eventos_ordenados = sorted(eventos, key=lambda x: x.fecha_inicio)

        conflictos: list[ConflictoDetalle] = []
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
                            duracion_solapamiento_segundos=duracion,
                        )
                    )

        return eventos_ordenados, conflictos
