import { Moon, Sun } from "lucide-react";
import { useLiquidGlass } from "@/hooks/use-liquid-glass";
import { ModernTooltip } from "@/components/ModernTooltip";
import { useTheme } from "@/context/ThemeContext";

/**
 * Light/Dark mode toggle — a separate control from ThemeSelector (theme =
 * color atmosphere, mode = light/dark material). Same `.cp-liquid` trigger
 * material, but a plain icon toggle rather than a popover: only 2 states,
 * so a picker list would be overkill.
 */
export function ModeSelector() {
  const { mode, setMode } = useTheme();
  const liquid = useLiquidGlass<HTMLButtonElement>({ strength: 4 });
  const next = mode === "light" ? "dark" : "light";

  return (
    <ModernTooltip content={mode === "light" ? "Switch to dark mode" : "Switch to light mode"}>
      <button
        ref={(node) => {
          liquid.ref.current = node;
        }}
        type="button"
        onMouseMove={liquid.onMouseMove}
        onMouseLeave={liquid.onMouseLeave}
        className="cp-liquid editor-rail__icon-btn mode-selector__trigger"
        aria-label={`Switch to ${next} mode`}
        aria-pressed={mode === "dark"}
        onClick={() => setMode(next)}
      >
        {mode === "light" ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </ModernTooltip>
  );
}
