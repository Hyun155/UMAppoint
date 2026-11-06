import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, CalendarCheck, GraduationCap, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "UMAppoint — Book Consultations with FCSIT Lecturers" },
      { name: "description", content: "Find FCSIT lecturers, view open consultation slots and book appointments online." },
      { property: "og:title", content: "UMAppoint — Book Consultations with FCSIT Lecturers" },
      { property: "og:description", content: "Find FCSIT lecturers, view open consultation slots and book appointments online." },
    ],
  }),
  component: Index,
});

const FEATURES = [
  { icon: Search, title: "Find the right lecturer", text: "Search by name, department or specialisation." },
  { icon: CalendarCheck, title: "Book open slots", text: "See real availability and request a time in seconds." },
  { icon: Bell, title: "Stay updated", text: "Get notified when requests are approved, rejected or changed." },
  { icon: ShieldCheck, title: "No double-booking", text: "Each slot holds one booking, so clashes can't happen." },
];

function Index() {
  const { session } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-semibold">UMAppoint</span>
        </div>
        {session ? (
          <Button asChild><Link to="/dashboard">Go to dashboard</Link></Button>
        ) : (
          <div className="flex gap-2">
            <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
            <Button asChild><Link to="/auth" search={{ mode: "register" }}>Register</Link></Button>
          </div>
        )}
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-10 md:grid-cols-2 md:pt-20">
        <div>
          <p className="inline-flex rounded-full bg-gold/20 px-3 py-1 text-xs font-medium text-gold-foreground">
            Faculty of Computer Science & IT · Universiti Malaya
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-foreground md:text-5xl">
            Lecturer consultations, booked without the email ping-pong.
          </h1>
          <p className="mt-5 text-lg text-muted-foreground">
            Students find a lecturer, pick an open slot and send a request. Lecturers approve, reject or reschedule from one place.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/auth">Sign in to book</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/auth" search={{ mode: "register" }}>Create an account</Link></Button>
          </div>
        </div>
        <div className="rounded-2xl bg-primary p-6 text-primary-foreground shadow-card">
          <p className="text-sm text-primary-foreground/70">Next consultation</p>
          <p className="mt-1 font-display text-2xl font-semibold">Dr. Nurul Hakim</p>
          <p className="text-sm text-primary-foreground/80">Department of Software Engineering</p>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {["Mon 10:00", "Tue 14:30", "Thu 09:00"].map((t, i) => (
              <div key={t} className={i === 1 ? "rounded-lg bg-gold p-3 text-gold-foreground" : "rounded-lg bg-primary-foreground/10 p-3"}>
                <p className="text-sm font-semibold">{t}</p>
                <p className="text-[11px] opacity-80">{i === 1 ? "Selected" : "Open"}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg bg-primary-foreground/10 p-4 text-sm">
            <p className="font-medium">Purpose</p>
            <p className="text-primary-foreground/80">Discuss final year project scope and timeline.</p>
          </div>
        </div>
      </section>

      <section className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-14 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <f.icon className="h-6 w-6 text-primary" />
              <p className="mt-3 font-semibold">{f.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="py-8 text-center text-xs text-muted-foreground">© 2026 UMAppoint · FCSIT, Universiti Malaya</footer>
    </div>
  );
}
