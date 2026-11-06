import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — UMAppoint" }] }),
  component: () => (
    <div>
      <PageHeader title="Profile" />
      <EmptyState title="Coming soon" text="This page is still being built." />
    </div>
  ),
});
