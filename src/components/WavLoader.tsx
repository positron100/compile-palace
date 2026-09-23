import { useTheme } from "@/context/ThemeContext";

/**
 * "Wave" compiling loader. Pasted SVG has two color variants (light/dark
 * ink); everything else (bars/beads/keyframes/reduced-motion) is identical,
 * so we swap only the ink color based on the active mode instead of forking
 * the markup.
 */
export function WavLoader({ size = 96 }: { size?: number }) {
  const { mode } = useTheme();
  const ink = mode === "dark" ? "#f5f5f7" : "#131316";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="wav"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      role="img"
      aria-label="Loading"
      style={{ color: ink }}
    >
      <style>{`
        .wav { --dur: 1.8s; }

        .wav-bar {
          stroke: currentColor;
          stroke-width: .8;
          opacity: .24;
          animation: wav-shimmer calc(var(--dur) * var(--rate, 1)) ease-in-out infinite;
          animation-delay: calc(var(--i) * var(--dur) * var(--rate, 1) / -9);
        }

        .wav-bead {
          fill: currentColor;
          animation: wav-bob calc(var(--dur) * var(--rate, 1)) ease-in-out infinite;
          animation-delay: calc(var(--i) * var(--dur) * var(--rate, 1) / -7);
        }

        @keyframes wav-bob     { 0%, 100% { transform: translateY(-16px); } 50% { transform: translateY(16px); } }
        @keyframes wav-shimmer { 0%, 100% { opacity: .2; } 50% { opacity: .62; } }

        @media (prefers-reduced-motion: reduce) {
          .wav-bar  { animation: none; opacity: .3; }
          .wav-bead { animation: none; transform: translateY(calc((var(--i) - 2) * 7px)); }
        }
      `}</style>

      <defs><clipPath id="wav-disc"><circle cx="32" cy="32" r="32" /></clipPath></defs>
      <g clipPath="url(#wav-disc)">
        <line className="wav-bar" x1="4.00" y1="0" x2="4.00" y2="64" style={{ ["--i" as string]: 0 }} />
        <line className="wav-bar" x1="8.00" y1="0" x2="8.00" y2="64" style={{ ["--i" as string]: 1 }} />
        <line className="wav-bar" x1="12.00" y1="0" x2="12.00" y2="64" style={{ ["--i" as string]: 2 }} />
        <line className="wav-bar" x1="16.00" y1="0" x2="16.00" y2="64" style={{ ["--i" as string]: 3 }} />
        <line className="wav-bar" x1="20.00" y1="0" x2="20.00" y2="64" style={{ ["--i" as string]: 4 }} />
        <line className="wav-bar" x1="24.00" y1="0" x2="24.00" y2="64" style={{ ["--i" as string]: 5 }} />
        <line className="wav-bar" x1="28.00" y1="0" x2="28.00" y2="64" style={{ ["--i" as string]: 6 }} />
        <line className="wav-bar" x1="32.00" y1="0" x2="32.00" y2="64" style={{ ["--i" as string]: 7 }} />
        <line className="wav-bar" x1="36.00" y1="0" x2="36.00" y2="64" style={{ ["--i" as string]: 8 }} />
        <line className="wav-bar" x1="40.00" y1="0" x2="40.00" y2="64" style={{ ["--i" as string]: 9 }} />
        <line className="wav-bar" x1="44.00" y1="0" x2="44.00" y2="64" style={{ ["--i" as string]: 10 }} />
        <line className="wav-bar" x1="48.00" y1="0" x2="48.00" y2="64" style={{ ["--i" as string]: 11 }} />
        <line className="wav-bar" x1="52.00" y1="0" x2="52.00" y2="64" style={{ ["--i" as string]: 12 }} />
        <line className="wav-bar" x1="56.00" y1="0" x2="56.00" y2="64" style={{ ["--i" as string]: 13 }} />
        <line className="wav-bar" x1="60.00" y1="0" x2="60.00" y2="64" style={{ ["--i" as string]: 14 }} />
        <circle className="wav-bead" cx="14.08" cy="32" r="2.5" style={{ ["--i" as string]: 0 }} />
        <circle className="wav-bead" cx="23.04" cy="32" r="2.5" style={{ ["--i" as string]: 1 }} />
        <circle className="wav-bead" cx="32.00" cy="32" r="2.5" style={{ ["--i" as string]: 2 }} />
        <circle className="wav-bead" cx="40.96" cy="32" r="2.5" style={{ ["--i" as string]: 3 }} />
        <circle className="wav-bead" cx="49.92" cy="32" r="2.5" style={{ ["--i" as string]: 4 }} />
      </g>
    </svg>
  );
}
