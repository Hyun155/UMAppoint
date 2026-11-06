import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Bell,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  GraduationCap,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  User,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { fetchNotifications } from "@/lib/api";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof Bell; search?: Record<string, string> };

const STUDENT_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/lecturers", label: "Find Lecturers", icon: Users },
  { to: "/appointments", label: "My Appointments", icon: CalendarCheck },
  { to: "/history", label: "History", icon: History },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

const LECTURER_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/requests", label: "Booking Requests", icon: CalendarClock },
  { to: "/schedule", label: "My Schedule", icon: CalendarDays },
  { to: "/availability", label: "Availability", icon: CalendarCheck },
  { to: "/history", label: "History", icon: History },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
];

export function AppShell() {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const notifQ = useQuery({ queryKey: ["notifications"], queryFn: fetchNotifications, enabled: !!me });
  const unread = notifQ.data?.filter((n) => !n.is_read).length ?? 0;
  const nav = me?.role === "lecturer" ? LECTURER_NAV : STUDENT_NAV;

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-lg font-semibold leading-none text-sidebar-accent-foreground">UMAppoint</p>
          <p className="mt-1 text-[11px] uppercase tracking-wider text-sidebar-foreground/70">FCSIT · Universiti Malaya</p>
        </div>
      </div>
      <p className="px-5 pb-2 pt-3 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/60">
        {me?.role === "lecturer" ? "Lecturer portal" : "Student portal"}
      </p>
      <nav className="flex-1 space-y-0.5 px-3">
        {nav.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
          >
            <n.icon className="h-4 w-4" />
            <span className="flex-1">{n.label}</span>
            {n.to === "/notifications" && unread > 0 && (
              <span className="rounded-full bg-sidebar-primary px-1.5 text-[11px] font-semibold text-sidebar-primary-foreground">
                {unread}
              </span>
            )}
          </Link>
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
            {initials(me?.full_name ?? "")}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-sidebar-accent-foreground">{me?.full_name ?? "…"}</p>
            <p className="truncate text-xs text-sidebar-foreground/70">{me?.email}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-card/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="font-display font-semibold">UMAppoint</span>
          <Link to="/notifications" className="relative" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-gold" />}
          </Link>
        </header>
        <main className={cn("mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8")}>
          {me ? <Outlet /> : <p className="text-sm text-muted-foreground">Loading…</p>}
        </main>
      </div>
    </div>
  );
}
