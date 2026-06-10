from datetime import datetime, date
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field, field_validator, ConfigDict

# Configuración base para todos los esquemas Pydantic v2
class BaseSchema(BaseModel):
    model_config = ConfigDict(
        extra="forbid",        # Prohibir payloads con campos adicionales no mapeados
        from_attributes=True,  # Permitir serialización desde objetos ORM de SQLAlchemy
    )

# --- HOGAR ---
class HogarCreate(BaseSchema):
    nombre: str = Field(..., min_length=2, max_length=100, description="Nombre descriptivo del núcleo familiar")

class HogarUpdate(BaseSchema):
    nombre: Optional[str] = Field(None, min_length=2, max_length=100)

class HogarResponse(BaseSchema):
    id: UUID
    nombre: str
    created_at: datetime
    updated_at: datetime


# --- AUTENTICACIÓN Y USUARIOS ---
class RegistroRequest(BaseSchema):
    nombre_hogar: str = Field(..., min_length=2, max_length=100, description="Nombre del nuevo hogar (ej: Familia Navarro)")
    nombre: str = Field(..., min_length=2, max_length=100, description="Nombre del usuario que se registra")
    email: EmailStr = Field(..., max_length=255, description="Email único del usuario")
    password: str = Field(..., min_length=8, max_length=72, description="Contraseña (mínimo 8 caracteres, máximo 72 por límite de bcrypt)")

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


# --- INVENTARIO ALIMENTOS ---
class InventarioAlimentoCreate(BaseSchema):
    nombre: str = Field(..., min_length=1, max_length=150, description="Nombre del alimento")
    cantidad: float = Field(..., gt=0.0, description="Cantidad en despensa (debe ser estrictamente mayor que 0)")
    unidad: str = Field(..., min_length=1, max_length=30, description="Unidad de medida (ej: litros, gramos, unidades)")
    fecha_caducidad: Optional[date] = Field(None, description="Fecha de vencimiento del producto")
    categoria: str = Field(..., min_length=1, max_length=50, description="Categoría de clasificación")

    @field_validator("fecha_caducidad")
    @classmethod
    def validar_fecha_futura(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v < date.today():
            raise ValueError("La fecha de caducidad no puede ser en el pasado")
        return v

class InventarioAlimentoUpdate(BaseSchema):
    nombre: Optional[str] = Field(None, min_length=1, max_length=150)
    cantidad: Optional[float] = Field(None, gt=0.0, description="Cantidad (debe ser mayor que 0)")
    unidad: Optional[str] = Field(None, min_length=1, max_length=30)
    fecha_caducidad: Optional[date] = Field(None)
    categoria: Optional[str] = Field(None, min_length=1, max_length=50)

    @field_validator("fecha_caducidad")
    @classmethod
    def validar_fecha_futura(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v < date.today():
            raise ValueError("La fecha de caducidad no puede ser en el pasado")
        return v

class InventarioAlimentoResponse(BaseSchema):
    id: UUID
    hogar_id: UUID
    nombre: str
    cantidad: float
    unidad: str
    fecha_caducidad: Optional[date]
    categoria: str
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


# --- TAREAS HOGAR ---
class TareaHogarIn(BaseSchema):
    nombre: str = Field(..., min_length=2, max_length=200, description="Descripción o nombre de la tarea")
    asignado_a: Optional[str] = Field(None, max_length=100, description="Miembro de la familia asignado")
    frecuencia: str = Field(..., min_length=2, max_length=50, description="Ej: diaria, semanal, mensual")
    prioridad: str = Field("media", description="Prioridad de la tarea (alta, media, baja)")
    estado: str = Field("pendiente", min_length=2, max_length=30, description="Estado inicial de la tarea")

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
    nombre: Optional[str] = Field(None, min_length=2, max_length=200)
    asignado_a: Optional[str] = Field(None, max_length=100)
    frecuencia: Optional[str] = Field(None, min_length=2, max_length=50)
    ultimo_completado: Optional[datetime] = Field(None)
    prioridad: Optional[str] = Field(None, description="Prioridad de la tarea (alta, media, baja)")
    estado: Optional[str] = Field(None, min_length=2, max_length=30)

    @field_validator("prioridad")
    @classmethod
    def validar_prioridad(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        prioridades_validas = ["alta", "media", "baja"]
        if v not in prioridades_validas:
            raise ValueError("La prioridad debe ser una de: alta, media, baja")
        return v

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, v: Optional[str]) -> Optional[str]:
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
    asignado_a: Optional[str]
    frecuencia: str
    prioridad: str
    ultimo_completado: Optional[datetime]
    estado: str
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

# Aliases de compatibilidad para el repositorio y otros servicios
TareaHogarCreate = TareaHogarIn
TareaHogarResponse = TareaHogarOut



# --- EVENTOS CALENDARIO ---
class EventoCalendarioCreate(BaseSchema):
    titulo: str = Field(..., min_length=2, max_length=200, description="Título del evento o cita")
    descripcion: Optional[str] = Field(None, description="Notas aclaratorias adicionales")
    fecha_inicio: datetime = Field(..., description="Fecha y hora de inicio con zona horaria")
    fecha_fin: datetime = Field(..., description="Fecha y hora de finalización con zona horaria")
    participantes: Optional[List[str]] = Field(None, description="Miembros familiares participantes")

    @field_validator("fecha_fin")
    @classmethod
    def validar_fechas_consistentes(cls, v: datetime, info) -> datetime:
        # Validación de que la fecha fin sea estrictamente mayor que la fecha de inicio
        inicio = info.data.get("fecha_inicio")
        if inicio is not None and v <= inicio:
            raise ValueError("La fecha de fin debe ser posterior a la fecha de inicio")
        return v

class EventoCalendarioUpdate(BaseSchema):
    titulo: Optional[str] = Field(None, min_length=2, max_length=200)
    descripcion: Optional[str] = Field(None)
    fecha_inicio: Optional[datetime] = Field(None)
    fecha_fin: Optional[datetime] = Field(None)
    participantes: Optional[List[str]] = Field(None)

    @field_validator("fecha_fin")
    @classmethod
    def validar_fechas_consistentes(cls, v: Optional[datetime], info) -> Optional[datetime]:
        if v is None:
            return v
        inicio = info.data.get("fecha_inicio")
        if inicio is not None and v <= inicio:
            raise ValueError("La fecha de fin debe ser posterior a la fecha de inicio")
        return v

class EventoCalendarioResponse(BaseSchema):
    id: UUID
    hogar_id: UUID
    titulo: str
    descripcion: Optional[str]
    fecha_inicio: datetime
    fecha_fin: datetime
    participantes: Optional[List[str]]
    is_deleted: bool
    created_at: datetime
    updated_at: datetime


# --- SERVICE LAYER RESPONSES ---

class ConflictoDetalle(BaseSchema):
    evento_a: EventoCalendarioResponse = Field(..., description="Primer evento del conflicto")
    evento_b: EventoCalendarioResponse = Field(..., description="Segundo evento del conflicto")
    duracion_solapamiento_segundos: float = Field(..., description="Duración de la superposición en segundos")

class PantryStockMetrics(BaseSchema):
    porcentaje_stock: float = Field(
        ..., 
        ge=0.0, 
        le=100.0, 
        description="Porcentaje total de stock de la despensa (debe estar entre 0 y 100)"
    )
    items_disponibles: int = Field(..., ge=0, description="Cantidad total de alimentos activos disponibles")
    alertas_caducidad: List[InventarioAlimentoResponse] = Field(
        default_factory=list, 
        description="Alimentos que caducan en 6 días o menos"
    )
    items: List[InventarioAlimentoResponse] = Field(
        default_factory=list,
        description="Lista completa de todos los alimentos activos en la despensa"
    )

class DashboardUnifiedContext(BaseSchema):
    fecha: str = Field(..., description="Fecha del briefing en formato ISO-8601")
    eventos_hoy: List[EventoCalendarioResponse] = Field(default_factory=list, description="Lista de eventos activos programados para hoy")
    alertas_despensa: PantryStockMetrics = Field(..., description="Estado de métricas de stock y alertas de caducidad")
    tareas_pendientes: List[TareaHogarResponse] = Field(default_factory=list, description="Lista de tareas del hogar con estado pendiente")
    conflictos_agenda: List[ConflictoDetalle] = Field(default_factory=list, description="Lista de conflictos de solapamiento horario de hoy")
    clima_temperatura: str = Field("22°C", description="Temperatura climatológica mokeada")
    clima_estado: str = Field("Parcialmente nublado", description="Estado del clima mokeado")
    briefing_texto: Optional[str] = Field(None, description="Resumen ejecutivo amigable generado por IA")

class CalendarAgendaResponse(BaseSchema):
    eventos: List[EventoCalendarioResponse] = Field(default_factory=list, description="Eventos del hogar")
    conflictos: List[ConflictoDetalle] = Field(default_factory=list, description="Conflictos de solapamiento de horarios")
