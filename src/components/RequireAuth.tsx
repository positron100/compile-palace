import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Gates a route on the shared auth context — not a local mount-time check —
 * so it re-evaluates on every render: sign-out, a stale tab regaining focus,
 * or the browser Back button after logout all land here with a fresh
 * `user` read instead of a snapshot taken when the route first mounted.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, signingOut } = useAuth();
  const location = useLocation();

  // Don't redirect before Supabase has restored (or ruled out) a session.
  // Same for an intentional sign-out in progress: `user` flips to null on
  // Supabase's own async schedule, and this guard can't tell that apart
  // from "never was logged in" — without this check it redirects to /auth
  // for a frame before the sign-out handler's own navigate (to Start) wins
  // the race, flashing the login screen. Deferring here lets the sign-out
  // handler's intended destination land first.
  if (loading || signingOut) return null;

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
