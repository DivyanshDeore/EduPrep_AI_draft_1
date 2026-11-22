"""Initialize PostgreSQL relational schema for Student, Subject, TimetableEntry, and Syllabus.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-11-22 00:43:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

theme_mode_enum = postgresql.ENUM("light", "dark", "system", name="theme_mode_enum", create_type=False)
syllabus_file_type_enum = postgresql.ENUM(
    "pdf",
    "txt",
    "docx",
    "pasted",
    name="syllabus_file_type_enum",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    theme_mode_enum.create(bind, checkfirst=True)
    syllabus_file_type_enum.create(bind, checkfirst=True)

    op.create_table(
        "students",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("uid", sa.String(length=128), nullable=True),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("institution", sa.String(length=160), nullable=True),
        sa.Column("program", sa.String(length=160), nullable=True),
        sa.Column("academic_term", sa.String(length=80), nullable=True),
        sa.Column("daily_goal", sa.Integer(), server_default=sa.text("25"), nullable=False),
        sa.Column(
            "preferred_model",
            sa.String(length=80),
            server_default=sa.text("'gemini-4-hydrogen'"),
            nullable=False,
        ),
        sa.Column(
            "theme_mode",
            theme_mode_enum,
            server_default=sa.text("'system'"),
            nullable=False,
        ),
        sa.Column("photo_url", sa.String(length=1000), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name="pk_students"),
    )
    op.create_index("ix_students_uid", "students", ["uid"], unique=True)
    op.create_index("ix_students_email", "students", ["email"], unique=True)

    op.create_table(
        "subjects",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("instructor", sa.String(length=120), nullable=True),
        sa.Column("credits", sa.Numeric(precision=4, scale=1), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["students.id"],
            name="fk_subjects_student_id_students",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_subjects"),
        sa.UniqueConstraint("student_id", "code", name="uq_subjects_student_code"),
    )
    op.create_index("ix_subjects_student_id", "subjects", ["student_id"], unique=False)

    op.create_table(
        "timetable_entries",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_code", sa.String(length=32), nullable=True),
        sa.Column("subject_title", sa.String(length=160), nullable=False),
        sa.Column("day_of_week", sa.SmallInteger(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("room", sa.String(length=100), nullable=False),
        sa.Column("instructor", sa.String(length=120), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "day_of_week >= 0 AND day_of_week <= 6",
            name="ck_timetable_entries_day_of_week_range",
        ),
        sa.CheckConstraint(
            "end_time > start_time",
            name="ck_timetable_entries_valid_time_range",
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["students.id"],
            name="fk_timetable_entries_student_id_students",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["subject_id"],
            ["subjects.id"],
            name="fk_timetable_entries_subject_id_subjects",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_timetable_entries"),
    )
    op.create_index("ix_timetable_entries_student_id", "timetable_entries", ["student_id"], unique=False)
    op.create_index("ix_timetable_entries_subject_id", "timetable_entries", ["subject_id"], unique=False)
    op.create_index(
        "ix_timetable_entries_student_day_start",
        "timetable_entries",
        ["student_id", "day_of_week", "start_time"],
        unique=False,
    )

    op.create_table(
        "syllabi",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("file_type", syllabus_file_type_enum, nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=False),
        sa.Column(
            "parsed_topic_count",
            sa.Integer(),
            server_default=sa.text("0"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "file_size >= 0 AND file_size <= 10485760",
            name="ck_syllabi_file_size_limit",
        ),
        sa.CheckConstraint(
            "parsed_topic_count >= 0",
            name="ck_syllabi_topic_count_nonneg",
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["students.id"],
            name="fk_syllabi_student_id_students",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["subject_id"],
            ["subjects.id"],
            name="fk_syllabi_subject_id_subjects",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_syllabi"),
    )
    op.create_index("ix_syllabi_student_id", "syllabi", ["student_id"], unique=False)
    op.create_index("ix_syllabi_subject_id", "syllabi", ["subject_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_syllabi_subject_id", table_name="syllabi")
    op.drop_index("ix_syllabi_student_id", table_name="syllabi")
    op.drop_table("syllabi")

    op.drop_index("ix_timetable_entries_student_day_start", table_name="timetable_entries")
    op.drop_index("ix_timetable_entries_subject_id", table_name="timetable_entries")
    op.drop_index("ix_timetable_entries_student_id", table_name="timetable_entries")
    op.drop_table("timetable_entries")

    op.drop_index("ix_subjects_student_id", table_name="subjects")
    op.drop_table("subjects")

    op.drop_index("ix_students_email", table_name="students")
    op.drop_index("ix_students_uid", table_name="students")
    op.drop_table("students")

    bind = op.get_bind()
    syllabus_file_type_enum.drop(bind, checkfirst=True)
    theme_mode_enum.drop(bind, checkfirst=True)
