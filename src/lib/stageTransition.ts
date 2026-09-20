import { flushSync } from "react-dom";

/**
 * ONE shared route-transition primitive for Start -> Auth -> Room -> Editor
 * (and back). Three shapes:
 *
 *   "circle" — CloudBook's dark/light theme reveal
 *     (CloudBook/frontend/src/lib/themeTransition.ts): View Transitions API
 *     + a WAAPI circle grown/shrunk on the `::view-transition-{old,new}(root)`
 *     pseudo-element from an origin point, radius = hypot to the farthest
 *     viewport corner, 900ms, cubic-bezier(0.65, 0, 0.35, 1). The edge is
 *     softened with a radial-gradient `mask-image` (`#000 78%, transparent
 *     100%`) — the same feather CloudBook's OpeningScene uses on its
 *     `-webkit-mask`/`mask` — with a hard `clip-path: circle()` fallback
 *     (CloudBook's own theme reveal, which has no feather) on browsers
 *     without mask-image support.
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
 *   "curtain" — Auth -> Room only. Continues this app's own AuthCard login/
 *     register curtain (components/auth/AuthCard.css): a rounded-leading-edge
 *     sweep, not a fade/wipe/rect reveal. 720ms, the curtain's own
 *     cubic-bezier(0.65, 0, 0.35, 1) easing, swept horizontally (vertically
 *     under 900px, matching AuthCard's own mobile breakpoint).
 *
 * All three are adaptations of the same underlying technique CloudBook
 * already uses: run the navigation inside `document.startViewTransition`,
 * then animate the resulting pseudo-elements. Falls back to a plain,
 * unanimated navigation when the API is unavailable or the caller didn't ask
 * for reduced motion to be skipped.
 */

export interface RevealOrigin {
  x: number;
  y: number;
}

export type RevealShape = "circle" | "rect" | "curtain";
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
const RECT_DURATION_MS = 1150;
const RECT_EASING = "cubic-bezier(0.62, 0, 0.15, 1)";
const CURTAIN_DURATION_MS = 720;
const CURTAIN_EASING = "cubic-bezier(0.65, 0, 0.35, 1)";
// AuthCard.css's own --bulge: clamp(2rem, 7vw, 5rem) — the curtain's rounded
// leading edge, reused here so the route-level sweep reads as the same
// curtain, not a different shape that happens to share a name.
const CURTAIN_BULGE = "clamp(2rem, 7vw, 5rem)";
const CURTAIN_MOBILE_BREAKPOINT = 900;

// Module-scoped, not per-call: overlapping navigations (a double-click, a
// fast back-and-forth) must never each hold their own full-page GPU
// snapshot piling up — the newer one always wins.
let activeTransition: ViewTransitionLike | null = null;
let activeAnimation: Animation | null = null;

const supportsMaskReveal =
  typeof CSS !== "undefined" &&
  !!CSS.supports &&
  (CSS.supports("mask-image", "radial-gradient(#000, transparent)") ||
    CSS.supports("-webkit-mask-image", "radial-gradient(#000, transparent)"));

/** Hard-edged clip-path circle — CloudBook's actual theme-reveal fallback. */
function buildCircleClipFrames(origin: RevealOrigin, endRadius: number): Keyframe[] {
  return [
    { clipPath: `circle(0px at ${origin.x}px ${origin.y}px)` },
    { clipPath: `circle(${endRadius}px at ${origin.x}px ${origin.y}px)` },
  ];
}

/**
 * Soft-edged circle via `mask-image`, feathered the way CloudBook's
 * OpeningScene softens its own reveal hole (`transparent 78% -> #000 100%`,
 * here inverted since a mask's opaque area is what stays visible). The end
 * radius overshoots by 15% so the 22%-wide feather band still fully clears
 * the farthest viewport corner.
 */
function buildCircleMaskFrames(origin: RevealOrigin, endRadius: number): Keyframe[] {
  const grownRadius = endRadius * 1.15;
  const gradient = (r: number) =>
    `radial-gradient(circle ${r}px at ${origin.x}px ${origin.y}px, #000 78%, transparent 100%)`;
  return [
    { maskImage: gradient(0), WebkitMaskImage: gradient(0) },
    { maskImage: gradient(grownRadius), WebkitMaskImage: gradient(grownRadius) },
  ];
}

function buildCircleFrames(origin: RevealOrigin): Keyframe[] {
  const endRadius = Math.hypot(
    Math.max(origin.x, window.innerWidth - origin.x),
    Math.max(origin.y, window.innerHeight - origin.y),
  );
  return supportsMaskReveal ? buildCircleMaskFrames(origin, endRadius) : buildCircleClipFrames(origin, endRadius);
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
 * AuthCard's login/register curtain, continued at route scale: a sweep with
 * a rounded leading edge, not a fade or a rect reveal. Horizontal (left ->
 * right) on desktop; vertical under CURTAIN_MOBILE_BREAKPOINT, matching
 * AuthCard.css's own mobile axis swap.
 */
function buildCurtainFrames(): Keyframe[] {
  const mobile = window.innerWidth < CURTAIN_MOBILE_BREAKPOINT;
  if (mobile) {
    return [
      { clipPath: `inset(100% 0% 0% 0% round ${CURTAIN_BULGE} ${CURTAIN_BULGE} 0 0)` },
      { clipPath: "inset(0% 0% 0% 0% round 0)" },
    ];
  }
  return [
    { clipPath: `inset(0% 100% 0% 0% round 0 ${CURTAIN_BULGE} ${CURTAIN_BULGE} 0)` },
    { clipPath: "inset(0% 0% 0% 0% round 0)" },
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
  } else if (shape === "curtain") {
    const grow = buildCurtainFrames();
    frames = forward ? grow : [...grow].reverse();
    durationMs = CURTAIN_DURATION_MS;
    easing = CURTAIN_EASING;
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

  const animation = root.animate(frames, { duration: durationMs, easing, pseudoElement, fill: "both" });
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
