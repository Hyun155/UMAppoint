from datetime import date
from typing import List

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Appointment, AppointmentStatus, AvailabilitySlot, Lecturer, Profile,
)
from app.security import get_current_user

router = APIRouter()

ACTIVE = (
    AppointmentStatus.pending,
    AppointmentStatus.approved,
    AppointmentStatus.cancellation_requested,
    AppointmentStatus.rescheduling_requested,
)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class ChatReply(BaseModel):
    answer: str
    suggestions: List[str] = []


@router.post("/message", response_model=ChatReply)
def chat_message(
    req: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Authenticated, deterministic UMAppoint help assistant.

    This first release answers product FAQs and reads current availability from
    PostgreSQL. It deliberately does not claim to be an LLM or invent records.
    """
    question = req.message.strip().lower()

    if any(term in question for term in ("my appointment", "my booking", "upcoming appointment", "booking status")):
        query = db.query(Appointment).filter(
            (Appointment.student_id == current_user.id) | (Appointment.lecturer_id == current_user.id)
        ).order_by(Appointment.appointment_date.desc(), Appointment.start_time.desc())
        records = query.limit(10).all()
        if not records:
            return ChatReply(
                answer="There are no appointments linked to your account yet. You can book a consultation from Find Lecturers or wait for a student request in Booking Requests.",
                suggestions=["Show available slots", "How do I book an appointment?"],
            )
        lines = []
        for item in records[:5]:
            date_text = item.appointment_date.isoformat()
            start_text = item.start_time.strftime("%H:%M")
            end_text = item.end_time.strftime("%H:%M")
            status_text = item.status.value if hasattr(item.status, "value") else str(item.status)
            lines.append(f"{item.ref_code or str(item.id)[:8]} — {date_text}, {start_text}-{end_text}: {status_text.replace('_', ' ').title()}")
        return ChatReply(
            answer="Here are your latest appointments:\n" + "\n".join(lines),
            suggestions=["What does pending mean?", "Show available slots"],
        )

    if any(term in question for term in ("available", "availability", "free slot", "open slot")):
        rows = (
            db.query(AvailabilitySlot, Lecturer, Profile)
            .join(Lecturer, Lecturer.id == AvailabilitySlot.lecturer_id)
            .join(Profile, Profile.id == Lecturer.id)
            .filter(AvailabilitySlot.slot_date >= date.today())
            .order_by(AvailabilitySlot.slot_date, AvailabilitySlot.start_time)
            .limit(30)
            .all()
        )
        results = []
        for slot, lecturer, profile in rows:
            booked = db.query(Appointment.id).filter(
                Appointment.slot_id == slot.id,
                Appointment.status.in_(ACTIVE),
            ).first()
            if not booked:
                results.append(
                    f"{lecturer.title} {profile.full_name}: "
                    f"{slot.slot_date.isoformat()} {slot.start_time.strftime('%H:%M')}-"
                    f"{slot.end_time.strftime('%H:%M')} ({slot.location})"
                )
            if len(results) == 5:
                break
        if not results:
            return ChatReply(
                answer="I couldn't find any open future consultation slots right now. Please check the lecturer directory again later.",
                suggestions=["How do I book an appointment?", "How do I contact a lecturer?"],
            )
        return ChatReply(
            answer="Here are up to five currently open consultation slots:\n" + "\n".join(results),
            suggestions=["How do I book an appointment?", "What does pending mean?"],
        )

    if any(term in question for term in ("book", "booking", "appointment", "consultation")):
        return ChatReply(
            answer="To book a consultation, sign in as a student, open Find Lecturers, choose a lecturer with an open slot, select the slot, enter a consultation purpose, and submit. Your request will appear as Pending until the lecturer responds.",
            suggestions=["Show available slots", "What does pending mean?", "How do I cancel?"],
        )

    if "pending" in question or "status" in question:
        return ChatReply(
            answer="Pending means your booking request has been submitted and is awaiting the lecturer's decision. Approved means the consultation is confirmed. Rejected means the lecturer declined the request. Completed means the consultation has taken place.",
            suggestions=["How do I book an appointment?", "Show available slots"],
        )

    if any(term in question for term in ("cancel", "cancellation")):
        return ChatReply(
            answer="Open your Appointments page and check the booking's available actions. If a cancellation request option is shown, submit the reason and wait for the lecturer's response. If the option is unavailable, contact the lecturer or faculty administrator.",
            suggestions=["How do I check my appointment status?", "Show available slots"],
        )

    if any(term in question for term in ("reschedule", "change time", "change appointment")):
        return ChatReply(
            answer="To change a consultation time, contact the lecturer and provide your preferred alternative. The rescheduling workflow may depend on the booking status and the options enabled in your current UMAppoint release.",
            suggestions=["Show available slots", "What does pending mean?"],
        )

    if any(term in question for term in ("lecturer", "find", "search")):
        return ChatReply(
            answer="Open Find Lecturers to search by lecturer name or department. Each lecturer profile shows their department, specialisation, consultation information and available slots.",
            suggestions=["Show available slots", "How do I book an appointment?"],
        )

    return ChatReply(
        answer="I'm the UMAppoint help assistant. I can explain booking steps and appointment statuses, or retrieve currently open consultation slots from the UMAppoint database. I don't make booking decisions or change appointments for you.",
        suggestions=["How do I book an appointment?", "Show available slots", "What does pending mean?"],
    )
