import { useId } from "react";

/**
 * The Compile Palace brand mark (castle-C + cube), inlined as SVG instead of
 * the old baked `/logo-mark.png` — a raster PNG's fill color is fixed at
 * generation time, so it can never re-tint with the active theme. Same
 * geometry as public/logo.svg (kept as the favicon/apple-touch-icon source,
 * which genuinely can't be live-recolored by CSS); this is the live in-UI
 * version. Not the theme-toggle control (ThemeSelector.tsx) — a separate
 * element, untouched here.
 */
export function BrandLogo({ size = 24, className }: { size?: number; className?: string }) {
  const gradientId = useId();
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className ? `cp-logo-mark ${className}` : "cp-logo-mark"}
      aria-hidden="true"
    >
      <defs>
        {/* Rainbow only — referenced by the CSS `fill: url(#...)` override
            below, same "iridescent, not loud" restraint as the rest of the
            theme (lavender -> sage -> coral, the same three source hues used
            everywhere else in Rainbow). */}
        <linearGradient id={gradientId} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(243 70% 60%)" />
          <stop offset="55%" stopColor="hsl(152 45% 42%)" />
          <stop offset="100%" stopColor="hsl(22 75% 56%)" />
        </linearGradient>
      </defs>
      <path
        className="cp-logo-mark__body"
        style={{ ["--cp-logo-rainbow-fill" as string]: `url(#${gradientId})` }}
        d="M8 28 L8 56 L28 56 L28 40 L36 40 L36 56 L56 56 L56 28 L48 28 L48 14 L44 14 L44 20 L40 20 L40 14 L36 14 L36 20 L28 20 L28 14 L24 14 L24 20 L20 20 L20 14 L16 14 L16 28 Z"
      />
      <rect className="cp-logo-mark__cube" x="26" y="30" width="12" height="12" />
    </svg>
  );
}
