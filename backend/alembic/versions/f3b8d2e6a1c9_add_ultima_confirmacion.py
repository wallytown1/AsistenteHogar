"""Add ultima_confirmacion a inventario_alimentos (confianza que decae)

Revision ID: f3b8d2e6a1c9
Revises: e7a9c1b3d5f0
Create Date: 2026-06-22 11:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3b8d2e6a1c9"
down_revision: Union[str, Sequence[str], None] = "e7a9c1b3d5f0"
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
    # server_default para que las filas existentes tomen "ahora" como última confirmación.
    op.add_column(
        "inventario_alimentos",
        sa.Column(
            "ultima_confirmacion",
            sa.DateTime(timezone=True),
            server_default=default_now,
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("inventario_alimentos", "ultima_confirmacion")
