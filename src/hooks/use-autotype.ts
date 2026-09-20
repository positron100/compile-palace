import { useEffect, useState } from "react";

/**
 * Types `text` out a character at a time while `active`. Meant for an idle
 * demo preview, not real input — the caller decides when it's active (e.g.
 * `isEmpty && !hasInteracted`) and clears it the instant the user touches the
 * field. Plain setTimeout chain, no rAF loop, cancels cleanly on unmount.
 */
export function useAutotype(text: string, active: boolean, startDelay = 500, stepMs = 55): string {
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!active || !text) {
      setPreview("");
      return;
    }
    let cancelled = false;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      if (cancelled) return;
      i += 1;
      setPreview(text.slice(0, i));
      if (i < text.length) timer = setTimeout(step, stepMs);
    };

    timer = setTimeout(step, startDelay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [text, active, startDelay, stepMs]);

  return preview;
}
