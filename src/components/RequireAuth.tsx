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
  const { user, loading } = useAuth();
  const location = useLocation();

  // Don't redirect before Supabase has restored (or ruled out) a session.
  if (loading) return null;

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
