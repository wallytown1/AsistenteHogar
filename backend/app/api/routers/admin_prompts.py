from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_current_admin, get_prompt_config_service
from app.models.models import AdminUser
from app.schemas.schemas import PromptTemplateResponse, PromptTemplateUpdate
from app.services.prompt_config import PromptConfigService

router = APIRouter(prefix="/admin/prompts", tags=["admin-prompts"])


@router.get("", response_model=list[PromptTemplateResponse])
async def list_prompts(
    svc: PromptConfigService = Depends(get_prompt_config_service),
    _admin: AdminUser = Depends(get_current_admin),
) -> list[PromptTemplateResponse]:
    templates = await svc._repo.list_all()
    return [PromptTemplateResponse.model_validate(t) for t in templates]


@router.get("/{clave}", response_model=PromptTemplateResponse)
async def get_prompt(
    clave: str,
    svc: PromptConfigService = Depends(get_prompt_config_service),
    _admin: AdminUser = Depends(get_current_admin),
) -> PromptTemplateResponse:
    template = await svc._repo.get_by_clave(clave)
    if template is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe un template con clave '{clave}'.",
        )
    return PromptTemplateResponse.model_validate(template)


@router.patch("/{clave}", response_model=PromptTemplateResponse)
async def upsert_prompt(
    clave: str,
    body: PromptTemplateUpdate,
    svc: PromptConfigService = Depends(get_prompt_config_service),
    _admin: AdminUser = Depends(get_current_admin),
) -> PromptTemplateResponse:
    if body.system_instruction is None and body.activo is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes proporcionar al menos 'system_instruction' o 'activo'.",
        )
    template = await svc._repo.upsert(
        clave=clave,
        system_instruction=body.system_instruction,
        activo=body.activo,
    )
    await svc._repo._session.commit()
    await svc.invalidate(clave)
    return PromptTemplateResponse.model_validate(template)
