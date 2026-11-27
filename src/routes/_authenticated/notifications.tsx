import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarCheck, Check, Clock3, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/portal-ui";
import { useAuth } from "@/lib/auth";
import {
  apiGetNotifications,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  getToken,
  type ApiNotification,
} from "@/lib/backend";

function formatTimeAgo(dateStr?: string) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
}

function getNotificationStyle(title: string) {
  const t = title.toLowerCase();
  if (t.includes("approved") || t.includes("completed")) {
    return {
      icon: CalendarCheck,
      tone: "success" as const,
      label: t.includes("approved") ? "Approved" : "Completed",
    };
  }
  if (t.includes("cancellation") || t.includes("reschedule") || t.includes("action") || t.includes("request")) {
    return {
      icon: Clock3,
      tone: "warning" as const,
      label: t.includes("cancellation") ? "Cancellation" : "Action needed",
    };
  }
  if (t.includes("rejected") || t.includes("cancelled")) {
    return {
      icon: Clock3,
      tone: "danger" as const,
      label: t.includes("rejected") ? "Rejected" : "Cancelled",
    };
  }
  return {
    icon: Bell,
    tone: "info" as const,
    label: "Notification",
  };
}

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — UMAppoint" }] }),
  component: function NotificationsPage() {
    const { isPreview } = useAuth();
    const hasToken = typeof window !== "undefined" && !!getToken();
    const qc = useQueryClient();

    // Fallback demo state
    const [demoNotifs, setDemoNotifs] = useState([
      {
        id: "demo-1",
        title: "Booking request approved",
        text: "Dr. Nadia Rahman approved your consultation request.",
        time: "12 minutes ago",
        read: false,
        icon: CalendarCheck,
        tone: "success" as const,
        label: "Approved",
      },
      {
        id: "demo-2",
        title: "New reschedule request",
        text: "A student has requested to change an upcoming appointment.",
        time: "1 hour ago",
        read: false,
        icon: Clock3,
        tone: "warning" as const,
        label: "Action needed",
      },
      {
        id: "demo-3",
        title: "Consultation reminder",
        text: "Your consultation with Prof. Azlan Ibrahim is tomorrow at 2:00 PM.",
        time: "Yesterday",
        read: true,
        icon: Bell,
        tone: "info" as const,
        label: "Reminder",
      },
      {
        id: "demo-4",
        title: "Profile updated",
        text: "Your profile details were saved successfully.",
        time: "2 days ago",
        read: true,
        icon: MessageSquare,
        tone: "neutral" as const,
        label: "Account",
      },
    ]);

    const { data: realNotifs, isLoading } = useQuery({
      queryKey: ["notifications"],
      queryFn: apiGetNotifications,
      enabled: hasToken && !isPreview,
      staleTime: 10_000,
      refetchInterval: 30_000,
      refetchOnWindowFocus: true,
    });

    const isLive = hasToken && !isPreview;

    const items = useMemo(() => {
      if (isLive) {
        return (realNotifs ?? []).map((n: ApiNotification) => {
          const style = getNotificationStyle(n.title);
          return {
            id: n.id,
            title: n.title,
            text: n.message,
            time: formatTimeAgo(n.created_at),
            read: n.is_read,
            icon: style.icon,
            tone: style.tone,
            label: style.label,
          };
        });
      }
      return demoNotifs;
    }, [isLive, realNotifs, demoNotifs]);

    async function handleMarkAllAsRead() {
      if (isLive) {
        try {
          await apiMarkAllNotificationsRead();
          await qc.invalidateQueries({ queryKey: ["notifications"] });
          toast.success("All notifications marked as read");
        } catch {
          toast.error("Failed to mark all as read");
        }
      } else {
        setDemoNotifs(demoNotifs.map((n) => ({ ...n, read: true })));
        toast.success("All notifications marked as read");
      }
    }

    async function handleMarkAsRead(id: string) {
      if (isLive) {
        try {
          await apiMarkNotificationRead(id);
          await qc.invalidateQueries({ queryKey: ["notifications"] });
          toast.success("Notification marked as read");
        } catch {
          toast.error("Failed to mark notification as read");
        }
      } else {
        setDemoNotifs(demoNotifs.map((n) => (n.id === id ? { ...n, read: true } : n)));
      }
    }

    return (
      <div>
        <PageHeader
          title="Notifications"
          subtitle="Stay up to date with your appointments and account."
          action={
            <Button
              variant="outline"
              onClick={handleMarkAllAsRead}
              disabled={items.length === 0 || items.every((n) => n.read)}
            >
              <Check className="h-4 w-4" />
              Mark all as read
            </Button>
          }
        />

        {isLoading ? (
          <div className="mt-8 flex justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-6 rounded-xl border bg-card p-8 text-center shadow-card">
            <EmptyState
              title="No notifications"
              text="You're all caught up! When appointments update, you'll see notifications here."
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            {items.map((n) => (
              <div
                key={n.id}
                className={`flex gap-4 border-b p-5 last:border-0 ${!n.read ? "bg-primary-soft/30" : ""}`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    n.tone === "success"
                      ? "bg-success-soft text-success"
                      : n.tone === "warning"
                        ? "bg-warning-soft text-warning"
                        : n.tone === "danger"
                          ? "bg-danger-soft text-danger"
                          : "bg-info-soft text-info"
                  }`}
                >
                  <n.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-foreground">{n.title}</p>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.text}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <StatusPill tone={n.tone}>{n.label}</StatusPill>
                    <span className="text-xs text-muted-foreground">{n.time}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={n.read}
                  onClick={() => handleMarkAsRead(n.id)}
                >
                  {n.read ? "Read" : "Mark read"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
});
