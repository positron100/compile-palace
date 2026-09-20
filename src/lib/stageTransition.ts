import { flushSync } from "react-dom";

/**
 * ONE shared route-transition primitive for Start -> Auth -> Room -> Editor
 * (and back). Three shapes:
 *
 *   "circle" — CloudBook's dark/light theme reveal
 *     (CloudBook/frontend/src/lib/themeTransition.ts): View Transitions API
 *     + a WAAPI circle grown/shrunk on the `::view-transition-{old,new}(root)`
 *     pseudo-element from an origin point, radius = hypot to the farthest
 *     viewport corner, 900ms, cubic-bezier(0.65, 0, 0.35, 1) — the same hard
 *     `clip-path: circle()` CloudBook itself uses (no mask feather: masking a
 *     top-layer view-transition pseudo-element is not reliably supported, so
 *     this sticks to the exact mechanism already proven there). Circle-
 *     forward (Start -> Auth) also gets a subtle indigo/atmosphere `filter`
 *     tint on `::view-transition-new(root)` (index.css) — `filter` is the one
 *     CSS mechanism that actually paints inside the browser's top layer,
 *     where view-transition pseudo-elements live; a regular DOM overlay
 *     cannot, since the top layer always paints above all regular content
 *     regardless of z-index.
 *
 *   "rect" — TextUtils_enhanced's intro/theme reveal geometry
 *     (TextUtils_enhanced/src/styles/global.css, `@keyframes intro-geo`):
 *     dot -> 48px rounded square -> full-width 48px band -> full viewport,
 *     at keyframe offsets 0 / 0.2 / 0.32 / 0.64 / 1, 1150ms,
 *     cubic-bezier(0.62, 0, 0.15, 1). Reproduced here as `clip-path: inset()`
 *     keyframes (TextUtils drives an actual DOM element's width/height/
 *     border-radius directly; here the same geometry clips a View Transition
 *     snapshot instead, since we're revealing a different ROUTE, not an
 *     already-mounted page underneath).
 *
 * Auth -> Room does NOT go through here — it reuses AuthCard's own actual
 * curtain DOM/CSS directly (components/auth/AuthCard.tsx's `roomStage` prop,
 * AuthCard.css's `[data-mode="room"]` rules), so the auth CARD itself is what
 * visually becomes the room card, not a route-level snapshot sweep.
 *
 * Both remaining shapes are adaptations of the same underlying technique CloudBook
 * already uses: run the navigation inside `document.startViewTransition`,
 * then animate the resulting pseudo-elements. Falls back to a plain,
 * unanimated navigation when the API is unavailable or the caller didn't ask
 * for reduced motion to be skipped.
 */

export interface RevealOrigin {
  x: number;
  y: number;
}

export type RevealShape = "circle" | "rect";
export type RevealDirection = "forward" | "reverse";

interface ViewTransitionLike {
  finished: Promise<unknown>;
  ready: Promise<unknown>;
  skipTransition: () => void;
}
type StartViewTransition = (cb: () => void) => ViewTransitionLike;

export function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && "startViewTransition" in document;
}

const CIRCLE_DURATION_MS = 900;
const CIRCLE_EASING = "cubic-bezier(0.65, 0, 0.35, 1)";
// Room -> Editor (and back) only, both directions — slowed from 1150ms so
// the reveal reads as something to watch, not just a load flicker.
const RECT_DURATION_MS = 1850;
const RECT_EASING = "cubic-bezier(0.62, 0, 0.15, 1)";

// Module-scoped, not per-call: overlapping navigations (a double-click, a
// fast back-and-forth) must never each hold their own full-page GPU
// snapshot piling up — the newer one always wins.
let activeTransition: ViewTransitionLike | null = null;
let activeAnimation: Animation | null = null;

function circleEndRadius(origin: RevealOrigin): number {
  return Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );
}

/** Hard-edged clip-path circle — CloudBook's actual theme-reveal mechanism. */
function buildCircleFrames(origin: RevealOrigin): Keyframe[] {
  const endRadius = circleEndRadius(origin);
  return [
    { clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` },
    { clipPath: `circle(${endRadius}px at ${origin.x}px ${origin.y}px)` },
  ];
}

/** TextUtils' `@keyframes intro-geo`, reproduced as clip-path insets. */
function buildRectFrames(): Keyframe[] {
  return [
    { clipPath: "inset(calc(50% - 3px) calc(50% - 3px) calc(50% - 3px) calc(50% - 3px) round 50%)", offset: 0 },
    { clipPath: "inset(calc(50% - 24px) calc(50% - 24px) calc(50% - 24px) calc(50% - 24px) round 14px)", offset: 0.2 },
    { clipPath: "inset(calc(50% - 24px) calc(50% - 24px) calc(50% - 24px) calc(50% - 24px) round 12px)", offset: 0.32 },
    { clipPath: "inset(calc(50% - 24px) 0px calc(50% - 24px) 0px round 8px)", offset: 0.64 },
    { clipPath: "inset(0px 0px 0px 0px round 0px)", offset: 1 },
  ];
}

/**
 * Runs `runNavigation` (a route change, applied via flushSync so the View
 * Transition's "new" snapshot already reflects the destination route) inside
 * a View Transition, then plays the clip-path reveal. `origin` is only used
 * by the circle shape; the rect shape always grows from viewport centre,
 * matching the actual TextUtils geometry.
 */
export async function startStageTransition(
  shape: RevealShape,
  direction: RevealDirection,
  origin: RevealOrigin | null,
  runNavigation: () => void,
  /** Overrides the shape's own default duration — same easing/mechanism,
   *  just paced differently for a specific call site (e.g. sign-out's circle
   *  wants to read slower than Start -> Auth's). */
  durationOverrideMs?: number,
): Promise<void> {
  if (!supportsViewTransitions()) {
    runNavigation();
    return;
  }

  const root = document.documentElement;

  try {
    activeAnimation?.cancel();
    activeTransition?.skipTransition();
  } catch {
    /* already settled */
  }
  activeAnimation = null;
  activeTransition = null;

  if (origin) {
    root.style.setProperty("--reveal-x", `${origin.x}px`);
    root.style.setProperty("--reveal-y", `${origin.y}px`);
  }
  root.setAttribute("data-stage-transition", `${shape}-${direction}`);

  const clearVars = () => {
    root.removeAttribute("data-stage-transition");
    root.style.removeProperty("--reveal-x");
    root.style.removeProperty("--reveal-y");
  };

  const doc = document as unknown as { startViewTransition: StartViewTransition };
  let transition: ViewTransitionLike;
  try {
    transition = doc.startViewTransition(() => {
      flushSync(runNavigation);
    });
  } catch {
    runNavigation();
    clearVars();
    return;
  }
  activeTransition = transition;

  let ownAnimation: Animation | null = null;
  transition.finished.finally(() => {
    ownAnimation?.cancel();
    if (activeAnimation === ownAnimation) activeAnimation = null;
    if (activeTransition !== transition) return;
    clearVars();
    activeTransition = null;
  });

  try {
    await transition.ready;
  } catch {
    return;
  }

  const forward = direction === "forward";
  let frames: Keyframe[];
  let durationMs: number;
  let easing: string;

  if (shape === "circle") {
    const o = origin ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const grow = buildCircleFrames(o);
    frames = forward ? grow : [...grow].reverse();
    durationMs = CIRCLE_DURATION_MS;
    easing = CIRCLE_EASING;
  } else {
    const grow = buildRectFrames();
    frames = forward ? grow : grow.map((f, i) => ({ ...grow[grow.length - 1 - i], offset: f.offset }));
    durationMs = RECT_DURATION_MS;
    easing = RECT_EASING;
  }

  // Forward: the incoming (new) route grows on top, revealing itself.
  // Reverse: the outgoing (old) route shrinks away on top, uncovering what's
  // already been swapped in underneath.
  const pseudoElement = forward ? "::view-transition-new(root)" : "::view-transition-old(root)";

  const animation = root.animate(frames, {
    duration: durationOverrideMs ?? durationMs,
    easing,
    pseudoElement,
    fill: "both",
  });
  activeAnimation = animation;
  ownAnimation = animation;
  animation.finished
    .catch(() => {
      /* cancelled by a newer navigation */
    })
    .finally(() => {
      if (activeAnimation === animation) activeAnimation = null;
    });
}
