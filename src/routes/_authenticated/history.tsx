import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { demoAppointments, formatDisplayDate, StatusPill } from "@/components/portal-ui";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — UMAppoint" }] }),
  component: function HistoryPage() {
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("All");
    const past = [
      { ...demoAppointments[0], date: "2026-09-22", status: "Completed" as const },
      { ...demoAppointments[1], date: "2026-08-11", status: "Cancelled" as const },
      { ...demoAppointments[2], date: "2026-07-04", status: "Rejected" as const },
    ];
    const filtered = past.filter(
      (a) =>
        (status === "All" || a.status === status) &&
        `${a.name} ${a.purpose}`.toLowerCase().includes(query.toLowerCase()),
    );
    return (
      <div>
        <PageHeader title="History" subtitle="Review your previous consultations and requests." />
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-card md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by lecturer or purpose..."
              className="pl-9"
            />
          </div>
          <Input type="date" className="w-full md:w-44" />
          <Input type="date" className="w-full md:w-44" />
        </div>
        <div className="mt-4 flex gap-2">
          {["All", "Completed", "Rejected", "Cancelled"].map((item) => (
            <Button
              key={item}
              size="sm"
              variant={status === item ? "default" : "outline"}
              onClick={() => setStatus(item)}
            >
              {item}
            </Button>
          ))}
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="hidden grid-cols-[1.3fr_1fr_1fr_0.7fr] gap-4 border-b bg-muted/40 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid">
            <span>Lecturer</span>
            <span>Date & time</span>
            <span>Purpose</span>
            <span>Status</span>
          </div>
          {filtered.map((a) => (
            <div
              key={a.id}
              className="grid gap-3 border-b px-5 py-4 last:border-0 md:grid-cols-[1.3fr_1fr_1fr_0.7fr] md:items-center md:gap-4"
            >
              <div>
                <p className="font-medium">
                  {a.title} {a.name}
                </p>
                <p className="text-xs text-muted-foreground">{a.location}</p>
              </div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                {formatDisplayDate(a.date)}
                <span className="hidden lg:inline">· {a.time}</span>
              </p>
              <p className="text-sm text-muted-foreground">{a.purpose}</p>
              <StatusPill
                tone={
                  a.status === "Completed"
                    ? "success"
                    : a.status === "Rejected"
                      ? "danger"
                      : "neutral"
                }
              >
                {a.status}
              </StatusPill>
            </div>
          ))}
        </div>
      </div>
    );
  },
});
