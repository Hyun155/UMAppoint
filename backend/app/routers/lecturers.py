import uuid
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Lecturer, AvailabilitySlot, Appointment, AppointmentStatus, Profile
from app.schemas import LecturerOut, SlotOut, SlotCreateRequest, SlotUpdateRequest
from app.security import get_current_user, require_lecturer

router = APIRouter()

# Active-booking statuses (slot is NOT free when appointment has one of these)
ACTIVE = (
    AppointmentStatus.pending,
    AppointmentStatus.approved,
    AppointmentStatus.cancellation_requested,
    AppointmentStatus.rescheduling_requested,
)


def _slot_is_booked(slot_id: uuid.UUID, db: Session) -> bool:
    return db.query(Appointment).filter(
        Appointment.slot_id == slot_id,
        Appointment.status.in_(ACTIVE),
    ).first() is not None


def _build_lecturer_out(lec: Lecturer, open_slots: list) -> LecturerOut:
    p: Profile = lec.profile
    return LecturerOut(
        id=lec.id,
        title=lec.title,
        full_name=p.full_name if p else "",
        email=p.email if p else "",
        department=lec.department,
        specialization=lec.specialization,
        office_location=lec.office_location,
        consultation_info=lec.consultation_info,
        open_slots=open_slots,
    )


def _to_slot_out(s: AvailabilitySlot, open: bool) -> SlotOut:
    return SlotOut(
        id=s.id,
        slot_date=s.slot_date,
        start_time=s.start_time,
        end_time=s.end_time,
        location_type=s.location_type,
        location=s.location,
        notes=s.notes,
        open=open,
    )


# ---------------------------------------------------------------------------
# GET /api/lecturers?search=&department=
# ---------------------------------------------------------------------------
@router.get("", response_model=list[LecturerOut])
def list_lecturers(
    search: Optional[str] = "",
    department: Optional[str] = "",
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    query = db.query(Lecturer)

    if search:
        pattern = f"%{search}%"
        query = query.join(Lecturer.profile).filter(
            or_(
                func.lower(Profile.full_name).like(func.lower(pattern)),
                func.lower(Lecturer.specialization).like(func.lower(pattern)),
            )
        )

    if department:
        query = query.filter(
            func.lower(Lecturer.department).like(func.lower(f"%{department}%"))
        )

    lecturers = query.all()
    today = date.today()
    current_time = datetime.now().time().replace(tzinfo=None)

    result = []
    for lec in lecturers:
        future_slots = db.query(AvailabilitySlot).filter(
            AvailabilitySlot.lecturer_id == lec.id,
            AvailabilitySlot.slot_date >= today,
        ).order_by(AvailabilitySlot.slot_date, AvailabilitySlot.start_time).all()

        open_slots = [
            _to_slot_out(s, True)
            for s in future_slots
            if (s.slot_date > today or s.start_time > current_time)
            and not _slot_is_booked(s.id, db)
        ]
        result.append(_build_lecturer_out(lec, open_slots))

    return result


# ---------------------------------------------------------------------------
# GET /api/lecturers/{id}/slots
# ---------------------------------------------------------------------------
@router.get("/{lecturer_id}/slots", response_model=list[SlotOut])
def get_slots(
    lecturer_id: uuid.UUID,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    lec = db.get(Lecturer, lecturer_id)
    if not lec:
        raise HTTPException(status_code=404, detail="Lecturer not found")

    today = date.today()
    current_time = datetime.now().time().replace(tzinfo=None)
    slots = db.query(AvailabilitySlot).filter(
        AvailabilitySlot.lecturer_id == lecturer_id,
        AvailabilitySlot.slot_date >= today,
    ).order_by(AvailabilitySlot.slot_date, AvailabilitySlot.start_time).all()

    future_slots = [
        slot for slot in slots
        if slot.slot_date > today or slot.start_time > current_time
    ]
    return [_to_slot_out(s, not _slot_is_booked(s.id, db)) for s in future_slots]



# ---------------------------------------------------------------------------
# Availability management (LECTURER only)
# ---------------------------------------------------------------------------

def _check_slot_time(slot_date, start_time, end_time):
    now = datetime.now()

    if slot_date < date.today():
        raise HTTPException(
            status_code=400,
            detail="Cannot create or update availability in the past"
        )

    if slot_date == date.today() and start_time <= now.time().replace(tzinfo=None):
        raise HTTPException(
            status_code=400,
            detail="Cannot create or update a slot that has already started"
        )

    if start_time >= end_time:
        raise HTTPException(
            status_code=400,
            detail="Start time must be earlier than end time"
        )


def _check_slot_overlap(
    db: Session,
    lecturer_id: uuid.UUID,
    slot_date: date,
    start_time,
    end_time,
    exclude_slot_id: Optional[uuid.UUID] = None,
):
    query = db.query(AvailabilitySlot).filter(
        AvailabilitySlot.lecturer_id == lecturer_id,
        AvailabilitySlot.slot_date == slot_date,
        AvailabilitySlot.start_time < end_time,
        AvailabilitySlot.end_time > start_time,
    )

    if exclude_slot_id is not None:
        query = query.filter(AvailabilitySlot.id != exclude_slot_id)

    if query.first():
        raise HTTPException(
            status_code=409,
            detail="This availability overlaps with an existing slot"
        )


def _lock_lecturer(db: Session, lecturer_id: uuid.UUID):
    # Serialize slot creation/updates/deletions for this lecturer.
    return (
        db.query(Lecturer.id)
        .filter(Lecturer.id == lecturer_id)
        .with_for_update()
        .first()
    )


@router.post("/slots", response_model=SlotOut, status_code=201)
def create_slot(
    req: SlotCreateRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_lecturer),
):
    try:
        if not _lock_lecturer(db, current_user.id):
            raise HTTPException(status_code=404, detail="Lecturer profile not found")

        _check_slot_time(req.slot_date, req.start_time, req.end_time)
        _check_slot_overlap(
            db,
            current_user.id,
            req.slot_date,
            req.start_time,
            req.end_time,
        )

        slot = AvailabilitySlot(
            id=uuid.uuid4(),
            lecturer_id=current_user.id,
            slot_date=req.slot_date,
            start_time=req.start_time,
            end_time=req.end_time,
            location_type=req.location_type,
            location=req.location,
            notes=req.notes,
            created_at=datetime.utcnow().isoformat(),
        )
        db.add(slot)
        db.commit()
        db.refresh(slot)
        return _to_slot_out(slot, True)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to create availability slot"
        ) from exc


@router.patch("/slots/{slot_id}", response_model=SlotOut)
def update_slot(
    slot_id: uuid.UUID,
    req: SlotUpdateRequest,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_lecturer),
):
    try:
        if not _lock_lecturer(db, current_user.id):
            raise HTTPException(status_code=404, detail="Lecturer profile not found")

        slot = (
            db.query(AvailabilitySlot)
            .filter(
                AvailabilitySlot.id == slot_id,
                AvailabilitySlot.lecturer_id == current_user.id,
            )
            .with_for_update()
            .first()
        )
        if not slot:
            raise HTTPException(
                status_code=404,
                detail="Slot not found or not owned by you"
            )

        if _slot_is_booked(slot.id, db):
            raise HTTPException(
                status_code=409,
                detail="Cannot edit a slot with an active appointment"
            )

        updates = req.model_dump(exclude_unset=True)

        # Required database fields cannot be explicitly set to null.
        required_fields = {
            "slot_date", "start_time", "end_time", "location_type", "location"
        }
        if any(updates.get(field, object()) is None for field in required_fields if field in updates):
            raise HTTPException(
                status_code=400,
                detail="Required slot fields cannot be null"
            )

        new_date = updates.get("slot_date", slot.slot_date)
        new_start = updates.get("start_time", slot.start_time)
        new_end = updates.get("end_time", slot.end_time)

        _check_slot_time(new_date, new_start, new_end)
        _check_slot_overlap(
            db,
            current_user.id,
            new_date,
            new_start,
            new_end,
            exclude_slot_id=slot.id,
        )

        for field, value in updates.items():
            setattr(slot, field, value)

        db.commit()
        db.refresh(slot)
        return _to_slot_out(slot, not _slot_is_booked(slot.id, db))

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to update availability slot"
        ) from exc


@router.delete("/slots/{slot_id}", status_code=200)
def delete_slot(
    slot_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: Profile = Depends(require_lecturer),
):
    try:
        if not _lock_lecturer(db, current_user.id):
            raise HTTPException(status_code=404, detail="Lecturer profile not found")

        slot = (
            db.query(AvailabilitySlot)
            .filter(
                AvailabilitySlot.id == slot_id,
                AvailabilitySlot.lecturer_id == current_user.id,
            )
            .with_for_update()
            .first()
        )
        if not slot:
            raise HTTPException(
                status_code=404,
                detail="Slot not found or not owned by you"
            )

        # Preserve appointment history and avoid violating the appointments.slot_id FK.
        has_appointment_history = (
            db.query(Appointment.id)
            .filter(Appointment.slot_id == slot.id)
            .first()
            is not None
        )
        if has_appointment_history:
            raise HTTPException(
                status_code=409,
                detail="Cannot delete a slot referenced by appointment history"
            )

        db.delete(slot)
        db.commit()
        return {
            "message": "Availability slot deleted successfully",
            "slot_id": str(slot_id),
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete availability slot"
        ) from exc
