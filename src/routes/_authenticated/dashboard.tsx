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
  const q = useQuery({ queryKey: ["appointments"], queryFn: fetchMyAppointments });
  const list = q.data ?? [];
  const active = list.filter((a) => ACTIVE_STATUSES.includes(a.status));
  const stats = [
    { label: "Pending", n: list.filter((a) => a.status === "pending").length },
    { label: "Approved", n: list.filter((a) => a.status === "approved").length },
    { label: "Completed", n: list.filter((a) => a.status === "completed").length },
  ];
  return (
    <div>
      <PageHeader title={`Hello, ${me?.full_name ?? ""}`} subtitle={me?.role === "lecturer" ? "Your consultation overview" : "Your upcoming consultations"} />
      <div className="mb-6 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5 shadow-card">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold">{s.n}</p>
          </div>
        ))}
      </div>
      <h2 className="mb-3 text-lg font-semibold">Active appointments</h2>
      {q.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : active.length === 0 ? (
        <EmptyState title="No active appointments" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {active.map((a) => <AppointmentCard key={a.id} a={a} role={me!.role} />)}
        </div>
      )}
    </div>
  );
}
