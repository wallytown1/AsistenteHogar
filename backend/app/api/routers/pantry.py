from fastapi import APIRouter, Depends, Path, status
import uuid

from app.api.deps import get_hogar_id, get_pantry_service
from app.services.pantry import PantryService
from app.services.llm import generate_recipe_suggestions
from app.schemas.schemas import (
    PantryStockMetrics,
    InventarioAlimentoCreate,
    InventarioAlimentoUpdate,
    InventarioAlimentoResponse,
    RecetasSugeridasResponse
)

router = APIRouter(tags=["Pantry"])

@router.get("/pantry", response_model=PantryStockMetrics)
async def get_pantry_metrics(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service)
):
    """Obtiene el inventario de despensa y sus métricas de stock asociadas al Hogar."""
    return await pantry_service.get_stock_metrics(hogar_id)

@router.get("/pantry/recetas", response_model=RecetasSugeridasResponse)
async def get_recetas_sugeridas(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service)
):
    """Sugiere recetas con IA a partir del inventario real de la despensa del Hogar,
    priorizando los alimentos próximos a caducar. IA pasiva: solo sugiere."""
    metrics = await pantry_service.get_stock_metrics(hogar_id)
    return await generate_recipe_suggestions(metrics.items, metrics.alertas_caducidad)

@router.post("/pantry", response_model=InventarioAlimentoResponse, status_code=status.HTTP_201_CREATED)
async def create_pantry_item(
    schema: InventarioAlimentoCreate,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service)
):
    """Crea un nuevo producto en la despensa vinculado al Hogar."""
    return await pantry_service.add_item(hogar_id, schema)

@router.patch("/pantry/{alimento_id}", response_model=InventarioAlimentoResponse)
async def patch_pantry_item(
    alimento_id: uuid.UUID = Path(..., description="UUID del alimento en el inventario"),
    schema: InventarioAlimentoUpdate = None, # Será parseado del JSON Body
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service)
):
    """Actualiza parcialmente un producto de la despensa de manera interactiva (validando cantidad > 0 si se envía)."""
    # En FastAPI, para leer el body, especificamos el tipo del parámetro (que hereda de BaseModel) sin Depends
    # Pydantic v2 validará que la cantidad sea gt=0.0 si es enviada.
    return await pantry_service.update_item(alimento_id, hogar_id, schema)

@router.delete("/pantry/{alimento_id}", response_model=InventarioAlimentoResponse)
async def delete_pantry_item(
    alimento_id: uuid.UUID = Path(..., description="UUID del alimento a eliminar"),
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service)
):
    """Elimina lógicamente un producto de la despensa del Hogar (soft delete)."""
    return await pantry_service.remove_item(alimento_id, hogar_id)
