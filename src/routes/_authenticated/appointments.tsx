import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, Clock3, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { demoAppointments, formatDisplayDate, StatusPill } from "@/components/portal-ui";

export const Route = createFileRoute("/_authenticated/appointments")({
  head: () => ({ meta: [{ title: "My Appointments — UMAppoint" }] }),
  component: function AppointmentsPage() {
    const [filter, setFilter] = useState("All");
    const [cancel, setCancel] = useState<(typeof demoAppointments)[number] | null>(null);
    const items = useMemo(
      () =>
        filter === "All" ? demoAppointments : demoAppointments.filter((a) => a.status === filter),
      [filter],
    );
    const tone = (status: string) =>
      status === "Approved"
        ? ("success" as const)
        : status === "Pending"
          ? ("warning" as const)
          : ("info" as const);
    return (
      <div>
        <PageHeader
          title="My Appointments"
          subtitle="Keep track of your upcoming consultation requests."
        />
        <div className="mb-5 flex flex-wrap gap-2">
          {["All", "Pending", "Approved", "Change Requested"].map((item) => (
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
        <div className="space-y-3">
          {items.map((a) => (
            <article key={a.id} className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">{a.id}</p>
                  <p className="mt-1 font-semibold">
                    {a.title} {a.name}
                  </p>
                </div>
                <StatusPill tone={tone(a.status)}>{a.status}</StatusPill>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
                <span className="flex gap-2">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  {formatDisplayDate(a.date)}
                </span>
                <span className="flex gap-2">
                  <Clock3 className="h-4 w-4 text-primary" />
                  {a.time}
                </span>
                <span className="flex gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {a.location}
                </span>
              </div>
              <p className="mt-4 text-sm">
                <span className="font-medium">Purpose:</span> {a.purpose}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {a.status === "Approved" && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.success("Reschedule request started")}
                    >
                      Request reschedule
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setCancel(a)}
                    >
                      Request cancellation
                    </Button>
                  </>
                )}
                {a.status === "Pending" && (
                  <Button size="sm" variant="outline" onClick={() => setCancel(a)}>
                    Withdraw request
                  </Button>
                )}
                {a.status === "Change Requested" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info("Your change request is under review")}
                  >
                    View request
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
        {items.length === 0 && (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center">
            <p className="font-medium">No {filter.toLowerCase()} appointments</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Your appointments will appear here.
            </p>
          </div>
        )}
        <Dialog open={!!cancel} onOpenChange={(open) => !open && setCancel(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {cancel?.status === "Pending" ? "Withdraw request?" : "Request cancellation?"}
              </DialogTitle>
              <DialogDescription>
                This action will notify the lecturer about your request for {cancel?.id}.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCancel(null)}>
                Keep appointment
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  toast.success("Request sent");
                  setCancel(null);
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
});
