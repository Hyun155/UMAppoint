import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({ meta: [{ title: "History — UMAppoint" }] }),
  component: () => (
    <div>
      <PageHeader title="History" />
      <EmptyState title="Coming soon" text="This page is still being built." />
    </div>
  ),
});
