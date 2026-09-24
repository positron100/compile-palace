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

  // Watchdog: `transition.finished` is a browser-native promise that, per
  // everything observed empirically working on this feature, doesn't always
  // settle in bounded time (measured multi-second-plus stalls, and in at
  // least one environment never at all). Left unguarded, that means
  // `data-stage-transition` (which disables CSS transitions app-wide via the
  // `* { transition: none !important }` rule below) and the top-layer view-
  // transition snapshot both stay stuck indefinitely — the page becomes
  // uninteractive/confusing until a full reload, which matches exactly what
  // "sometimes stuck, fixed by opening a new tab" looks like. This forces
  // the same cleanup `transition.finished.finally` already does, after a
  // bound generous enough to never fire during a normal-speed transition
  // (longest real duration used anywhere is RECT_DURATION_MS = 1850ms).
  const WATCHDOG_MS = 4000;
  let settled = false;
  const watchdog = setTimeout(() => {
    if (settled || activeTransition !== transition) return;
    try {
      transition.skipTransition();
    } catch {
      /* already settled or unsupported */
    }
    clearVars();
    activeTransition = null;
  }, WATCHDOG_MS);

  let ownAnimation: Animation | null = null;
  transition.finished.finally(() => {
    settled = true;
    clearTimeout(watchdog);
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
    // A true time-reversal needs offsets mirrored too (1 - offset), not just
    // the value order — grow's offsets aren't evenly spaced (0, .2, .32,
    // .64, 1), so keeping the original ascending offsets paired with
    // reversed values crams most of the visual change into the first ~20%
    // of the duration instead of mirroring forward's actual pacing, which
    // reads as "reverse plays too fast".
    frames = forward
      ? grow
      : [...grow].reverse().map((f) => ({ ...f, offset: 1 - (f.offset ?? 0) }));
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

// ---------------------------------------------------------------------------
// Editor-content reveal (Saved Code -> Open) — reuses the exact same rect
// geometry/timing (buildRectFrames/RECT_DURATION_MS/RECT_EASING) Room ->
// Editor already uses, but scoped to a single element via a named
// view-transition-name instead of the page root, so the animation is
// confined to that element's own box (no full-page overlay, Room Info panel
// untouched) and never runs a route navigation. `view-transition-name` is
// only added to the target right before the transition and removed right
// after (mirroring how startStageTransition sets/clears its own
// `data-stage-transition` attribute) so this never interferes with the
// separate root-level Room -> Editor transition, which names a completely
// different element (`root`) at a completely different time.
// ---------------------------------------------------------------------------
const EDITOR_REVEAL_NAME = "cp-editor-reveal";
const EDITOR_REVEAL_CLASS = "cp-editor-reveal-target";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Wraps `applyChange` (e.g. loading saved code into the editor) in the same
 * circle... no — same RECT reveal Room -> Editor uses, confined to `target`
 * (the editor surface element). Falls back to an immediate, unanimated
 * `applyChange()` when View Transitions aren't supported or the user has
 * reduced motion enabled.
 */
export async function startEditorRevealTransition(
  target: HTMLElement,
  applyChange: () => void,
): Promise<void> {
  if (!supportsViewTransitions() || prefersReducedMotion()) {
    applyChange();
    return;
  }

  target.classList.add(EDITOR_REVEAL_CLASS);

  const doc = document as unknown as { startViewTransition: StartViewTransition };
  let transition: ViewTransitionLike;
  try {
    transition = doc.startViewTransition(() => {
      flushSync(applyChange);
    });
  } catch {
    applyChange();
    target.classList.remove(EDITOR_REVEAL_CLASS);
    return;
  }

  transition.finished.finally(() => {
    target.classList.remove(EDITOR_REVEAL_CLASS);
  });

  try {
    await transition.ready;
  } catch {
    return;
  }

  const frames = buildRectFrames(); // same private geometry Room -> Editor uses, unmodified
  document.documentElement.animate(frames, {
    duration: RECT_DURATION_MS,
    easing: RECT_EASING,
    pseudoElement: `::view-transition-new(${EDITOR_REVEAL_NAME})`,
    fill: "both",
  });

  // Old/new CODE CONTENT crossfade — the view-transition snapshots ARE
  // bitmaps of the actual editor content (old code vs new code), so
  // animating their opacity literally crossfades old code -> new code, not
  // just the container. Two separate, parallel Animation objects (opacity
  // only) layered on top of the same unmodified clip-path reveal above —
  // Web Animations lets multiple `.animate()` calls target the same
  // pseudo-element concurrently as long as they don't touch the same CSS
  // property, so this never touches or redefines the approved geometry.
  // Was previously relying on the reveal's own hard clip-path edge to hide
  // the old snapshot, which only fully covered it at the very last instant
  // — reads as an abrupt pop when the transition tears the snapshots down.
  // An explicit, synchronized opacity ramp (old 1->0, new 0->1, same
  // duration/easing as the geometry) guarantees old is already fully
  // invisible before that teardown, so there's nothing left to "disappear".
  document.documentElement.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    { duration: RECT_DURATION_MS, easing: RECT_EASING, pseudoElement: `::view-transition-old(${EDITOR_REVEAL_NAME})`, fill: "both" }
  );
  document.documentElement.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    { duration: RECT_DURATION_MS, easing: RECT_EASING, pseudoElement: `::view-transition-new(${EDITOR_REVEAL_NAME})`, fill: "both" }
  );
}
