"""Add registros_borrado table (auditoría de supresión RGPD, sin datos personales)

Revision ID: b7d4e9a2c1f8
Revises: 3e8f2a1b9c7d
Create Date: 2026-06-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d4e9a2c1f8'
down_revision: Union[str, Sequence[str], None] = '3e8f2a1b9c7d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    default_now = sa.text("CURRENT_TIMESTAMP") if is_sqlite else sa.text("timezone('utc'::text, now())")
    uuid_type = sa.String(36) if is_sqlite else sa.UUID()

    op.create_table('registros_borrado',
    sa.Column('id', uuid_type, nullable=False),
    sa.Column('tipo_evento', sa.String(length=30), nullable=False),
    sa.Column('motivo', sa.String(length=100), nullable=False),
    sa.Column('registros_afectados', sa.Integer(), nullable=False),
    sa.Column('ejecutado_en', sa.DateTime(timezone=True), server_default=default_now, nullable=False),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('registros_borrado')
