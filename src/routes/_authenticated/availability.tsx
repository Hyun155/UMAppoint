import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/availability")({
  head: () => ({ meta: [{ title: "Availability — UMAppoint" }] }),
  component: () => (
    <div>
      <PageHeader title="Availability" />
      <EmptyState title="Coming soon" text="This page is still being built." />
    </div>
  ),
});
