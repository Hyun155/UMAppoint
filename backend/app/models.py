import enum
import uuid
from datetime import date, time, datetime

from sqlalchemy import (
    Column, String, Text, Date, Time, Integer, Boolean,
    ForeignKey, UniqueConstraint, Enum as SAEnum, func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


# ---------------------------------------------------------------------------
# Postgres enums (already exist in DB – create_type=False)
# ---------------------------------------------------------------------------

class AppRole(str, enum.Enum):
    student  = "student"
    lecturer = "lecturer"


class AppointmentStatus(str, enum.Enum):
    pending                 = "pending"
    approved                = "approved"
    rejected                = "rejected"
    cancellation_requested  = "cancellation_requested"
    rescheduling_requested  = "rescheduling_requested"
    cancelled               = "cancelled"
    completed               = "completed"


_role_enum   = SAEnum(AppRole,            name="app_role",           schema="public", create_type=False)
_status_enum = SAEnum(AppointmentStatus,  name="appointment_status",  schema="public", create_type=False)


# ---------------------------------------------------------------------------
# ORM models  (map to existing Supabase tables – no DDL changes)
# ---------------------------------------------------------------------------

class Profile(Base):
    __tablename__ = "profiles"
    __table_args__ = {"schema": "public"}

    id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name  = Column(String, nullable=False, default="")
    email      = Column(String, nullable=False, default="")
    phone      = Column(String)
    avatar_url = Column(String)
    created_at = Column(String)   # timestamptz – read as string is fine
    updated_at = Column(String)


class UserRole(Base):
    __tablename__ = "user_roles"
    __table_args__ = {"schema": "public"}

    id      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("public.profiles.id"), nullable=False)
    role    = Column(_role_enum, nullable=False)


class Lecturer(Base):
    __tablename__ = "lecturers"
    __table_args__ = {"schema": "public"}

    id               = Column(UUID(as_uuid=True), ForeignKey("public.profiles.id"), primary_key=True)
    title            = Column(String, nullable=False, default="Dr.")
    department       = Column(String, nullable=False, default="")
    specialization   = Column(String, nullable=False, default="")
    office_location  = Column(String, nullable=False, default="")
    consultation_info= Column(String, nullable=False, default="")
    created_at       = Column(String)

    profile = relationship("Profile", foreign_keys=[id], lazy="joined")


class Student(Base):
    __tablename__ = "students"
    __table_args__ = {"schema": "public"}

    id            = Column(UUID(as_uuid=True), ForeignKey("public.profiles.id"), primary_key=True)
    matric_no     = Column(String, nullable=False, default="")
    programme     = Column(String, nullable=False, default="")
    year_of_study = Column(Integer, nullable=False, default=1)
    created_at    = Column(String)

    profile = relationship("Profile", foreign_keys=[id], lazy="joined")


class AvailabilitySlot(Base):
    __tablename__ = "availability_slots"
    __table_args__ = {"schema": "public"}

    id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lecturer_id   = Column(UUID(as_uuid=True), ForeignKey("public.lecturers.id"), nullable=False)
    slot_date     = Column(Date, nullable=False)
    start_time    = Column(Time, nullable=False)
    end_time      = Column(Time, nullable=False)
    location_type = Column(String, nullable=False, default="physical")
    location      = Column(String, nullable=False, default="")
    notes         = Column(Text)
    created_at    = Column(String)


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = {"schema": "public"}

    id                      = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ref_code                = Column(String, unique=True)
    student_id              = Column(UUID(as_uuid=True), ForeignKey("public.students.id"), nullable=False)
    lecturer_id             = Column(UUID(as_uuid=True), ForeignKey("public.lecturers.id"), nullable=False)
    slot_id                 = Column(UUID(as_uuid=True), ForeignKey("public.availability_slots.id"))
    appointment_date        = Column(Date, nullable=False)
    start_time              = Column(Time, nullable=False)
    end_time                = Column(Time, nullable=False)
    location                = Column(String, nullable=False, default="")
    purpose                 = Column(Text, nullable=False)
    status                  = Column(_status_enum, nullable=False, default=AppointmentStatus.pending)
    lecturer_note           = Column(Text)
    student_request_reason  = Column(Text)
    reschedule_slot_id      = Column(UUID(as_uuid=True))
    parent_appointment_id   = Column(UUID(as_uuid=True))
    created_at              = Column(String)
    updated_at              = Column(String)

    lecturer = relationship("Lecturer", foreign_keys=[lecturer_id], lazy="select")
    student  = relationship("Student",  foreign_keys=[student_id],  lazy="select")
    reschedule_slot = relationship(
        "AvailabilitySlot",
        primaryjoin="Appointment.reschedule_slot_id == AvailabilitySlot.id",
        foreign_keys=[reschedule_slot_id],
        lazy="joined",
        viewonly=True,
    )


class AppCredential(Base):
    """Spring-Boot sidecar credential table (created by V2__app_credentials.sql)."""
    __tablename__ = "app_credentials"
    __table_args__ = {"schema": "public"}

    user_id       = Column(UUID(as_uuid=True), ForeignKey("public.profiles.id"), primary_key=True)
    password_hash = Column(String, nullable=False)
    created_at    = Column(String)


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = {"schema": "public"}

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id        = Column(UUID(as_uuid=True), ForeignKey("public.profiles.id"), nullable=False)
    title          = Column(String, nullable=False)
    message        = Column(Text, nullable=False)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("public.appointments.id"), nullable=True)
    is_read        = Column(Boolean, nullable=False, default=False)
    created_at     = Column(String)
