import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { LaptopIntro } from "@/components/start/LaptopIntro";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * ONE persistent, looping LaptopIntro for the whole Auth -> Room experience.
 * It never remounts, because it's never reparented: it's always a plain
 * child of this provider (mounted once, at the App root, alongside the
 * router — never torn down by a route change), rendered as a `position:
 * fixed` overlay that tracks whichever placeholder element is currently
 * registered as "the room laptop slot" (Auth.tsx's transient curtain-sweep
 * preview first, then RoomJoinCard's real slot on "/") via
 * `getBoundingClientRect`, polled every frame while a slot is registered so
 * it tracks that slot's own CSS transitions (the curtain sweep's slide-in)
 * smoothly rather than snapping at the end.
 *
 * An earlier version used a React portal, re-targeting its container between
 * the transient and real slots. That failed in a way worth recording:
 * moving a portal's *container* preserves the child component's React state,
 * but the transient slot lives physically inside Auth.tsx's own page root —
 * and unmounting a page root is a single recursive DOM removal at the
 * browser level that takes everything nested inside it down too, including
 * a portaled child, regardless of what the React fiber tree considers that
 * child's logical parent to be. Measured live: a fresh DOM node and a
 * momentary `.laptop--open` reset at the exact handoff, every time, even
 * with an explicit flushSync release one tick before the navigate. Never
 * reparenting at all removes the whole class of bug instead of racing it.
 *
 * The registered slot itself stays a real (empty, layout-reserving) element
 * in both RoomJoinCard mounts — same flex sizing as before — so the
 * surrounding two-column layout is untouched; only the visible laptop is an
 * overlay now, not a portal.
 *
 * ENTRY CHOREOGRAPHY: the first time any slot registers (the moment Auth's
 * curtain-sweep preview mounts), a *static* closed-laptop shape
 * (LaptopIntro.css's own classes, no `.laptop--open`, no JS — literally
 * cannot animate on its own) starts travelling from off-canvas into the
 * tracked slot position, on the same lead-in and duration as the curtain
 * and room panel, so all three move as one.
 *
 * The travelling wrapper is a separate, persistent element from whatever is
 * rendered inside it, which is the whole trick: `<LaptopIntro loop>` mounts
 * MID-travel (MOUNT_AT_MS) and simply continues gliding on the wrapper's
 * still-running transition — closed by construction (its own initial
 * stage), identical markup to the static shape, so the swap is invisible
 * and there's no jump. Mounting it early is deliberate: LaptopIntro's own
 * built-in 200ms closed-before-typing hold then expires LID_LEAD_MS after
 * the scene settles, which is the "short settle, then it opens" beat. The
 * previous version waited for travel to fully finish before mounting, so
 * that 200ms hold started only afterwards and the lid-open landed a whole
 * beat late — reading as "the room panel arrived, and then separately a
 * laptop showed up". Still ONE LaptopIntro instance for the entire Room
 * lifetime; it simply doesn't exist yet during the first part of the travel.
 */
interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface RoomLaptopContextValue {
  registerSlot: (el: HTMLElement) => void;
  releaseSlot: (el: HTMLElement) => void;
}

const RoomLaptopContext = createContext<RoomLaptopContextValue | null>(null);

function sameRect(a: Rect | null, b: Rect): boolean {
  return !!a && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}

// How far left (as a fraction of the laptop's own tracked width) the closed
// shape starts before travelling in — scales down naturally on mobile's
// smaller laptop rather than needing a separate breakpoint value.
const ENTRY_OFFSET = "-55%";
// Mirrors AuthCard.css's [data-mode="room"] curtain/room-panel timing
// (8% lead-in delay, --dur-room 760ms total, --ease-curtain's own curve) so
// the laptop's travel is synchronized frame-for-frame with the curtain
// dissolving and the room panel assembling. Can't share the CSS custom
// properties directly (this overlay lives outside .auth-stage's DOM
// subtree), so the numbers are duplicated here deliberately — keep them in
// lockstep if either changes.
const ROOM_MS = 760; // === --dur-room
const ENTRY_DELAY_MS = 60; // ~0.08 * ROOM_MS, === the curtain/panel lead-in
const ENTRY_MS = ROOM_MS - ENTRY_DELAY_MS; // travel lands exactly with the panel
const ENTRY_EASE = "cubic-bezier(0.65, 0, 0.35, 1)"; // matches --ease-curtain

// LaptopIntro's OWN internal closed->code delay (LaptopIntro.tsx's
// `setTimeout(..., 200)` on stage "closed"). Not modified — just accounted
// for here, because it's what decides when the lid actually starts rising
// relative to the moment the rest of the scene settles.
const LAPTOP_CLOSED_HOLD_MS = 200;
// How long after the scene settles the lid should start rising (the "short
// settle" beat). Mounting LaptopIntro this much before its own hold expires
// is what places the opening there instead of a full 200ms later.
const LID_LEAD_MS = 140;
const MOUNT_AT_MS = ROOM_MS - LAPTOP_CLOSED_HOLD_MS + LID_LEAD_MS;

type Phase = "idle" | "entering-start" | "entering-move" | "active";

export function RoomLaptopProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const startTimer = useRef<ReturnType<typeof setTimeout>>();
  const activeTimer = useRef<ReturnType<typeof setTimeout>>();
  // Wall-clock time entry began, for THIS lineage — lets a slot swap mid-
  // entry (see below) resume the schedule instead of restarting or losing it.
  const entryStartRef = useRef<number | null>(null);

  const registerSlot = useCallback((el: HTMLElement) => setSlotEl(el), []);
  const releaseSlot = useCallback((el: HTMLElement) => setSlotEl((prev) => (prev === el ? null : prev)), []);

  useEffect(() => {
    if (!slotEl) {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const r = slotEl.getBoundingClientRect();
      setRect((prev) => (sameRect(prev, r) ? prev : { top: r.top, left: r.left, width: r.width, height: r.height }));
      raf = requestAnimationFrame(measure);
    };
    raf = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(raf);
  }, [slotEl]);

  // Drives the phase machine off slot presence alone. A slot going away
  // (sign-out, or simply no RoomJoinCard mounted anywhere) resets to "idle"
  // so a *future* entry into Room plays the closed-entry beat again, rather
  // than staying "active" forever after the first visit.
  //
  // slotEl changes TWICE during a real Auth -> Room entry: once when the
  // transient curtain-sweep preview registers, and again, mid-flight, when
  // Index.tsx's real RoomJoinCard registers its own slot right as Auth.tsx
  // unmounts (both driven by --dur-room, so they land within a few ms of
  // each other by design — see AuthCard.css). Re-running this effect on that
  // second registration must RESUME the existing schedule, not restart it
  // (double the travel) or abandon it (an earlier version keyed the "become
  // active" timeout to a fresh `setTimeout` on every slotEl change, guarded
  // by `phase !== "idle"` — so the swap's re-run saw "entering-move", the
  // guard skipped rescheduling, and the cleanup from the OLD run had already
  // cleared the pending timer: the laptop got stuck closed forever). Tracking
  // wall-clock elapsed time since entry actually began (entryStartRef) makes
  // the correct behavior fall out regardless of how many times the slot
  // reference changes mid-entry.
  useEffect(() => {
    clearTimeout(startTimer.current);
    clearTimeout(activeTimer.current);
    if (!slotEl) {
      setPhase("idle");
      entryStartRef.current = null;
      return;
    }
    if (phase === "active") return; // already fully entered; a later slot swap is transparent
    if (reduceMotion) {
      setPhase("active");
      return;
    }
    if (entryStartRef.current === null) {
      // First slot registration for this lineage: start the beat.
      entryStartRef.current = performance.now();
      setPhase("entering-start");
      // Two-frame trick (same one Auth.tsx's own room-mode flip uses): mount
      // at the off-canvas transform with no transition first, so the browser
      // has a "before" frame to animate from. Then hold for ENTRY_DELAY_MS
      // (the same lead-in the curtain/room-panel transitions carry) before
      // flipping to the transitioning state, so all three start moving
      // together rather than the laptop jumping ahead of the curtain by a
      // whole frame.
      const raf = requestAnimationFrame(() => {
        startTimer.current = setTimeout(() => setPhase("entering-move"), ENTRY_DELAY_MS);
      });
      activeTimer.current = setTimeout(() => setPhase("active"), MOUNT_AT_MS);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(startTimer.current);
      };
    }
    // A slot swap mid-entry: pick the schedule back up from elapsed time
    // rather than from zero.
    if (phase !== "entering-move") setPhase("entering-move");
    const elapsed = performance.now() - entryStartRef.current;
    const remaining = Math.max(0, MOUNT_AT_MS - elapsed);
    activeTimer.current = setTimeout(() => setPhase("active"), remaining);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotEl]);

  return (
    <RoomLaptopContext.Provider value={{ registerSlot, releaseSlot }}>
      {children}
      <div
        aria-hidden="true"
        // Reuses .room-stage__laptop (RoomJoinCard.css) verbatim — that's
        // what sizes/centers the laptop and shrinks it (including the
        // <=900px media query's smaller max-width) for the room panel scale,
        // via plain class selectors that don't care where in the DOM this
        // div physically lives. Without it the overlay has no intrinsic
        // size of its own and just stretches to the raw measured rect,
        // oversized and unclipped on any viewport whose flex slot is wider
        // than the laptop was ever meant to render.
        className="room-stage__laptop"
        style={
          rect
            ? {
                position: "fixed",
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                pointerEvents: "none",
                // Above everything, including the curtain — no registered
                // slot is ever meaningfully covered by it (the room layer's
                // own enter offset is a small 6% shift, not an off-screen
                // slide), and staying on top keeps the laptop continuously
                // visible through the handoff rather than participating in
                // the curtain's own cover/reveal timing.
                zIndex: 50,
              }
            : // No slot registered (nothing on screen wants the laptop right
              // now, e.g. the Start screen's own separate LaptopIntro is
              // showing instead) — parked off-screen, nothing rendered
              // inside (see below), so there's nothing running to remount.
              { position: "fixed", left: "-9999px", top: "-9999px" }
        }
      >
        {phase === "idle" ? null : (
          // The TRAVELLING WRAPPER — deliberately outside the static-shape /
          // LaptopIntro branch below, so it stays mounted across that swap
          // and the entry transition is never interrupted. That's what lets
          // the real instance mount MID-travel and keep gliding to its
          // resting spot on the same, still-running transition.
          //
          // An earlier version put the transform on the static shape itself,
          // so the swap could only happen once travel had finished — which
          // meant LaptopIntro's own 200ms closed hold only started then,
          // putting the lid-open a full beat after the rest of the scene had
          // already settled. That gap is exactly what read as "the panel
          // arrives, and then separately a laptop shows up".
          //
          // `transform` slides it in; `opacity` now rides the SAME duration/
          // easing alongside it (not a separately-timed "pop" — this isn't
          // the popping-in this comment used to warn against, it's synced to
          // the identical curve as the slide). Needed because the pre-`active`
          // closed shape below (LaptopIntro.css's `.laptop__shell`) is, by
          // its own design, "a short, wide, bottom-anchored bar" — everything
          // above the hinge/base band is deliberately empty/transparent, so
          // that shell is the ONLY opaque thing visible while this wrapper
          // travels. At full opacity from the first off-canvas frame, that
          // reads as a solid dark rectangle sliding in from nowhere — no
          // laptop context yet to read it as "a closed laptop arriving" (the
          // Start screen has that context because the user just watched the
          // lid fold down onto this exact shape; Room's entry has none). A
          // synced 0->1 fade makes it materialize into place with the slide
          // instead of appearing as a pre-formed, disconnected object.
          <div
            className="laptop-scene"
            aria-hidden="true"
            style={{
              transform: phase === "entering-start" ? `translateX(${ENTRY_OFFSET})` : "none",
              opacity: phase === "entering-start" ? 0 : 1,
              transition:
                phase === "entering-start" ? "none" : `transform ${ENTRY_MS}ms ${ENTRY_EASE}, opacity ${ENTRY_MS}ms ${ENTRY_EASE}`,
            }}
          >
            {phase === "active" ? (
              <LaptopIntro loop />
            ) : (
              // Static closed shape — plain CSS classes, no JS, so it cannot
              // animate its own lid/code/etc. Same markup and classes
              // LaptopIntro itself renders while closed, so swapping to the
              // real instance mid-travel is visually seamless.
              <div className="laptop">
                <div className="laptop__screen" />
                <div className="laptop__hinge" />
                <div className="laptop__base" />
                <div className="laptop__shell" />
              </div>
            )}
          </div>
        )}
      </div>
    </RoomLaptopContext.Provider>
  );
}

export function useRoomLaptopSlot(): RoomLaptopContextValue {
  const ctx = useContext(RoomLaptopContext);
  if (!ctx) throw new Error("useRoomLaptopSlot must be used within RoomLaptopProvider");
  return ctx;
}
