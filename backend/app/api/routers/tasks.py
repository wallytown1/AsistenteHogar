from fastapi import APIRouter, Depends, Path, HTTPException, status
import uuid
from typing import List, Optional

from app.api.deps import get_hogar_id, get_task_repository
from app.repositories.task import TaskRepository
from app.repositories.exceptions import TaskNotFoundError
from app.schemas.schemas import TareaHogarIn, TareaHogarUpdate, TareaHogarOut
from app.core.utils import sanitize_text

router = APIRouter(tags=["Tasks"])


@router.get("/tasks", response_model=List[TareaHogarOut])
async def get_tasks(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    task_repo: TaskRepository = Depends(get_task_repository)
):
    """Obtiene todas las tareas activas del hogar actual."""
    return await task_repo.get_all(hogar_id)


@router.post("/tasks", response_model=TareaHogarOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    schema: TareaHogarIn,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    task_repo: TaskRepository = Depends(get_task_repository)
):
    """Registra una nueva tarea vinculada al hogar actual, sanitizando las entradas de texto."""
    sanitized_schema = TareaHogarIn(
        nombre=sanitize_text(schema.nombre),
        asignado_a=sanitize_text(schema.asignado_a) if schema.asignado_a else None,
        frecuencia=schema.frecuencia,
        prioridad=schema.prioridad,
        estado=schema.estado
    )
    return await task_repo.create(hogar_id, sanitized_schema)


@router.patch("/tasks/{tarea_id}", response_model=TareaHogarOut)
async def patch_task(
    tarea_id: uuid.UUID = Path(..., description="UUID de la tarea a actualizar"),
    schema: TareaHogarUpdate = None,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    task_repo: TaskRepository = Depends(get_task_repository)
):
    """Actualiza parcialmente los atributos de una tarea (como cambiar el estado o la prioridad)."""
    if not schema:
        raise HTTPException(status_code=400, detail="Cuerpo de actualización vacío o no proporcionado.")
        
    if schema.nombre is not None:
        schema.nombre = sanitize_text(schema.nombre)
    if schema.asignado_a is not None:
        schema.asignado_a = sanitize_text(schema.asignado_a) if schema.asignado_a else None
        
    try:
        return await task_repo.update(tarea_id, hogar_id, schema)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)


@router.delete("/tasks/{tarea_id}", response_model=TareaHogarOut)
async def delete_task(
    tarea_id: uuid.UUID = Path(..., description="UUID de la tarea a eliminar"),
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    task_repo: TaskRepository = Depends(get_task_repository)
):
    """Realiza el borrado lógico (is_deleted = True) de la tarea del hogar actual."""
    try:
        return await task_repo.delete(tarea_id, hogar_id)
    except TaskNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
