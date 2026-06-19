"""Router para perfiles individuales de miembros del hogar (Fase 3).

Solo preferencias gastronómicas (dieta + ingredientes a evitar).
NO se almacenan alergias ni intolerancias médicas (RGPD art. 9).
"""
import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_hogar_id
from app.database import get_async_session
from app.models.models import Usuario
from app.repositories.perfiles_individual import PerfilIndividualRepository
from app.schemas.schemas import (
    PerfilIndividualCreate,
    PerfilIndividualResponse,
    PerfilIndividualUpdate,
)

router = APIRouter(prefix="/perfiles", tags=["perfiles"])


def _get_repo(
    session: AsyncSession = Depends(get_async_session),
) -> PerfilIndividualRepository:
    return PerfilIndividualRepository(session)


@router.get("", response_model=list[PerfilIndividualResponse])
async def list_perfiles(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    repo: PerfilIndividualRepository = Depends(_get_repo),
    _: Usuario = Depends(get_current_user),
) -> list[PerfilIndividualResponse]:
    """Lista todos los perfiles individuales activos del hogar."""
    perfiles = await repo.list_by_hogar(hogar_id)
    return [PerfilIndividualResponse.model_validate(p) for p in perfiles]


@router.post(
    "", response_model=PerfilIndividualResponse, status_code=status.HTTP_201_CREATED
)
async def create_perfil(
    data: PerfilIndividualCreate,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    repo: PerfilIndividualRepository = Depends(_get_repo),
    _: Usuario = Depends(get_current_user),
) -> PerfilIndividualResponse:
    """Crea un perfil culinario para un miembro del hogar (máx. 10)."""
    perfil = await repo.create(hogar_id, data)
    return PerfilIndividualResponse.model_validate(perfil)


@router.get("/{perfil_id}", response_model=PerfilIndividualResponse)
async def get_perfil(
    perfil_id: uuid.UUID,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    repo: PerfilIndividualRepository = Depends(_get_repo),
    _: Usuario = Depends(get_current_user),
) -> PerfilIndividualResponse:
    perfil = await repo.get_by_id(perfil_id, hogar_id)
    return PerfilIndividualResponse.model_validate(perfil)


@router.patch("/{perfil_id}", response_model=PerfilIndividualResponse)
async def update_perfil(
    perfil_id: uuid.UUID,
    data: PerfilIndividualUpdate,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    repo: PerfilIndividualRepository = Depends(_get_repo),
    _: Usuario = Depends(get_current_user),
) -> PerfilIndividualResponse:
    perfil = await repo.update(perfil_id, hogar_id, data)
    return PerfilIndividualResponse.model_validate(perfil)


@router.delete("/{perfil_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_perfil(
    perfil_id: uuid.UUID,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    repo: PerfilIndividualRepository = Depends(_get_repo),
    _: Usuario = Depends(get_current_user),
) -> None:
    await repo.delete(perfil_id, hogar_id)
