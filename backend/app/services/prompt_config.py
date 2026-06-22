import hashlib
from typing import cast

from app.models.models import PromptTemplate
from app.repositories.prompt_template import PromptTemplateRepository
from app.services import llm as llm_module

PROMPT_CACHE_TTL = 5 * 60  # 5 minutos


def _hash_key(prefix: str, value: str) -> str:
    return prefix + ":" + hashlib.sha256(value.encode()).hexdigest()[:16]


class PromptConfigService:
    def __init__(self, repo: PromptTemplateRepository) -> None:
        self._repo = repo

    async def get_system_instruction(self, clave: str, fallback: str) -> str:
        """Devuelve la system instruction para la clave dada.

        Orden de resolución:
        1. Caché en memoria (TTL 5 min)
        2. DB (template activo)
        3. Fallback hardcodeado

        En todos los casos, PERSONA_CHEF se antepone (voz cálida y cercana) y
        FILOSOFIA_MEDITERRANEA se añade al final — ninguna de las dos puede ser
        eliminada por una edición del admin (la parte editable es la del medio).
        """
        cache_key = _hash_key("prompt", clave)

        cached = await llm_module._cache_get(cache_key)
        if cached:
            return str(cached)

        template = await self._repo.get_by_clave(clave)
        base = (
            template.system_instruction
            if (template and template.activo and template.system_instruction)
            else fallback
        )

        # Guards no-negociables: persona cálida delante, filosofía mediterránea detrás.
        result = (
            llm_module.PERSONA_CHEF
            + "\n\n"
            + base
            + "\n\n"
            + llm_module.FILOSOFIA_MEDITERRANEA
        )

        await llm_module._cache_set(cache_key, result, PROMPT_CACHE_TTL)
        return result

    async def invalidate(self, clave: str) -> None:
        cache_key = _hash_key("prompt", clave)
        # Sobrescribir con TTL=1 equivale a expirar inmediatamente
        await llm_module._cache_set(cache_key, "", 1)

    # --- API pública para el panel admin (no exponer el repo) ---

    async def list_templates(self) -> list[PromptTemplate]:
        """Devuelve todos los templates (uso del panel admin)."""
        return await self._repo.list_all()

    async def get_template(self, clave: str) -> PromptTemplate | None:
        """Devuelve un template por clave, o None si no existe."""
        return await self._repo.get_by_clave(clave)

    async def upsert_template(
        self,
        clave: str,
        system_instruction: str | None,
        activo: bool | None,
    ) -> PromptTemplate:
        """Crea/actualiza un template, persiste e invalida la caché de esa clave."""
        template = await self._repo.upsert(
            clave=clave,
            system_instruction=system_instruction,
            activo=activo,
        )
        await self._repo._session.commit()
        await self.invalidate(clave)
        return template

    async def seed_default_templates(self) -> None:
        """Inicializa los templates de prompt por defecto en la base de datos de manera idempotente.
        En despliegues concurrentes, maneja IntegrityError en caso de race conditions.
        """
        from sqlalchemy.exc import IntegrityError

        default_templates = [
            {
                "clave": "recetas",
                "system_instruction": llm_module.DEFAULT_RECETAS,
                "activo": True,
            },
            {
                "clave": "plan_comidas",
                "system_instruction": llm_module.DEFAULT_PLAN,
                "activo": True,
            },
        ]

        for dt in default_templates:
            try:
                clave = cast(str, dt["clave"])
                system_instruction = cast(str | None, dt["system_instruction"])
                activo = cast(bool | None, dt["activo"])
                # Comprobar primero si ya existe para evitar la inserción
                template = await self._repo.get_by_clave(clave)
                if template is None:
                    await self._repo.upsert(
                        clave=clave,
                        system_instruction=system_instruction,
                        activo=activo,
                    )
                    await self._repo._session.commit()
            except IntegrityError:
                # En caso de concurrencia (race condition), otra transacción ya lo insertó.
                # Hacemos rollback de la sesión actual para no dejarla corrupta y continuar.
                await self._repo._session.rollback()
            except Exception:
                # Otros fallos menores no deben impedir el arranque de la app
                await self._repo._session.rollback()
