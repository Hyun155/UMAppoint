import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchMyAppointments } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ACTIVE_STATUSES } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { AppointmentCard } from "@/components/AppointmentCard";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — UMAppoint" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { me } = useAuth();
  const q = useQuery({
    queryKey: ["appointments"],
    queryFn: fetchMyAppointments,
    retry: false,
    staleTime: 5_000,
  });

  const list = q.data ?? [];
  const active = list.filter((a) => ACTIVE_STATUSES.includes(a.status));
  const stats = [
    { label: "Pending", n: list.filter((a) => a.status === "pending").length },
    { label: "Approved", n: list.filter((a) => a.status === "approved").length },
    { label: "Completed", n: list.filter((a) => a.status === "completed").length },
  ];

  return (
    <div>
      <PageHeader
        title={`Hello, ${me?.full_name ?? "there"}`}
        subtitle={
          me?.role === "lecturer" ? "Your consultation overview" : "Your upcoming consultations"
        }
      />
      <div className="mb-6 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5 shadow-card">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold text-foreground">{s.n}</p>
          </div>
        ))}
      </div>
      <h2 className="mb-3 text-lg font-semibold text-foreground">Active appointments</h2>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading appointments…</p>
      ) : q.isError ? (
        <div className="rounded-xl border border-destructive/30 bg-card p-5 text-sm text-destructive">
          Could not load appointments from the UMAppoint backend. Check that the API is running
          and your session is valid, then refresh this page.
          {q.error instanceof Error ? <p className="mt-2">{q.error.message}</p> : null}
        </div>
      ) : active.length === 0 ? (
        <EmptyState title="No active appointments" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {active.map((a) => (
            <AppointmentCard key={a.id} a={a} role={me?.role || "student"} />
          ))}
        </div>
      )}
    </div>
  );
}
