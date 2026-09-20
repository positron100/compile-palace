import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({ user: null, session: null, loading: true });

/**
 * Single source of truth for auth state, subscribed once at the app root.
 *
 * The bug this fixes: every page used to run its own `getSession()` +
 * `onAuthStateChange` pair. `onAuthStateChange` already fires once
 * immediately with the current session on subscribe (an `INITIAL_SESSION`
 * event), so the extra `getSession()` call was redundant — and racy: its
 * promise could resolve *after* a later `SIGNED_OUT` event and clobber state
 * back to a stale authenticated session, which is exactly why a page kept
 * rendering as logged-in right after sign-out. One subscription, no race.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user: session?.user ?? null, session, loading }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
