"""Add admin_users, prompt_templates, recetario_maestro (Fase 2)

Tres tablas globales (sin hogar_id) para el panel de administración:
- admin_users: usuarios con JWT separado del JWT familiar
- prompt_templates: system instructions editables por clave
- recetario_maestro: catálogo de recetas mediterráneas maestras

Revision ID: e1f3a5c70d84
Revises: d3e5f7b91a26
Create Date: 2026-06-18 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e1f3a5c70d84"
down_revision: Union[str, Sequence[str], None] = "d3e5f7b91a26"
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

    insp = sa.inspect(bind)
    existing = set(insp.get_table_names())

    if "admin_users" not in existing:
        op.create_table(
            "admin_users",
            sa.Column("id", uuid_type, nullable=False),
            sa.Column("email", sa.String(255), nullable=False),
            sa.Column("hashed_password", sa.String(255), nullable=False),
            sa.Column("nombre", sa.String(100), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=default_now,
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("email"),
        )
        op.create_index("ix_admin_users_email", "admin_users", ["email"], unique=True)

    if "prompt_templates" not in existing:
        op.create_table(
            "prompt_templates",
            sa.Column("id", uuid_type, nullable=False),
            sa.Column("clave", sa.String(50), nullable=False),
            sa.Column("system_instruction", sa.String(8000), nullable=False),
            sa.Column("activo", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=default_now,
                nullable=False,
            ),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("clave"),
        )
        op.create_index(
            "ix_prompt_templates_clave", "prompt_templates", ["clave"], unique=True
        )

    if "recetario_maestro" not in existing:
        op.create_table(
            "recetario_maestro",
            sa.Column("id", uuid_type, nullable=False),
            sa.Column("nombre", sa.String(200), nullable=False),
            sa.Column("ingredientes", sa.JSON(), nullable=False),
            sa.Column("pasos", sa.JSON(), nullable=False),
            sa.Column("categoria", sa.String(50), nullable=False),
            sa.Column("temporada", sa.String(50), nullable=True),
            sa.Column(
                "aprovechamiento", sa.Boolean(), nullable=False, server_default="0"
            ),
            sa.Column("activa", sa.Boolean(), nullable=False, server_default="1"),
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
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("nombre"),
        )
        op.create_index(
            "ix_recetario_maestro_nombre", "recetario_maestro", ["nombre"], unique=True
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing = set(insp.get_table_names())

    for table, index in [
        ("recetario_maestro", "ix_recetario_maestro_nombre"),
        ("prompt_templates", "ix_prompt_templates_clave"),
        ("admin_users", "ix_admin_users_email"),
    ]:
        if table in existing:
            if index in {i["name"] for i in insp.get_indexes(table)}:
                op.drop_index(index, table_name=table)
            op.drop_table(table)
