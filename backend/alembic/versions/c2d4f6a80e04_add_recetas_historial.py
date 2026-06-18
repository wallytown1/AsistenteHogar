"""Add recetas_historial table (F-PIVOT #5: behavior learning)

Registra acciones del hogar sobre recetas sugeridas ('cocinada' | 'rechazada')
para realimentar el prompt de Gemini y que las sugerencias mejoren con el uso.

Revision ID: c2d4f6a80e04
Revises: a1c3e5f70b92
Create Date: 2026-06-18 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c2d4f6a80e04'
down_revision: Union[str, Sequence[str], None] = 'a1c3e5f70b92'
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
        'recetas_historial',
        sa.Column('id', uuid_type, nullable=False),
        sa.Column('hogar_id', uuid_type, nullable=False),
        sa.Column('nombre_receta', sa.String(200), nullable=False),
        sa.Column('accion', sa.String(20), nullable=False),
        sa.Column('cocinada_en', sa.DateTime(timezone=True), server_default=default_now, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=default_now, nullable=False),
        sa.ForeignKeyConstraint(['hogar_id'], ['hogares.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_recetas_historial_hogar_id', 'recetas_historial', ['hogar_id'])


def downgrade() -> None:
    op.drop_index('ix_recetas_historial_hogar_id', table_name='recetas_historial')
    op.drop_table('recetas_historial')
