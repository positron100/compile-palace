/**
 * Eye icon whose slash animates in/out (an SVG line-draw via
 * stroke-dashoffset) instead of hard-swapping between two separate lucide
 * icons (Eye <-> EyeOff). `pathLength="1"` normalizes the dash units so the
 * draw animation works regardless of the line's actual pixel length.
 */
export function PasswordRevealIcon({ revealed, size = 18 }: { revealed: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
      <line
        x1="3"
        y1="21"
        x2="21"
        y2="3"
        pathLength={1}
        className="auth-field__reveal-slash"
        style={{ strokeDasharray: 1, strokeDashoffset: revealed ? 0 : 1 }}
      />
    </svg>
  );
}
