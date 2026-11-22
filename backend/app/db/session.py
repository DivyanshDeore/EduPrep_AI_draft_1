import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

load_dotenv()


def get_database_url() -> str:
    """Resolve PostgreSQL connection URL from environment without hardcoding credentials."""
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Configure a PostgreSQL connection URL "
            "(e.g. postgresql+psycopg://user:password@localhost:5432/eduprep_ai) "
            "in your backend environment."
        )
    return url


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    """Lazily initialize the SQLAlchemy PostgreSQL engine."""
    global _engine
    if _engine is None:
        _engine = create_engine(
            get_database_url(),
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )
    return _engine


def SessionLocal() -> Session:
    """Create a new database session using the lazily initialized engine."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(
            bind=get_engine(),
            autocommit=False,
            autoflush=False,
            expire_on_commit=False,
        )
    return _session_factory()


def get_db() -> Generator[Session, None, None]:
    """FastAPI-compatible dependency yielding a scoped SQLAlchemy Session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
