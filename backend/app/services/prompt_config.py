import hashlib

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

        En todos los casos, _FILOSOFIA_MEDITERRANEA se añade al final — no puede
        ser eliminada por ninguna edición del admin.
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

        # Guard no-negociable: la filosofía mediterránea siempre se añade
        result = base + "\n\n" + llm_module._FILOSOFIA_MEDITERRANEA

        await llm_module._cache_set(cache_key, result, PROMPT_CACHE_TTL)
        return result

    async def invalidate(self, clave: str) -> None:
        cache_key = _hash_key("prompt", clave)
        # Sobrescribir con TTL=1 equivale a expirar inmediatamente
        await llm_module._cache_set(cache_key, "", 1)
