import { useEffect, useRef, useState } from "react";
import { Save, Check } from "lucide-react";
import { ModernTooltip } from "@/components/ModernTooltip";
import { useLiquidGlass } from "@/hooks/use-liquid-glass";

interface InlineSaveFormProps {
  /** Return a string to show it as inline validation and keep the form
   *  open (duplicate name); return/resolve nothing for success. */
  onSubmit: (name: string) => string | void | Promise<string | void>;
}

/**
 * Save icon that expands into a small glass naming input, replacing the
 * Save-name modal (section 4/5) — same structural approach as
 * LanguageDropdown (trigger + `data-open` panel, click-outside/Escape to
 * close), but expands the trigger itself horizontally in place rather than
 * dropping a panel below it, since this needs to read as "the button
 * becoming a small form," not a menu.
 */
export function InlineSaveForm({ onSubmit }: InlineSaveFormProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerLiquid = useLiquidGlass<HTMLButtonElement>({ strength: 3 });
  const confirmLiquid = useLiquidGlass<HTMLButtonElement>({ strength: 3 });

  const close = () => {
    setOpen(false);
    setName("");
    setError(null);
  };

  useEffect(() => {
    if (!open) return;
    // Autofocus the instant the expand animation starts (matches
    // SaveCodeDialog's own autoFocus behavior for the modal it replaces).
    inputRef.current?.focus();
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        (document.activeElement as HTMLElement | null)?.blur();
        close();
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    const result = await onSubmit(trimmed);
    setSaving(false);
    if (result) {
      setError(result);
    } else {
      close();
    }
  };

  return (
    <div className="editor-inline-save" ref={rootRef} data-open={open}>
      {!open ? (
        <ModernTooltip content="Save Code">
          <button
            ref={triggerLiquid.ref}
            onMouseMove={triggerLiquid.onMouseMove}
            onMouseLeave={triggerLiquid.onMouseLeave}
            type="button"
            className="cp-liquid editor-rail__icon-btn"
            onClick={() => setOpen(true)}
            aria-label="Save code"
            aria-expanded={false}
          >
            <Save size={15} />
          </button>
        </ModernTooltip>
      ) : (
        <form onSubmit={handleSubmit} className="editor-inline-save__form">
          <Save size={14} className="editor-inline-save__icon" aria-hidden="true" />
          <label htmlFor="inline-save-name" className="sr-only">
            Saved code name
          </label>
          <input
            id="inline-save-name"
            ref={inputRef}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Name this code…"
            className="editor-inline-save__input"
            maxLength={120}
            aria-invalid={!!error}
            aria-describedby={error ? "inline-save-error" : undefined}
          />
          <ModernTooltip content="Confirm">
            <button
              ref={confirmLiquid.ref}
              onMouseMove={confirmLiquid.onMouseMove}
              onMouseLeave={confirmLiquid.onMouseLeave}
              type="submit"
              disabled={!name.trim() || saving}
              className="cp-liquid editor-inline-save__confirm"
              aria-label="Confirm save"
            >
              <Check size={14} />
            </button>
          </ModernTooltip>
        </form>
      )}
      {open && error && (
        <p id="inline-save-error" className="editor-inline-save__error">
          {error}
        </p>
      )}
    </div>
  );
}
