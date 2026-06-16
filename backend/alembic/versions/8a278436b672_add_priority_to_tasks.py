"""Add priority to tasks

Revision ID: 8a278436b672
Revises: 95c749193f65
Create Date: 2026-06-09 16:16:17.679360

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8a278436b672'
down_revision: Union[str, Sequence[str], None] = '95c749193f65'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('tareas_hogar', sa.Column('prioridad', sa.String(length=20), nullable=False, server_default='media'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('tareas_hogar', 'prioridad')
