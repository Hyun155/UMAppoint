import { STATUS_LABEL, type Status } from "@/lib/format";
import { cn } from "@/lib/utils";

const STYLES: Record<Status, string> = {
  pending: "bg-warning-soft text-warning",
  approved: "bg-success-soft text-success",
  rejected: "bg-danger-soft text-destructive",
  cancellation_requested: "bg-info-soft text-info",
  rescheduling_requested: "bg-info-soft text-info",
  cancelled: "bg-muted text-muted-foreground",
  completed: "bg-primary-soft text-primary",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", STYLES[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}
