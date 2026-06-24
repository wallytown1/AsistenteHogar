import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException, Path, status

from app.api.deps import (
    get_historial_service,
    get_hogar_id,
    get_memoria_service,
    get_onboarding_service,
    get_pantry_service,
    get_perfiles_repo,
    get_prompt_config_service,
    get_recetario_repo,
    requiere_familia,
    requiere_premium,
    text_ai_daily_quota,
    ticket_pdf_daily_quota,
    vision_daily_quota,
)
from app.core.rate_limit import (
    audio_rate_limiter,
    foto_nevera_rate_limiter,
    interpretar_rate_limiter,
    metadata_rate_limiter,
    plan_comidas_rate_limiter,
    recetas_rate_limiter,
)
from app.repositories.perfiles_individual import PerfilIndividualRepository
from app.repositories.receta_maestra import RecetaMaestraRepository
from app.schemas.schemas import (
    FotoNeveraRequest,
    FotoNeveraResponse,
    InterpretarDespensaRequest,
    InterpretarDespensaResponse,
    InventarioAlimentoCreate,
    InventarioAlimentoResponse,
    InventarioAlimentoUpdate,
    PantryStockMetrics,
    PerfilIndividualResponse,
    PlanComidasResponse,
    RecetaMaestraResponse,
    RecetasSugeridasResponse,
    RecetaSugerida,
    SugerenciaMetadataResponse,
    SugerenciasResponse,
    SugerirMetadataRequest,
    TicketOcrRequest,
    TicketOcrResponse,
    TicketPdfRequest,
    TicketPdfResponse,
)
from app.services.historial import RecetaHistorialService
from app.services.llm import (
    analyze_fridge_photo,
    generate_meal_plan,
    generate_recipe_suggestions,
    interpret_pantry_audio,
    interpret_pantry_text,
    parse_ticket_pdf,
    process_receipt_ocr,
    suggest_food_metadata,
)
from app.services.memoria import MemoriaService
from app.services.onboarding import OnboardingService
from app.services.pantry import PantryService
from app.services.prompt_config import PromptConfigService

router = APIRouter(tags=["Pantry"])


@router.get("/pantry", response_model=PantryStockMetrics)
async def get_pantry_metrics(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
) -> PantryStockMetrics:
    """Obtiene el inventario de despensa y sus métricas de stock asociadas al Hogar."""
    return await pantry_service.get_stock_metrics(hogar_id)


@router.get(
    "/pantry/recetas/basicas",
    response_model=RecetasSugeridasResponse,
)
async def get_recetas_basicas(
    recetario_repo: RecetaMaestraRepository = Depends(get_recetario_repo),
    _: uuid.UUID = Depends(get_hogar_id),
) -> RecetasSugeridasResponse:
    """Devuelve recetas del recetario maestro sin IA. Disponible en todos los tiers."""
    recetas_db = await recetario_repo.list_all(activa_only=True)
    recetas = [
        RecetaSugerida(
            titulo=r.nombre,
            tiempo_min=30,
            ingredientes_usados=r.ingredientes,
            pasos=r.pasos,
        )
        for r in recetas_db
    ]
    return RecetasSugeridasResponse(recetas=recetas, generado_por_ia=False)


@router.get(
    "/pantry/recetas",
    response_model=RecetasSugeridasResponse,
    dependencies=[Depends(requiere_premium), Depends(recetas_rate_limiter)],
)
async def get_recetas_sugeridas(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
    onboarding_service: OnboardingService = Depends(get_onboarding_service),
    historial_service: RecetaHistorialService = Depends(get_historial_service),
    prompt_config: PromptConfigService = Depends(get_prompt_config_service),
    perfiles_repo: PerfilIndividualRepository = Depends(get_perfiles_repo),
    recetario_repo: RecetaMaestraRepository = Depends(get_recetario_repo),
    memoria_service: MemoriaService = Depends(get_memoria_service),
) -> RecetasSugeridasResponse:
    """Sugiere recetas con IA a partir del inventario real de la despensa del Hogar,
    priorizando los alimentos próximos a caducar y personalizando según el perfil del
    hogar, perfiles individuales, memoria de gustos e historial. IA pasiva: solo sugiere."""
    metrics = await pantry_service.get_stock_metrics(hogar_id)
    perfil = await onboarding_service.get_perfil(hogar_id)
    historial = await historial_service.get_historial(hogar_id)
    _perfiles = await perfiles_repo.list_by_hogar(hogar_id)
    perfiles = [PerfilIndividualResponse.model_validate(p) for p in _perfiles] or None
    _recetario = await recetario_repo.list_all(activa_only=True)
    recetario = [RecetaMaestraResponse.model_validate(r) for r in _recetario] or None
    memoria = await memoria_service.obtener(hogar_id)
    return await generate_recipe_suggestions(
        metrics.items,
        metrics.alertas_caducidad,
        perfil,
        historial,
        prompt_config,
        perfiles_individuales=perfiles,
        recetario=recetario,
        memoria=memoria,
    )


@router.get(
    "/pantry/plan-comidas",
    response_model=PlanComidasResponse,
    dependencies=[Depends(requiere_familia), Depends(plan_comidas_rate_limiter)],
)
async def get_plan_comidas(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
    onboarding_service: OnboardingService = Depends(get_onboarding_service),
    prompt_config: PromptConfigService = Depends(get_prompt_config_service),
    perfiles_repo: PerfilIndividualRepository = Depends(get_perfiles_repo),
    recetario_repo: RecetaMaestraRepository = Depends(get_recetario_repo),
    memoria_service: MemoriaService = Depends(get_memoria_service),
) -> PlanComidasResponse:
    """Genera un plan de comidas semanal con IA a partir de la despensa real,
    priorizando lo que caduca pronto y personalizando según perfiles y memoria del hogar.
    IA pasiva: solo sugiere."""
    metrics = await pantry_service.get_stock_metrics(hogar_id)
    perfil = await onboarding_service.get_perfil(hogar_id)
    _perfiles = await perfiles_repo.list_by_hogar(hogar_id)
    perfiles = [PerfilIndividualResponse.model_validate(p) for p in _perfiles] or None
    _recetario = await recetario_repo.list_all(activa_only=True)
    recetario = [RecetaMaestraResponse.model_validate(r) for r in _recetario] or None
    memoria = await memoria_service.obtener(hogar_id)
    return await generate_meal_plan(
        metrics.items,
        metrics.alertas_caducidad,
        perfil,
        prompt_config,
        perfiles_individuales=perfiles,
        recetario=recetario,
        memoria=memoria,
    )


@router.get(
    "/pantry/sugerencias",
    response_model=SugerenciasResponse,
    dependencies=[
        Depends(requiere_familia),
        Depends(recetas_rate_limiter),
        Depends(plan_comidas_rate_limiter),
    ],
)
async def get_sugerencias(
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
    onboarding_service: OnboardingService = Depends(get_onboarding_service),
    historial_service: RecetaHistorialService = Depends(get_historial_service),
    prompt_config: PromptConfigService = Depends(get_prompt_config_service),
    perfiles_repo: PerfilIndividualRepository = Depends(get_perfiles_repo),
    recetario_repo: RecetaMaestraRepository = Depends(get_recetario_repo),
) -> SugerenciasResponse:
    """Devuelve recetas sugeridas y plan de comidas en una sola llamada (asyncio.gather),
    personalizadas según el perfil del hogar, perfiles individuales e historial."""
    metrics = await pantry_service.get_stock_metrics(hogar_id)
    perfil = await onboarding_service.get_perfil(hogar_id)
    historial = await historial_service.get_historial(hogar_id)
    _perfiles = await perfiles_repo.list_by_hogar(hogar_id)
    perfiles = [PerfilIndividualResponse.model_validate(p) for p in _perfiles] or None
    _recetario = await recetario_repo.list_all(activa_only=True)
    recetario = [RecetaMaestraResponse.model_validate(r) for r in _recetario] or None
    recetas_res, plan_res = await asyncio.gather(
        generate_recipe_suggestions(
            metrics.items,
            metrics.alertas_caducidad,
            perfil,
            historial,
            prompt_config,
            perfiles_individuales=perfiles,
            recetario=recetario,
        ),
        generate_meal_plan(
            metrics.items,
            metrics.alertas_caducidad,
            perfil,
            prompt_config,
            perfiles_individuales=perfiles,
            recetario=recetario,
        ),
    )
    return SugerenciasResponse(recetas=recetas_res, plan_comidas=plan_res)


@router.post(
    "/pantry/interpretar",
    response_model=InterpretarDespensaResponse,
    dependencies=[Depends(interpretar_rate_limiter), Depends(text_ai_daily_quota)],
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
    "/pantry/audio",
    response_model=InterpretarDespensaResponse,
    dependencies=[Depends(audio_rate_limiter), Depends(text_ai_daily_quota)],
)
async def interpretar_audio_despensa(
    schema: InterpretarDespensaRequest,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
) -> InterpretarDespensaResponse:
    """Interpreta un texto dictado por voz y devuelve PROPUESTAS de producto.

    El cliente transcribe el audio (dictado del teclado nativo de iOS/Android
    u otro motor STT) y envía el texto resultante. Semánticamente equivalente
    a /pantry/interpretar pero con rate limit propio para entrada por voz.
    IA pasiva: nunca añade nada; el cliente confirma y llama a POST /pantry.
    """
    return await interpret_pantry_audio(schema.texto, schema.fecha_referencia)


@router.post(
    "/pantry/sugerir-metadata",
    response_model=SugerenciaMetadataResponse,
    dependencies=[Depends(metadata_rate_limiter), Depends(text_ai_daily_quota)],
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
    dependencies=[Depends(interpretar_rate_limiter), Depends(vision_daily_quota)],
)
async def ocr_ticket_compra(
    schema: TicketOcrRequest,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
) -> TicketOcrResponse:
    """Procesa una imagen en Base64 de un ticket de compra usando Gemini Vision y devuelve una lista de productos propuestos."""
    return await process_receipt_ocr(schema.imagen_base64, schema.fecha_referencia)


@router.post(
    "/pantry/ticket/pdf",
    response_model=TicketPdfResponse,
    dependencies=[Depends(interpretar_rate_limiter), Depends(ticket_pdf_daily_quota)],
)
async def parsear_ticket_pdf(
    schema: TicketPdfRequest,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
) -> TicketPdfResponse:
    """Parsea un PDF de ticket de supermercado con Gemini Flash visión.

    Extrae productos con precio unitario (para el AhorroService). Sin gate premium:
    es el motor principal de onboarding sin fricción de la Fase 2 del pivote.
    IA pasiva: devuelve propuestas; el usuario confirma y llama a POST /pantry por cada una."""
    return await parse_ticket_pdf(schema.pdf_base64, schema.fecha_referencia)


@router.post(
    "/pantry/foto-nevera",
    response_model=FotoNeveraResponse,
    dependencies=[Depends(foto_nevera_rate_limiter), Depends(vision_daily_quota)],
)
async def analizar_foto_nevera(
    schema: FotoNeveraRequest,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
) -> FotoNeveraResponse:
    """Analiza una foto de nevera o despensa con Gemini Vision e identifica los
    ingredientes visibles. Devuelve propuesta de alimentos para confirmación y
    sugerencias de recetas express. IA pasiva: nunca añade nada directamente."""
    return await analyze_fridge_photo(schema.imagen_base64, schema.fecha_referencia)


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


@router.post("/pantry/{alimento_id}/agotar", response_model=InventarioAlimentoResponse)
async def agotar_pantry_item(
    alimento_id: uuid.UUID = Path(..., description="UUID del alimento agotado"),
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
) -> InventarioAlimentoResponse:
    """ "Se acabó" de un toque: borra el alimento y lo registra como consumo (origen 'agotado')."""
    return await pantry_service.agotar_item(alimento_id, hogar_id)


@router.post(
    "/pantry/{alimento_id}/confirmar", response_model=InventarioAlimentoResponse
)
async def confirmar_pantry_item(
    alimento_id: uuid.UUID = Path(..., description="UUID del alimento confirmado"),
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
) -> InventarioAlimentoResponse:
    """ "Sigo teniéndolo": renueva la confianza (resetea ultima_confirmacion → deja de estar incierto)."""
    return await pantry_service.confirmar_item(alimento_id, hogar_id)


@router.post(
    "/pantry/{alimento_id}/restaurar", response_model=InventarioAlimentoResponse
)
async def restaurar_pantry_item(
    alimento_id: uuid.UUID = Path(..., description="UUID del alimento a restaurar"),
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
) -> InventarioAlimentoResponse:
    """Undo de un agotado o descuento del chef: reactiva el alimento y registra compensación en el ledger."""
    return await pantry_service.restaurar_item(alimento_id, hogar_id)
