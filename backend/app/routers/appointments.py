import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    Appointment, AppointmentStatus, AvailabilitySlot, Profile, Notification
)
from app.schemas import BookingRequest, AppointmentOut, StatusUpdateRequest
from app.security import get_current_user, require_student, require_lecturer
from app.telegram import send_telegram_alert

router = APIRouter()

ACTIVE = (
    AppointmentStatus.pending,
    AppointmentStatus.approved,
    AppointmentStatus.cancellation_requested,
    AppointmentStatus.rescheduling_requested,
)


def _to_out(a: Appointment) -> AppointmentOut:
    lec_name = None
    lec_title = None
    lec_dept = None
    if getattr(a, "lecturer", None):
        lec_title = a.lecturer.title
        lec_dept = a.lecturer.department
        if getattr(a.lecturer, "profile", None):
            lec_name = a.lecturer.profile.full_name

    stud_name = None
    stud_matric = None
    if getattr(a, "student", None):
        stud_matric = a.student.matric_no
        if getattr(a.student, "profile", None):
            stud_name = a.student.profile.full_name

    return AppointmentOut(
        id=a.id,
        ref_code=a.ref_code,
        student_id=a.student_id,
        lecturer_id=a.lecturer_id,
        lecturer_name=lec_name,
        lecturer_title=lec_title,
        lecturer_department=lec_dept,
        student_name=stud_name,
        student_matric_no=stud_matric,
        slot_id=a.slot_id,
        appointment_date=a.appointment_date,
        start_time=a.start_time,
        end_time=a.end_time,
        location=a.location,
        purpose=a.purpose,
        status=a.status.value if hasattr(a.status, "value") else str(a.status),
        lecturer_note=a.lecturer_note,
        student_request_reason=a.student_request_reason,
        reschedule_date=a.reschedule_slot.slot_date if getattr(a, "reschedule_slot", None) else None,
        reschedule_start_time=a.reschedule_slot.start_time if getattr(a, "reschedule_slot", None) else None,
        reschedule_end_time=a.reschedule_slot.end_time if getattr(a, "reschedule_slot", None) else None,
        reschedule_location=a.reschedule_slot.location if getattr(a, "reschedule_slot", None) else None,
        created_at=str(a.created_at) if a.created_at else None,
        updated_at=str(a.updated_at) if a.updated_at else None,
    )


# ===========================================================================
# Step 3: POST /api/appointments  (STUDENT only)
# Double-booking prevented via SELECT … FOR UPDATE (pessimistic lock)
# ===========================================================================
@router.post("/appointments", response_model=AppointmentOut, status_code=201)
def book_appointment(
    req: BookingRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_student),
):
    try:
        # 1. Lock the slot row  → SELECT … FOR UPDATE
        slot: AvailabilitySlot = (
            db.query(AvailabilitySlot)
            .filter(AvailabilitySlot.id == req.slot_id)
            .with_for_update()          # <-- pessimistic lock
            .first()
        )
        if not slot:
            raise HTTPException(status_code=404, detail="Slot not found")

        # 2. Check availability (while holding lock)
        already_booked = db.query(Appointment).filter(
            Appointment.slot_id == slot.id,
            Appointment.status.in_(ACTIVE),
        ).first()
        if already_booked:
            raise HTTPException(status_code=400, detail="Slot already taken")

        # 3. Guard: cannot book own slot
        if slot.lecturer_id == current_user.id:
            raise HTTPException(status_code=400, detail="You cannot book your own slot")

        # 4. Guard: past slot
        if slot.slot_date < date.today():
            raise HTTPException(status_code=400, detail="This slot is in the past")

        # 5. Insert appointment with status PENDING
        now = datetime.utcnow().isoformat()
        location = (
            f"Online: {slot.location}" if slot.location_type == "online" else slot.location
        )
        appt_id = uuid.uuid4()
        ref_code = f"APT-{uuid.uuid4().hex[:6].upper()}"
        appt = Appointment(
            id=appt_id,
            ref_code=ref_code,
            student_id=current_user.id,
            lecturer_id=slot.lecturer_id,
            slot_id=slot.id,
            appointment_date=slot.slot_date,
            start_time=slot.start_time,
            end_time=slot.end_time,
            location=location,
            purpose=req.purpose,
            status=AppointmentStatus.pending,
            created_at=now,
            updated_at=now,
        )
        db.add(appt)
        db.add(Notification(
            id=uuid.uuid4(),
            user_id=slot.lecturer_id,
            title="New booking request",
            message=f"{current_user.full_name} requested a consultation on {slot.slot_date} from {slot.start_time.strftime('%H:%M')} to {slot.end_time.strftime('%H:%M')}.",
            appointment_id=appt.id,
            is_read=False,
            created_at=now,
        ))
        db.add(Notification(
            id=uuid.uuid4(),
            user_id=current_user.id,
            title="Booking request submitted",
            message=f"Your request {ref_code} has been sent to the lecturer and is awaiting a decision.",
            appointment_id=appt.id,
            is_read=False,
            created_at=now,
        ))
        db.commit()
        db.refresh(appt)
        send_telegram_alert(f"UMAppoint: new booking request {appt.ref_code} for {appt.appointment_date} ({appt.start_time}-{appt.end_time}). Please review in the lecturer portal.")
        return _to_out(appt)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Booking failed: {str(e)}") from e


# ===========================================================================
# GET /api/appointments  (student's own list)
# ===========================================================================
@router.get("/appointments", response_model=list[AppointmentOut])
def my_appointments(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_student),
):
    appts = (
        db.query(Appointment)
        .filter(Appointment.student_id == current_user.id)
        .order_by(Appointment.appointment_date.desc())
        .all()
    )
    return [_to_out(a) for a in appts]


# ===========================================================================
# Step 4: GET /api/lecturer/appointments?status=PENDING  (LECTURER only)
# ===========================================================================
@router.get("/lecturer/appointments", response_model=list[AppointmentOut])
def lecturer_appointments(
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_lecturer),
):
    query = db.query(Appointment).filter(Appointment.lecturer_id == current_user.id)

    if status:
        try:
            s = AppointmentStatus(status.lower())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Unknown status: {status}")
        query = query.filter(Appointment.status == s)

    appts = query.order_by(Appointment.appointment_date.asc()).all()
    return [_to_out(a) for a in appts]


# ===========================================================================
# Step 4: PATCH /api/appointments/{id}/status  (LECTURER only)
# ===========================================================================
@router.patch("/appointments/{appointment_id}/status", response_model=AppointmentOut)
def update_appointment_status(
    appointment_id: uuid.UUID,
    req: StatusUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_lecturer),
):
    try:
        # Lock the row
        appt: Appointment = (
            db.query(Appointment)
            .filter(Appointment.id == appointment_id)
            .with_for_update()
            .first()
        )
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found")

        # Ownership check
        if appt.lecturer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your appointment")

        previous_status = appt.status
        new_status = AppointmentStatus(req.status.lower())

        # Validate allowed transitions
        allowed = {
            AppointmentStatus.pending: [AppointmentStatus.approved, AppointmentStatus.rejected],
            AppointmentStatus.approved: [AppointmentStatus.completed],
            AppointmentStatus.cancellation_requested: [AppointmentStatus.cancelled, AppointmentStatus.approved],
            AppointmentStatus.rescheduling_requested: [AppointmentStatus.approved, AppointmentStatus.rejected],
        }
        if appt.status not in allowed or new_status not in allowed[appt.status]:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot transition appointment from {appt.status.value} to {new_status.value}",
            )

        if appt.status == AppointmentStatus.rescheduling_requested:
            if new_status == AppointmentStatus.approved:
                target = (
                    db.query(AvailabilitySlot)
                    .filter(
                        AvailabilitySlot.id == appt.reschedule_slot_id,
                        AvailabilitySlot.lecturer_id == current_user.id,
                    )
                    .with_for_update()
                    .first()
                )
                if not target:
                    raise HTTPException(status_code=409, detail="Requested alternative slot is no longer available")
                occupied = db.query(Appointment.id).filter(
                    Appointment.slot_id == target.id,
                    Appointment.id != appt.id,
                    Appointment.status.in_(ACTIVE),
                ).first()
                if occupied:
                    raise HTTPException(status_code=409, detail="Requested alternative slot has been booked")
                appt.slot_id = target.id
                appt.appointment_date = target.slot_date
                appt.start_time = target.start_time
                appt.end_time = target.end_time
                appt.location = f"Online: {target.location}" if target.location_type == "online" else target.location
            appt.reschedule_slot_id = None
            appt.status = AppointmentStatus.approved
        else:
            appt.status = new_status
        if req.lecturer_note:
            appt.lecturer_note = req.lecturer_note.strip()
        appt.updated_at = datetime.utcnow().isoformat()

        # Create notification for student
        try:
            status_labels = {
                AppointmentStatus.approved: ("Appointment approved", "approved"),
                AppointmentStatus.rejected: ("Appointment rejected", "rejected"),
                AppointmentStatus.completed: ("Consultation completed", "completed"),
                AppointmentStatus.cancelled: ("Appointment cancelled", "cancelled"),
            }
            if previous_status == AppointmentStatus.rescheduling_requested and new_status == AppointmentStatus.rejected:
                title, verb = ("Rescheduling request declined", "declined; your original booking remains confirmed")
            elif previous_status == AppointmentStatus.cancellation_requested and new_status == AppointmentStatus.approved:
                title, verb = ("Cancellation request declined", "remains confirmed")
            else:
                title, verb = status_labels.get(new_status, (None, None))
            if title:
                date_str = appt.appointment_date.strftime("%d %b %Y") if hasattr(appt.appointment_date, "strftime") else str(appt.appointment_date)
                notif = Notification(
                    id=uuid.uuid4(),
                    user_id=appt.student_id,
                    title=title,
                    message=f"Your consultation with {current_user.full_name} on {date_str} is now {verb}.",
                    appointment_id=appt.id,
                    is_read=False,
                    created_at=datetime.utcnow().isoformat(),
                )
                db.add(notif)
        except Exception:
            pass  # Do not block status update if notification logging fails

        db.commit()
        db.refresh(appt)
        send_telegram_alert(f"UMAppoint: appointment {appt.ref_code or appt.id} status changed to {appt.status.value}.")
        return _to_out(appt)
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update appointment: {str(e)}") from e


# ===========================================================================
# GET /api/history  (completed / rejected / cancelled consultations)
# ===========================================================================
@router.get("/history", response_model=list[AppointmentOut])
def get_appointment_history(
    db: Session = Depends(get_db),
    current_user: Profile = Depends(get_current_user),
):
    """Return historical appointments (completed, rejected, cancelled) for the logged-in user."""
    historical_statuses = (
        AppointmentStatus.completed,
        AppointmentStatus.rejected,
        AppointmentStatus.cancelled,
    )
    appts = (
        db.query(Appointment)
        .filter(
            (Appointment.student_id == current_user.id) | (Appointment.lecturer_id == current_user.id)
        )
        .filter(Appointment.status.in_(historical_statuses))
        .order_by(Appointment.appointment_date.desc(), Appointment.start_time.desc())
        .all()
    )
    return [_to_out(a) for a in appts]

class StudentRequestBody(BaseModel):
    reason: str = Field(min_length=5, max_length=1000)

    @field_validator("reason")
    @classmethod
    def clean_reason(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 5:
            raise ValueError("Please provide a reason of at least 5 characters")
        return value


class RescheduleRequestBody(StudentRequestBody):
    slot_id: uuid.UUID


@router.post("/appointments/{appointment_id}/cancellation-request", response_model=AppointmentOut)
def request_cancellation(
    appointment_id: uuid.UUID,
    req: StudentRequestBody,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_student),
):
    try:
        appt = (
            db.query(Appointment)
            .filter(Appointment.id == appointment_id, Appointment.student_id == current_user.id)
            .with_for_update()
            .first()
        )
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found")
        if appt.status not in (AppointmentStatus.pending, AppointmentStatus.approved):
            raise HTTPException(status_code=400, detail="Only pending or approved appointments can be cancelled")
        appt.status = AppointmentStatus.cancellation_requested
        appt.student_request_reason = req.reason
        appt.updated_at = datetime.utcnow().isoformat()
        db.add(Notification(
            id=uuid.uuid4(),
            user_id=appt.lecturer_id,
            title="Cancellation requested",
            message=f"{current_user.full_name} requested cancellation. Reason: {req.reason}",
            appointment_id=appt.id,
            is_read=False,
            created_at=datetime.utcnow().isoformat(),
        ))
        db.commit()
        db.refresh(appt)
        send_telegram_alert(f"UMAppoint: cancellation requested for {appt.ref_code or appt.id}. Please review in the lecturer portal.")
        return _to_out(appt)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to request cancellation") from exc


@router.post("/appointments/{appointment_id}/reschedule-request", response_model=AppointmentOut)
def request_reschedule(
    appointment_id: uuid.UUID,
    req: RescheduleRequestBody,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_student),
):
    try:
        appt = (
            db.query(Appointment)
            .filter(Appointment.id == appointment_id, Appointment.student_id == current_user.id)
            .with_for_update()
            .first()
        )
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found")
        if appt.status != AppointmentStatus.approved:
            raise HTTPException(status_code=400, detail="Only approved appointments can be rescheduled")
        if req.slot_id == appt.slot_id:
            raise HTTPException(status_code=400, detail="Choose a different consultation slot")
        target = (
            db.query(AvailabilitySlot)
            .filter(AvailabilitySlot.id == req.slot_id, AvailabilitySlot.lecturer_id == appt.lecturer_id)
            .with_for_update()
            .first()
        )
        if not target:
            raise HTTPException(status_code=404, detail="Alternative slot not found for this lecturer")
        if target.slot_date < date.today() or (target.slot_date == date.today() and target.start_time <= datetime.now().time()):
            raise HTTPException(status_code=400, detail="Alternative slot must be in the future")
        occupied = db.query(Appointment.id).filter(
            Appointment.slot_id == target.id,
            Appointment.status.in_(ACTIVE),
        ).first()
        if occupied:
            raise HTTPException(status_code=409, detail="Alternative slot is no longer available")
        appt.reschedule_slot_id = target.id
        appt.student_request_reason = req.reason
        appt.status = AppointmentStatus.rescheduling_requested
        appt.updated_at = datetime.utcnow().isoformat()
        db.add(Notification(
            id=uuid.uuid4(),
            user_id=appt.lecturer_id,
            title="Rescheduling requested",
            message=f"{current_user.full_name} requested a new consultation time. Reason: {req.reason}",
            appointment_id=appt.id,
            is_read=False,
            created_at=datetime.utcnow().isoformat(),
        ))
        db.commit()
        db.refresh(appt)
        send_telegram_alert(f"UMAppoint: rescheduling requested for {appt.ref_code or appt.id}. Please review in the lecturer portal.")
        return _to_out(appt)
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to request rescheduling") from exc
