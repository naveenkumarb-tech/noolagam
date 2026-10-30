"""remove email verification

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DELETE FROM auth_tokens WHERE purpose = 'verify_email'")
    op.drop_constraint("ck_auth_tokens_purpose", "auth_tokens", type_="check")
    op.create_check_constraint("ck_auth_tokens_purpose", "auth_tokens", "purpose IN ('reset_password')")
    op.drop_column("users", "is_verified")


def downgrade() -> None:
    op.add_column(
        "users", sa.Column("is_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False)
    )
    op.drop_constraint("ck_auth_tokens_purpose", "auth_tokens", type_="check")
    op.create_check_constraint(
        "ck_auth_tokens_purpose", "auth_tokens", "purpose IN ('verify_email', 'reset_password')"
    )
