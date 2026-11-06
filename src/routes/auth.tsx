import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { errMsg } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({ mode: s.mode === "register" ? ("register" as const) : undefined }),
  head: () => ({
    meta: [
      { title: "Sign in — UMAppoint" },
      { name: "description", content: "Sign in or register for UMAppoint consultation booking." },
      { property: "og:title", content: "Sign in — UMAppoint" },
      { property: "og:description", content: "Sign in or register for UMAppoint consultation booking." },
    ],
  }),
  component: AuthPage,
});

const DEMO = [
  { label: "Demo student", email: "aiman.student@demo.umappoint.edu" },
  { label: "Demo lecturer", email: "nurul.hakim@demo.umappoint.edu" },
];

function AuthPage() {
  const { mode } = Route.useSearch();
  const register = mode === "register";
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<"student" | "lecturer">("student");
  const [f, setF] = useState({ email: "", password: "", full_name: "", matric_no: "", programme: "", department: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function signIn(email: string, password: string) {
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    navigate({ to: "/dashboard" });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!register) return signIn(f.email, f.password);
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: f.email,
      password: f.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { role, full_name: f.full_name, matric_no: f.matric_no, programme: f.programme, department: f.department },
      },
    });
    setBusy(false);
    if (error) return toast.error(errMsg(error));
    if (data.session) navigate({ to: "/dashboard" });
    else toast.success("Account created. Check your email to confirm, then sign in.");
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground md:flex">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold text-gold-foreground"><GraduationCap className="h-5 w-5" /></div>
          <span className="font-display text-xl font-semibold">UMAppoint</span>
        </Link>
        <div>
          <h2 className="text-3xl font-semibold">Consultations made simple.</h2>
          <p className="mt-3 text-primary-foreground/75">For FCSIT students and lecturers at Universiti Malaya.</p>
        </div>
        <p className="text-xs text-primary-foreground/60">© 2026 UMAppoint</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold">{register ? "Create your account" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {register ? "Already registered? " : "New here? "}
            <Link to="/auth" search={{ mode: register ? undefined : "register" }} className="font-medium text-primary underline-offset-4 hover:underline">
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            {register && (
              <>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
                  {(["student", "lecturer"] as const).map((r) => (
                    <button type="button" key={r} onClick={() => setRole(r)}
                      className={role === r ? "rounded-md bg-card py-1.5 text-sm font-medium shadow-card" : "py-1.5 text-sm text-muted-foreground"}>
                      {r === "student" ? "Student" : "Lecturer"}
                    </button>
                  ))}
                </div>
                <div><Label>Full name</Label><Input required value={f.full_name} onChange={set("full_name")} /></div>
                {role === "student" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Matric no.</Label><Input value={f.matric_no} onChange={set("matric_no")} /></div>
                    <div><Label>Programme</Label><Input value={f.programme} onChange={set("programme")} /></div>
                  </div>
                ) : (
                  <div><Label>Department</Label><Input value={f.department} onChange={set("department")} placeholder="Department of Software Engineering" /></div>
                )}
              </>
            )}
            <div><Label>Email</Label><Input type="email" required value={f.email} onChange={set("email")} /></div>
            <div><Label>Password</Label><Input type="password" required minLength={6} value={f.password} onChange={set("password")} /></div>
            <Button type="submit" className="w-full" disabled={busy}>{register ? "Create account" : "Sign in"}</Button>
          </form>
          {!register && (
            <div className="mt-8 rounded-xl border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Try a demo account</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {DEMO.map((d) => (
                  <Button key={d.email} variant="outline" size="sm" disabled={busy} onClick={() => signIn(d.email, "Demo@1234")}>{d.label}</Button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
