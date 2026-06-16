from datetime import date, datetime
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
    model_validator,
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


# --- TAREAS HOGAR ---
class TareaHogarIn(BaseSchema):
    nombre: str = Field(
        ...,
        min_length=2,
        max_length=200,
        description="Descripción o nombre de la tarea",
    )
    asignado_a: str | None = Field(
        None, max_length=100, description="Miembro de la familia asignado"
    )
    frecuencia: str = Field(
        ..., min_length=2, max_length=50, description="Ej: diaria, semanal, mensual"
    )
    prioridad: str = Field(
        "media", description="Prioridad de la tarea (alta, media, baja)"
    )
    estado: str = Field(
        "pendiente",
        min_length=2,
        max_length=30,
        description="Estado inicial de la tarea",
    )

    @field_validator("prioridad")
    @classmethod
    def validar_prioridad(cls, v: str) -> str:
        prioridades_validas = ["alta", "media", "baja"]
        if v not in prioridades_validas:
            raise ValueError("La prioridad debe ser una de: alta, media, baja")
        return v

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, v: str) -> str:
        estados_validos = ["pendiente", "completado"]
        if v not in estados_validos:
            raise ValueError(f"El estado debe ser uno de: {', '.join(estados_validos)}")
        return v


class TareaHogarUpdate(BaseSchema):
    nombre: str | None = Field(None, min_length=2, max_length=200)
    asignado_a: str | None = Field(None, max_length=100)
    frecuencia: str | None = Field(None, min_length=2, max_length=50)
    ultimo_completado: datetime | None = Field(None)
    prioridad: str | None = Field(
        None, description="Prioridad de la tarea (alta, media, baja)"
    )
    estado: str | None = Field(None, min_length=2, max_length=30)

    @field_validator("prioridad")
    @classmethod
    def validar_prioridad(cls, v: str | None) -> str | None:
        if v is None:
            return v
        prioridades_validas = ["alta", "media", "baja"]
        if v not in prioridades_validas:
            raise ValueError("La prioridad debe ser una de: alta, media, baja")
        return v

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, v: str | None) -> str | None:
        if v is None:
            return v
        estados_validos = ["pendiente", "completado"]
        if v not in estados_validos:
            raise ValueError(f"El estado debe ser uno de: {', '.join(estados_validos)}")
        return v


class TareaHogarOut(BaseSchema):
    id: UUID
    hogar_id: UUID
    nombre: str
    asignado_a: str | None
    frecuencia: str
    prioridad: str
    ultimo_completado: datetime | None
    estado: str
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


# Aliases de compatibilidad para el repositorio y otros servicios
TareaHogarCreate = TareaHogarIn
TareaHogarResponse = TareaHogarOut


# --- EVENTOS CALENDARIO ---
class EventoCalendarioCreate(BaseSchema):
    titulo: str = Field(
        ..., min_length=2, max_length=200, description="Título del evento o cita"
    )
    descripcion: str | None = Field(None, description="Notas aclaratorias adicionales")
    fecha_inicio: datetime = Field(
        ..., description="Fecha y hora de inicio con zona horaria"
    )
    fecha_fin: datetime = Field(
        ..., description="Fecha y hora de finalización con zona horaria"
    )
    participantes: list[str] | None = Field(
        None, description="Miembros familiares participantes"
    )

    @model_validator(mode="after")
    def validar_fechas_consistentes(self) -> "EventoCalendarioCreate":
        # La fecha de fin debe ser estrictamente posterior a la de inicio.
        if self.fecha_fin <= self.fecha_inicio:
            raise ValueError("La fecha de fin debe ser posterior a la fecha de inicio")
        return self


class EventoCalendarioUpdate(BaseSchema):
    titulo: str | None = Field(None, min_length=2, max_length=200)
    descripcion: str | None = Field(None)
    fecha_inicio: datetime | None = Field(None)
    fecha_fin: datetime | None = Field(None)
    participantes: list[str] | None = Field(None)

    @model_validator(mode="after")
    def validar_fechas_consistentes(self) -> "EventoCalendarioUpdate":
        # PATCH parcial: solo se valida si llegan AMBAS fechas (la consistencia
        # contra el evento persistido la garantiza CalendarService.update_event).
        if (
            self.fecha_inicio is not None
            and self.fecha_fin is not None
            and self.fecha_fin <= self.fecha_inicio
        ):
            raise ValueError("La fecha de fin debe ser posterior a la fecha de inicio")
        return self


class EventoCalendarioResponse(BaseSchema):
    id: UUID
    hogar_id: UUID
    titulo: str
    descripcion: str | None
    fecha_inicio: datetime
    fecha_fin: datetime
    participantes: list[str] | None
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


# --- SERVICE LAYER RESPONSES ---


class ConflictoDetalle(BaseSchema):
    evento_a: EventoCalendarioResponse = Field(
        ..., description="Primer evento del conflicto"
    )
    evento_b: EventoCalendarioResponse = Field(
        ..., description="Segundo evento del conflicto"
    )
    duracion_solapamiento_segundos: float = Field(
        ..., description="Duración de la superposición en segundos"
    )


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
    eventos_hoy: list[EventoCalendarioResponse] = Field(
        default_factory=list,
        description="Lista de eventos activos programados para hoy",
    )
    alertas_despensa: PantryStockMetrics = Field(
        ..., description="Estado de métricas de stock y alertas de caducidad"
    )
    tareas_pendientes: list[TareaHogarResponse] = Field(
        default_factory=list,
        description="Lista de tareas del hogar con estado pendiente",
    )
    conflictos_agenda: list[ConflictoDetalle] = Field(
        default_factory=list,
        description="Lista de conflictos de solapamiento horario de hoy",
    )
    briefing_texto: str | None = Field(
        None, description="Resumen ejecutivo amigable generado por IA"
    )
    briefing_generado_por_ia: bool = Field(
        False,
        description="True si el briefing proviene del modelo de IA (obliga a mostrar el aviso de transparencia); False si es el fallback estático",
    )


class CalendarAgendaResponse(BaseSchema):
    eventos: list[EventoCalendarioResponse] = Field(
        default_factory=list, description="Eventos del hogar"
    )
    conflictos: list[ConflictoDetalle] = Field(
        default_factory=list, description="Conflictos de solapamiento de horarios"
    )


# --- INTERPRETACIÓN DE EVENTOS EN LENGUAJE NATURAL (IA) ---


class InterpretarEventoRequest(BaseSchema):
    texto: str = Field(
        ...,
        min_length=3,
        max_length=300,
        description="Frase en lenguaje natural que describe el evento (ej: 'dentista mañana a las 10 con papá')",
    )
    fecha_referencia: datetime = Field(
        ...,
        description="Fecha y hora actual del dispositivo del usuario para resolver expresiones relativas",
    )


class EventoInterpretado(BaseSchema):
    titulo: str = Field(..., min_length=2, max_length=200)
    descripcion: str | None = Field(None)
    fecha_inicio: datetime
    fecha_fin: datetime
    participantes: list[str] | None = Field(None)


class InterpretarEventoResponse(BaseSchema):
    evento: EventoInterpretado | None = Field(
        None,
        description="Propuesta de evento interpretada por la IA (el usuario debe confirmarla)",
    )
    mensaje: str | None = Field(
        None, description="Motivo cuando no se pudo interpretar la frase"
    )


# --- INTERPRETACIÓN DE TAREAS EN LENGUAJE NATURAL (IA) ---


class InterpretarTareaRequest(BaseSchema):
    texto: str = Field(
        ...,
        min_length=3,
        max_length=300,
        description="Frase en lenguaje natural que describe la tarea (ej: 'poner la lavadora cada martes, le toca a papá')",
    )


class TareaInterpretada(BaseSchema):
    nombre: str = Field(..., min_length=2, max_length=200)
    asignado_a: str | None = Field(None, max_length=100)
    frecuencia: str = Field(
        "ocasional", max_length=50, description="diaria, semanal, mensual u ocasional"
    )
    prioridad: str = Field("media", description="alta, media o baja")

    @field_validator("prioridad")
    @classmethod
    def normalizar_prioridad(cls, v: str) -> str:
        return v if v in ("alta", "media", "baja") else "media"

    @field_validator("frecuencia")
    @classmethod
    def normalizar_frecuencia(cls, v: str) -> str:
        return v if v in ("diaria", "semanal", "mensual", "ocasional") else "ocasional"


class InterpretarTareaResponse(BaseSchema):
    tarea: TareaInterpretada | None = Field(
        None,
        description="Propuesta de tarea interpretada por la IA (el usuario debe confirmarla)",
    )
    mensaje: str | None = Field(
        None, description="Motivo cuando no se pudo interpretar la frase"
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
