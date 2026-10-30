from alembic import command

from tests.conftest import alembic_config


def test_models_match_the_migrations() -> None:
    command.check(alembic_config())


def test_migrations_can_be_rolled_back_and_reapplied() -> None:
    command.downgrade(alembic_config(), "base")
    command.upgrade(alembic_config(), "head")
