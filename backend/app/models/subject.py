import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.student import Student
    from app.models.syllabus import Syllabus
    from app.models.timetable_entry import TimetableEntry


class Subject(Base):
    """Academic course or subject owned by a student."""

    __tablename__ = "subjects"
    __table_args__ = (
        UniqueConstraint("student_id", "code", name="uq_subjects_student_code"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    instructor: Mapped[str | None] = mapped_column(String(120), nullable=True)
    credits: Mapped[Decimal | None] = mapped_column(Numeric(4, 1), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
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

    student: Mapped["Student"] = relationship(back_populates="subjects")
    timetable_entries: Mapped[list["TimetableEntry"]] = relationship(
        back_populates="subject",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    syllabi: Mapped[list["Syllabus"]] = relationship(
        back_populates="subject",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
