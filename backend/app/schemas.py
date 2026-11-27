from __future__ import annotations
import uuid
from datetime import date, time, datetime
from typing import Optional, List, Any, Union
from pydantic import BaseModel, EmailStr, field_validator


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str                  # "student" or "lecturer"
    matric_no: Optional[str] = None
    programme: Optional[str] = None
    department: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in ("student", "lecturer"):
            raise ValueError("role must be 'student' or 'lecturer'")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user_id: uuid.UUID
    role: str
    full_name: str
    email: str


# ---------------------------------------------------------------------------
# Slots
# ---------------------------------------------------------------------------

class SlotOut(BaseModel):
    id: uuid.UUID
    slot_date: date
    start_time: time
    end_time: time
    location_type: str
    location: str
    notes: Optional[str]
    open: bool          # True when no active booking

    model_config = {"from_attributes": True}

class SlotCreateRequest(BaseModel):
    slot_date: date
    start_time: time
    end_time: time
    location_type: str = "physical"
    location: str
    notes: Optional[str] = None

    @field_validator("location_type")
    @classmethod
    def valid_location_type(cls, value: str) -> str:
        value = value.strip().lower()
        if value not in ("physical", "online"):
            raise ValueError("location_type must be physical or online")
        return value

    @field_validator("location")
    @classmethod
    def valid_location(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Location cannot be empty")
        return value


class SlotUpdateRequest(BaseModel):
    slot_date: Optional[date] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    location_type: Optional[str] = None
    location: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("location_type")
    @classmethod
    def valid_location_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip().lower()
        if value not in ("physical", "online"):
            raise ValueError("location_type must be physical or online")
        return value

    @field_validator("location")
    @classmethod
    def valid_location(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        value = value.strip()
        if not value:
            raise ValueError("Location cannot be empty")
        return value


# ---------------------------------------------------------------------------
# Lecturers
# ---------------------------------------------------------------------------

class LecturerOut(BaseModel):
    id: uuid.UUID
    title: str
    full_name: str
    email: str
    department: str
    specialization: str
    office_location: str
    consultation_info: str
    open_slots: List[SlotOut] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------

class BookingRequest(BaseModel):
    slot_id: uuid.UUID
    purpose: str

    @field_validator("purpose")
    @classmethod
    def purpose_min_length(cls, v: str) -> str:
        if len(v.strip()) < 5:
            raise ValueError("Purpose must be at least 5 characters")
        return v.strip()


class StatusUpdateRequest(BaseModel):
    status: str           # "APPROVED", "REJECTED", "COMPLETED", or "CANCELLED"
    lecturer_note: Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: str) -> str:
        if v.upper() not in ("APPROVED", "REJECTED", "COMPLETED", "CANCELLED"):
            raise ValueError("status must be APPROVED, REJECTED, COMPLETED or CANCELLED")
        return v.upper()


class AppointmentOut(BaseModel):
    id: uuid.UUID
    ref_code: Optional[str] = None
    student_id: uuid.UUID
    lecturer_id: uuid.UUID
    lecturer_name: Optional[str] = None
    lecturer_title: Optional[str] = None
    lecturer_department: Optional[str] = None
    student_name: Optional[str] = None
    student_matric_no: Optional[str] = None
    slot_id: Optional[uuid.UUID] = None
    appointment_date: date
    start_time: time
    end_time: time
    location: str
    purpose: str
    status: str
    lecturer_note: Optional[str] = None
    student_request_reason: Optional[str] = None
    reschedule_date: Optional[date] = None
    reschedule_start_time: Optional[time] = None
    reschedule_end_time: Optional[time] = None
    reschedule_location: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    model_config = {"from_attributes": True}


class NotificationOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    message: str
    appointment_id: Optional[uuid.UUID] = None
    is_read: bool
    created_at: Optional[Any] = None

    model_config = {"from_attributes": True}
