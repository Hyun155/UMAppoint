import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { AppointmentFull } from "@/lib/api";
import { fetchOpenSlots } from "@/lib/api";
import { errMsg, fmtDate, fmtRange, isFuture } from "@/lib/format";
import type { Role } from "@/lib/auth";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type Mode = null | "reject" | "cancel" | "reschedule" | "decline";

export function AppointmentCard({ a, role, actions = true }: { a: AppointmentFull; role: Role; actions?: boolean }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>(null);
  const [note, setNote] = useState("");
  const [slotId, setSlotId] = useState<string>("");

  const run = useMutation({
    mutationFn: async (fn: () => PromiseLike<{ error: unknown }>) => {
      const { error } = await fn();
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries();
      setMode(null);
      setNote("");
      setSlotId("");
      toast.success("Updated");
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const slotsQ = useQuery({
    queryKey: ["open-slots", a.lecturer_id],
    queryFn: () => fetchOpenSlots(a.lecturer_id),
    enabled: mode === "reschedule",
  });

  const other = role === "student" ? a.lecturer : a.student;
  const otherLabel =
    role === "student"
      ? `${a.lecturer.title ? a.lecturer.title + " " : ""}${a.lecturer.full_name}`
      : `${a.student.full_name}${a.student.matric_no ? " · " + a.student.matric_no : ""}`;
  const future = isFuture(a);

  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{a.ref_code}</p>
          <p className="mt-0.5 font-semibold text-foreground">{otherLabel}</p>
          <p className="text-xs text-muted-foreground">{other.email}</p>
        </div>
        <StatusBadge status={a.status} />
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4" />{fmtDate(a.appointment_date)}</span>
        <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{fmtRange(a)}</span>
        <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4" />{a.location}</span>
      </div>
      <p className="mt-3 text-sm text-foreground"><span className="font-medium">Purpose:</span> {a.purpose}</p>
      {a.student_request_reason && (
        <p className="mt-1 text-sm text-muted-foreground"><span className="font-medium">Student's reason:</span> {a.student_request_reason}</p>
      )}
      {a.status === "rescheduling_requested" && a.reschedule_slot && (
        <p className="mt-1 text-sm text-info">
          Requested new time: {fmtDate(a.reschedule_slot.slot_date)}, {fmtRange(a.reschedule_slot)}
        </p>
      )}
      {a.lecturer_note && (
        <p className="mt-1 text-sm text-muted-foreground"><span className="font-medium">Lecturer's note:</span> {a.lecturer_note}</p>
      )}

      {actions && (
        <div className="mt-4 flex flex-wrap gap-2">
          {role === "lecturer" && a.status === "pending" && (
            <>
              <Button size="sm" disabled={run.isPending} onClick={() => run.mutate(() => supabase.rpc("decide_appointment", { _appt: a.id, _approve: true }))}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => setMode("reject")}>Reject</Button>
            </>
          )}
          {role === "lecturer" && (a.status === "cancellation_requested" || a.status === "rescheduling_requested") && (
            <>
              <Button size="sm" disabled={run.isPending} onClick={() => run.mutate(() => supabase.rpc("respond_change_request", { _appt: a.id, _approve: true }))}>
                Approve {a.status === "cancellation_requested" ? "cancellation" : "new time"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode("decline")}>Decline</Button>
            </>
          )}
          {role === "lecturer" && a.status === "approved" && (
            <Button size="sm" variant="secondary" disabled={run.isPending} onClick={() => run.mutate(() => supabase.rpc("complete_appointment", { _appt: a.id }))}>Mark completed</Button>
          )}
          {role === "student" && a.status === "pending" && future && (
            <Button size="sm" variant="outline" onClick={() => setMode("cancel")}>Withdraw request</Button>
          )}
          {role === "student" && a.status === "approved" && future && (
            <>
              <Button size="sm" variant="outline" onClick={() => setMode("reschedule")}>Request reschedule</Button>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setMode("cancel")}>Request cancellation</Button>
            </>
          )}
        </div>
      )}

      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "reject" && "Reject booking request"}
              {mode === "decline" && "Decline student's request"}
              {mode === "cancel" && (a.status === "pending" ? "Withdraw request" : "Request cancellation")}
              {mode === "reschedule" && "Request a new time"}
            </DialogTitle>
            <DialogDescription>
              {fmtDate(a.appointment_date)}, {fmtRange(a)} with {otherLabel}
            </DialogDescription>
          </DialogHeader>
          {mode === "reschedule" && (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {slotsQ.isLoading && <p className="text-sm text-muted-foreground">Loading open slots…</p>}
              {slotsQ.data?.length === 0 && <p className="text-sm text-muted-foreground">No other open slots right now.</p>}
              {slotsQ.data?.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                  <input type="radio" name="slot" checked={slotId === s.id} onChange={() => setSlotId(s.id)} />
                  <span className="font-medium">{fmtDate(s.slot_date)}</span>
                  <span className="text-muted-foreground">{fmtRange(s)}</span>
                </label>
              ))}
            </div>
          )}
          <Textarea
            placeholder={mode === "reject" || mode === "decline" ? "Reason (optional)" : "Reason"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMode(null)}>Back</Button>
            <Button
              disabled={run.isPending || (mode === "reschedule" && (!slotId || !note.trim()))}
              onClick={() => {
                if (mode === "reject") run.mutate(() => supabase.rpc("decide_appointment", { _appt: a.id, _approve: false, _note: note }));
                if (mode === "decline") run.mutate(() => supabase.rpc("respond_change_request", { _appt: a.id, _approve: false, _note: note }));
                if (mode === "cancel") run.mutate(() => supabase.rpc("request_cancellation", { _appt: a.id, _reason: note }));
                if (mode === "reschedule") run.mutate(() => supabase.rpc("request_reschedule", { _appt: a.id, _new_slot: slotId, _reason: note }));
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
