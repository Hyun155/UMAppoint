import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({ meta: [{ title: "My Schedule — UMAppoint" }] }),
  component: () => (
    <div>
      <PageHeader title="My Schedule" />
      <EmptyState title="Coming soon" text="This page is still being built." />
    </div>
  ),
});
