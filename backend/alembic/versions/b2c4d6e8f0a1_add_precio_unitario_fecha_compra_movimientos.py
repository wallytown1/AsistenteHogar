"""Add precio_unitario and fecha_compra to movimientos_despensa (Fase 2 ticket parser)

Revision ID: b2c4d6e8f0a1
Revises: f3b8d2e6a1c9
Create Date: 2026-06-23 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c4d6e8f0a1"
down_revision: Union[str, Sequence[str], None] = "f3b8d2e6a1c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "movimientos_despensa",
        sa.Column("precio_unitario", sa.Numeric(10, 4), nullable=True),
    )
    op.add_column(
        "movimientos_despensa",
        sa.Column("fecha_compra", sa.Date(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("movimientos_despensa", "fecha_compra")
    op.drop_column("movimientos_despensa", "precio_unitario")
