import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/appointments")({
  head: () => ({ meta: [{ title: "My Appointments — UMAppoint" }] }),
  component: () => (
    <div>
      <PageHeader title="My Appointments" />
      <EmptyState title="Coming soon" text="This page is still being built." />
    </div>
  ),
});
