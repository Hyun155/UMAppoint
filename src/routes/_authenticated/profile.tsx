import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Mail, Phone, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, StatusPill } from "@/components/portal-ui";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Profile — UMAppoint" }] }),
  component: function ProfilePage() {
    const { me } = useAuth();
    const [saved, setSaved] = useState(false);
    return (
      <div>
        <PageHeader
          title="Profile"
          subtitle="Manage your personal information and consultation details."
        />
        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-xl border bg-card p-6 text-center shadow-card">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-soft text-2xl font-semibold text-primary">
              {(me?.full_name ?? "A")
                .split(" ")
                .map((p) => p[0])
                .join("")
                .slice(0, 2)}
            </div>
            <p className="mt-4 font-semibold">{me?.full_name ?? "Aisyah Zulkifli"}</p>
            <p className="mt-1 text-sm text-muted-foreground">{me?.email ?? "aisyah@um.edu.my"}</p>
            <StatusPill tone="info">{me?.role === "lecturer" ? "Lecturer" : "Student"}</StatusPill>
            <div className="mt-5 space-y-2 border-t pt-4 text-left text-sm text-muted-foreground">
              <p className="flex gap-2">
                <Mail className="h-4 w-4" />
                {me?.email ?? "aisyah@um.edu.my"}
              </p>
              <p className="flex gap-2">
                <Phone className="h-4 w-4" />
                +60 12 345 6789
              </p>
            </div>
          </aside>
          <section className="rounded-xl border bg-card p-6 shadow-card">
            <div className="mb-5 flex items-center gap-3 border-b pb-4">
              <UserRound className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-semibold">Personal information</h2>
                <p className="text-sm text-muted-foreground">Keep your details up to date.</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Full name">
                <Input defaultValue={me?.full_name ?? "Aisyah Zulkifli"} />
              </Field>
              <Field label="Email address">
                <Input defaultValue={me?.email ?? "aisyah@um.edu.my"} type="email" />
              </Field>
              <Field label="Phone number">
                <Input defaultValue="+60 12 345 6789" />
              </Field>
              <Field label="Matric number">
                <Input defaultValue="S2234567" />
              </Field>
              <Field label="Programme">
                <Input defaultValue="Bachelor of Computer Science" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="About you">
                <Textarea defaultValue="Final year student interested in building reliable and accessible software." />
              </Field>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              {saved && (
                <span className="flex items-center gap-1 text-sm text-success">
                  <Check className="h-4 w-4" />
                  Changes saved
                </span>
              )}
              <Button
                onClick={() => {
                  setSaved(true);
                  toast.success("Profile updated successfully");
                }}
              >
                <Save />
                Save changes
              </Button>
            </div>
          </section>
        </div>
      </div>
    );
  },
});
