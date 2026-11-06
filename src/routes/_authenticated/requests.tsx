import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({ meta: [{ title: "Booking Requests — UMAppoint" }] }),
  component: () => (
    <div>
      <PageHeader title="Booking Requests" />
      <EmptyState title="Coming soon" text="This page is still being built." />
    </div>
  ),
});
