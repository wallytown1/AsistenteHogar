import uuid

from fastapi import APIRouter, Depends

from app.api.deps import (
    check_freemium_chat_quota,
    get_hogar_id,
    get_memoria_service,
    get_onboarding_service,
    get_pantry_service,
    get_perfiles_repo,
    get_recetario_repo,
)
from app.core.rate_limit import chef_chat_rate_limiter
from app.repositories.perfiles_individual import PerfilIndividualRepository
from app.repositories.receta_maestra import RecetaMaestraRepository
from app.schemas.schemas import (
    ChefChatRequest,
    ChefChatResponse,
    ConsumoAplicado,
    PerfilIndividualResponse,
    RecetaMaestraResponse,
    TranscribeAudioRequest,
    TranscribeAudioResponse,
)
from app.services.llm import chef_chat
from app.services.memoria import MemoriaService
from app.services.onboarding import OnboardingService
from app.services.pantry import PantryService

router = APIRouter(tags=["Chef"])


@router.post(
    "/chef/chat",
    response_model=ChefChatResponse,
    dependencies=[Depends(check_freemium_chat_quota), Depends(chef_chat_rate_limiter)],
)
async def chef_chat_endpoint(
    body: ChefChatRequest,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
    pantry_service: PantryService = Depends(get_pantry_service),
    onboarding_service: OnboardingService = Depends(get_onboarding_service),
    perfiles_repo: PerfilIndividualRepository = Depends(get_perfiles_repo),
    recetario_repo: RecetaMaestraRepository = Depends(get_recetario_repo),
    memoria_service: MemoriaService = Depends(get_memoria_service),
) -> ChefChatResponse:
    """Conversa con el chef del hogar. Responde fundamentado en la despensa real, la
    memoria de gustos y los perfiles del hogar, con la persona cálida del asistente.

    Privacidad: el servidor NO persiste el texto del chat; el cliente reenvía los
    turnos recientes en cada petición. La continuidad de largo plazo vive en la
    memoria de gustos destilada (solo datos gastronómicos)."""
    metrics = await pantry_service.get_stock_metrics(hogar_id)
    perfil = await onboarding_service.get_perfil(hogar_id)
    _perfiles = await perfiles_repo.list_by_hogar(hogar_id)
    perfiles = [PerfilIndividualResponse.model_validate(p) for p in _perfiles] or None
    _recetario = await recetario_repo.list_all(activa_only=True)
    recetario = [RecetaMaestraResponse.model_validate(r) for r in _recetario] or None
    memoria = await memoria_service.obtener(hogar_id)
    response = await chef_chat(
        body.mensajes,
        metrics.items,
        metrics.alertas_caducidad,
        perfil=perfil,
        memoria=memoria,
        perfiles_individuales=perfiles,
        recetario=recetario,
    )

    if response.consumo_estimado:
        import logging

        from app.schemas.schemas import InventarioAlimentoUpdate

        logger = logging.getLogger("app.api.chef")
        aplicados: list[str] = []
        detallados: list[ConsumoAplicado] = []
        for consumo in response.consumo_estimado:
            try:
                try:
                    c_id = uuid.UUID(str(consumo.item_id))
                except ValueError:
                    continue
                item_actual = next((i for i in metrics.items if i.id == c_id), None)
                if item_actual:
                    cantidad_anterior = float(item_actual.cantidad)
                    if consumo.cantidad >= item_actual.cantidad:
                        await pantry_service.agotar_item(c_id, hogar_id)
                        aplicados.append(f"Agotado: {item_actual.nombre}")
                        detallados.append(
                            ConsumoAplicado(
                                item_id=c_id,
                                nombre=item_actual.nombre,
                                cantidad_anterior=cantidad_anterior,
                                fue_agotado=True,
                            )
                        )
                    else:
                        nueva_cant = cantidad_anterior - consumo.cantidad
                        if nueva_cant > 0:
                            await pantry_service.update_item(
                                c_id,
                                hogar_id,
                                InventarioAlimentoUpdate(cantidad=nueva_cant),
                            )
                            aplicados.append(
                                f"Descontado {consumo.cantidad} {item_actual.unidad} de {item_actual.nombre}"
                            )
                            detallados.append(
                                ConsumoAplicado(
                                    item_id=c_id,
                                    nombre=item_actual.nombre,
                                    cantidad_anterior=cantidad_anterior,
                                    fue_agotado=False,
                                )
                            )
            except Exception as e:
                logger.warning(f"Error aplicando consumo estimado: {e}")

        if aplicados:
            response.consumos_aplicados = aplicados
        if detallados:
            response.consumos_detalle = detallados

    return response


@router.post(
    "/chef/transcribe",
    response_model=TranscribeAudioResponse,
    dependencies=[Depends(check_freemium_chat_quota), Depends(chef_chat_rate_limiter)],
)
async def chef_transcribe_endpoint(
    body: TranscribeAudioRequest,
    hogar_id: uuid.UUID = Depends(get_hogar_id),
) -> TranscribeAudioResponse:
    """Convierte un audio hablado en texto utilizando el modelo multimodal de Gemini.
    Comparte límite de rate limit y cuota freemium con el chat del chef."""
    from app.services.llm import transcribe_audio

    texto = await transcribe_audio(body.audio_base64, body.mime_type)

    if texto is None:
        return TranscribeAudioResponse(
            texto="Lo siento, no he podido escuchar bien el audio. ¿Puedes repetirlo?",
            generado_por_ia=False,
        )

    return TranscribeAudioResponse(
        texto=texto,
        generado_por_ia=True,
    )
