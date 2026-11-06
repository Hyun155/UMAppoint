import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — UMAppoint" }] }),
  component: () => (
    <div>
      <PageHeader title="Notifications" />
      <EmptyState title="Coming soon" text="This page is still being built." />
    </div>
  ),
});
