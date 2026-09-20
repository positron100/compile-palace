import { useNavigate, type NavigateOptions, type To } from "react-router-dom";
import { useReducedMotion } from "./use-reduced-motion";
import { startStageTransition, type RevealDirection, type RevealOrigin, type RevealShape } from "@/lib/stageTransition";

interface StageTransitionOptions extends NavigateOptions {
  shape: RevealShape;
  /** Circle only — omit for viewport centre (also the only option for rect). */
  origin?: RevealOrigin;
  /** "forward" (default): new route grows in. "reverse": old route shrinks away. */
  direction?: RevealDirection;
}

/**
 * The one navigate used for every Start/Auth/Room/Editor transition. Reduced
 * motion (and unsupported browsers, handled inside startStageTransition)
 * skip straight to a plain navigate — no large spatial animation, no missing
 * route change.
 */
export function useStageTransitionNavigate() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  return (to: To, { shape, origin, direction = "forward", ...navOptions }: StageTransitionOptions) => {
    if (reduce) {
      navigate(to, navOptions);
      return;
    }
    void startStageTransition(shape, direction, origin ?? null, () => navigate(to, navOptions));
  };
}
