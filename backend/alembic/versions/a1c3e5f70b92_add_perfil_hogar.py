"""Add perfil_hogar table (onboarding: gustos culinarios + nº comensales)

Datos NO sensibles únicamente. Alergias/intolerancias (RGPD art. 9) pospuestas a
una iteración con consentimiento explícito dedicado.

Revision ID: a1c3e5f70b92
Revises: b7d4e9a2c1f8
Create Date: 2026-06-17 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1c3e5f70b92'
down_revision: Union[str, Sequence[str], None] = 'b7d4e9a2c1f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    default_now = sa.text("CURRENT_TIMESTAMP") if is_sqlite else sa.text("timezone('utc'::text, now())")
    uuid_type = sa.String(36) if is_sqlite else sa.UUID()

    op.create_table('perfil_hogar',
    sa.Column('id', uuid_type, nullable=False),
    sa.Column('hogar_id', uuid_type, nullable=False),
    sa.Column('gustos_culinarios', sa.JSON(), nullable=False),
    sa.Column('num_comensales', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=default_now, nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=default_now, nullable=False),
    sa.ForeignKeyConstraint(['hogar_id'], ['hogares.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('hogar_id')
    )
    op.create_index(op.f('ix_perfil_hogar_hogar_id'), 'perfil_hogar', ['hogar_id'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_perfil_hogar_hogar_id'), table_name='perfil_hogar')
    op.drop_table('perfil_hogar')
