import uuid
from typing import List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from app.models.models import TareaHogar
from app.schemas.schemas import TareaHogarCreate, TareaHogarUpdate
from app.repositories.exceptions import DatabaseIntegrityError

class TaskRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, task_id: uuid.UUID, hogar_id: uuid.UUID, lock: bool = False) -> TareaHogar:
        """Obtiene una tarea por su ID y Hogar ID.
        Soporta row-level locking (FOR UPDATE)."""
        stmt = select(TareaHogar).where(
            TareaHogar.id == task_id,
            TareaHogar.hogar_id == hogar_id,
            TareaHogar.is_deleted == False
        )
        if lock:
            stmt = stmt.with_for_update()

        result = await self.session.execute(stmt)
        task = result.scalar_one_or_none()
        if not task:
            # Reutilizar excepciones de negocio heredadas deexceptions.py
            raise ValueError(f"No se ha encontrado la tarea {task_id} en el hogar {hogar_id}")
        return task

    async def get_all(self, hogar_id: uuid.UUID) -> List[TareaHogar]:
        """Obtiene todas las tareas activas para un hogar específico."""
        stmt = select(TareaHogar).where(
            TareaHogar.hogar_id == hogar_id,
            TareaHogar.is_deleted == False
        ).order_by(TareaHogar.created_at.desc())
        
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_pending_tasks(self, hogar_id: uuid.UUID) -> List[TareaHogar]:
        """Obtiene todas las tareas pendientes del hogar (estado == 'pendiente')."""
        stmt = select(TareaHogar).where(
            TareaHogar.hogar_id == hogar_id,
            TareaHogar.estado == "pendiente",
            TareaHogar.is_deleted == False
        ).order_by(TareaHogar.created_at.asc())
        
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def create(self, hogar_id: uuid.UUID, schema: TareaHogarCreate) -> TareaHogar:
        """Crea una nueva tarea del hogar."""
        db_task = TareaHogar(
            hogar_id=hogar_id,
            nombre=schema.nombre,
            asignado_a=schema.asignado_a,
            frecuencia=schema.frecuencia,
            prioridad=schema.prioridad,
            estado=schema.estado,
            is_deleted=False
        )
        self.session.add(db_task)
        try:
            await self.session.commit()
            await self.session.refresh(db_task)
        except IntegrityError as e:
            await self.session.rollback()
            raise DatabaseIntegrityError(str(e.orig))
        return db_task

    async def update(self, task_id: uuid.UUID, hogar_id: uuid.UUID, schema: TareaHogarUpdate) -> TareaHogar:
        """Actualiza una tarea existente."""
        db_task = await self.get_by_id(task_id, hogar_id, lock=True)
        
        update_data = schema.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_task, key, value)
            
        try:
            await self.session.commit()
            await self.session.refresh(db_task)
        except IntegrityError as e:
            await self.session.rollback()
            raise DatabaseIntegrityError(str(e.orig))
        return db_task

    async def delete(self, task_id: uuid.UUID, hogar_id: uuid.UUID) -> TareaHogar:
        """Elimina de forma lógica una tarea."""
        db_task = await self.get_by_id(task_id, hogar_id, lock=True)
        db_task.is_deleted = True
        
        try:
            await self.session.commit()
            await self.session.refresh(db_task)
        except IntegrityError as e:
            await self.session.rollback()
            raise DatabaseIntegrityError(str(e.orig))
        return db_task
