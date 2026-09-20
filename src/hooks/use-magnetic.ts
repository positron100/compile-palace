import { useCallback, useEffect, useRef, type MouseEvent } from "react";
import { useReducedMotion } from "./use-reduced-motion";

interface UseMagneticOptions {
  /** Peak offset in px at the element's edge. */
  strength?: number;
  disabled?: boolean;
}

/**
 * Subtle pointer-follow: an element leans a few px toward the cursor while
 * hovered and eases back on leave. Fine-pointer + non-reduced-motion only.
 * Writes `translate` straight to the DOM node (no React re-render per move) —
 * a short CSS transition on the node does the easing.
 */
export function useMagnetic<T extends HTMLElement>({ strength = 8, disabled = false }: UseMagneticOptions = {}) {
  const ref = useRef<T | null>(null);
  const reduce = useReducedMotion();
  const enabledRef = useRef(false);

  useEffect(() => {
    enabledRef.current =
      !reduce && !disabled && typeof window !== "undefined" && window.matchMedia?.("(pointer: fine)").matches;
    if (!enabledRef.current && ref.current) ref.current.style.translate = "";
  }, [reduce, disabled]);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!enabledRef.current || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
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
