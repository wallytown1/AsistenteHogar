"""Add lista_compra table

Revision ID: c6d8f0a1b2e3
Revises: a5b3c1d9e7f2
Create Date: 2026-06-19 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c6d8f0a1b2e3"
down_revision: Union[str, Sequence[str], None] = "a5b3c1d9e7f2"
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
        "lista_compra",
        sa.Column("id", uuid_type, nullable=False),
        sa.Column("hogar_id", uuid_type, nullable=False),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("cantidad", sa.Numeric(10, 2), nullable=True),
        sa.Column("unidad", sa.String(50), nullable=True),
        sa.Column(
            "is_checked",
            sa.Boolean(),
            nullable=False,
            server_default="0" if is_sqlite else "false",
        ),
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            nullable=False,
            server_default="0" if is_sqlite else "false",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=default_now,
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=default_now,
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["hogar_id"], ["hogares.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_lista_compra_hogar_id"), "lista_compra", ["hogar_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_lista_compra_hogar_id"), table_name="lista_compra")
    op.drop_table("lista_compra")
