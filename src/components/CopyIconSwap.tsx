import { Check, type LucideIcon } from "lucide-react";

/**
 * Idle icon → check crossfade for icon-only copy buttons. Both icons stay
 * mounted in one fixed-size grid cell (so the button never changes size) and
 * CSS (`.cp-copy-icon` in EditorPage.css) fades/scales them and draws the
 * check's stroke. The visually-hidden status text announces the success
 * state to screen readers, since the animation alone doesn't.
 */
export function CopyIconSwap({
  copied,
  icon: Icon,
  size = 15,
}: {
  copied: boolean;
  icon: LucideIcon;
  size?: number;
}) {
  return (
    <span className="cp-copy-icon" data-copied={copied || undefined} style={{ width: size, height: size }}>
      <Icon size={size} className="cp-copy-icon__idle" />
      <Check size={size} className="cp-copy-icon__check" />
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </span>
  );
}

/** Tooltip text that re-mounts (and so re-runs its short rise/fade) on each state change. */
export function CopyLabel({ copied, idle }: { copied: boolean; idle: string }) {
  return (
    <span key={copied ? "copied" : "idle"} className="cp-copy-label">
      {copied ? "Copied" : idle}
    </span>
  );
}
