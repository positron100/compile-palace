import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "cp:lastActivity";
const LIMIT_MS = 24 * 60 * 60 * 1000;
const WRITE_THROTTLE_MS = 60_000;
const CHECK_INTERVAL_MS = 5 * 60_000;
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "click", "wheel"] as const;

/**
 * Signs the user out after 24h of real inactivity (not "24h since login").
 * Activity timestamp lives in localStorage so it survives refresh/backgrounding;
 * expiry is checked on mount, on an interval, and on focus/visibility resume
 * rather than trusted to a single setTimeout (background tabs throttle those).
 */
export function useInactivityLogout() {
  const navigate = useNavigate();

  useEffect(() => {
    let authed = false;
    let writeThrottled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      authed = !!session;
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      authed = !!session;
      if (authed) localStorage.setItem(STORAGE_KEY, String(Date.now()));
    });

    const recordActivity = () => {
      if (!authed || writeThrottled) return;
      writeThrottled = true;
      setTimeout(() => {
        writeThrottled = false;
      }, WRITE_THROTTLE_MS);
      localStorage.setItem(STORAGE_KEY, String(Date.now()));
    };

    const checkExpired = async () => {
      const last = Number(localStorage.getItem(STORAGE_KEY) || 0);
      if (!last || Date.now() - last <= LIMIT_MS) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      await supabase.auth.signOut();
      localStorage.removeItem(STORAGE_KEY);
      navigate("/", { replace: true });
    };

    ACTIVITY_EVENTS.forEach((ev) => window.addEventListener(ev, recordActivity, { passive: true }));
    document.addEventListener("visibilitychange", checkExpired);
    window.addEventListener("focus", checkExpired);
    const interval = setInterval(checkExpired, CHECK_INTERVAL_MS);
    checkExpired();

    return () => {
      ACTIVITY_EVENTS.forEach((ev) => window.removeEventListener(ev, recordActivity));
      document.removeEventListener("visibilitychange", checkExpired);
      window.removeEventListener("focus", checkExpired);
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [navigate]);
}
