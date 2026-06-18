import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import PromptTemplate


class PromptTemplateRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_by_clave(self, clave: str) -> PromptTemplate | None:
        result = await self._session.execute(
            select(PromptTemplate).where(PromptTemplate.clave == clave)
        )
        return result.scalar_one_or_none()

    async def list_all(self) -> list[PromptTemplate]:
        result = await self._session.execute(
            select(PromptTemplate).order_by(PromptTemplate.clave)
        )
        return list(result.scalars().all())

    async def upsert(
        self,
        clave: str,
        system_instruction: str | None = None,
        activo: bool | None = None,
    ) -> PromptTemplate:
        template = await self.get_by_clave(clave)
        if template is None:
            template = PromptTemplate(
                clave=clave,
                system_instruction=system_instruction or "",
                activo=True if activo is None else activo,
                version=1,
                updated_at=datetime.now(UTC),
            )
            self._session.add(template)
        else:
            if system_instruction is not None:
                template.system_instruction = system_instruction
            if activo is not None:
                template.activo = activo
            template.version += 1
            template.updated_at = datetime.now(UTC)
        await self._session.flush()
        await self._session.refresh(template)
        return template

    async def get_by_id(self, template_id: uuid.UUID) -> PromptTemplate | None:
        result = await self._session.execute(
            select(PromptTemplate).where(PromptTemplate.id == template_id)
        )
        return result.scalar_one_or_none()
