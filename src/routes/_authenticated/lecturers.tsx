import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Search,
  Users,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  formatDisplayDate,
  lecturers as demoLecturers,
  demoSlots,
  SearchFilterBar,
  StatusPill,
} from "@/components/portal-ui";
import { useAuth } from "@/lib/auth";
import {
  apiGetLecturers,
  apiBookAppointment,
  fmtTime,
  fmtDate,
  type LecturerOut,
  type SlotOut,
} from "@/lib/backend";

interface UnifiedLecturer {
  id: string;
  title: string;
  name: string;
  department: string;
  specialisation: string;
  office: string;
  slotsCount: number;
  initials: string;
  color: string;
  rules: string;
  rawSlots?: SlotOut[];
}

export const Route = createFileRoute("/_authenticated/lecturers")({
  head: () => ({ meta: [{ title: "Find Lecturers — UMAppoint" }] }),
  component: function LecturersPage() {
    const { me, isPreview } = useAuth();
    const qc = useQueryClient();

    const [search, setSearch] = useState("");
    const [department, setDepartment] = useState("all");
    const [specialisation, setSpecialisation] = useState("all");
    const [selected, setSelected] = useState<UnifiedLecturer | null>(null);
    const [slot, setSlot] = useState("");
    const [purpose, setPurpose] = useState("");
    const [notes, setNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // ── Fetch from FastAPI backend ──────────────────────────────────────────
    const {
      data: backendLecturers,
      isLoading,
      isError,
    } = useQuery({
      queryKey: ["lecturers", search, department],
      queryFn: () => apiGetLecturers(search, department === "all" ? undefined : department),
      staleTime: 10_000,
      retry: false,
    });

    // Real sessions must display only records returned by FastAPI.
    // Static lecturer data is available only in explicitly selected preview mode.
    const unifiedList: UnifiedLecturer[] = useMemo(() => {
      if (isPreview) {
        return demoLecturers.map((d) => ({
          id: d.id,
          title: d.title,
          name: d.name,
          department: d.department,
          specialisation: d.specialisation,
          office: d.office,
          slotsCount: d.slots,
          initials: d.initials,
          color: d.color,
          rules: d.rules,
        }));
      }

      return (backendLecturers ?? []).map((l: LecturerOut, idx: number) => {
        const colors = [
          "bg-primary-soft text-primary",
          "bg-info-soft text-info",
          "bg-success-soft text-success",
          "bg-warning-soft text-warning",
        ];
        const nameParts = l.full_name.trim().split(/\s+/);
        const firstChar = nameParts[0]?.charAt(0) ?? "D";
        const lastChar = nameParts[nameParts.length - 1]?.charAt(0) ?? "R";
        return {
          id: l.id,
          title: l.title || "Dr.",
          name: l.full_name,
          department: l.department,
          specialisation: l.specialization || "General Academic Advising",
          office: l.office_location || "FCSIT, Universiti Malaya",
          slotsCount: l.open_slots?.length || 0,
          initials: (firstChar + lastChar).toUpperCase(),
          color: colors[idx % colors.length] ?? "bg-primary-soft text-primary",
          rules: l.consultation_info || "Please arrive prepared with specific questions or materials to discuss.",
          rawSlots: l.open_slots,
        };
      });
    }, [backendLecturers, isPreview]);

    const filtered = useMemo(() => {
      return unifiedList.filter((l) => {
        const matchesSearch =
          !search || `${l.name} ${l.department}`.toLowerCase().includes(search.toLowerCase());
        const matchesDept =
          department === "all" || l.department.toLowerCase().includes(department.toLowerCase());
        const matchesSpec =
          specialisation === "all" ||
          l.specialisation.toLowerCase().includes(specialisation.toLowerCase());
        return matchesSearch && matchesDept && matchesSpec;
      });
    }, [unifiedList, search, department, specialisation]);

    const close = () => {
      setSelected(null);
      setSlot("");
      setPurpose("");
      setNotes("");
    };

    // ── Handle booking with pessimistic locking on backend ──────────────────
    async function handleBook() {
      if (!selected || !slot || !purpose.trim()) return;

      // In demo mode or if selected is a demo lecturer with non-uuid id:
      if (isPreview) {
        toast.success("Booking request submitted (Demo Mode)", {
          description: "Your lecturer will review the request shortly.",
        });
        close();
        return;
      }

      setSubmitting(true);
      try {
        const fullPurpose = notes.trim()
          ? `${purpose.trim()} (Notes: ${notes.trim()})`
          : purpose.trim();
        const appt = await apiBookAppointment(slot, fullPurpose);
        toast.success("Consultation booked successfully!", {
          description: `Reference: ${appt.ref_code || appt.id.slice(0, 8)} · Status: PENDING`,
        });
        qc.invalidateQueries({ queryKey: ["lecturers"] });
        qc.invalidateQueries({ queryKey: ["my-appointments"] });
        close();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to book slot";
        toast.error("Booking Error", { description: msg });
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <div>
        <PageHeader
          title="Find Lecturers"
          subtitle="Connect with your FCSIT lecturers and book a consultation."
        />

        <SearchFilterBar
          search={search}
          onSearch={setSearch}
          placeholder="Search by lecturer name or department..."
        >
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              <SelectItem value="Software Engineering">Software Engineering</SelectItem>
              <SelectItem value="Artificial Intelligence">Artificial Intelligence</SelectItem>
              <SelectItem value="Computer System & Technology">
                Computer System & Network
              </SelectItem>
              <SelectItem value="Information Systems">Information Systems</SelectItem>
              <SelectItem value="Multimedia Computing">Multimedia Computing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={specialisation} onValueChange={setSpecialisation}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Specialisation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All specialisations</SelectItem>
              <SelectItem value="Machine Learning">Artificial Intelligence</SelectItem>
              <SelectItem value="Software Architecture">Software Architecture</SelectItem>
              <SelectItem value="Computer Networks">Computer Networks</SelectItem>
              <SelectItem value="Data Analytics">Data Analytics</SelectItem>
              <SelectItem value="Human-Computer Interaction">Human-Computer Interaction</SelectItem>
            </SelectContent>
          </Select>
        </SearchFilterBar>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{filtered.length} lecturers available</p>
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {backendLecturers
              ? (isPreview ? "Preview data" : "Live data from UMAppoint backend")
              : "Demo data"}
          </p>
        </div>

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {filtered.map((l) => (
            <article
              key={l.id}
              className="rounded-xl border bg-card p-5 shadow-card transition-shadow hover:shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${l.color}`}
                  >
                    {l.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-foreground">
                          {l.name.toLowerCase().startsWith((l.title || "").toLowerCase().trim())
                            ? l.name
                            : `${l.title ? l.title + " " : ""}${l.name}`}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{l.department}</p>
                      </div>
                      <StatusPill tone={l.slotsCount > 0 ? "success" : "neutral"}>
                        {l.slotsCount} open slots
                      </StatusPill>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-2 border-t pt-3 text-sm text-muted-foreground">
                  <p className="flex gap-2">
                    <Users className="h-4 w-4 shrink-0 text-primary" />
                    <span>{l.specialisation}</span>
                  </p>
                  <p className="flex gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-primary" />
                    <span>{l.office}</span>
                  </p>
                </div>
              </div>

              <Button
                className="mt-5 w-full"
                onClick={() => setSelected(l)}
                disabled={l.slotsCount === 0}
              >
                {l.slotsCount > 0 ? "Book consultation" : "No open slots"}
              </Button>
            </article>
          ))}
        </div>

        {filtered.length === 0 && !isLoading && (
          <div className="mt-5 rounded-xl border border-dashed bg-card p-12 text-center">
            <Search className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 font-medium">No lecturers found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search query or department filter.
            </p>
          </div>
        )}

        {/* ── Booking Dialog ── */}
        <Dialog open={!!selected} onOpenChange={(open) => !open && close()}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Book a consultation</DialogTitle>
              <DialogDescription>
                {selected &&
                  `${selected.name.toLowerCase().startsWith((selected.title || "").toLowerCase().trim()) ? selected.name : `${selected.title ? selected.title + " " : ""}${selected.name}`} · ${selected.department}`}
              </DialogDescription>
            </DialogHeader>

            {selected && (
              <div className="space-y-4">
                <div className="rounded-lg bg-primary-soft p-3.5 text-sm">
                  <p className="font-medium text-primary">Consultation information</p>
                  <p className="mt-1 text-xs text-muted-foreground">{selected.rules}</p>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium">Choose an available time slot</p>
                  <div className="grid gap-2 max-h-56 overflow-y-auto pr-1 sm:grid-cols-2">
                    {selected.rawSlots && selected.rawSlots.length > 0
                      ? selected.rawSlots
                          .filter((s) => s.open)
                          .map((s) => (
                            <label
                              key={s.id}
                              className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 text-xs transition-colors ${
                                slot === s.id
                                  ? "border-primary bg-primary-soft ring-1 ring-primary"
                                  : "hover:bg-muted"
                              }`}
                            >
                              <input
                                type="radio"
                                name="slot"
                                checked={slot === s.id}
                                onChange={() => setSlot(s.id)}
                                className="mt-0.5"
                              />
                              <div>
                                <span className="block font-medium text-foreground">
                                  {fmtDate(s.slot_date)}
                                </span>
                                <span className="text-muted-foreground">
                                  {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                                </span>
                                <span className="block text-[11px] text-primary mt-0.5">
                                  {s.location_type === "online" ? "🌐 Online" : `📍 ${s.location}`}
                                </span>
                              </div>
                            </label>
                          ))
                      : demoSlots
                          .filter((s) => s.status === "Open")
                          .map((s) => (
                            <label
                              key={s.id}
                              className={`flex cursor-pointer gap-2.5 rounded-lg border p-3 text-xs transition-colors ${
                                slot === s.id
                                  ? "border-primary bg-primary-soft ring-1 ring-primary"
                                  : "hover:bg-muted"
                              }`}
                            >
                              <input
                                type="radio"
                                name="slot"
                                checked={slot === s.id}
                                onChange={() => setSlot(s.id)}
                                className="mt-0.5"
                              />
                              <div>
                                <span className="block font-medium">
                                  {formatDisplayDate(s.date)}
                                </span>
                                <span className="text-muted-foreground">
                                  {s.start} – {s.end} · {s.location}
                                </span>
                              </div>
                            </label>
                          ))}
                  </div>
                </div>

                <Field label="Consultation Purpose / Topics">
                  <Input
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. Discuss final year project scope and timeline"
                    required
                  />
                </Field>

                <Field label="Additional Notes (Optional)">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Provide background context or coursework questions..."
                    rows={2}
                  />
                </Field>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={close} disabled={submitting}>
                Cancel
              </Button>
              <Button disabled={!slot || !purpose.trim() || submitting} onClick={handleBook}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Locking slot...
                  </>
                ) : (
                  "Confirm & Book"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
});
