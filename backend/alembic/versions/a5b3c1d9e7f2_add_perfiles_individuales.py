"""Add perfiles_individuales table (Fase 3: perfiles culinarios por miembro del hogar)

Solo preferencias gastronómicas (dieta, ingredientes a evitar).
NO se almacenan alergias ni intolerancias médicas (RGPD art. 9).
Máximo 10 perfiles por hogar (constraint de servicio, no de BD).

Revision ID: a5b3c1d9e7f2
Revises: e1f3a5c70d84
Create Date: 2026-06-19 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a5b3c1d9e7f2"
down_revision: Union[str, Sequence[str], None] = "e1f3a5c70d84"
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

    op.create_table(
        "perfiles_individuales",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("hogar_id", uuid_type, nullable=False),
        sa.Column("nombre", sa.String(100), nullable=False),
        sa.Column("preferencias_dieta", sa.JSON(), nullable=False),
        sa.Column("excluir_ingredientes", sa.JSON(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="0" if is_sqlite else "false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=default_now, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=default_now, nullable=False),
        sa.ForeignKeyConstraint(["hogar_id"], ["hogares.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_perfiles_individuales_hogar_id"),
        "perfiles_individuales",
        ["hogar_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_perfiles_individuales_hogar_id"),
        table_name="perfiles_individuales",
    )
    op.drop_table("perfiles_individuales")
