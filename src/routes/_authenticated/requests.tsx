import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Check, Clock3, MapPin, UserRound, X } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({ meta: [{ title: "Booking Requests — UMAppoint" }] }),
  component: function RequestsPage() {
    const [kind, setKind] = useState("Booking requests");
    const [rejecting, setRejecting] = useState<string | null>(null);
    const [reason, setReason] = useState("");
    const requests = [
      {
        id: "REQ-209",
        name: "Aisyah Zulkifli",
        type: "New booking",
        date: "2026-11-12",
        time: "14:00 – 14:30",
        purpose: "Discuss database normalisation for capstone project",
      },
      {
        id: "REQ-210",
        name: "Daniel Lee",
        type: "Reschedule request",
        date: "2026-11-13",
        time: "11:00 – 11:30",
        purpose: "Requested a new time due to timetable clash",
      },
    ];
    return (
      <div>
        <PageHeader
          title="Booking Requests"
          subtitle="Review and respond to student booking changes."
          action={<StatusPill tone="warning">3 pending actions</StatusPill>}
        />
        <div className="mb-5 flex gap-2">
          {["Booking requests", "Change requests"].map((item) => (
            <Button
              key={item}
              variant={kind === item ? "default" : "outline"}
              onClick={() => setKind(item)}
            >
              {item}
            </Button>
          ))}
        </div>
        <div className="space-y-3">
          {requests.map((r) => (
            <article key={r.id} className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                    <UserRound className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.id} · {r.type}
                    </p>
                  </div>
                </div>
                <StatusPill tone="warning">Pending review</StatusPill>
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {formatDisplayDate(r.date)}
                </span>
                <span className="flex gap-1.5">
                  <Clock3 className="h-4 w-4" />
                  {r.time}
                </span>
                <span className="flex gap-1.5">
                  <MapPin className="h-4 w-4" />
                  Office consultation
                </span>
              </div>
              <p className="mt-4 rounded-lg bg-muted/50 p-3 text-sm">{r.purpose}</p>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    toast.success("Request approved", {
                      description: `The student has been notified.`,
                    })
                  }
                >
                  <Check />
                  Approve
                </Button>
                <Button size="sm" variant="outline" onClick={() => setRejecting(r.id)}>
                  <X />
                  Reject
                </Button>
              </div>
            </article>
          ))}
        </div>
        <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject request</DialogTitle>
              <DialogDescription>
                Provide a short reason so the student knows what to do next.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for rejecting this request..."
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setRejecting(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!reason.trim()}
                onClick={() => {
                  toast.success("Request rejected");
                  setRejecting(null);
                  setReason("");
                }}
              >
                Reject request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
});
