import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    TypeDecorator,
)
from sqlalchemy import UUID as SQL_UUID
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import expression
from sqlalchemy.types import TypeEngine

from app.database import Base


class TZDateTime(TypeDecorator[datetime]):
    """Garantiza que todos los datetimes de la base de datos se manejen como timezone-aware en UTC."""

    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(
        self, value: datetime | None, dialect: Dialect
    ) -> datetime | None:
        if value is not None:
            if value.tzinfo is None:
                value = value.replace(tzinfo=UTC)
            else:
                value = value.astimezone(UTC)
        return value

    def process_result_value(
        self, value: datetime | None, dialect: Dialect
    ) -> datetime | None:
        if value is not None:
            if value.tzinfo is None:
                value = value.replace(tzinfo=UTC)
            else:
                value = value.astimezone(UTC)
        return value


# Tipo de datos UUID multiplataforma (PostgreSQL nativo / SQLite en CHAR(36))
UUID_TYPE = SQL_UUID(as_uuid=True)


# Elemento SQL personalizado para obtener utcnow compilado según el dialecto
class utcnow(expression.FunctionElement[datetime]):
    type: TypeEngine[datetime] = TZDateTime()
    inherit_cache = True


@compiles(utcnow, "postgresql")
def pg_utcnow(element: Any, compiler: Any, **kw: Any) -> str:
    return "timezone('utc'::text, now())"


@compiles(utcnow, "sqlite")
def sqlite_utcnow(element: Any, compiler: Any, **kw: Any) -> str:
    # En SQLite, datetime('now') retorna la fecha y hora UTC actual en texto
    return "datetime('now')"


@compiles(utcnow)
def default_utcnow(element: Any, compiler: Any, **kw: Any) -> str:
    return "CURRENT_TIMESTAMP"


class Hogar(Base):
    __tablename__ = "hogares"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        nullable=False,
        server_default=utcnow(),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relaciones declarativas
    alimentos: Mapped[list["InventarioAlimento"]] = relationship(
        "InventarioAlimento", back_populates="hogar", cascade="all, delete-orphan"
    )
    usuarios: Mapped[list["Usuario"]] = relationship(
        "Usuario", back_populates="hogar", cascade="all, delete-orphan"
    )
    perfil: Mapped["PerfilHogar | None"] = relationship(
        "PerfilHogar",
        back_populates="hogar",
        cascade="all, delete-orphan",
        uselist=False,
    )
    historial_recetas: Mapped[list["RecetaHistorial"]] = relationship(
        "RecetaHistorial", back_populates="hogar", cascade="all, delete-orphan"
    )
    perfiles_individuales: Mapped[list["PerfilIndividual"]] = relationship(
        "PerfilIndividual", back_populates="hogar", cascade="all, delete-orphan"
    )
    lista_compra: Mapped[list["ListaCompraItem"]] = relationship(
        "ListaCompraItem", back_populates="hogar", cascade="all, delete-orphan"
    )
    memoria_gustos: Mapped["MemoriaGustos | None"] = relationship(
        "MemoriaGustos",
        back_populates="hogar",
        cascade="all, delete-orphan",
        uselist=False,
    )
    movimientos: Mapped[list["MovimientoDespensa"]] = relationship(
        "MovimientoDespensa", back_populates="hogar", cascade="all, delete-orphan"
    )


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    hogar_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("hogares.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        nullable=False,
        server_default=utcnow(),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relaciones
    hogar: Mapped["Hogar"] = relationship("Hogar", back_populates="usuarios")


class InventarioAlimento(Base):
    __tablename__ = "inventario_alimentos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    hogar_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("hogares.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    cantidad: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False, default=0.00
    )
    unidad: Mapped[str] = mapped_column(String(30), nullable=False)
    fecha_caducidad: Mapped[date | None] = mapped_column(Date, nullable=True)
    categoria: Mapped[str] = mapped_column(String(50), nullable=False)
    # Última vez que el hogar confirmó tener este alimento (alta, reposición o "sigo
    # teniéndolo"). Base de la "confianza que decae": pasada la cadencia de compra sin
    # confirmar, el alimento se marca como incierto.
    ultima_confirmacion: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        nullable=False,
        server_default=utcnow(),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relaciones
    hogar: Mapped["Hogar"] = relationship("Hogar", back_populates="alimentos")


class RegistroBorrado(Base):
    """Auditoría de supresión (RGPD art. 5.2 y 17). Deliberadamente sin datos
    personales ni hogar_id: solo acredita que el mecanismo de borrado se ejecutó,
    cuándo y cuántas filas eliminó. Identificar al usuario suprimido violaría
    la propia supresión."""

    __tablename__ = "registros_borrado"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    tipo_evento: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # 'purga_programada' | 'eliminacion_cuenta'
    motivo: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # 'retencion_30_dias' | 'solicitud_usuario'
    registros_afectados: Mapped[int] = mapped_column(Integer, nullable=False)
    ejecutado_en: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )


class PerfilHogar(Base):
    """Perfil de preferencias del hogar (encuesta de onboarding). Un perfil por hogar
    (hogar_id único, upsert). Solo datos NO sensibles: gustos culinarios y nº de
    comensales. Las alergias e intolerancias (datos de salud, RGPD art. 9) se posponen
    a una iteración futura con un flujo de consentimiento explícito dedicado."""

    __tablename__ = "perfil_hogar"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    hogar_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("hogares.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    gustos_culinarios: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list
    )
    num_comensales: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        nullable=False,
        server_default=utcnow(),
        onupdate=lambda: datetime.now(UTC),
    )

    # Relaciones
    hogar: Mapped["Hogar"] = relationship("Hogar", back_populates="perfil")


class RecetaHistorial(Base):
    """Registro de comportamiento del hogar respecto a recetas sugeridas.
    'cocinada' = señal positiva; 'rechazada' = señal negativa.
    El historial se inyecta en el prompt de Gemini para que las sugerencias
    aprendan del comportamiento real del hogar."""

    __tablename__ = "recetas_historial"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    hogar_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("hogares.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nombre_receta: Mapped[str] = mapped_column(String(200), nullable=False)
    accion: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # 'cocinada' | 'rechazada'
    # Señal de feedback explícita (opcional): refuerza el aprendizaje de gustos.
    valoracion: Mapped[str | None] = mapped_column(
        String(20), nullable=True
    )  # 'me_encanto' | 'gusto' | 'no_me_gusto' | None
    # Categoría/tipo de plato para aprender qué ESTILO de comida gusta, no solo
    # recetas concretas (p. ej. 'guiso', 'arroz', 'pescado', 'legumbre').
    categoria: Mapped[str | None] = mapped_column(String(50), nullable=True)
    cocinada_en: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )

    hogar: Mapped["Hogar"] = relationship("Hogar", back_populates="historial_recetas")


class PerfilIndividual(Base):
    """Perfil culinario de un miembro del hogar (apodo + preferencias de dieta +
    ingredientes a evitar). Solo preferencias gastronómicas — NO se almacenan alergias
    ni intolerancias médicas (datos de salud RGPD art. 9). Máximo 10 por hogar."""

    __tablename__ = "perfiles_individuales"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    hogar_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("hogares.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    preferencias_dieta: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list
    )
    excluir_ingredientes: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, default=list
    )
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        nullable=False,
        server_default=utcnow(),
        onupdate=lambda: datetime.now(UTC),
    )

    hogar: Mapped["Hogar"] = relationship(
        "Hogar", back_populates="perfiles_individuales"
    )


class MemoriaGustos(Base):
    """Memoria de gustos destilada del hogar: un resumen en lenguaje natural de las
    preferencias aprendidas con el uso (gustos del onboarding + perfiles + historial
    valorado). Uno por hogar (hogar_id único, upsert). Solo datos gastronómicos — NUNCA
    datos de salud (RGPD art. 9). Se inyecta en los prompts del LLM para que el asistente
    'recuerde' al hogar manteniendo el prompt acotado (tamaño fijo vs historial creciente)."""

    __tablename__ = "memoria_gustos"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    hogar_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("hogares.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    resumen: Mapped[str] = mapped_column(String(2000), nullable=False, default="")
    # Nº de señales de historial ya incorporadas al resumen: permite detectar cuándo
    # la memoria está obsoleta (hay nuevas señales sin destilar) y recalcular.
    eventos_fuente: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        nullable=False,
        server_default=utcnow(),
        onupdate=lambda: datetime.now(UTC),
    )

    hogar: Mapped["Hogar"] = relationship("Hogar", back_populates="memoria_gustos")


class MovimientoDespensa(Base):
    """Ledger de movimientos de la despensa (entradas/salidas). Se rellena como efecto
    secundario de las escrituras de stock (compra/consumo/caducado) para aprender los
    hábitos de compra/consumo del hogar y afinar las sugerencias. Solo datos gastronómicos
    (nombres de alimentos + cantidades + fechas), sin identificadores personales."""

    __tablename__ = "movimientos_despensa"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    hogar_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("hogares.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nombre: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    # 'compra' | 'consumo' | 'caducado' | 'ajuste'
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)
    cantidad: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    unidad: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # 'ticket' | 'manual' | 'cocina' | 'voz' | 'foto' | 'agotado' | 'edicion'
    origen: Mapped[str] = mapped_column(String(20), nullable=False, default="manual")
    fecha: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow(), index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )

    hogar: Mapped["Hogar"] = relationship("Hogar", back_populates="movimientos")


class ListaCompraItem(Base):
    """Ítem de la lista de la compra del hogar. Soft delete vía is_deleted."""

    __tablename__ = "lista_compra"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    hogar_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("hogares.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    cantidad: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    unidad: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_checked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_deleted: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        nullable=False,
        server_default=utcnow(),
        onupdate=lambda: datetime.now(UTC),
    )

    hogar: Mapped["Hogar"] = relationship("Hogar", back_populates="lista_compra")


class AdminUser(Base):
    """Usuario del panel de administración. Global (sin hogar_id).
    JWT firmado con ADMIN_JWT_SECRET_KEY, completamente separado de los JWT familiares."""

    __tablename__ = "admin_users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(
        String(255), nullable=False, unique=True, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )


class PromptTemplate(Base):
    """Plantilla de system instruction editable desde el panel admin.
    La clave identifica el prompt (ej. 'recetas', 'plan_comidas').
    PromptConfigService siempre añade _FILOSOFIA_MEDITERRANEA al resultado final."""

    __tablename__ = "prompt_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    clave: Mapped[str] = mapped_column(
        String(50), nullable=False, unique=True, index=True
    )
    system_instruction: Mapped[str] = mapped_column(String(8000), nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        nullable=False,
        server_default=utcnow(),
        onupdate=lambda: datetime.now(UTC),
    )


class RecetaMaestra(Base):
    """Receta mediterránea española del catálogo maestro. Global (sin hogar_id).
    Hard delete autorizado: no contiene datos personales."""

    __tablename__ = "recetario_maestro"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    nombre: Mapped[str] = mapped_column(
        String(200), nullable=False, unique=True, index=True
    )
    ingredientes: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    pasos: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    categoria: Mapped[str] = mapped_column(String(50), nullable=False)
    temporada: Mapped[str | None] = mapped_column(String(50), nullable=True)
    aprovechamiento: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    activa: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        nullable=False,
        server_default=utcnow(),
        onupdate=lambda: datetime.now(UTC),
    )
