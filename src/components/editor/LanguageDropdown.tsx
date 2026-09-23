import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { getCleanLanguageName } from "@/utils/languageUtils";
import { useLiquidGlass } from "@/hooks/use-liquid-glass";

interface LanguageOption {
  id: number;
  name: string;
}

interface LanguageDropdownProps {
  options: LanguageOption[];
  value: LanguageOption;
  onChange: (option: LanguageOption) => void;
}

/**
 * Frosted-glass language selector — same trigger material/interaction as
 * every other editor control (`.cp-liquid`) and the same unfold
 * choreography as the room panel (`.cp-unfold`: scale+translate+opacity
 * from the trigger, not a plain opacity fade), instead of shadcn's Radix
 * Select. Selection logic/data are unchanged — this only replaces the
 * trigger+panel markup around the same `options`/`value`/`onChange`.
 */
export function LanguageDropdown({ options, value, onChange }: LanguageDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const liquid = useLiquidGlass<HTMLButtonElement>({ strength: 4 });

  // Click-outside + Escape to close — the one bit of behavior a native
  // <select>/Radix would have given for free.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Same fix as the click handler below: blur whatever option/control
        // currently has focus before hiding its ancestor, or aria-hidden
        // lands on an element that still holds focus (ARIA violation).
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
    <div className="editor-lang" ref={rootRef}>
      <button
        ref={liquid.ref}
        type="button"
        onMouseMove={liquid.onMouseMove}
        onMouseLeave={liquid.onMouseLeave}
        className="cp-liquid editor-lang__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">{getCleanLanguageName(value.name)}</span>
        <ChevronDown size={14} className="editor-lang__chevron opacity-60" />
      </button>

      <div className="editor-lang__panel cp-unfold" data-open={open} role="listbox" aria-hidden={!open}>
        {options.map((opt) => {
          const selected = opt.id === value.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="option"
              aria-selected={selected}
              tabIndex={open ? 0 : -1}
              className="editor-lang__option"
              data-selected={selected}
              onClick={(e) => {
                // The clicked option retains focus for this instant — hiding
                // its ancestor (aria-hidden below, once `open` flips false)
                // while it's still focused is an ARIA violation, so blur
                // first, same fix as OutputDrawer's close button.
                e.currentTarget.blur();
                onChange(opt);
                setOpen(false);
              }}
            >
              <span className="truncate">{getCleanLanguageName(opt.name)}</span>
              {selected && <Check size={14} className="shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
