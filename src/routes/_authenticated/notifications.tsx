import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, CalendarCheck, Check, Clock3, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/portal-ui";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — UMAppoint" }] }),
  component: function NotificationsPage() {
    const [notifications, setNotifications] = useState([
      {
        id: 1,
        title: "Booking request approved",
        text: "Dr. Nadia Rahman approved your consultation request.",
        time: "12 minutes ago",
        read: false,
        icon: CalendarCheck,
        tone: "success" as const,
        label: "Approved",
      },
      {
        id: 2,
        title: "New reschedule request",
        text: "A student has requested to change an upcoming appointment.",
        time: "1 hour ago",
        read: false,
        icon: Clock3,
        tone: "warning" as const,
        label: "Action needed",
      },
      {
        id: 3,
        title: "Consultation reminder",
        text: "Your consultation with Prof. Azlan Ibrahim is tomorrow at 2:00 PM.",
        time: "Yesterday",
        read: true,
        icon: Bell,
        tone: "info" as const,
        label: "Reminder",
      },
      {
        id: 4,
        title: "Profile updated",
        text: "Your profile details were saved successfully.",
        time: "2 days ago",
        read: true,
        icon: MessageSquare,
        tone: "neutral" as const,
        label: "Account",
      },
    ]);
    return (
      <div>
        <PageHeader
          title="Notifications"
          subtitle="Stay up to date with your appointments and account."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setNotifications(notifications.map((n) => ({ ...n, read: true })));
                toast.success("All notifications marked as read");
              }}
            >
              <Check />
              Mark all as read
            </Button>
          }
        />
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex gap-4 border-b p-5 last:border-0 ${!n.read ? "bg-primary-soft/30" : ""}`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${n.tone === "success" ? "bg-success-soft text-success" : n.tone === "warning" ? "bg-warning-soft text-warning" : "bg-info-soft text-info"}`}
              >
                <n.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{n.title}</p>
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
                onClick={() =>
                  setNotifications(
                    notifications.map((item) =>
                      item.id === n.id ? { ...item, read: true } : item,
                    ),
                  )
                }
              >
                {n.read ? "Read" : "Mark read"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  },
});
