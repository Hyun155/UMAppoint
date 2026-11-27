/**
 * src/lib/backend.ts
 * HTTP client for the FastAPI backend at VITE_API_URL (default: http://localhost:8000)
 */

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/+$/, "") || "http://127.0.0.1:8002";

const TOKEN_KEY = "uma_token";
const USER_KEY = "uma_user";

// ── Stored session helpers ────────────────────────────────────────────────────

export interface StoredUser {
  user_id: string;
  role: "student" | "lecturer";
  full_name: string;
  email: string;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, user: StoredUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): StoredUser | null {
  const raw = localStorage.getItem(USER_KEY);
  try {
    return raw ? (JSON.parse(raw) as StoredUser) : null;
  } catch {
    return null;
  }
}

// ── API types (mirror FastAPI schemas) ────────────────────────────────────────

export interface AuthResponse {
  token: string;
  user_id: string;
  role: string;
  full_name: string;
  email: string;
}

export interface SlotOut {
  id: string;
  slot_date: string; // "2026-11-25"
  start_time: string; // "10:00:00"
  end_time: string; // "10:30:00"
  location_type: string;
  location: string;
  notes: string | null;
  open: boolean;
}

export interface LecturerOut {
  id: string;
  title: string;
  full_name: string;
  email: string;
  department: string;
  specialization: string;
  office_location: string;
  consultation_info: string;
  open_slots: SlotOut[];
}

export interface AppointmentOut {
  id: string;
  ref_code: string | null;
  student_id: string;
  lecturer_id: string;
  lecturer_name?: string | null;
  lecturer_title?: string | null;
  lecturer_department?: string | null;
  student_name?: string | null;
  student_matric_no?: string | null;
  slot_id: string | null;
  appointment_date: string; // "2026-11-25"
  start_time: string; // "10:00:00"
  end_time: string;
  location: string;
  purpose: string;
  status: string;
  lecturer_note: string | null;
  student_request_reason: string | null;
  reschedule_date?: string | null;
  reschedule_start_time?: string | null;
  reschedule_end_time?: string | null;
  reschedule_location?: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ApiNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  appointment_id?: string | null;
  is_read: boolean;
  created_at: string;
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const init: RequestInit = {
    method,
    headers,
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch (err: unknown) {
    // Attempt IPv4 / localhost fallback in case of Windows dual-stack socket issues
    const fallbackBase = API_URL.includes("localhost")
      ? API_URL.replace("localhost", "127.0.0.1")
      : API_URL.includes("127.0.0.1")
        ? API_URL.replace("127.0.0.1", "localhost")
        : null;

    if (fallbackBase) {
      try {
        res = await fetch(`${fallbackBase}${path}`, init);
      } catch {
        throw new Error(
          `Cannot connect to backend server at ${API_URL}. Please ensure the UMAppoint FastAPI server is running.`,
        );
      }
    } else {
      const isConnErr =
        err instanceof TypeError || (err instanceof Error && err.message.includes("fetch"));
      if (isConnErr) {
        throw new Error(
          "Cannot connect to backend server at http://localhost:8000. Please ensure uvicorn is running on port 8000.",
        );
      }
      throw err;
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    let message = `Server error (${res.status})`;

    if (err) {
      if (typeof err.detail === "string") {
        message = err.detail;
      } else if (Array.isArray(err.detail)) {
        // FastAPI / Pydantic validation error array
        message = err.detail
          .map((d: { loc?: unknown[]; msg?: string }) => {
            const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "";
            return field ? `${field}: ${d.msg}` : d.msg || "Invalid input";
          })
          .join("; ");
      } else if (err.message) {
        message = err.message;
      }
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface ChatReply {
  answer: string;
  suggestions: string[];
}

export async function apiSendChatMessage(message: string): Promise<ChatReply> {
  return req<ChatReply>("POST", "/api/chat/message", { message });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  return req<AuthResponse>("POST", "/api/auth/login", { email, password });
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  role: string;
  matric_no?: string | undefined;
  programme?: string | undefined;
  department?: string | undefined;
}

export async function apiRegister(data: RegisterPayload): Promise<AuthResponse> {
  return req<AuthResponse>("POST", "/api/auth/register", data);
}

// ── Lecturers ─────────────────────────────────────────────────────────────────

export async function apiGetLecturers(
  search?: string,
  department?: string,
): Promise<LecturerOut[]> {
  const p = new URLSearchParams();
  if (search) p.set("search", search);
  if (department) p.set("department", department);
  const qs = p.toString() ? `?${p}` : "";
  return req<LecturerOut[]>("GET", `/api/lecturers${qs}`);
}

export async function apiGetSlots(lecturerId: string): Promise<SlotOut[]> {
  return req<SlotOut[]>("GET", `/api/lecturers/${lecturerId}/slots`);
}

export interface AvailabilitySlotPayload {
  slot_date: string;
  start_time: string;
  end_time: string;
  location_type: "physical" | "online";
  location: string;
  notes?: string | null;
}

export async function apiGetAvailabilitySlots(lecturerId: string): Promise<SlotOut[]> {
  return apiGetSlots(lecturerId);
}

export async function apiCreateAvailabilitySlot(
  payload: AvailabilitySlotPayload,
): Promise<SlotOut> {
  return req<SlotOut>("POST", "/api/lecturers/slots", payload);
}

export async function apiUpdateAvailabilitySlot(
  slotId: string,
  payload: Partial<AvailabilitySlotPayload>,
): Promise<SlotOut> {
  return req<SlotOut>("PATCH", `/api/lecturers/slots/${slotId}`, payload);
}

export async function apiDeleteAvailabilitySlot(
  slotId: string,
): Promise<{ message: string; slot_id: string }> {
  return req<{ message: string; slot_id: string }>("DELETE", `/api/lecturers/slots/${slotId}`);
}

// ── Appointments ──────────────────────────────────────────────────────────────

export async function apiBookAppointment(slotId: string, purpose: string): Promise<AppointmentOut> {
  return req<AppointmentOut>("POST", "/api/appointments", { slot_id: slotId, purpose });
}

export async function apiGetMyAppointments(): Promise<AppointmentOut[]> {
  return req<AppointmentOut[]>("GET", "/api/appointments");
}

// ── Lecturer workflow ─────────────────────────────────────────────────────────

export async function apiGetLecturerAppointments(status?: string): Promise<AppointmentOut[]> {
  const qs = status ? `?status=${status}` : "";
  return req<AppointmentOut[]>("GET", `/api/lecturer/appointments${qs}`);
}

export async function apiUpdateStatus(
  id: string,
  status: "APPROVED" | "REJECTED" | "COMPLETED" | "CANCELLED",
  lecturerNote?: string,
): Promise<AppointmentOut> {
  return req<AppointmentOut>("PATCH", `/api/appointments/${id}/status`, {
    status,
    lecturer_note: lecturerNote ?? null,
  });
}

// ── History & Notifications ───────────────────────────────────────────────────

export async function apiGetHistory(): Promise<AppointmentOut[]> {
  return req<AppointmentOut[]>("GET", "/api/history");
}

export async function apiGetNotifications(): Promise<ApiNotification[]> {
  return req<ApiNotification[]>("GET", "/api/notifications");
}

export async function apiMarkNotificationRead(id: string): Promise<ApiNotification> {
  return req<ApiNotification>("PATCH", `/api/notifications/${id}/read`);
}

export async function apiMarkAllNotificationsRead(): Promise<{ status: string; message: string }> {
  return req<{ status: string; message: string }>("PATCH", "/api/notifications/read-all");
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  avatar_url?: string | null;
  role: "student" | "lecturer";
  title?: string;
  department?: string;
  specialization?: string;
  office_location?: string;
  consultation_info?: string;
  matric_no?: string;
  programme?: string;
  year_of_study?: number;
}

export async function apiGetProfile(): Promise<UserProfile> {
  return req<UserProfile>("GET", "/api/auth/me");
}

export async function apiUpdateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
  return req<UserProfile>("PATCH", "/api/auth/me", data);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format "10:00:00" → "10:00" */
export function fmtTime(t: string): string {
  return t ? t.slice(0, 5) : "";
}

/** Format "2026-11-25" → "25 Nov 2026" */
export function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}


export async function apiRequestCancellation(id: string, reason: string): Promise<AppointmentOut> {
  return req<AppointmentOut>("POST", `/api/appointments/${id}/cancellation-request`, { reason });
}

export async function apiRequestReschedule(id: string, slotId: string, reason: string): Promise<AppointmentOut> {
  return req<AppointmentOut>("POST", `/api/appointments/${id}/reschedule-request`, { slot_id: slotId, reason });
}
