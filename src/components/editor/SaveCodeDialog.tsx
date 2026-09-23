import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLiquidGlass } from "@/hooks/use-liquid-glass";

interface SaveCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  initialName?: string;
  /** Return a string to show it as an inline validation error and keep the
   *  dialog open (section 6/7 — duplicate name); return/resolve nothing for
   *  success, which closes the dialog. */
  onSubmit: (name: string) => string | void | Promise<string | void>;
}

/**
 * Shared name-entry dialog for both "Save Code" and "Rename" (section 7
 * explicitly says reuse this style) — a frosted-glass override of the
 * shared shadcn Dialog (custom className on DialogContent only; the shared
 * ui/dialog.tsx primitive itself is untouched, same pattern the mobile
 * Sheet already uses for its own glass look). Radix's Dialog already
 * handles Escape-to-close; Enter submits via the form's own onSubmit.
 */
export function SaveCodeDialog({ open, onOpenChange, title, initialName = "", onSubmit }: SaveCodeDialogProps) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const liquid = useLiquidGlass<HTMLButtonElement>({ strength: 4 });

  // Reset to the current item's name each time the dialog opens (rename
  // reuses this same component across different items).
  useEffect(() => {
    if (open) {
      setName(initialName);
      setSaving(false);
      setError(null);
    }
  }, [open, initialName]);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !saving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    const result = await onSubmit(trimmed);
    setSaving(false);
    if (result) {
      // Validation failure (e.g. duplicate name) — stay open, show inline.
      setError(result);
    } else {
      setError(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="cp-glass-dialog sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">Enter a name for this saved code.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="saved-code-name" className="text-xs font-medium opacity-70">
              Name
            </label>
            <input
              id="saved-code-name"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="My Python Practice"
              className="cp-glass-dialog__input"
              maxLength={120}
              aria-invalid={!!error}
              aria-describedby={error ? "saved-code-name-error" : undefined}
            />
            {error && (
              <p id="saved-code-name-error" className="cp-glass-dialog__error">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="cp-liquid cp-glass-dialog__btn"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              ref={liquid.ref}
              onMouseMove={liquid.onMouseMove}
              onMouseLeave={liquid.onMouseLeave}
              type="submit"
              disabled={!canSubmit}
              className="cp-liquid cp-glass-dialog__btn cp-glass-dialog__btn--primary"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
