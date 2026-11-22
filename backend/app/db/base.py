from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

# Deterministic constraint naming convention for PostgreSQL & Alembic autogenerate
POSTGRES_NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """Shared SQLAlchemy 2.0 declarative base for EduPrep AI PostgreSQL models."""

    metadata = MetaData(naming_convention=POSTGRES_NAMING_CONVENTION)
