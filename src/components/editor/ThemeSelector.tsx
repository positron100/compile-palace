import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";
import { useLiquidGlass } from "@/hooks/use-liquid-glass";
import { ModernTooltip } from "@/components/ModernTooltip";
import { THEMES, useTheme, type ThemeName } from "@/context/ThemeContext";

const THEME_LABEL: Record<ThemeName, string> = {
  lavender: "Lavender",
  forest: "Forest",
  sunset: "Sunset",
  rainbow: "Rainbow",
};

/**
 * Theme selector — same trigger/panel choreography as LanguageDropdown
 * (`.cp-liquid` trigger, `.cp-unfold` panel unfold from the trigger), not a
 * second popover implementation. Click-outside/Escape copied from the same
 * source for the same reason: no Radix Popover involved anywhere else in
 * this top bar.
 */
export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const liquid = useLiquidGlass<HTMLButtonElement>({ strength: 4 });

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="theme-selector" ref={rootRef}>
      {/* Hidden defs only — provides the gradient the Rainbow-theme CSS rule
          points the trigger icon's `stroke` at (`url(#cp-theme-toggle-rainbow)`).
          SVG gradients can't be expressed as a CSS custom property, so the
          gradient itself has to live in real markup; this renders nothing. */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="cp-theme-toggle-rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(243 75% 59%)" />
            <stop offset="50%" stopColor="hsl(152 45% 32%)" />
            <stop offset="100%" stopColor="hsl(22 80% 55%)" />
          </linearGradient>
        </defs>
      </svg>
      <ModernTooltip content="Theme">
        <button
          ref={(node) => {
            liquid.ref.current = node;
          }}
          type="button"
          onMouseMove={liquid.onMouseMove}
          onMouseLeave={liquid.onMouseLeave}
          className="cp-liquid editor-rail__icon-btn theme-selector__trigger"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="Change theme"
          onClick={() => setOpen((v) => !v)}
        >
          <Palette size={15} />
        </button>
      </ModernTooltip>

      <div className="theme-selector__panel cp-unfold" data-open={open} role="listbox" aria-hidden={!open}>
        {THEMES.map((name) => {
          const selected = name === theme;
          return (
            <button
              key={name}
              type="button"
              role="option"
              aria-selected={selected}
              tabIndex={open ? 0 : -1}
              className="theme-selector__option"
              data-selected={selected}
              data-theme-swatch={name}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                e.currentTarget.blur();
                setTheme(name, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                setOpen(false);
              }}
            >
              <span className="theme-selector__swatch" data-theme-swatch={name} aria-hidden="true" />
              <span className="truncate">{THEME_LABEL[name]}</span>
              {selected && <Check size={14} className="shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
