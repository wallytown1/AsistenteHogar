from datetime import date, datetime
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)


# Configuración base para todos los esquemas Pydantic v2
class BaseSchema(BaseModel):
    model_config = ConfigDict(
        extra="forbid",  # Prohibir payloads con campos adicionales no mapeados
        from_attributes=True,  # Permitir serialización desde objetos ORM de SQLAlchemy
    )


# --- HOGAR ---
class HogarResponse(BaseSchema):
    id: UUID
    nombre: str
    created_at: datetime
    updated_at: datetime


# --- PERFIL DE HOGAR (ONBOARDING) ---
class PerfilHogarBase(BaseSchema):
    gustos_culinarios: list[str] = Field(
        default_factory=list,
        max_length=30,
        description="Gustos/preferencias culinarias del hogar (ej: arroces, pescado, picante)",
    )
    num_comensales: int = Field(
        1, ge=1, le=20, description="Número de comensales habituales del hogar"
    )

    @field_validator("gustos_culinarios")
    @classmethod
    def limpiar_gustos(cls, v: list[str]) -> list[str]:
        limpios = [g.strip() for g in v if g.strip()]
        if any(len(g) > 50 for g in limpios):
            raise ValueError("Cada gusto culinario no puede superar los 50 caracteres")
        return limpios


class OnboardingRequest(PerfilHogarBase):
    """Payload de la encuesta de onboarding (upsert del perfil del hogar)."""


class PerfilHogarResponse(PerfilHogarBase):
    id: UUID
    hogar_id: UUID
    created_at: datetime
    updated_at: datetime


# --- AUTENTICACIÓN Y USUARIOS ---
class RegistroRequest(BaseSchema):
    nombre_hogar: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Nombre del nuevo hogar (ej: Familia Navarro)",
    )
    nombre: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="Nombre del usuario que se registra",
    )
    email: EmailStr = Field(..., max_length=255, description="Email único del usuario")
    password: str = Field(
        ...,
        min_length=8,
        max_length=72,
        description="Contraseña (mínimo 8 caracteres, máximo 72 bytes por límite de bcrypt)",
    )

    @field_validator("password")
    @classmethod
    def validar_password_bytes(cls, v: str) -> str:
        # bcrypt rechaza contraseñas de más de 72 bytes. max_length cuenta caracteres,
        # así que validamos los bytes reales: 72 caracteres acentuados o con emojis
        # superan el límite y, sin esta comprobación, provocarían un 500 al hashear.
        if len(v.encode("utf-8")) > 72:
            raise ValueError(
                "La contraseña supera el límite de 72 bytes. Los caracteres acentuados "
                "y los emojis ocupan más de un byte; usa una contraseña más corta."
            )
        return v


class LoginRequest(BaseSchema):
    email: EmailStr = Field(..., max_length=255)
    password: str = Field(..., min_length=1, max_length=72)


class UsuarioResponse(BaseSchema):
    id: UUID
    hogar_id: UUID
    email: EmailStr
    nombre: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseSchema):
    access_token: str = Field(..., description="Token JWT de acceso (Bearer)")
    token_type: str = Field("bearer", description="Tipo de token según RFC 6750")
    usuario: UsuarioResponse
    hogar: HogarResponse


class CuentaEliminarRequest(BaseSchema):
    # Re-autenticación obligatoria: un JWT activo en un dispositivo no basta
    # para destruir los datos de toda la familia (RGPD art. 17 + App Store 5.1.1(v))
    password: str = Field(
        ...,
        min_length=1,
        max_length=72,
        description="Contraseña actual para confirmar la eliminación definitiva",
    )


class CuentaEliminadaResponse(BaseSchema):
    success: bool = Field(
        ..., description="True si la cuenta y sus datos fueron destruidos"
    )
    message: str = Field(..., description="Confirmación de la eliminación")


class LogoutResponse(BaseSchema):
    success: bool = Field(..., description="True si la sesión fue cerrada")
    message: str = Field(..., description="Confirmación del cierre de sesión")


# --- INVENTARIO ALIMENTOS ---
class InventarioAlimentoCreate(BaseSchema):
    nombre: str = Field(
        ..., min_length=1, max_length=150, description="Nombre del alimento"
    )
    cantidad: float = Field(
        ...,
        gt=0.0,
        description="Cantidad en despensa (debe ser estrictamente mayor que 0)",
    )
    unidad: str = Field(
        ...,
        min_length=1,
        max_length=30,
        description="Unidad de medida (ej: litros, gramos, unidades)",
    )
    fecha_caducidad: date | None = Field(
        None, description="Fecha de vencimiento del producto"
    )
    categoria: str = Field(
        ..., min_length=1, max_length=50, description="Categoría de clasificación"
    )

    @field_validator("fecha_caducidad")
    @classmethod
    def validar_fecha_futura(cls, v: date | None) -> date | None:
        if v is not None and v < date.today():
            raise ValueError("La fecha de caducidad no puede ser en el pasado")
        return v


class InventarioAlimentoUpdate(BaseSchema):
    nombre: str | None = Field(None, min_length=1, max_length=150)
    cantidad: float | None = Field(
        None, gt=0.0, description="Cantidad (debe ser mayor que 0)"
    )
    unidad: str | None = Field(None, min_length=1, max_length=30)
    fecha_caducidad: date | None = Field(None)
    categoria: str | None = Field(None, min_length=1, max_length=50)

    @field_validator("fecha_caducidad")
    @classmethod
    def validar_fecha_futura(cls, v: date | None) -> date | None:
        if v is not None and v < date.today():
            raise ValueError("La fecha de caducidad no puede ser en el pasado")
        return v


class InventarioAlimentoResponse(BaseSchema):
    id: UUID
    hogar_id: UUID
    nombre: str
    cantidad: float
    unidad: str
    fecha_caducidad: date | None
    categoria: str
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


# --- SERVICE LAYER RESPONSES ---


class PantryStockMetrics(BaseSchema):
    porcentaje_stock: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Porcentaje total de stock de la despensa (debe estar entre 0 y 100)",
    )
    items_disponibles: int = Field(
        ..., ge=0, description="Cantidad total de alimentos activos disponibles"
    )
    alertas_caducidad: list[InventarioAlimentoResponse] = Field(
        default_factory=list, description="Alimentos que caducan en 6 días o menos"
    )
    items: list[InventarioAlimentoResponse] = Field(
        default_factory=list,
        description="Lista completa de todos los alimentos activos en la despensa",
    )


class RecetaSugerida(BaseSchema):
    titulo: str = Field(..., description="Nombre de la receta sugerida")
    tiempo_min: int = Field(
        ..., ge=0, description="Tiempo estimado de preparación en minutos"
    )
    ingredientes_usados: list[str] = Field(
        default_factory=list, description="Ingredientes de la despensa que aprovecha"
    )
    pasos: list[str] = Field(
        default_factory=list, description="Pasos breves de preparación"
    )


class RecetasSugeridasResponse(BaseSchema):
    recetas: list[RecetaSugerida] = Field(
        default_factory=list,
        description="Recetas sugeridas por la IA a partir de la despensa",
    )
    generado_por_ia: bool = Field(
        ..., description="True si las sugerencias provienen del modelo de IA"
    )
    mensaje: str | None = Field(
        None, description="Aviso cuando no hay sugerencias disponibles"
    )


class DashboardUnifiedContext(BaseSchema):
    fecha: str = Field(..., description="Fecha del briefing en formato ISO-8601")
    alertas_despensa: PantryStockMetrics = Field(
        ..., description="Estado de métricas de stock y alertas de caducidad"
    )
    briefing_texto: str | None = Field(
        None, description="Resumen ejecutivo amigable generado por IA"
    )
    briefing_generado_por_ia: bool = Field(
        False,
        description="True si el briefing proviene del modelo de IA (obliga a mostrar el aviso de transparencia); False si es el fallback estático",
    )


# --- INTERPRETACIÓN DE DESPENSA EN LENGUAJE NATURAL (IA) ---


class InterpretarDespensaRequest(BaseSchema):
    texto: str = Field(
        ...,
        min_length=3,
        max_length=400,
        description="Frase con uno o varios productos (ej: 'compré 6 huevos y leche que caduca el viernes')",
    )
    fecha_referencia: date = Field(
        ...,
        description="Fecha actual del dispositivo para resolver caducidades relativas",
    )


class AlimentoInterpretado(BaseSchema):
    nombre: str = Field(..., min_length=1, max_length=150)
    cantidad: float = Field(1.0, gt=0)
    unidad: str = Field("unidades", max_length=30)
    categoria: str = Field("Despensa", max_length=50)
    fecha_caducidad: date | None = Field(None)


class InterpretarDespensaResponse(BaseSchema):
    alimentos: list[AlimentoInterpretado] = Field(
        default_factory=list,
        description="Productos propuestos por la IA (el usuario los confirma antes de añadirlos)",
    )
    mensaje: str | None = Field(
        None, description="Motivo cuando no se pudo interpretar la frase"
    )


# --- SUGERENCIA DE METADATOS DE ALIMENTO (IA) ---


class SugerirMetadataRequest(BaseSchema):
    nombre: str = Field(
        ...,
        min_length=2,
        max_length=150,
        description="Nombre del alimento a clasificar",
    )
    fecha_referencia: date = Field(
        ..., description="Fecha actual para estimar la caducidad"
    )


class SugerenciaMetadataResponse(BaseSchema):
    categoria: str | None = Field(None, description="Categoría sugerida")
    dias_estimados: int | None = Field(
        None, description="Vida útil típica estimada en días"
    )
    fecha_caducidad_estimada: date | None = Field(
        None, description="Caducidad estimada = hoy + dias_estimados"
    )
    generado_por_ia: bool = Field(False)
    mensaje: str | None = Field(None)


# --- PLAN DE COMIDAS SEMANAL (IA) ---


class DiaPlanComidas(BaseSchema):
    dia: str = Field(..., description="Día de la semana")
    comida: str = Field(..., description="Sugerencia para la comida")
    cena: str = Field(..., description="Sugerencia para la cena")


class PlanComidasResponse(BaseSchema):
    dias: list[DiaPlanComidas] = Field(
        default_factory=list,
        description="Plan de hasta 7 días aprovechando la despensa",
    )
    generado_por_ia: bool = Field(False)
    mensaje: str | None = Field(None)


# --- SUGERENCIAS UNIFICADAS (recetas + plan en una sola llamada) ---


class SugerenciasResponse(BaseSchema):
    recetas: RecetasSugeridasResponse
    plan_comidas: PlanComidasResponse


# --- HISTORIAL DE RECETAS (APRENDIZAJE DE COMPORTAMIENTO) ---

_ACCIONES_VALIDAS = {"cocinada", "rechazada"}
_VALORACIONES_VALIDAS = {"me_encanto", "gusto", "no_me_gusto"}


class RecetaHistorialCreate(BaseSchema):
    nombre_receta: str = Field(
        ..., min_length=1, max_length=200, description="Nombre de la receta"
    )
    accion: str = Field(..., description="Acción realizada: 'cocinada' o 'rechazada'")
    valoracion: str | None = Field(
        None,
        description="Valoración opcional: 'me_encanto', 'gusto' o 'no_me_gusto'",
    )
    categoria: str | None = Field(
        None,
        max_length=50,
        description="Tipo/estilo de plato (p. ej. 'guiso', 'arroz', 'pescado')",
    )

    @field_validator("accion")
    @classmethod
    def validar_accion(cls, v: str) -> str:
        if v not in _ACCIONES_VALIDAS:
            raise ValueError("La acción debe ser 'cocinada' o 'rechazada'")
        return v

    @field_validator("valoracion")
    @classmethod
    def validar_valoracion(cls, v: str | None) -> str | None:
        if v is not None and v not in _VALORACIONES_VALIDAS:
            raise ValueError(
                "La valoración debe ser 'me_encanto', 'gusto' o 'no_me_gusto'"
            )
        return v


class RecetaHistorialResponse(BaseSchema):
    id: UUID
    hogar_id: UUID
    nombre_receta: str
    accion: str
    valoracion: str | None = None
    categoria: str | None = None
    cocinada_en: datetime
    created_at: datetime


# --- FOTO DE NEVERA (IA VISION) ---


class FotoNeveraRequest(BaseSchema):
    imagen_base64: str = Field(
        ..., description="Imagen de la nevera o despensa codificada en Base64"
    )
    fecha_referencia: date = Field(
        ..., description="Fecha actual del dispositivo para estimar caducidades"
    )


class FotoNeveraResponse(BaseSchema):
    alimentos: list[AlimentoInterpretado] = Field(
        default_factory=list,
        description="Ingredientes detectados visualmente (el usuario los confirma)",
    )
    sugerencias_rapidas: list[str] = Field(
        default_factory=list,
        description="Nombres de recetas express posibles con los ingredientes visibles",
    )
    mensaje: str | None = Field(
        None, description="Motivo cuando no se pudieron detectar ingredientes"
    )


# --- OCR DE TICKETS DE COMPRA (IA) ---


class TicketOcrRequest(BaseSchema):
    imagen_base64: str = Field(
        ..., description="Imagen del ticket de compra codificada en Base64"
    )
    fecha_referencia: date = Field(
        ...,
        description="Fecha actual del dispositivo para resolver caducidades relativas",
    )


class TicketOcrResponse(BaseSchema):
    alimentos: list[AlimentoInterpretado] = Field(
        default_factory=list,
        description="Productos detectados en el ticket y propuestos por la IA",
    )
    mensaje: str | None = Field(
        None, description="Motivo cuando no se pudo extraer la información"
    )


# --- PERFILES INDIVIDUALES (Fase 3) ---


class PerfilIndividualCreate(BaseSchema):
    """Perfil culinario de un miembro del hogar. Solo preferencias gastronómicas.
    NO usar para alergias o intolerancias médicas (datos de salud RGPD art. 9)."""

    nombre: str = Field(
        ..., min_length=1, max_length=100, description="Apodo del miembro del hogar"
    )
    preferencias_dieta: list[str] = Field(
        default_factory=list,
        description="Preferencias de dieta (ej: vegetariano, sin gluten preferido)",
    )
    excluir_ingredientes: list[str] = Field(
        default_factory=list,
        description="Ingredientes que este miembro prefiere evitar (preferencia culinaria)",
    )

    @field_validator("preferencias_dieta", "excluir_ingredientes")
    @classmethod
    def limpiar_lista(cls, v: list[str]) -> list[str]:
        limpios = [x.strip() for x in v if x.strip()]
        if any(len(x) > 100 for x in limpios):
            raise ValueError("Cada entrada no puede superar los 100 caracteres")
        return limpios


class PerfilIndividualUpdate(BaseSchema):
    nombre: str | None = Field(None, min_length=1, max_length=100)
    preferencias_dieta: list[str] | None = None
    excluir_ingredientes: list[str] | None = None

    @field_validator("preferencias_dieta", "excluir_ingredientes")
    @classmethod
    def limpiar_lista(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        limpios = [x.strip() for x in v if x.strip()]
        if any(len(x) > 100 for x in limpios):
            raise ValueError("Cada entrada no puede superar los 100 caracteres")
        return limpios


class PerfilIndividualResponse(BaseSchema):
    id: UUID
    hogar_id: UUID
    nombre: str
    preferencias_dieta: list[str]
    excluir_ingredientes: list[str]
    created_at: datetime
    updated_at: datetime


# --- ADMIN AUTH ---


class AdminLoginRequest(BaseSchema):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=72)


class AdminBootstrapRequest(BaseSchema):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    nombre: str = Field(..., min_length=2, max_length=100)
    bootstrap_token: str = Field(..., min_length=1)


class _AdminInfo(BaseSchema):
    id: UUID
    email: str
    nombre: str


class AdminTokenResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"
    admin: _AdminInfo


# --- PROMPT TEMPLATES ---


class PromptTemplateUpdate(BaseSchema):
    system_instruction: str | None = Field(None, min_length=10, max_length=8000)
    activo: bool | None = None


class PromptTemplateResponse(BaseSchema):
    id: UUID
    clave: str
    system_instruction: str
    activo: bool
    version: int
    updated_at: datetime


# --- RECETARIO MAESTRO ---


class RecetaMaestraCreate(BaseSchema):
    nombre: str = Field(..., min_length=2, max_length=200)
    ingredientes: list[str] = Field(..., min_length=1)
    pasos: list[str] = Field(..., min_length=1)
    categoria: str = Field(..., min_length=2, max_length=50)
    temporada: str | None = Field(None, max_length=50)
    aprovechamiento: bool = False

    @field_validator("ingredientes", "pasos")
    @classmethod
    def no_vacios(cls, v: list[str]) -> list[str]:
        limpio = [x.strip() for x in v if x.strip()]
        if not limpio:
            raise ValueError("La lista no puede estar vacía")
        return limpio


class RecetaMaestraUpdate(BaseSchema):
    nombre: str | None = Field(None, min_length=2, max_length=200)
    ingredientes: list[str] | None = None
    pasos: list[str] | None = None
    categoria: str | None = Field(None, min_length=2, max_length=50)
    temporada: str | None = Field(None, max_length=50)
    aprovechamiento: bool | None = None
    activa: bool | None = None

    @field_validator("ingredientes", "pasos")
    @classmethod
    def no_vacios_update(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        limpio = [x.strip() for x in v if x.strip()]
        if not limpio:
            raise ValueError("La lista no puede estar vacía")
        return limpio


class RecetaMaestraResponse(BaseSchema):
    id: UUID
    nombre: str
    ingredientes: list[str]
    pasos: list[str]
    categoria: str
    temporada: str | None
    aprovechamiento: bool
    activa: bool
    created_at: datetime
    updated_at: datetime


# --- RECHAZO DE INGREDIENTES (Fase 4b) ---


class RechazarIngredienteRequest(BaseSchema):
    nombre_receta: str = Field(..., min_length=1, max_length=200)
    ingredientes_receta: list[str] = Field(..., min_length=1)
    perfil_id: UUID

    @field_validator("ingredientes_receta")
    @classmethod
    def no_vacios(cls, v: list[str]) -> list[str]:
        limpio = [x.strip() for x in v if x.strip()]
        if not limpio:
            raise ValueError("La lista de ingredientes no puede estar vacía")
        return limpio


class RechazarIngredienteResponse(BaseSchema):
    perfil_id: UUID
    nombre_perfil: str
    ingredientes_anadidos: list[str]
    excluir_ingredientes_actualizado: list[str]
    generado_por_ia: bool
    mensaje: str | None = None


# --- LISTA DE LA COMPRA ---


class ListaCompraItemCreate(BaseSchema):
    nombre: str = Field(..., min_length=1, max_length=200)
    cantidad: float | None = Field(None, gt=0)
    unidad: str | None = Field(None, max_length=50)

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre(cls, v: str) -> str:
        return v.strip()


class ListaCompraItemUpdate(BaseSchema):
    nombre: str | None = Field(None, min_length=1, max_length=200)
    cantidad: float | None = Field(None, gt=0)
    unidad: str | None = Field(None, max_length=50)
    is_checked: bool | None = None


class ListaCompraItemResponse(BaseSchema):
    id: UUID
    hogar_id: UUID
    nombre: str
    cantidad: float | None
    unidad: str | None
    is_checked: bool
    created_at: datetime
    updated_at: datetime


# --- HÁBITOS DE COMPRA / CONSUMO (derivados del ledger de movimientos) ---


class HabitoCompraItem(BaseSchema):
    nombre: str
    veces: int
    ultima_compra: datetime | None = None
    intervalo_medio_dias: float | None = None
    cantidad_habitual: float | None = None


class ConsumoItem(BaseSchema):
    nombre: str
    veces: int
    cantidad_total: float | None = None
    ultimo: datetime | None = None


# --- MEMORIA DE GUSTOS (personalización destilada) ---


class MemoriaGustosResponse(BaseSchema):
    resumen: str
    updated_at: datetime


# --- CHEF CONVERSACIONAL ---

_ROLES_CHAT_VALIDOS = {"usuario", "chef"}


class ChefMensaje(BaseSchema):
    rol: str = Field(..., description="Quién emite el mensaje: 'usuario' o 'chef'")
    texto: str = Field(..., min_length=1, max_length=1000)

    @field_validator("rol")
    @classmethod
    def validar_rol(cls, v: str) -> str:
        if v not in _ROLES_CHAT_VALIDOS:
            raise ValueError("El rol debe ser 'usuario' o 'chef'")
        return v


class ChefChatRequest(BaseSchema):
    # Turnos recientes de la conversación, el último debe ser del usuario. El servidor
    # NO persiste el texto crudo del chat (RGPD): el cliente reenvía el contexto reciente.
    mensajes: list[ChefMensaje] = Field(..., min_length=1, max_length=20)

    @field_validator("mensajes")
    @classmethod
    def ultimo_es_usuario(cls, v: list[ChefMensaje]) -> list[ChefMensaje]:
        if v[-1].rol != "usuario":
            raise ValueError("El último mensaje debe ser del usuario")
        return v


class ChefChatResponse(BaseSchema):
    respuesta: str
    generado_por_ia: bool
    mensaje: str | None = None
