import { useId, useState, type FocusEvent, type InputHTMLAttributes, type MouseEvent } from "react";
import { AlertCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAutotype } from "@/hooks/use-autotype";
import { useMagnetic } from "@/hooks/use-magnetic";
import { PasswordRevealIcon } from "./PasswordRevealIcon";
import "./AuthField.css";

/**
 * Focus-origin tracker. Text inputs match `:focus-visible` on a mouse click
 * too (you have to see where you type), so CSS alone can't tell a mouse click
 * from a Tab. This can: a keyboard key just before focus means the accessible
 * ring shows; a pointer press means the physical lift alone carries it.
 */
let lastInputWasKeyboard = false;
if (typeof window !== "undefined") {
  const KEYS = new Set(["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);
  window.addEventListener(
    "keydown",
    (e) => {
      if (KEYS.has(e.key)) lastInputWasKeyboard = true;
    },
    true,
  );
  window.addEventListener("pointerdown", () => (lastInputWasKeyboard = false), true);
}

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  icon?: LucideIcon;
  error?: string;
  /**
   * Demo text typed into a ghost overlay while the pointer hovers this field
   * (and it's empty, untouched) — a visual affordance only. Stops the instant
   * the field is focused, a key is pressed, or the pointer leaves.
   */
  previewText?: string;
}

/**
 * Label + input, wired for a11y (id, aria-describedby, aria-invalid).
 * Hover: magnetic lean + per-field autotype preview, no lift. Focus/click:
 * physical lift + shadow, no lift on hover. Mouse focus gets a Compile
 * Palace accent treatment instead of a ring; keyboard focus (Tab/arrows)
 * gets an accessible ring on top, via the tracker above.
 */
export function AuthField({
  label,
  icon: Icon,
  error,
  previewText,
  id: idProp,
  type,
  className,
  onFocus,
  onBlur,
  ...rest
}: AuthFieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const errorId = error ? `${id}-error` : undefined;
  const [revealed, setRevealed] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [kbFocus, setKbFocus] = useState(false);
  const isPassword = type === "password";
  const magnetic = useMagnetic<HTMLDivElement>({ strength: 4 });

  const isEmpty = rest.value == null || rest.value === "";
  const previewActive = Boolean(previewText) && !interacted && isEmpty && hovered;
  const preview = useAutotype(isPassword ? "•".repeat(previewText?.length ?? 0) : previewText ?? "", previewActive);

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    setInteracted(true);
    setKbFocus(lastInputWasKeyboard);
    onFocus?.(e);
  };
  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setKbFocus(false);
    onBlur?.(e);
  };

  return (
    <div className={cn("auth-field", error && "auth-field--invalid", className)}>
      <label htmlFor={id} className="auth-field__label">
        {label}
      </label>
      <div
        ref={magnetic.ref}
        className="auth-field__lift"
        onMouseMove={magnetic.onMouseMove as (e: MouseEvent<HTMLDivElement>) => void}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          magnetic.onMouseLeave();
        }}
      >
        <div className="auth-field__wrap">
          {Icon && <Icon aria-hidden="true" size={18} className="auth-field__icon auth-field__icon--start" />}
          <input
            id={id}
            type={isPassword ? (revealed ? "text" : "password") : type}
            className={cn(
              "auth-field__control",
              Icon && "auth-field__control--icon-start",
              isPassword && "auth-field__control--has-reveal",
            )}
            aria-describedby={errorId}
            aria-invalid={error ? true : undefined}
            data-kbd-focus={kbFocus ? "true" : undefined}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={() => setInteracted(true)}
            {...rest}
          />
          {isPassword && (
            <button
              type="button"
              className="auth-field__reveal cp-pill"
              aria-label={revealed ? "Hide password" : "Show password"}
              aria-pressed={revealed}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setRevealed((v) => !v)}
            >
              <PasswordRevealIcon revealed={revealed} />
            </button>
          )}
          {preview && (
            <span className="auth-field__preview" aria-hidden="true">
              {preview}
              <span className="auth-field__preview-caret" />
            </span>
          )}
        </div>
      </div>
      {error && (
        <span id={errorId} className="auth-field__error" role="alert">
          <AlertCircle size={14} />
          {error}
        </span>
      )}
    </div>
  );
}
