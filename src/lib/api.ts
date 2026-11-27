import { supabase } from "@/integrations/supabase/client";
import type { Appointment, Slot } from "./format";
import {
  getToken,
  apiGetMyAppointments,
  apiGetLecturerAppointments,
  apiGetNotifications,
  getStoredUser,
} from "./backend";
import { demoAppointments, lecturers as demoLecturers } from "@/components/portal-ui";

export interface Person {
  id: string;
  full_name: string;
  email: string;
}

export interface LecturerFull {
  id: string;
  title: string;
  department: string;
  specialization: string;
  office_location: string;
  consultation_info: string;
  full_name: string;
  email: string;
}

export interface AppointmentFull extends Appointment {
  student: Person & { matric_no?: string | undefined; programme?: string | undefined };
  lecturer: Person & { title?: string | undefined };
  reschedule_slot?: Slot | null;
}

export async function fetchLecturers(): Promise<LecturerFull[]> {
  try {
    const { data: lec, error } = await supabase.from("lecturers").select("*");
    if (error || !lec) throw error;
    const ids = lec.map((l) => l.id);
    const { data: profs, error: e2 } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    if (e2 || !profs) throw e2;
    return lec
      .map((l) => {
        const p = profs.find((x) => x.id === l.id);
        return { ...l, full_name: p?.full_name ?? "", email: p?.email ?? "" };
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  } catch {
    // Fallback to static demo lecturers
    return demoLecturers.map((d) => ({
      id: d.id,
      title: d.title,
      department: d.department,
      specialization: d.specialisation,
      office_location: d.office,
      consultation_info: d.rules,
      full_name: d.name,
      email: `${d.name.toLowerCase().replace(/[^a-z]/g, "")}@um.edu.my`,
    }));
  }
}

export async function fetchLecturer(id: string): Promise<LecturerFull | null> {
  const all = await fetchLecturers();
  return all.find((l) => l.id === id) ?? null;
}

/** Future slots of a lecturer that have no active booking. */
export async function fetchOpenSlots(lecturerId: string): Promise<Slot[]> {
  try {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const [{ data: slots, error }, { data: booked, error: e2 }] = await Promise.all([
      supabase
        .from("availability_slots")
        .select("*")
        .eq("lecturer_id", lecturerId)
        .gte("slot_date", today)
        .order("slot_date")
        .order("start_time"),
      supabase.rpc("booked_slot_ids", { _lecturer: lecturerId }),
    ]);
    if (error || !slots) throw error;
    const bookedSet = new Set((booked as unknown as string[]) ?? []);
    return slots.filter(
      (s) => !bookedSet.has(s.id) && new Date(`${s.slot_date}T${s.start_time}`) > now,
    );
  } catch {
    return [];
  }
}

export async function fetchMyAppointments(): Promise<AppointmentFull[]> {
  const token = getToken();
  const storedUser = getStoredUser();

  // If authenticated with a real backend token:
  if (token && storedUser) {
    try {
      const appts =
        storedUser.role === "lecturer"
          ? await apiGetLecturerAppointments()
          : await apiGetMyAppointments();

      // A successful empty API response means this account has no appointments.
      // Never substitute demo records for an authenticated user.
      return appts.map((a) => ({
          id: a.id,
          ref_code: a.ref_code || a.id.slice(0, 8),
          student_id: a.student_id,
          lecturer_id: a.lecturer_id,
          slot_id: a.slot_id,
          appointment_date: a.appointment_date,
          start_time: a.start_time,
          end_time: a.end_time,
          location: a.location,
          purpose: a.purpose,
          status: a.status as AppointmentFull["status"],
          lecturer_note: a.lecturer_note,
          student_request_reason: a.student_request_reason,
          reschedule_slot_id: null,
          parent_appointment_id: null,
          created_at: a.created_at || new Date().toISOString(),
          updated_at: a.updated_at || new Date().toISOString(),
          student: {
            id: a.student_id,
            full_name:
              a.student_name || (storedUser.role === "student" ? storedUser.full_name : "Student"),
            email: storedUser.role === "student" ? storedUser.email : "",
            matric_no: a.student_matric_no ?? undefined,
          },
          lecturer: {
            id: a.lecturer_id,
            full_name:
              a.lecturer_name ||
              (storedUser.role === "lecturer" ? storedUser.full_name : "Lecturer"),
            email: storedUser.role === "lecturer" ? storedUser.email : "",
            title: a.lecturer_title || "Dr.",
          },
          reschedule_slot: null,
        }));
    } catch (e) {
      console.error("Could not load appointments from FastAPI:", e);
      throw e;
    }
  }

  // Demo appointments are only for preview mode or users without a real session.
  return demoAppointments.map((d, i) => {
    const isApproved = d.status === "Approved";
    const isChange = d.status === "Change Requested";
    const statusVal: AppointmentFull["status"] = isApproved
      ? "approved"
      : isChange
        ? "rescheduling_requested"
        : "pending";

    return {
      id: d.id,
      ref_code: d.id,
      student_id: "b0000000-0000-0000-0000-000000000001",
      lecturer_id: `a0000000-0000-0000-0000-00000000000${i + 1}`,
      slot_id: null,
      appointment_date: d.date,
      start_time: d.time.split(" – ")[0] ? `${d.time.split(" – ")[0]}:00` : "09:00:00",
      end_time: d.time.split(" – ")[1] ? `${d.time.split(" – ")[1]}:00` : "09:30:00",
      location: d.location,
      purpose: d.purpose,
      status: statusVal,
      lecturer_note: isApproved ? "Confirmed. Please come to my office." : null,
      student_request_reason: isChange ? "Timetable clash with tutorial" : null,
      reschedule_slot_id: null,
      parent_appointment_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      student: {
        id: "b0000000-0000-0000-0000-000000000001",
        full_name: "Muhammad Aiman bin Rosli",
        email: "aiman.student@demo.umappoint.edu",
        matric_no: "U2102345",
        programme: "Bachelor of Computer Science",
      },
      lecturer: {
        id: `a0000000-0000-0000-0000-00000000000${i + 1}`,
        full_name: d.name,
        email: `${d.name.toLowerCase().replace(/[^a-z]/g, "")}@um.edu.my`,
        title: d.title,
      },
      reschedule_slot: null,
    };
  });
}

export async function fetchNotifications() {
  if (!getToken()) return [];
  // A live FastAPI session must never fall back to Supabase browser queries or
  // fabricated notifications. The FastAPI endpoint scopes results to the JWT user.
  return apiGetNotifications();
}
