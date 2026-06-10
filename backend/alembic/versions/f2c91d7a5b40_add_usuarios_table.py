"""Add usuarios table

Revision ID: f2c91d7a5b40
Revises: 8a278436b672
Create Date: 2026-06-10 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2c91d7a5b40'
down_revision: Union[str, Sequence[str], None] = '8a278436b672'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    is_sqlite = bind.dialect.name == "sqlite"
    default_now = sa.text("CURRENT_TIMESTAMP") if is_sqlite else sa.text("timezone('utc'::text, now())")
    uuid_type = sa.String(36) if is_sqlite else sa.UUID()

    op.create_table('usuarios',
    sa.Column('id', uuid_type, nullable=False),
    sa.Column('hogar_id', uuid_type, nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('nombre', sa.String(length=100), nullable=False),
    sa.Column('hashed_password', sa.String(length=255), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=default_now, nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=default_now, nullable=False),
    sa.ForeignKeyConstraint(['hogar_id'], ['hogares.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_usuarios_hogar_id'), 'usuarios', ['hogar_id'], unique=False)
    op.create_index(op.f('ix_usuarios_email'), 'usuarios', ['email'], unique=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_usuarios_email'), table_name='usuarios')
    op.drop_index(op.f('ix_usuarios_hogar_id'), table_name='usuarios')
    op.drop_table('usuarios')
