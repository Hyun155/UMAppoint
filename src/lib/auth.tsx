import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Role = "student" | "lecturer";

export interface Me {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  role: Role;
}

interface AuthCtx {
  session: Session | null;
  ready: boolean;
  me: Me | null;
  meLoading: boolean;
}

const Ctx = createContext<AuthCtx>({ session: null, ready: false, me: null, meLoading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  const meQ = useQuery({
    queryKey: ["me", uid],
    enabled: !!uid,
    queryFn: async (): Promise<Me> => {
      const [{ data: p, error }, { data: r }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid!).single(),
        supabase.from("user_roles").select("role").eq("user_id", uid!),
      ]);
      if (error) throw error;
      const role: Role = r?.some((x) => x.role === "lecturer") ? "lecturer" : "student";
      return { id: p.id, email: p.email, full_name: p.full_name, phone: p.phone, role };
    },
  });

  return (
    <Ctx.Provider value={{ session, ready, me: meQ.data ?? null, meLoading: !!uid && meQ.isLoading }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
