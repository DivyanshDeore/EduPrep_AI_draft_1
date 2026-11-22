import uuid
from datetime import datetime, time
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, SmallInteger, String, Time, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.student import Student
    from app.models.subject import Subject


class TimetableEntry(Base):
    """Weekly recurring class schedule entry owned by a student."""

    __tablename__ = "timetable_entries"
    __table_args__ = (
        CheckConstraint("day_of_week >= 0 AND day_of_week <= 6", name="day_of_week_range"),
        CheckConstraint("end_time > start_time", name="valid_time_range"),
        Index("ix_timetable_entries_student_day_start", "student_id", "day_of_week", "start_time"),
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
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subject_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    subject_title: Mapped[str] = mapped_column(String(160), nullable=False)
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)  # 0=Sunday .. 6=Saturday
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    room: Mapped[str] = mapped_column(String(100), nullable=False)
    instructor: Mapped[str | None] = mapped_column(String(120), nullable=True)
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

    student: Mapped["Student"] = relationship(back_populates="timetable_entries")
    subject: Mapped["Subject"] = relationship(back_populates="timetable_entries")
