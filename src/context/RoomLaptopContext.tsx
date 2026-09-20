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
 * curtain-sweep preview mounts), this doesn't mount LaptopIntro yet. It
 * first renders a *static* closed-laptop shape (LaptopIntro.css's own
 * classes, no `.laptop--open`, no JS — literally cannot animate on its own)
 * that travels from off-canvas into the tracked slot position over
 * ENTRY_MS. Only once that travel finishes does `<LaptopIntro loop>` mount
 * for the first time — closed by construction (its own initial stage), at
 * the exact position the static shape just settled into, so there's no
 * jump. LaptopIntro's own built-in 200ms closed-before-typing delay is what
 * supplies the "brief settle" beat the design calls for; nothing here needs
 * to duplicate it. This is still ONE LaptopIntro instance for the entire
 * Room lifetime — it simply doesn't exist yet during the travel beat.
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
const ENTRY_MS = 750;
const ENTRY_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

type Phase = "idle" | "entering-start" | "entering-move" | "active";

export function RoomLaptopProvider({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const entryTimer = useRef<ReturnType<typeof setTimeout>>();

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
  useEffect(() => {
    clearTimeout(entryTimer.current);
    if (!slotEl) {
      setPhase("idle");
      return;
    }
    if (phase !== "idle") return; // already entering/active for this slot lineage
    if (reduceMotion) {
      setPhase("active");
      return;
    }
    setPhase("entering-start");
    // Two-frame trick (same one Auth.tsx's own room-mode flip uses): mount
    // at the off-canvas transform with no transition first, so the browser
    // has a "before" frame to animate from, then flip to the transitioning
    // state on the next paint.
    const raf = requestAnimationFrame(() => setPhase("entering-move"));
    entryTimer.current = setTimeout(() => setPhase("active"), ENTRY_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(entryTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotEl]);

  const entering = phase === "entering-start" || phase === "entering-move";

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
        {entering ? (
          // Static closed shape — plain CSS classes, no JS, cannot animate
          // its own lid/code/etc. Only `transform` moves, eased in from
          // ENTRY_OFFSET to its resting spot; never opacity (no "pop"), no
          // scale, no bounce.
          <div
            className="laptop-scene"
            aria-hidden="true"
            style={{
              transform: phase === "entering-start" ? `translateX(${ENTRY_OFFSET})` : "none",
              transition: phase === "entering-move" ? `transform ${ENTRY_MS}ms ${ENTRY_EASE}` : "none",
            }}
          >
            <div className="laptop">
              <div className="laptop__screen" />
              <div className="laptop__hinge" />
              <div className="laptop__base" />
              <div className="laptop__shell" />
            </div>
          </div>
        ) : phase === "active" ? (
          <LaptopIntro loop />
        ) : null}
      </div>
    </RoomLaptopContext.Provider>
  );
}

export function useRoomLaptopSlot(): RoomLaptopContextValue {
  const ctx = useContext(RoomLaptopContext);
  if (!ctx) throw new Error("useRoomLaptopSlot must be used within RoomLaptopProvider");
  return ctx;
}
