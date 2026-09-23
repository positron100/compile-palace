import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { startStageTransition, type RevealOrigin } from "@/lib/stageTransition";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export const THEMES = ["lavender", "forest", "sunset", "rainbow"] as const;
export type ThemeName = (typeof THEMES)[number];

export const MODES = ["light", "dark"] as const;
export type ModeName = (typeof MODES)[number];

const THEME_STORAGE_KEY = "cp-theme";
const MODE_STORAGE_KEY = "cp-mode";
const DEFAULT_THEME: ThemeName = "lavender";
const DEFAULT_MODE: ModeName = "light";

function isThemeName(v: unknown): v is ThemeName {
  return typeof v === "string" && (THEMES as readonly string[]).includes(v);
}
function isModeName(v: unknown): v is ModeName {
  return typeof v === "string" && (MODES as readonly string[]).includes(v);
}

/** Read synchronously — also called from main.tsx before React mounts, so
 *  `data-theme`/`.dark` are already correct on first paint (no flash). */
export function readStoredTheme(): ThemeName {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeName(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}
export function readStoredMode(): ModeName {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
    return isModeName(stored) ? stored : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

interface ThemeContextValue {
  theme: ThemeName;
  mode: ModeName;
  /** origin: viewport point the circular reveal grows from (e.g. the click
   *  on the theme-selector trigger). Omit for viewport centre. */
  setTheme: (theme: ThemeName, origin?: RevealOrigin) => void;
  setMode: (mode: ModeName) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(() => readStoredTheme());
  const [mode, setModeState] = useState<ModeName>(() => readStoredMode());
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    // `.dark` also drives the pre-existing shadcn base tokens + translucent
    // glass-depth tokens in index.css — mode owns the material layer, theme
    // (above) owns color, and compound `.dark[data-theme="x"]` blocks in
    // index.css deepen that theme's own accent for dark mode.
    document.documentElement.classList.toggle("dark", mode === "dark");
  }, [mode]);

  const setTheme = useCallback(
    (next: ThemeName, origin?: RevealOrigin) => {
      if (next === theme) return;
      const applyChange = () => {
        setThemeState(next);
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          /* storage unavailable — theme still applies for this session */
        }
      };
      // Reuses the SAME circular expanding transition every route change
      // already uses (lib/stageTransition.ts); the circle reveals the
      // destination theme's real accent/glass tint since the DOM is
      // re-themed inside the transition, regardless of current mode.
      if (reduceMotion) {
        applyChange();
        return;
      }
      void startStageTransition("circle", "forward", origin ?? null, applyChange);
    },
    [theme, reduceMotion],
  );

  const setMode = useCallback((next: ModeName) => {
    setModeState(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      /* storage unavailable — mode still applies for this session */
    }
  }, []);

  const value = useMemo(() => ({ theme, mode, setTheme, setMode }), [theme, mode, setTheme, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
