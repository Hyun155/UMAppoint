import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/lecturers")({
  head: () => ({ meta: [{ title: "Find Lecturers — UMAppoint" }] }),
  component: () => (
    <div>
      <PageHeader title="Find Lecturers" />
      <EmptyState title="Coming soon" text="This page is still being built." />
    </div>
  ),
});
