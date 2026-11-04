import type { Database } from "@/integrations/supabase/types";

export type Status = Database["public"]["Enums"]["appointment_status"];
export type Appointment = Database["public"]["Tables"]["appointments"]["Row"];
export type Slot = Database["public"]["Tables"]["availability_slots"]["Row"];

export const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancellation_requested: "Cancellation Requested",
  rescheduling_requested: "Rescheduling Requested",
  cancelled: "Cancelled",
  completed: "Completed",
};

export const ACTIVE_STATUSES: Status[] = ["pending", "approved", "cancellation_requested", "rescheduling_requested"];

export function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function fmtRange(a: { start_time: string; end_time: string }) {
  return `${fmtTime(a.start_time)} – ${fmtTime(a.end_time)}`;
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isFuture(a: { appointment_date?: string; slot_date?: string; start_time: string }) {
  const date = a.appointment_date ?? a.slot_date!;
  return new Date(`${date}T${a.start_time}`) > new Date();
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !["bin", "binti", "a/l", "a/p"].includes(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Something went wrong. Please try again.";
}
