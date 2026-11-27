import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, Clock3, MapPin, UserRound, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDisplayDate, StatusPill } from "@/components/portal-ui";
import { useAuth } from "@/lib/auth";
import {
  apiGetLecturerAppointments,
  apiUpdateStatus,
  fmtDate,
  fmtTime,
  getToken,
  type AppointmentOut,
} from "@/lib/backend";

interface NormalizedRequest {
  id: string;
  ref_code: string | null;
  studentName: string;
  matricNo: string | null;
  type: string;
  dateStr: string;
  timeStr: string;
  location: string;
  purpose: string;
  status: string;
  lecturerNote: string | null;
  studentReason: string | null;
  proposedTime: string | null;
}

const DEMO_REQUESTS = [
  {
    id: "REQ-209",
    name: "Aisyah Zulkifli",
    type: "New booking",
    date: "2026-11-25",
    time: "14:00 – 14:30",
    purpose: "Discuss database normalisation for capstone project",
    status: "pending",
  },
  {
    id: "REQ-210",
    name: "Daniel Lee",
    type: "Reschedule request",
    date: "2026-11-26",
    time: "11:00 – 11:30",
    purpose: "Requested a new time due to timetable clash",
    status: "pending",
  },
];

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({ meta: [{ title: "Booking Requests — UMAppoint" }] }),
  component: function RequestsPage() {
    const { me, isPreview } = useAuth();
    const qc = useQueryClient();

    const [kind, setKind] = useState<"pending" | "all">("pending");
    const [rejecting, setRejecting] = useState<string | null>(null);
    const [reason, setReason] = useState("");
    const [actionId, setActionId] = useState<string | null>(null);

    const hasToken = !!getToken();

    // ── Fetch incoming requests for this lecturer from FastAPI ──────────────
    const {
      data: realRequests,
      isLoading,
    } = useQuery({
      queryKey: ["lecturer-appointments", kind],
      queryFn: () => apiGetLecturerAppointments(),
      enabled: !isPreview && hasToken && me?.role === "lecturer",
      retry: false,
    });

    // ── Approve appointment (Step 4) ────────────────────────────────────────
    async function handleApprove(id: string) {
      if (isPreview || id.startsWith("REQ-")) {
        toast.success("Request approved (Demo Mode)", {
          description: "Student has been notified.",
        });
        return;
      }

      setActionId(id);
      try {
        const requestStatus = realRequests?.find((request) => request.id === id)?.status?.toLowerCase();
        await apiUpdateStatus(id, requestStatus === "cancellation_requested" ? "CANCELLED" : "APPROVED");
        toast.success(requestStatus === "cancellation_requested" ? "Appointment cancellation confirmed" : "Appointment approved!", {
          description: requestStatus === "cancellation_requested"
            ? "The appointment has been cancelled and its slot is available again."
            : "The consultation time is now confirmed for this student.",
        });
        qc.invalidateQueries({ queryKey: ["lecturer-appointments"] });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to approve appointment";
        toast.error("Error", { description: msg });
      } finally {
        setActionId(null);
      }
    }

    // ── Reject appointment (Step 4) ─────────────────────────────────────────
    async function handleReject() {
      if (!rejecting) return;

      if (isPreview || rejecting.startsWith("REQ-")) {
        toast.success("Request rejected (Demo Mode)");
        setRejecting(null);
        setReason("");
        return;
      }

      setActionId(rejecting);
      try {
        const requestStatus = realRequests?.find((request) => request.id === rejecting)?.status?.toLowerCase();
        const decision = requestStatus === "cancellation_requested" ? "APPROVED" : "REJECTED";
        await apiUpdateStatus(rejecting, decision, reason);
        toast.success(
          requestStatus === "rescheduling_requested"
            ? "Reschedule request declined"
            : requestStatus === "cancellation_requested"
              ? "Cancellation request declined"
              : "Appointment rejected",
          {
            description: requestStatus === "rescheduling_requested" || requestStatus === "cancellation_requested"
              ? "The original approved appointment remains unchanged."
              : "The requested slot has been released back to OPEN for other students.",
          },
        );
        setRejecting(null);
        setReason("");
        qc.invalidateQueries({ queryKey: ["lecturer-appointments"] });
        qc.invalidateQueries({ queryKey: ["lecturers"] });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to reject appointment";
        toast.error("Error", { description: msg });
      } finally {
        setActionId(null);
      }
    }

    const items: NormalizedRequest[] = useMemo(() => {
      if (realRequests && realRequests.length > 0) {
        return realRequests
          .filter((r) => kind === "all" || ["pending", "cancellation_requested", "rescheduling_requested"].includes(r.status.toLowerCase()))
          .map((r) => ({
          id: r.id,
          ref_code: r.ref_code,
          studentName:
            r.student_name || (r.ref_code ? `Ref: ${r.ref_code}` : `Appt #${r.id.slice(0, 8)}`),
          matricNo: r.student_matric_no ?? null,
          type: "Consultation Booking",
          dateStr: fmtDate(r.appointment_date),
          timeStr: `${fmtTime(r.start_time)} – ${fmtTime(r.end_time)}`,
          location: r.location || "Office consultation",
          purpose: r.purpose,
          status: r.status,
          lecturerNote: r.lecturer_note,
          studentReason: r.student_request_reason ?? null,
          proposedTime: r.reschedule_date
            ? `${fmtDate(r.reschedule_date)} · ${fmtTime(r.reschedule_start_time ?? "")}–${fmtTime(r.reschedule_end_time ?? "")} · ${r.reschedule_location ?? "Location to be confirmed"}`
            : null,
        }));
      }

      if (!realRequests && isPreview) {
        return DEMO_REQUESTS.map((d) => ({
          id: d.id,
          ref_code: null,
          studentName: d.name,
          matricNo: null,
          type: d.type,
          dateStr: formatDisplayDate(d.date),
          timeStr: d.time,
          location: "Office consultation",
          purpose: d.purpose,
          status: d.status,
          lecturerNote: null,
          studentReason: null,
          proposedTime: null,
        }));
      }

      return [];
    }, [realRequests, isPreview, kind]);

    return (
      <div>
        <PageHeader
          title="Booking Requests"
          subtitle="Review and respond to incoming student consultation bookings."
          action={
            <StatusPill tone="warning">
              {realRequests
                ? `${realRequests.filter((r) => ["pending", "cancellation_requested", "rescheduling_requested"].includes(r.status.toLowerCase())).length} pending`
                : "Preview"}
            </StatusPill>
          }
        />

        <div className="mb-5 flex gap-2">
          <Button
            variant={kind === "pending" ? "default" : "outline"}
            size="sm"
            onClick={() => setKind("pending")}
          >
            Pending review
          </Button>
          <Button
            variant={kind === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setKind("all")}
          >
            All appointments
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-12 text-center">
            <p className="font-medium text-foreground">No {kind} booking requests</p>
            <p className="mt-1 text-sm text-muted-foreground">
              New booking requests from students will appear here for your review.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((r: NormalizedRequest) => {
              const currentStatus = (r.status || "").toLowerCase();
              const isPending = ["pending", "cancellation_requested", "rescheduling_requested"].includes(currentStatus);
              const actionLabel = currentStatus === "cancellation_requested" ? "Confirm cancellation" : currentStatus === "rescheduling_requested" ? "Approve new time" : "Approve";

              return (
                <article key={r.id} className="rounded-xl border bg-card p-5 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">{r.studentName}</p>
                          {r.ref_code && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                              {r.ref_code}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {r.matricNo
                            ? `Matric No: ${r.matricNo}`
                            : r.type || "Consultation Booking"}
                        </p>
                      </div>
                    </div>
                    <StatusPill
                      tone={
                        (r.status || "").toLowerCase() === "approved"
                          ? "success"
                          : (r.status || "").toLowerCase() === "rejected"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {(r.status || "Pending").toUpperCase()}
                    </StatusPill>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      {r.dateStr}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock3 className="h-4 w-4 text-primary" />
                      {r.timeStr}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" />
                      {r.location || "Office consultation"}
                    </span>
                  </div>

                  <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-foreground">
                    <span className="font-medium text-foreground">Purpose: </span>
                    {r.purpose}
                  </p>

                  {r.proposedTime && (
                    <p className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
                      <span className="font-medium">Requested new time: </span>{r.proposedTime}
                    </p>
                  )}
                  {r.studentReason && (
                    <p className="mt-3 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
                      <span className="font-medium">Student request reason: </span>{r.studentReason}
                    </p>
                  )}
                  {r.lecturerNote && (
                    <p className="mt-2 text-xs text-muted-foreground italic">
                      Lecturer note: {r.lecturerNote}
                    </p>
                  )}

                  {isPending && (
                    <div className="mt-4 flex gap-2">
                      <Button
                        size="sm"
                        disabled={actionId === r.id}
                        onClick={() => handleApprove(r.id)}
                      >
                        {actionId === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4 mr-1" />
                        )}
                        {actionLabel}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionId === r.id}
                        onClick={() => setRejecting(r.id)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        {currentStatus === "cancellation_requested"
                          ? "Keep appointment"
                          : currentStatus === "rescheduling_requested"
                            ? "Decline new time"
                            : "Reject"}
                      </Button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}

        {/* ── Reject Reason Dialog ── */}
        <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {realRequests?.find((request) => request.id === rejecting)?.status === "rescheduling_requested"
                  ? "Decline reschedule request"
                  : realRequests?.find((request) => request.id === rejecting)?.status === "cancellation_requested"
                    ? "Decline cancellation request"
                    : "Reject booking request"}
              </DialogTitle>
              <DialogDescription>
                Provide a short reason so the student understands your decision. Declining a change request keeps the original approved appointment; rejecting a new booking releases its requested slot.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Clashing departmental meeting, please choose another slot..."
              rows={3}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRejecting(null)}>
                Cancel
              </Button>
              <Button variant="destructive" disabled={!reason.trim()} onClick={handleReject}>
                Confirm Decision
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
});
