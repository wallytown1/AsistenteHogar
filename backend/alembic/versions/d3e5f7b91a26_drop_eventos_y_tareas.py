"""Drop eventos_calendario y tareas_hogar (Pivote 2: app exclusiva de comida)

La app pasa a centrarse exclusivamente en comida, stock y recetas. Los módulos
de Eventos (calendario) y Tareas (domésticas) se eliminan de raíz. El downgrade
recrea ambas tablas (reversible) por seguridad operativa.

Revision ID: d3e5f7b91a26
Revises: c2d4f6a80e04
Create Date: 2026-06-18 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd3e5f7b91a26'
down_revision: Union[str, Sequence[str], None] = 'c2d4f6a80e04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing = set(insp.get_table_names())

    if "eventos_calendario" in existing:
        for idx in insp.get_indexes("eventos_calendario"):
            op.drop_index(idx["name"], table_name="eventos_calendario")
        op.drop_table("eventos_calendario")

    if "tareas_hogar" in existing:
        for idx in insp.get_indexes("tareas_hogar"):
            op.drop_index(idx["name"], table_name="tareas_hogar")
        op.drop_table("tareas_hogar")


def downgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    default_now = (
        sa.text("CURRENT_TIMESTAMP")
        if is_sqlite
        else sa.text("timezone('utc'::text, now())")
    )
    uuid_type = sa.String(36) if is_sqlite else sa.UUID()

    op.create_table(
        "tareas_hogar",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("hogar_id", uuid_type, nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("asignado_a", sa.String(100), nullable=True),
        sa.Column("frecuencia", sa.String(50), nullable=False),
        sa.Column("ultimo_completado", sa.DateTime(timezone=True), nullable=True),
        sa.Column("estado", sa.String(30), nullable=False),
        sa.Column("prioridad", sa.String(20), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=default_now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=default_now, nullable=False),
        sa.ForeignKeyConstraint(["hogar_id"], ["hogares.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tareas_hogar_hogar_id", "tareas_hogar", ["hogar_id"])
    op.create_index("ix_tareas_hogar_is_deleted", "tareas_hogar", ["is_deleted"])

    op.create_table(
        "eventos_calendario",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("hogar_id", uuid_type, nullable=False),
        sa.Column("titulo", sa.String(200), nullable=False),
        sa.Column("descripcion", sa.String(), nullable=True),
        sa.Column("fecha_inicio", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fecha_fin", sa.DateTime(timezone=True), nullable=False),
        sa.Column("participantes", sa.JSON(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=default_now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=default_now, nullable=False),
        sa.ForeignKeyConstraint(["hogar_id"], ["hogares.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_eventos_calendario_hogar_id", "eventos_calendario", ["hogar_id"])
    op.create_index("ix_eventos_calendario_is_deleted", "eventos_calendario", ["is_deleted"])
