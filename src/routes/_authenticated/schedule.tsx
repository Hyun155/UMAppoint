import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, CheckCircle2, Clock3, MapPin, Video } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { formatDisplayDate, StatusPill } from "@/components/portal-ui";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({ meta: [{ title: "My Schedule — UMAppoint" }] }),
  component: function SchedulePage() {
    const items = [
      {
        id: "APT-1042",
        student: "Aisyah Zulkifli",
        date: "2026-11-10",
        time: "09:00 – 09:30",
        location: "Office · C-312",
        purpose: "Final year project architecture",
      },
      {
        id: "APT-1051",
        student: "Daniel Lee",
        date: "2026-11-12",
        time: "14:00 – 14:30",
        location: "Online consultation",
        purpose: "Database normalisation review",
      },
      {
        id: "APT-1056",
        student: "Nur Iman",
        date: "2026-11-18",
        time: "11:00 – 11:30",
        location: "Office · C-312",
        purpose: "AI project supervision",
      },
    ];
    return (
      <div>
        <PageHeader
          title="My Schedule"
          subtitle="Your confirmed consultations in chronological order."
          action={
            <Button variant="outline">
              <CalendarDays /> Calendar view
            </Button>
          }
        />
        <div className="relative space-y-4 before:absolute before:bottom-4 before:left-5 before:top-4 before:w-px before:bg-border">
          {items.map((item) => (
            <article
              key={item.id}
              className="relative ml-0 rounded-xl border bg-card p-5 pl-16 shadow-card"
            >
              <div className="absolute left-3 top-5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <span className="h-2 w-2 rounded-full bg-white" />
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {formatDisplayDate(item.date)} · {item.time}
                  </p>
                  <p className="mt-1 font-semibold">{item.student}</p>
                </div>
                <StatusPill tone="success">Confirmed</StatusPill>
              </div>
              <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                <span className="flex gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  {item.location}
                </span>
                <span className="flex gap-2">
                  <Clock3 className="h-4 w-4 text-primary" />
                  {item.purpose}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => toast.success("Appointment marked as completed")}>
                  <CheckCircle2 />
                  Mark as completed
                </Button>
                {item.location.includes("Online") && (
                  <Button size="sm" variant="outline">
                    <Video />
                    Open meeting
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  },
});
