import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, Clock3, MapPin, Search, Users } from "lucide-react";
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
  lecturers,
  demoSlots,
  SearchFilterBar,
  StatusPill,
} from "@/components/portal-ui";

export const Route = createFileRoute("/_authenticated/lecturers")({
  head: () => ({ meta: [{ title: "Find Lecturers — UMAppoint" }] }),
  component: function LecturersPage() {
    const [search, setSearch] = useState("");
    const [department, setDepartment] = useState("all");
    const [specialisation, setSpecialisation] = useState("all");
    const [selected, setSelected] = useState<(typeof lecturers)[number] | null>(null);
    const [slot, setSlot] = useState("");
    const [purpose, setPurpose] = useState("");
    const [notes, setNotes] = useState("");
    const filtered = useMemo(
      () =>
        lecturers.filter(
          (l) =>
            (!search || `${l.name} ${l.department}`.toLowerCase().includes(search.toLowerCase())) &&
            (department === "all" || l.department === department) &&
            (specialisation === "all" || l.specialisation === specialisation),
        ),
      [search, department, specialisation],
    );
    const close = () => {
      setSelected(null);
      setSlot("");
      setPurpose("");
      setNotes("");
    };
    return (
      <div>
        <PageHeader
          title="Find Lecturers"
          subtitle="Connect with your lecturers and book a consultation."
        />
        <SearchFilterBar
          search={search}
          onSearch={setSearch}
          placeholder="Search by lecturer name..."
        >
          <Select value={department} onValueChange={setDepartment}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              <SelectItem value="Computer Science">Computer Science</SelectItem>
              <SelectItem value="Software Engineering">Software Engineering</SelectItem>
              <SelectItem value="Information Systems">Information Systems</SelectItem>
              <SelectItem value="Data Science">Data Science</SelectItem>
            </SelectContent>
          </Select>
          <Select value={specialisation} onValueChange={setSpecialisation}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Specialisation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All specialisations</SelectItem>
              <SelectItem value="Artificial Intelligence">Artificial Intelligence</SelectItem>
              <SelectItem value="Software Architecture">Software Architecture</SelectItem>
              <SelectItem value="Human Computer Interaction">Human Computer Interaction</SelectItem>
              <SelectItem value="Data Analytics">Data Analytics</SelectItem>
            </SelectContent>
          </Select>
        </SearchFilterBar>
        <div className="mt-5 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{filtered.length} lecturers available</p>
          <p className="hidden text-xs text-muted-foreground sm:block">
            Showing current consultation availability
          </p>
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          {filtered.map((l) => (
            <article
              key={l.id}
              className="rounded-xl border bg-card p-5 shadow-card transition-shadow hover:shadow-lg"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${l.color}`}
                >
                  {l.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {l.title} {l.name}
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{l.department}</p>
                    </div>
                    <StatusPill tone="success">{l.slots} available slots</StatusPill>
                  </div>
                </div>
              </div>
              <div className="mt-5 space-y-2 border-t pt-4 text-sm text-muted-foreground">
                <p className="flex gap-2">
                  <Users className="h-4 w-4 shrink-0 text-primary" />
                  {l.specialisation}
                </p>
                <p className="flex gap-2">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  {l.office}
                </p>
              </div>
              <Button className="mt-5 w-full" onClick={() => setSelected(l)}>
                Book consultation
              </Button>
            </article>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="mt-5 rounded-xl border border-dashed bg-card p-12 text-center">
            <Search className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 font-medium">No lecturers found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search or filters.
            </p>
          </div>
        )}
        <Dialog open={!!selected} onOpenChange={(open) => !open && close()}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Book a consultation</DialogTitle>
              <DialogDescription>
                {selected && `${selected.title} ${selected.name} · ${selected.department}`}
              </DialogDescription>
            </DialogHeader>
            {selected && (
              <div className="space-y-5">
                <div className="rounded-lg bg-primary-soft p-4 text-sm">
                  <p className="font-medium">Consultation guidelines</p>
                  <p className="mt-1 text-muted-foreground">{selected.rules}</p>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Choose an open slot</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {demoSlots
                      .filter((s) => s.status === "Open")
                      .map((s) => (
                        <label
                          key={s.id}
                          className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors ${slot === s.id ? "border-primary bg-primary-soft" : "hover:bg-muted"}`}
                        >
                          <input
                            type="radio"
                            name="slot"
                            checked={slot === s.id}
                            onChange={() => setSlot(s.id)}
                            className="mt-1"
                          />
                          <span>
                            <span className="block font-medium">{formatDisplayDate(s.date)}</span>
                            <span className="text-muted-foreground">
                              {s.start} – {s.end} · {s.location}
                            </span>
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
                <Field label="Consultation purpose / topics">
                  <Input
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="e.g. Final year project review"
                  />
                </Field>
                <Field label="Notes (optional)">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Share any context that will help your lecturer prepare."
                  />
                </Field>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button
                disabled={!slot || !purpose.trim()}
                onClick={() => {
                  toast.success("Booking request submitted", {
                    description: "Your lecturer will review the request shortly.",
                  });
                  close();
                }}
              >
                Submit request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
});
