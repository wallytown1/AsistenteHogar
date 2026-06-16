import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.api.deps import get_hogar_id, get_pantry_service, requiere_premium
from app.core.rate_limit import (
    interpretar_rate_limiter,
    metadata_rate_limiter,
    plan_comidas_rate_limiter,
    recetas_rate_limiter,
)
from app.schemas.schemas import (
    InterpretarDespensaRequest,
    InterpretarDespensaResponse,
    InventarioAlimentoCreate,
    InventarioAlimentoResponse,
    InventarioAlimentoUpdate,
    PantryStockMetrics,
    PlanComidasResponse,
    RecetasSugeridasResponse,
    SugerenciaMetadataResponse,
    SugerenciasResponse,
    SugerirMetadataRequest,
    TicketOcrRequest,
    TicketOcrResponse,
)
from app.services.llm import (
    generate_meal_plan,
    generate_recipe_suggestions,
    interpret_pantry_text,
    process_receipt_ocr,
    suggest_food_metadata,
)
from app.services.pantry import PantryService

router = APIRouter(tags=["Pantry"])


@router.get("/pantry", response_model=PantryStockMetrics)
async def get_pantry_metrics(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
) -> PantryStockMetrics:
    """Obtiene el inventario de despensa y sus métricas de stock asociadas al Hogar."""
    return await pantry_service.get_stock_metrics(hogar_id)


@router.get(
    "/pantry/recetas",
    response_model=RecetasSugeridasResponse,
    dependencies=[Depends(requiere_premium), Depends(recetas_rate_limiter)],
)
async def get_recetas_sugeridas(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
) -> RecetasSugeridasResponse:
    """Sugiere recetas con IA a partir del inventario real de la despensa del Hogar,
    priorizando los alimentos próximos a caducar. IA pasiva: solo sugiere."""
    metrics = await pantry_service.get_stock_metrics(hogar_id)
    return await generate_recipe_suggestions(metrics.items, metrics.alertas_caducidad)


@router.get(
    "/pantry/plan-comidas",
    response_model=PlanComidasResponse,
    dependencies=[Depends(requiere_premium), Depends(plan_comidas_rate_limiter)],
)
async def get_plan_comidas(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
) -> PlanComidasResponse:
    """Genera un plan de comidas semanal con IA a partir de la despensa real,
    priorizando lo que caduca pronto. IA pasiva: solo sugiere."""
    metrics = await pantry_service.get_stock_metrics(hogar_id)
    return await generate_meal_plan(metrics.items, metrics.alertas_caducidad)


@router.get(
    "/pantry/sugerencias",
    response_model=SugerenciasResponse,
    dependencies=[
        Depends(requiere_premium),
        Depends(recetas_rate_limiter),
        Depends(plan_comidas_rate_limiter),
    ],
)
async def get_sugerencias(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
) -> SugerenciasResponse:
    """Devuelve recetas sugeridas y plan de comidas en una sola llamada (asyncio.gather).
    Reutiliza las cachés individuales de cada función LLM."""
    metrics = await pantry_service.get_stock_metrics(hogar_id)
    recetas_res, plan_res = await asyncio.gather(
        generate_recipe_suggestions(metrics.items, metrics.alertas_caducidad),
        generate_meal_plan(metrics.items, metrics.alertas_caducidad),
    )
    return SugerenciasResponse(recetas=recetas_res, plan_comidas=plan_res)


@router.post(
    "/pantry/interpretar",
    response_model=InterpretarDespensaResponse,
    dependencies=[Depends(requiere_premium), Depends(interpretar_rate_limiter)],
)
async def interpretar_despensa(
    schema: InterpretarDespensaRequest,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
) -> InterpretarDespensaResponse:
    """Interpreta una frase y devuelve PROPUESTAS de producto para la despensa.

    IA pasiva: nunca añade nada; el cliente confirma y llama a POST /pantry por cada uno.
    """
    return await interpret_pantry_text(schema.texto, schema.fecha_referencia)


@router.post(
    "/pantry/sugerir-metadata",
    response_model=SugerenciaMetadataResponse,
    dependencies=[Depends(requiere_premium), Depends(metadata_rate_limiter)],
)
async def sugerir_metadata(
    schema: SugerirMetadataRequest,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
) -> SugerenciaMetadataResponse:
    """Sugiere categoría y caducidad estimada para un alimento dado su nombre.

    IA pasiva: es una ayuda para rellenar el formulario; el usuario edita y confirma.
    """
    return await suggest_food_metadata(schema.nombre, schema.fecha_referencia)


@router.post(
    "/pantry/ocr-ticket",
    response_model=TicketOcrResponse,
    dependencies=[Depends(requiere_premium), Depends(interpretar_rate_limiter)],
)
async def ocr_ticket_compra(
    schema: TicketOcrRequest,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
) -> TicketOcrResponse:
    """Procesa una imagen en Base64 de un ticket de compra usando Gemini Vision y devuelve una lista de productos propuestos."""
    return await process_receipt_ocr(schema.imagen_base64, schema.fecha_referencia)


@router.post(
    "/pantry",
    response_model=InventarioAlimentoResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_pantry_item(
    schema: InventarioAlimentoCreate,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
) -> InventarioAlimentoResponse:
    """Crea un nuevo producto en la despensa vinculado al Hogar."""
    return await pantry_service.add_item(hogar_id, schema)


@router.patch("/pantry/{alimento_id}", response_model=InventarioAlimentoResponse)
async def patch_pantry_item(
    alimento_id: uuid.UUID = Path(
        ..., description="UUID del alimento en el inventario"
    ),
    schema: InventarioAlimentoUpdate | None = None,  # Será parseado del JSON Body
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
) -> InventarioAlimentoResponse:
    """Actualiza parcialmente un producto de la despensa de manera interactiva (validando cantidad > 0 si se envía)."""
    # En FastAPI, para leer el body, especificamos el tipo del parámetro (que hereda de BaseModel) sin Depends
    # Pydantic v2 validará que la cantidad sea gt=0.0 si es enviada.
    if not schema:
        raise HTTPException(
            status_code=400, detail="Cuerpo de actualización vacío o no proporcionado."
        )
    return await pantry_service.update_item(alimento_id, hogar_id, schema)


@router.delete("/pantry/{alimento_id}", response_model=InventarioAlimentoResponse)
async def delete_pantry_item(
    alimento_id: uuid.UUID = Path(..., description="UUID del alimento a eliminar"),
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
) -> InventarioAlimentoResponse:
    """Elimina lógicamente un producto de la despensa del Hogar (soft delete)."""
    return await pantry_service.remove_item(alimento_id, hogar_id)
