"""Add performance indexes for filtered queries

Revision ID: 3e8f2a1b9c7d
Revises: f2c91d7a5b40
Create Date: 2026-06-11 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = "3e8f2a1b9c7d"
down_revision: Union[str, None] = "f2c91d7a5b40"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # get_pending_tasks: WHERE hogar_id = ? AND estado = 'pendiente' AND is_deleted = false
    op.create_index(
        "ix_tareas_hogar_estado",
        "tareas_hogar",
        ["hogar_id", "estado", "is_deleted"],
    )
    # Dashboard calendar range queries: WHERE hogar_id = ? AND fecha_inicio BETWEEN ...
    op.create_index(
        "ix_eventos_calendario_fecha_inicio",
        "eventos_calendario",
        ["hogar_id", "fecha_inicio"],
    )
    op.create_index(
        "ix_eventos_calendario_fecha_fin",
        "eventos_calendario",
        ["hogar_id", "fecha_fin"],
    )


def downgrade() -> None:
    op.drop_index("ix_eventos_calendario_fecha_fin", table_name="eventos_calendario")
    op.drop_index("ix_eventos_calendario_fecha_inicio", table_name="eventos_calendario")
    op.drop_index("ix_tareas_hogar_estado", table_name="tareas_hogar")
