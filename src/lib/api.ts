import { supabase } from "@/integrations/supabase/client";
import type { Appointment, Slot } from "./format";

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
  const { data: lec, error } = await supabase.from("lecturers").select("*");
  if (error) throw error;
  const ids = lec.map((l) => l.id);
  const { data: profs, error: e2 } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  if (e2) throw e2;
  return lec
    .map((l) => {
      const p = profs.find((x) => x.id === l.id);
      return { ...l, full_name: p?.full_name ?? "", email: p?.email ?? "" };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
}

export async function fetchLecturer(id: string): Promise<LecturerFull | null> {
  const all = await fetchLecturers();
  return all.find((l) => l.id === id) ?? null;
}

/** Future slots of a lecturer that have no active booking. */
export async function fetchOpenSlots(lecturerId: string): Promise<Slot[]> {
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
  if (error) throw error;
  if (e2) throw e2;
  const bookedSet = new Set((booked as unknown as string[]) ?? []);
  return slots.filter((s) => !bookedSet.has(s.id) && new Date(`${s.slot_date}T${s.start_time}`) > now);
}

export async function fetchMyAppointments(): Promise<AppointmentFull[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .order("appointment_date", { ascending: false })
    .order("start_time", { ascending: false });
  if (error) throw error;
  const ids = Array.from(new Set(data.flatMap((a) => [a.student_id, a.lecturer_id])));
  const slotIds = data.map((a) => a.reschedule_slot_id).filter(Boolean) as string[];
  const [{ data: profs }, { data: studs }, { data: lecs }, { data: rs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]),
    supabase.from("students").select("id, matric_no, programme"),
    supabase.from("lecturers").select("id, title"),
    slotIds.length
      ? supabase.from("availability_slots").select("*").in("id", slotIds)
      : Promise.resolve({ data: [] as Slot[] }),
  ]);
  return data.map((a) => {
    const sp = profs?.find((p) => p.id === a.student_id);
    const lp = profs?.find((p) => p.id === a.lecturer_id);
    const st = studs?.find((s) => s.id === a.student_id);
    const lc = lecs?.find((l) => l.id === a.lecturer_id);
    return {
      ...a,
      student: { id: a.student_id, full_name: sp?.full_name ?? "Student", email: sp?.email ?? "", matric_no: st?.matric_no, programme: st?.programme },
      lecturer: { id: a.lecturer_id, full_name: lp?.full_name ?? "Lecturer", email: lp?.email ?? "", title: lc?.title },
      reschedule_slot: rs?.find((s) => s.id === a.reschedule_slot_id) ?? null,
    };
  });
}

export async function fetchNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data;
}
