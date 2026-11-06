import type { ReactNode } from "react";
import { CheckCircle2, Search, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const lecturers = [
  {
    id: "dr-nadia",
    title: "Dr.",
    name: "Nadia Rahman",
    department: "Computer Science",
    specialisation: "Artificial Intelligence",
    office: "FCSIT, Block C · C-312",
    slots: 6,
    initials: "NR",
    color: "bg-primary-soft text-primary",
    rules:
      "Consultations are 30 minutes. Please arrive prepared with specific questions or materials to discuss.",
  },
  {
    id: "prof-azlan",
    title: "Prof.",
    name: "Azlan Ibrahim",
    department: "Software Engineering",
    specialisation: "Software Architecture",
    office: "FCSIT, Block A · A-204",
    slots: 4,
    initials: "AI",
    color: "bg-info-soft text-info",
    rules:
      "Please include your project context in the booking request. Online consultations are available on request.",
  },
  {
    id: "dr-mei",
    title: "Dr.",
    name: "Mei Lin Tan",
    department: "Information Systems",
    specialisation: "Human Computer Interaction",
    office: "FCSIT, Block B · B-118",
    slots: 8,
    initials: "MT",
    color: "bg-success-soft text-success",
    rules:
      "Bring a prototype or wireframe for design reviews. One topic per consultation is recommended.",
  },
  {
    id: "mr-farid",
    title: "Mr.",
    name: "Farid Hakim",
    department: "Data Science",
    specialisation: "Data Analytics",
    office: "FCSIT, Block C · C-220",
    slots: 3,
    initials: "FH",
    color: "bg-warning-soft text-warning",
    rules:
      "For technical support, attach relevant error messages and a short description of what you have tried.",
  },
] as const;

export const demoSlots = [
  {
    id: "slot-1",
    date: "2026-11-10",
    start: "09:00",
    end: "09:30",
    location: "Office · C-312",
    status: "Open",
  },
  {
    id: "slot-2",
    date: "2026-11-10",
    start: "10:00",
    end: "10:30",
    location: "Online",
    status: "Open",
  },
  {
    id: "slot-3",
    date: "2026-11-12",
    start: "14:00",
    end: "14:30",
    location: "Office · C-312",
    status: "Booked",
  },
  {
    id: "slot-4",
    date: "2026-11-13",
    start: "11:00",
    end: "11:30",
    location: "Office · C-312",
    status: "Open",
  },
];

export const demoAppointments = [
  {
    id: "APT-1042",
    name: "Dr. Nadia Rahman",
    title: "Dr.",
    date: "2026-11-10",
    time: "09:00 – 09:30",
    location: "Office · C-312",
    purpose: "Discuss final year project architecture",
    status: "Approved" as const,
  },
  {
    id: "APT-1048",
    name: "Prof. Azlan Ibrahim",
    title: "Prof.",
    date: "2026-11-14",
    time: "14:00 – 14:30",
    location: "Online consultation",
    purpose: "Review software design proposal",
    status: "Pending" as const,
  },
  {
    id: "APT-1031",
    name: "Dr. Mei Lin Tan",
    title: "Dr.",
    date: "2026-11-18",
    time: "11:00 – 11:30",
    location: "Office · B-118",
    purpose: "Feedback on usability testing plan",
    status: "Change Requested" as const,
  },
];

export function formatDisplayDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-MY", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "info" | "danger";
}) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", {
        "bg-muted text-muted-foreground": tone === "neutral",
        "bg-success-soft text-success": tone === "success",
        "bg-warning-soft text-warning": tone === "warning",
        "bg-info-soft text-info": tone === "info",
        "bg-danger-soft text-destructive": tone === "danger",
      })}
    >
      {children}
    </span>
  );
}

export function SearchFilterBar({
  search,
  onSearch,
  children,
  placeholder = "Search...",
}: {
  search: string;
  onSearch: (value: string) => void;
  children?: ReactNode;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-card md:flex-row md:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={placeholder}
          className="pl-9"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="hidden h-4 w-4 text-muted-foreground sm:block" />
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function EmptyResult({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-10 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-success-soft text-success">
        <CheckCircle2 className="h-5 w-5" />
      </div>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
      <Button variant="ghost" className="mt-3">
        Clear filters
      </Button>
    </div>
  );
}
