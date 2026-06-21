"""Add movimientos_despensa (ledger de entradas/salidas de stock)

Revision ID: e7a9c1b3d5f0
Revises: d4f6a8b02c15
Create Date: 2026-06-21 20:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e7a9c1b3d5f0"
down_revision: Union[str, Sequence[str], None] = "d4f6a8b02c15"
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
        "movimientos_despensa",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("hogar_id", uuid_type, nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("tipo", sa.String(20), nullable=False),
        sa.Column("cantidad", sa.Numeric(10, 2), nullable=True),
        sa.Column("unidad", sa.String(50), nullable=True),
        sa.Column(
            "origen", sa.String(20), nullable=False, server_default="manual"
        ),
        sa.Column(
            "fecha",
            sa.DateTime(timezone=True),
            server_default=default_now,
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=default_now,
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["hogar_id"], ["hogares.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_movimientos_despensa_hogar_id"),
        "movimientos_despensa",
        ["hogar_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_movimientos_despensa_nombre"),
        "movimientos_despensa",
        ["nombre"],
        unique=False,
    )
    op.create_index(
        op.f("ix_movimientos_despensa_fecha"),
        "movimientos_despensa",
        ["fecha"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_movimientos_despensa_fecha"), table_name="movimientos_despensa"
    )
    op.drop_index(
        op.f("ix_movimientos_despensa_nombre"), table_name="movimientos_despensa"
    )
    op.drop_index(
        op.f("ix_movimientos_despensa_hogar_id"), table_name="movimientos_despensa"
    )
    op.drop_table("movimientos_despensa")
