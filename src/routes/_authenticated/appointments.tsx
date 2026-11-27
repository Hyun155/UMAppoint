import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock3, MapPin, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiGetSlots, apiRequestCancellation, apiRequestReschedule } from "@/lib/backend";
import { demoAppointments, formatDisplayDate, StatusPill } from "@/components/portal-ui";
import { useAuth } from "@/lib/auth";
import {
  apiGetMyAppointments,
  fmtDate,
  fmtTime,
  getToken,
  type AppointmentOut,
} from "@/lib/backend";

interface NormalizedAppointment {
  id: string;
  ref_code: string | null;
  lecturerName: string;
  lecturerDepartment: string | null;
  dateStr: string;
  timeStr: string;
  location: string;
  purpose: string;
  status: string;
  lecturerNote: string | null;
}

export const Route = createFileRoute("/_authenticated/appointments")({
  head: () => ({ meta: [{ title: "My Appointments — UMAppoint" }] }),
  component: function AppointmentsPage() {
    const { me, isPreview } = useAuth();
    const [filter, setFilter] = useState("All");
    const queryClient = useQueryClient();

    const hasToken = !!getToken();

    // ── Fetch from FastAPI backend only when logged in with a real token ───
    const { data: realAppointments, isLoading } = useQuery({
      queryKey: ["my-appointments"],
      queryFn: apiGetMyAppointments,
      enabled: !isPreview && hasToken && me?.role === "student",
      retry: false,
    });

    const cancelMutation = useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) => apiRequestCancellation(id, reason),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        toast.success("Cancellation request sent to the lecturer.");
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to request cancellation."),
    });
    const rescheduleMutation = useMutation({
      mutationFn: ({ id, slotId, reason }: { id: string; slotId: string; reason: string }) =>
        apiRequestReschedule(id, slotId, reason),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["my-appointments"] });
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        toast.success("Rescheduling request sent to the lecturer.");
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "Unable to request rescheduling."),
    });

    async function requestReschedule(appointment: AppointmentOut) {
      try {
        const slots = (await apiGetSlots(appointment.lecturer_id))
          .filter((slot) => slot.open && slot.id !== appointment.slot_id);
        if (slots.length === 0) {
          window.alert("This lecturer has no other available consultation slots.");
          return;
        }
        const options = slots.slice(0, 20).map((slot, index) =>
          `${index + 1}. ${fmtDate(slot.slot_date)} · ${fmtTime(slot.start_time)}–${fmtTime(slot.end_time)} · ${slot.location}`
        ).join("\n");
        const selected = window.prompt("Select a new consultation slot by number:\n" + options);
        if (!selected) return;
        const index = Number(selected) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= Math.min(slots.length, 20)) {
          window.alert("Please enter a valid slot number.");
          return;
        }
        const reason = window.prompt("Why do you need to reschedule? (At least 5 characters)");
        if (!reason || reason.trim().length < 5) return;
        rescheduleMutation.mutate({ id: appointment.id, slotId: slots[index].id, reason: reason.trim() });
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "Unable to load available slots.");
      }
    }

    const items: NormalizedAppointment[] = useMemo(() => {
      // 1. If real appointments are loaded from FastAPI:
      if (!isPreview && hasToken && realAppointments !== undefined) {
        return realAppointments
          .filter((a) => {
            if (filter === "All") return true;
            return a.status.toLowerCase() === filter.toLowerCase();
          })
          .map((a) => ({
            id: a.id,
            ref_code: a.ref_code,
            lecturerName: a.lecturer_name
              ? (a.lecturer_title && !a.lecturer_name.toLowerCase().startsWith(a.lecturer_title.toLowerCase())
                  ? `${a.lecturer_title} ${a.lecturer_name}`
                  : a.lecturer_name)
              : a.ref_code
                ? `Ref: ${a.ref_code}`
                : `Appointment #${a.id.slice(0, 8)}`,
            lecturerDepartment: a.lecturer_department ?? null,
            dateStr: fmtDate(a.appointment_date),
            timeStr: `${fmtTime(a.start_time)} – ${fmtTime(a.end_time)}`,
            location: a.location || "Office",
            purpose: a.purpose,
            status: a.status,
            lecturerNote: a.lecturer_note,
          }));
      }

      // Do not display sample records for authenticated users.
      if (!isPreview && hasToken && me?.role === "student") return [];

      // Preview mode only: show sample appointments.
      return demoAppointments
        .filter((a) => {
          if (filter === "All") return true;
          return a.status.toLowerCase() === filter.toLowerCase();
        })
        .map((d) => ({
          id: d.id,
          ref_code: null,
          lecturerName: d.title && !d.name.toLowerCase().startsWith(d.title.toLowerCase())
            ? `${d.title} ${d.name}`
            : d.name,
          lecturerDepartment: null,
          dateStr: formatDisplayDate(d.date),
          timeStr: d.time,
          location: d.location || "Office",
          purpose: d.purpose,
          status: d.status,
          lecturerNote: null,
        }));
    }, [realAppointments, filter, isPreview, hasToken]);

    const tone = (status: string) => {
      const s = status.toLowerCase();
      if (s === "approved") return "success" as const;
      if (s === "pending") return "warning" as const;
      if (s === "rejected") return "danger" as const;
      return "info" as const;
    };

    return (
      <div>
        <PageHeader
          title="My Appointments"
          subtitle="Keep track of your scheduled consultations and request statuses."
        />

        <div className="mb-5 flex flex-wrap gap-2">
          {["All", "Pending", "Approved", "Rejected"].map((item) => (
            <Button
              key={item}
              size="sm"
              variant={filter === item ? "default" : "outline"}
              onClick={() => setFilter(item)}
            >
              {item}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center">
            <p className="font-medium text-foreground">No {filter.toLowerCase()} appointments</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Book consultations from the &quot;Find Lecturers&quot; page to see them here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((a) => (
              <article key={a.id} className="rounded-xl border bg-card p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground text-base">{a.lecturerName}</p>
                      {a.ref_code && (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs font-mono text-muted-foreground">
                          {a.ref_code}
                        </span>
                      )}
                    </div>
                    {a.lecturerDepartment && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.lecturerDepartment}</p>
                    )}
                  </div>
                  <StatusPill tone={tone(a.status)}>{a.status.toUpperCase()}</StatusPill>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {a.dateStr}
                  </span>
                  <span className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-primary" />
                    {a.timeStr}
                  </span>
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {a.location}
                  </span>
                </div>

                <p className="mt-4 text-sm text-foreground">
                  <span className="font-medium">Purpose: </span> {a.purpose}
                </p>

                {a.status.toLowerCase() === "approved" && realAppointments?.some((item) => item.id === a.id) && (
                  <div className="mt-4">
                    <Button size="sm" variant="outline" disabled={rescheduleMutation.isPending} onClick={() => {
                      const appointment = realAppointments?.find((item) => item.id === a.id);
                      if (appointment) void requestReschedule(appointment);
                    }}>
                      {rescheduleMutation.isPending ? "Submitting..." : "Request reschedule"}
                    </Button>
                  </div>
                )}
                {(a.status.toLowerCase() === "pending" || a.status.toLowerCase() === "approved") && (
                  <div className="mt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={cancelMutation.isPending}
                      onClick={() => {
                        const reason = window.prompt("Why do you need to cancel this appointment?");
                        if (reason && reason.trim().length >= 5) {
                          cancelMutation.mutate({ id: a.id, reason: reason.trim() });
                        }
                      }}
                    >
                      {cancelMutation.isPending ? "Submitting..." : "Request cancellation"}
                    </Button>
                  </div>
                )}
                {a.lecturerNote && (
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    Lecturer response note: {a.lecturerNote}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    );
  },
});
