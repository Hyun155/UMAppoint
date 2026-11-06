import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Video,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { Slot } from "@/lib/format";
import { errMsg, fmtDate, fmtRange } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Field, StatusPill } from "@/components/portal-ui";

type ViewMode = "weekly" | "monthly";
type LocationType = "in_person" | "online";
type SlotWithStatus = Slot & { booked: boolean };

function localDate(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function dateKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function startOfWeek(value: Date) {
  const date = localDate(value);
  const day = date.getDay();
  date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
  return date;
}

function endOfWeek(value: Date) {
  const date = startOfWeek(value);
  date.setDate(date.getDate() + 4);
  return date;
}

function displayRange(start: Date, end: Date) {
  const month = (value: Date) => value.toLocaleDateString("en-MY", { month: "short" });
  return `${start.toLocaleDateString("en-MY", { weekday: "short", day: "numeric" })} ${month(start)} – ${end.toLocaleDateString("en-MY", { weekday: "short", day: "numeric" })} ${month(end)} ${end.getFullYear()}`;
}

function timeValue(value: string) {
  return value.slice(0, 5);
}

function emptyForm(date = dateKey(new Date())) {
  return {
    date,
    start: "09:00",
    end: "10:00",
    locationType: "in_person" as LocationType,
    location: "",
    notes: "",
  };
}

export const Route = createFileRoute("/_authenticated/availability")({
  head: () => ({ meta: [{ title: "Availability — UMAppoint" }] }),
  component: function AvailabilityPage() {
    const { me } = useAuth();
    const queryClient = useQueryClient();
    const [week, setWeek] = useState(() => startOfWeek(new Date()));
    const [view, setView] = useState<ViewMode>("weekly");
    const [showWeekend, setShowWeekend] = useState(false);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<SlotWithStatus | null>(null);
    const [form, setForm] = useState(emptyForm());

    const range = useMemo(() => {
      if (view === "weekly") return { start: startOfWeek(week), end: endOfWeek(week) };
      const start = new Date(week.getFullYear(), week.getMonth(), 1);
      const end = new Date(week.getFullYear(), week.getMonth() + 1, 0);
      return { start, end };
    }, [view, week]);

    const slotsQuery = useQuery({
      queryKey: ["availability", me?.id, dateKey(range.start), dateKey(range.end)],
      enabled: !!me?.id,
      queryFn: async (): Promise<SlotWithStatus[]> => {
        const { data: slots, error } = await supabase
          .from("availability_slots")
          .select("*")
          .eq("lecturer_id", me!.id)
          .gte("slot_date", dateKey(range.start))
          .lte("slot_date", dateKey(range.end))
          .order("slot_date")
          .order("start_time");
        if (error) throw error;
        const ids = slots.map((slot) => slot.id);
        if (!ids.length) return [];
        const { data: appointments, error: appointmentsError } = await supabase
          .from("appointments")
          .select("slot_id, status")
          .in("slot_id", ids);
        if (appointmentsError) throw appointmentsError;
        const bookedIds = new Set(
          appointments
            .filter((appointment) => !["cancelled", "rejected"].includes(appointment.status))
            .map((appointment) => appointment.slot_id),
        );
        return slots.map((slot) => ({ ...slot, booked: bookedIds.has(slot.id) }));
      },
    });

    const refresh = () => queryClient.invalidateQueries({ queryKey: ["availability", me?.id] });
    const saveMutation = useMutation({
      mutationFn: async () => {
        if (!me?.id) throw new Error("You must be signed in as a lecturer.");
        if (!form.date || !form.start || !form.end || form.end <= form.start) {
          throw new Error("End time must be after the start time.");
        }
        const values = {
          lecturer_id: me.id,
          slot_date: form.date,
          start_time: form.start,
          end_time: form.end,
          location_type: form.locationType,
          location: form.location.trim(),
          notes: form.notes.trim() || null,
        };
        if (editing) {
          const { error } = await supabase
            .from("availability_slots")
            .update(values)
            .eq("id", editing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("availability_slots").insert(values);
          if (error) throw error;
        }
      },
      onSuccess: () => {
        toast.success(editing ? "Availability slot updated" : "Availability slot added");
        setDialogOpen(false);
        setEditing(null);
        refresh();
      },
      onError: (error) => toast.error(errMsg(error)),
    });
    const deleteMutation = useMutation({
      mutationFn: async (slot: SlotWithStatus) => {
        if (slot.booked) throw new Error("Booked slots cannot be deleted.");
        const { error } = await supabase.from("availability_slots").delete().eq("id", slot.id);
        if (error) throw error;
      },
      onSuccess: () => {
        toast.success("Availability slot deleted");
        refresh();
      },
      onError: (error) => toast.error(errMsg(error)),
    });

    const openAdd = (date = dateKey(new Date())) => {
      setEditing(null);
      setForm(emptyForm(date));
      setDialogOpen(true);
    };
    const openEdit = (slot: SlotWithStatus) => {
      setEditing(slot);
      setForm({
        date: slot.slot_date,
        start: timeValue(slot.start_time),
        end: timeValue(slot.end_time),
        locationType: slot.location_type === "online" ? "online" : "in_person",
        location: slot.location,
        notes: slot.notes ?? "",
      });
      setDialogOpen(true);
    };
    const days = useMemo(() => {
      const count =
        view === "weekly"
          ? showWeekend
            ? 7
            : 5
          : new Date(week.getFullYear(), week.getMonth() + 1, 0).getDate();
      return Array.from({ length: count }, (_, index) => {
        const date =
          view === "weekly"
            ? new Date(startOfWeek(week))
            : new Date(week.getFullYear(), week.getMonth(), 1);
        date.setDate(date.getDate() + index);
        return date;
      });
    }, [showWeekend, view, week]);
    const slots = slotsQuery.data ?? [];
    const slotsFor = (date: Date) => slots.filter((slot) => slot.slot_date === dateKey(date));

    return (
      <div>
        <PageHeader
          title="Availability"
          subtitle="Set the consultation times students can book with you."
          action={
            <Button onClick={() => openAdd(dateKey(week))}>
              <Plus /> Add availability slot
            </Button>
          }
        />
        <section className="rounded-xl border bg-card p-4 shadow-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setWeek(new Date(week.getFullYear(), week.getMonth(), week.getDate() - 7))
                }
              >
                <ChevronLeft /> Previous week
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setWeek(startOfWeek(new Date()))}>
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setWeek(new Date(week.getFullYear(), week.getMonth(), week.getDate() + 7))
                }
              >
                Next week <ChevronRight />
              </Button>
            </div>
            <div className="text-center">
              <p className="font-semibold">
                {view === "weekly"
                  ? displayRange(range.start, range.end)
                  : week.toLocaleDateString("en-MY", { month: "long", year: "numeric" })}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {slots.length} slot{slots.length === 1 ? "" : "s"} in this view
              </p>
            </div>
            <div className="flex items-center justify-center gap-1 rounded-lg bg-muted p-1">
              <Button
                size="sm"
                variant={view === "weekly" ? "default" : "ghost"}
                onClick={() => setView("weekly")}
              >
                Weekly grid
              </Button>
              <Button
                size="sm"
                variant={view === "monthly" ? "default" : "ghost"}
                onClick={() => setView("monthly")}
              >
                Monthly calendar
              </Button>
            </div>
          </div>
          {view === "weekly" && (
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowWeekend(!showWeekend)}>
                {showWeekend ? "Hide weekend" : "Show weekend"}
              </Button>
            </div>
          )}
        </section>

        {slotsQuery.isLoading ? (
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-xl border bg-muted/50" />
            ))}
          </div>
        ) : view === "weekly" ? (
          <div className="mt-5 grid gap-3 md:grid-cols-5">
            {days.map((day) => (
              <DayColumn
                key={dateKey(day)}
                date={day}
                slots={slotsFor(day)}
                onAdd={() => openAdd(dateKey(day))}
                onEdit={openEdit}
                onDelete={(slot) => deleteMutation.mutate(slot)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border shadow-card sm:grid-cols-4 md:grid-cols-7">
            {days.map((day) => (
              <div key={dateKey(day)} className="min-h-28 bg-card p-2">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={cn(
                      "font-medium",
                      day.getDay() === 0 || day.getDay() === 6 ? "text-muted-foreground" : "",
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {slotsFor(day).length > 0 && (
                    <span className="rounded-full bg-primary-soft px-1.5 text-primary">
                      {slotsFor(day).length}
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  {slotsFor(day)
                    .slice(0, 3)
                    .map((slot) => (
                      <button
                        key={slot.id}
                        onClick={() => openEdit(slot)}
                        className="w-full truncate rounded bg-primary-soft px-1.5 py-1 text-left text-[11px] text-primary"
                      >
                        {timeValue(slot.start_time)}{" "}
                        {slot.location_type === "online" ? "· Online" : ""}
                      </button>
                    ))}
                  <button
                    className="mt-1 text-xs text-muted-foreground hover:text-primary"
                    onClick={() => openAdd(dateKey(day))}
                  >
                    + Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editing ? "Edit availability slot" : "Add availability slot"}
              </DialogTitle>
              <DialogDescription>
                Students will see this slot as available unless it already has a booking.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Field label="Date">
                <Input
                  type="date"
                  value={form.date}
                  onChange={(event) => setForm({ ...form, date: event.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Start time">
                  <Input
                    type="time"
                    value={form.start}
                    onChange={(event) => setForm({ ...form, start: event.target.value })}
                  />
                </Field>
                <Field label="End time">
                  <Input
                    type="time"
                    value={form.end}
                    onChange={(event) => setForm({ ...form, end: event.target.value })}
                    aria-invalid={!!form.end && form.end <= form.start}
                  />
                  {form.end && form.end <= form.start && (
                    <span className="text-xs text-destructive">
                      End time must be after start time.
                    </span>
                  )}
                </Field>
              </div>
              <Field label="Location type">
                <Select
                  value={form.locationType}
                  onValueChange={(value: LocationType) => setForm({ ...form, locationType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_person">In-person</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={form.locationType === "online" ? "Meeting link" : "Location detail"}>
                <Input
                  value={form.location}
                  onChange={(event) => setForm({ ...form, location: event.target.value })}
                  placeholder={
                    form.locationType === "online"
                      ? "https://meet.google.com/..."
                      : "e.g. FCSIT, Block C · C-312"
                  }
                />
              </Field>
              <Field label="Notes (optional)">
                <Textarea
                  value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="Add any instructions for students."
                />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={
                  saveMutation.isPending ||
                  !form.date ||
                  !form.location.trim() ||
                  form.end <= form.start
                }
                onClick={() => saveMutation.mutate()}
              >
                {editing ? "Save changes" : "Add slot"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  },
});

function DayColumn({
  date,
  slots,
  onAdd,
  onEdit,
  onDelete,
}: {
  date: Date;
  slots: SlotWithStatus[];
  onAdd: () => void;
  onEdit: (slot: SlotWithStatus) => void;
  onDelete: (slot: SlotWithStatus) => void;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-card shadow-card">
      <div className="border-b bg-muted/30 p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {date.toLocaleDateString("en-MY", { weekday: "short" })}
            </p>
            <p className="mt-0.5 text-lg font-semibold">
              {date.getDate()}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                {date.toLocaleDateString("en-MY", { month: "short" })}
              </span>
            </p>
          </div>
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
            {slots.length}
          </span>
        </div>
      </div>
      <div className="min-h-48 space-y-2 p-2">
        {slots.length ? (
          slots.map((slot) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              onEdit={() => onEdit(slot)}
              onDelete={() => onDelete(slot)}
            />
          ))
        ) : (
          <button
            onClick={onAdd}
            className="flex min-h-40 w-full flex-col items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-primary-soft/40 hover:text-primary"
          >
            <Plus className="mb-2 h-4 w-4" />
            Add slot
          </button>
        )}
      </div>
    </div>
  );
}

function SlotCard({
  slot,
  onEdit,
  onDelete,
}: {
  slot: SlotWithStatus;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const online = slot.location_type === "online";
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Clock3 className="h-3.5 w-3.5 text-primary" />
          {fmtRange(slot)}
        </p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-2 h-7 w-7"
              aria-label="Slot actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={slot.booked}
              className="text-destructive focus:text-destructive"
              onClick={onDelete}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <StatusPill tone={slot.booked ? "warning" : "success"}>
          {slot.booked ? "Booked" : "Available"}
        </StatusPill>
        {online ? (
          <Video className="h-4 w-4 text-info" />
        ) : (
          <MapPin className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <p className="mt-2 truncate text-xs text-muted-foreground" title={slot.location}>
        {slot.location || (online ? "Online consultation" : "Location to be confirmed")}
      </p>
    </div>
  );
}
