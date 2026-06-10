import uuid
from datetime import datetime, date, timezone
from typing import List, Optional
from sqlalchemy import String, Numeric, Boolean, DateTime, Date, ForeignKey, JSON, UUID as SQL_UUID, TypeDecorator
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql import expression

from app.database import Base

class TZDateTime(TypeDecorator):
    """Garantiza que todos los datetimes de la base de datos se manejen como timezone-aware en UTC."""
    impl = DateTime(timezone=True)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            else:
                value = value.astimezone(timezone.utc)
        return value

    def process_result_value(self, value, dialect):
        if value is not None:
            if value.tzinfo is None:
                value = value.replace(tzinfo=timezone.utc)
            else:
                value = value.astimezone(timezone.utc)
        return value

# Tipo de datos UUID multiplataforma (PostgreSQL nativo / SQLite en CHAR(36))
UUID_TYPE = SQL_UUID(as_uuid=True)

# Elemento SQL personalizado para obtener utcnow compilado según el dialecto
class utcnow(expression.FunctionElement):
    type = TZDateTime
    inherit_cache = True

@compiles(utcnow, "postgresql")
def pg_utcnow(element, compiler, **kw):
    return "timezone('utc'::text, now())"

@compiles(utcnow, "sqlite")
def sqlite_utcnow(element, compiler, **kw):
    # En SQLite, datetime('now') retorna la fecha y hora UTC actual en texto
    return "datetime('now')"

@compiles(utcnow)
def default_utcnow(element, compiler, **kw):
    return "CURRENT_TIMESTAMP"


class Hogar(Base):
    __tablename__ = "hogares"

    id: Mapped[uuid.UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, 
        nullable=False, 
        server_default=utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime, 
        nullable=False, 
        server_default=utcnow(),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relaciones declarativas
    alimentos: Mapped[List["InventarioAlimento"]] = relationship("InventarioAlimento", back_populates="hogar", cascade="all, delete-orphan")
    tareas: Mapped[List["TareaHogar"]] = relationship("TareaHogar", back_populates="hogar", cascade="all, delete-orphan")
    eventos: Mapped[List["EventoCalendario"]] = relationship("EventoCalendario", back_populates="hogar", cascade="all, delete-orphan")
    usuarios: Mapped[List["Usuario"]] = relationship("Usuario", back_populates="hogar", cascade="all, delete-orphan")


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    hogar_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE,
        ForeignKey("hogares.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        nullable=False,
        server_default=utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime,
        nullable=False,
        server_default=utcnow(),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relaciones
    hogar: Mapped["Hogar"] = relationship("Hogar", back_populates="usuarios")


class InventarioAlimento(Base):
    __tablename__ = "inventario_alimentos"

    id: Mapped[uuid.UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    hogar_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, 
        ForeignKey("hogares.id", ondelete="CASCADE"), 
        nullable=False, 
        index=True
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    cantidad: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0.00)
    unidad: Mapped[str] = mapped_column(String(30), nullable=False)
    fecha_caducidad: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    categoria: Mapped[str] = mapped_column(String(50), nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, 
        nullable=False, 
        server_default=utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime, 
        nullable=False, 
        server_default=utcnow(),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relaciones
    hogar: Mapped["Hogar"] = relationship("Hogar", back_populates="alimentos")


class TareaHogar(Base):
    __tablename__ = "tareas_hogar"

    id: Mapped[uuid.UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    hogar_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, 
        ForeignKey("hogares.id", ondelete="CASCADE"), 
        nullable=False, 
        index=True
    )
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    asignado_a: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    frecuencia: Mapped[str] = mapped_column(String(50), nullable=False)
    ultimo_completado: Mapped[Optional[datetime]] = mapped_column(TZDateTime, nullable=True)
    estado: Mapped[str] = mapped_column(String(30), nullable=False, default="pendiente")
    prioridad: Mapped[str] = mapped_column(String(20), nullable=False, default="media")
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, 
        nullable=False, 
        server_default=utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime, 
        nullable=False, 
        server_default=utcnow(),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relaciones
    hogar: Mapped["Hogar"] = relationship("Hogar", back_populates="tareas")


class EventoCalendario(Base):
    __tablename__ = "eventos_calendario"

    id: Mapped[uuid.UUID] = mapped_column(UUID_TYPE, primary_key=True, default=uuid.uuid4)
    hogar_id: Mapped[uuid.UUID] = mapped_column(
        UUID_TYPE, 
        ForeignKey("hogares.id", ondelete="CASCADE"), 
        nullable=False, 
        index=True
    )
    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    descripcion: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    fecha_inicio: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    fecha_fin: Mapped[datetime] = mapped_column(TZDateTime, nullable=False)
    participantes: Mapped[Optional[List[str]]] = mapped_column(JSON, nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime, 
        nullable=False, 
        server_default=utcnow()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime, 
        nullable=False, 
        server_default=utcnow(),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relaciones
    hogar: Mapped["Hogar"] = relationship("Hogar", back_populates="eventos")
