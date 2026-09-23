import { useCallback, useEffect, useRef, type MouseEvent } from "react";
import { useReducedMotion } from "./use-reduced-motion";

interface UseLiquidGlassOptions {
  /** Peak magnetic offset in px at the element's edge. */
  strength?: number;
  disabled?: boolean;
}

/**
 * Liquid-glass control interaction: a cursor-tracked radial sheen (writes
 * `--mx`/`--my` percentages the `.cp-liquid` CSS class's `::before` reads,
 * works regardless of pointer type or motion preference — it's a hover
 * highlight, not motion) plus the same magnetic pointer-pull as
 * `useMagnetic` (fine-pointer + non-reduced-motion only). Combined into one
 * hook because every liquid-glass control wants both from the same
 * mousemove, and a control never needs the sheen without the pull or vice
 * versa.
 */
export function useLiquidGlass<T extends HTMLElement>({ strength = 6, disabled = false }: UseLiquidGlassOptions = {}) {
  const ref = useRef<T | null>(null);
  const reduce = useReducedMotion();
  const magneticEnabledRef = useRef(false);

  useEffect(() => {
    magneticEnabledRef.current =
      !reduce && !disabled && typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;
    if (!magneticEnabledRef.current && ref.current) ref.current.style.translate = "";
  }, [reduce, disabled]);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();

      const px = ((e.clientX - rect.left) / rect.width) * 100;
      const py = ((e.clientY - rect.top) / rect.height) * 100;
      ref.current.style.setProperty("--mx", `${px.toFixed(1)}%`);
      ref.current.style.setProperty("--my", `${py.toFixed(1)}%`);

      if (!magneticEnabledRef.current) return;
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);
      const x = (relX / (rect.width / 2)) * strength;
      const y = (relY / (rect.height / 2)) * strength;
      ref.current.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    },
    [strength],
  );

  const onMouseLeave = useCallback(() => {
    if (ref.current) ref.current.style.translate = "0 0";
  }, []);

  return { ref, onMouseMove, onMouseLeave };
}
