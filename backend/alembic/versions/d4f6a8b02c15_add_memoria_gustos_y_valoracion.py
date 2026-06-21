"""Add memoria_gustos table y valoracion/categoria en recetas_historial

Revision ID: d4f6a8b02c15
Revises: c6d8f0a1b2e3
Create Date: 2026-06-21 18:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4f6a8b02c15"
down_revision: Union[str, Sequence[str], None] = "c6d8f0a1b2e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    default_now = (
        sa.text("CURRENT_TIMESTAMP")
        if is_sqlite
        else sa.text("timezone('utc'::text, now())")
    )
    uuid_type = sa.String(36) if is_sqlite else sa.UUID()

    # Señal de feedback más rica en el historial de recetas.
    op.add_column(
        "recetas_historial",
        sa.Column("valoracion", sa.String(20), nullable=True),
    )
    op.add_column(
        "recetas_historial",
        sa.Column("categoria", sa.String(50), nullable=True),
    )

    # Memoria de gustos destilada (una por hogar).
    op.create_table(
        "memoria_gustos",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("hogar_id", uuid_type, nullable=False),
        sa.Column("resumen", sa.String(2000), nullable=False, server_default=""),
        sa.Column(
            "eventos_fuente", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=default_now,
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=default_now,
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["hogar_id"], ["hogares.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("hogar_id", name="uq_memoria_gustos_hogar_id"),
    )
    op.create_index(
        op.f("ix_memoria_gustos_hogar_id"),
        "memoria_gustos",
        ["hogar_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_memoria_gustos_hogar_id"), table_name="memoria_gustos")
    op.drop_table("memoria_gustos")
    op.drop_column("recetas_historial", "categoria")
    op.drop_column("recetas_historial", "valoracion")
