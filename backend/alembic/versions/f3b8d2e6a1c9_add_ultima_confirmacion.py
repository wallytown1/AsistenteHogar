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
    if is_sqlite:
        # SQLite does not allow non-constant defaults like CURRENT_TIMESTAMP in ALTER TABLE ADD COLUMN.
        # We use a constant datetime string instead.
        op.add_column(
            "inventario_alimentos",
            sa.Column(
                "ultima_confirmacion",
                sa.DateTime(timezone=True),
                server_default="2026-06-22 00:00:00",
                nullable=False,
            ),
        )
    else:
        op.add_column(
            "inventario_alimentos",
            sa.Column(
                "ultima_confirmacion",
                sa.DateTime(timezone=True),
                server_default=sa.text("timezone('utc'::text, now())"),
                nullable=False,
            ),
        )


def downgrade() -> None:
    op.drop_column("inventario_alimentos", "ultima_confirmacion")
