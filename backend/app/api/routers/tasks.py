import uuid

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.api.deps import get_hogar_id, get_task_repository
from app.core.rate_limit import interpretar_rate_limiter
from app.core.utils import sanitize_text
from app.models import TareaHogar
from app.repositories.exceptions import TaskNotFoundError
from app.repositories.task import TaskRepository
from app.schemas.schemas import (
    InterpretarTareaRequest,
    InterpretarTareaResponse,
    TareaHogarIn,
    TareaHogarOut,
    TareaHogarUpdate,
)
from app.services.llm import interpret_task_text

router = APIRouter(tags=["Tasks"])


@router.get("/tasks", response_model=list[TareaHogarOut])
async def get_tasks(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    task_repo: TaskRepository = Depends(get_task_repository),
) -> list[TareaHogar]:
    """Obtiene todas las tareas activas del hogar actual."""
    return await task_repo.get_all(hogar_id)


@router.post(
    "/tasks", response_model=TareaHogarOut, status_code=status.HTTP_201_CREATED
)
async def create_task(
    schema: TareaHogarIn,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    task_repo: TaskRepository = Depends(get_task_repository),
) -> TareaHogar:
    """Registra una nueva tarea vinculada al hogar actual, sanitizando las entradas de texto."""
    sanitized_schema = TareaHogarIn(
        nombre=sanitize_text(schema.nombre),
        asignado_a=sanitize_text(schema.asignado_a) if schema.asignado_a else None,
        frecuencia=schema.frecuencia,
        prioridad=schema.prioridad,
        estado=schema.estado,
    )
    return await task_repo.create(hogar_id, sanitized_schema)


@router.post(
    "/tasks/interpretar",
    response_model=InterpretarTareaResponse,
    dependencies=[Depends(interpretar_rate_limiter)],
)
async def interpretar_tarea(
    schema: InterpretarTareaRequest,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
) -> InterpretarTareaResponse:
    """Interpreta texto en lenguaje natural y devuelve una PROPUESTA de tarea.

    IA pasiva: nunca crea la tarea; el cliente debe confirmar y llamar a POST /tasks.
    """
    return await interpret_task_text(schema.texto)


@router.patch("/tasks/{tarea_id}", response_model=TareaHogarOut)
async def patch_task(
    tarea_id: uuid.UUID = Path(..., description="UUID de la tarea a actualizar"),
    schema: TareaHogarUpdate | None = None,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    task_repo: TaskRepository = Depends(get_task_repository),
) -> TareaHogar:
    """Actualiza parcialmente los atributos de una tarea (como cambiar el estado o la prioridad)."""
    if not schema:
        raise HTTPException(
            status_code=400, detail="Cuerpo de actualización vacío o no proporcionado."
        )

    if schema.nombre is not None:
        schema.nombre = sanitize_text(schema.nombre)
    if schema.asignado_a is not None:
        schema.asignado_a = (
            sanitize_text(schema.asignado_a) if schema.asignado_a else None
        )

    try:
        return await task_repo.update(tarea_id, hogar_id, schema)
    except TaskNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=e.message
        ) from e


@router.delete("/tasks/{tarea_id}", response_model=TareaHogarOut)
async def delete_task(
    tarea_id: uuid.UUID = Path(..., description="UUID de la tarea a eliminar"),
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    task_repo: TaskRepository = Depends(get_task_repository),
) -> TareaHogar:
    """Realiza el borrado lógico (is_deleted = True) de la tarea del hogar actual."""
    try:
        return await task_repo.delete(tarea_id, hogar_id)
    except TaskNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=e.message
        ) from e
