import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum as SAEnum, Integer, String, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.subject import Subject
    from app.models.syllabus import Syllabus
    from app.models.timetable_entry import TimetableEntry


class ThemeModeEnum(str, enum.Enum):
    LIGHT = "light"
    DARK = "dark"
    SYSTEM = "system"


class Student(Base):
    """Authenticated student profile and workspace settings."""

    __tablename__ = "students"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    uid: Mapped[str | None] = mapped_column(String(128), unique=True, nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, nullable=False, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    institution: Mapped[str | None] = mapped_column(String(160), nullable=True)
    program: Mapped[str | None] = mapped_column(String(160), nullable=True)
    academic_term: Mapped[str | None] = mapped_column(String(80), nullable=True)
    daily_goal: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=25,
        server_default=text("25"),
    )
    preferred_model: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        default="gemini-4-hydrogen",
        server_default=text("'gemini-4-hydrogen'"),
    )
    theme_mode: Mapped[ThemeModeEnum] = mapped_column(
        SAEnum(
            ThemeModeEnum,
            name="theme_mode_enum",
            values_callable=lambda obj: [e.value for e in obj],
        ),
        nullable=False,
        default=ThemeModeEnum.SYSTEM,
        server_default=text("'system'"),
    )
    photo_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    subjects: Mapped[list["Subject"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    timetable_entries: Mapped[list["TimetableEntry"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    syllabi: Mapped[list["Syllabus"]] = relationship(
        back_populates="student",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
