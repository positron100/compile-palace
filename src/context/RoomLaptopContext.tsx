import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { LaptopIntro } from "@/components/start/LaptopIntro";

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

export function RoomLaptopProvider({ children }: { children: ReactNode }) {
  const [slotEl, setSlotEl] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);

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
              // showing instead) — parked off-screen, still mounted and
              // running so it's never remounted once a slot appears.
              { position: "fixed", left: "-9999px", top: "-9999px" }
        }
      >
        <LaptopIntro loop />
      </div>
    </RoomLaptopContext.Provider>
  );
}

export function useRoomLaptopSlot(): RoomLaptopContextValue {
  const ctx = useContext(RoomLaptopContext);
  if (!ctx) throw new Error("useRoomLaptopSlot must be used within RoomLaptopProvider");
  return ctx;
}
