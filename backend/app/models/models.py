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
    tareas: Mapped[list["TareaHogar"]] = relationship(
        "TareaHogar", back_populates="hogar", cascade="all, delete-orphan"
    )
    eventos: Mapped[list["EventoCalendario"]] = relationship(
        "EventoCalendario", back_populates="hogar", cascade="all, delete-orphan"
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


class TareaHogar(Base):
    __tablename__ = "tareas_hogar"

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
    asignado_a: Mapped[str | None] = mapped_column(String(100), nullable=True)
    frecuencia: Mapped[str] = mapped_column(String(50), nullable=False)
    ultimo_completado: Mapped[datetime | None] = mapped_column(
        TZDateTime, nullable=True
    )
    estado: Mapped[str] = mapped_column(String(30), nullable=False, default="pendiente")
    prioridad: Mapped[str] = mapped_column(String(20), nullable=False, default="media")
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
    hogar: Mapped["Hogar"] = relationship("Hogar", back_populates="tareas")


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


class EventoCalendario(Base):
    __tablename__ = "eventos_calendario"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, primary_key=True, default=uuid.uuid4
    )
    hogar_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("hogares.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String, nullable=True)
    fecha_inicio: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    fecha_fin: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    participantes: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
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
    hogar: Mapped["Hogar"] = relationship("Hogar", back_populates="eventos")


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
    cocinada_en: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, nullable=False, server_default=utcnow()
    )

    hogar: Mapped["Hogar"] = relationship("Hogar", back_populates="historial_recetas")
