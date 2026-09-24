import { useEffect, useRef, type ReactNode } from "react";
import { useMagnetic } from "@/hooks/use-magnetic";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import "./AuthCard.css";

export type AuthMode = "login" | "register";
/** The stage can also be mid/post the Auth -> Room transform — a third
 *  position on the same curtain, not a new mechanism. */
export type AuthStage = AuthMode | "room";

const COPY = {
  login: {
    wordmark: "compile palace",
    heading: "New to the palace?",
    sub: "Spin up a room, invite your team, and start shipping code together.",
    ctaLabel: "Create account",
  },
  register: {
    wordmark: "compile palace",
    heading: "Already have a room?",
    sub: "Sign back in — your workspace is exactly where you left it.",
    ctaLabel: "Log in",
  },
} as const;

const SIDES = ["login", "register"] as const;

function AuthSwitchCta({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  const magnetic = useMagnetic<HTMLButtonElement>({ strength: 8 });
  return (
    <button
      ref={magnetic.ref}
      type="button"
      className="auth-stage__cta cp-pill"
      onMouseMove={magnetic.onMouseMove}
      onMouseLeave={magnetic.onMouseLeave}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface AuthCardProps {
  mode: AuthMode;
  onSwitch: (mode: AuthMode) => void;
  /** Set once the Auth -> Room transform is under way (see Auth.tsx). Which
   *  side (login/register) it's sweeping FROM — the curtain's room-bound
   *  target sits on the opposite side, so the sweep always crosses full
   *  coverage regardless of which form the user completed. */
  roomStage?: { entry: AuthMode; active: boolean } | null;
  /** Rendered inside the same curtain viewport as the forms — mounted a
   *  frame before `roomStage.active` flips so the CSS transition has a
   *  "before" state to animate from, exactly like login/register already do
   *  by staying mounted always. */
  roomContent?: ReactNode;
  /** Fires when the curtain's own transform finishes settling into "room" —
   *  the caller's cue that the reveal is visually complete. */
  onRoomRevealed?: () => void;
}

/**
 * The authentication stage — a fixed-size clipping viewport. The outer box
 * never resizes between login/register/room; only the layers inside move,
 * and only on transforms.
 *
 * The transition is a CURTAIN SWEEP: a full-width accent surface rests half
 * off one edge and, on a mode change, slides across to the opposite edge,
 * fully covering the card at the midpoint, while the welcome copy rides the
 * same sweep and the forms cross-fade underneath. All CSS, driven by
 * `data-mode`; every side stays mounted (no remount-to-switch) and the
 * inactive side is set `inert` so it takes no focus or pointer. Auth -> Room
 * reuses this exact mechanism: `roomContent` is a third side on the same
 * curtain (see AuthCard.css's `[data-mode="room"]` rules), not a separate
 * animation system.
 */
export function AuthCard({ mode, onSwitch, roomStage, roomContent, onRoomRevealed }: AuthCardProps) {
  const rootRef = useRef<HTMLElement>(null);
  const revealedRef = useRef(false);
  const stage: AuthStage = roomStage?.active ? "room" : mode;
  const isRegister = stage === "register";

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-auth-side]").forEach((el) => {
      el.inert = el.dataset.authSide !== stage;
    });
  }, [stage]);

  useEffect(() => {
    if (stage !== "room" || !onRoomRevealed) return;
    const curtain = rootRef.current?.querySelector<HTMLElement>(".auth-stage__curtain");
    if (!curtain) return;
    // Any single curtain property can have start == end for a given
    // entry side/theme/mode (transform entering Room from Signup; and
    // background-color in Dark+Rainbow, where the room-mode rule loses the
    // cascade tie to `.dark[data-theme="rainbow"] .auth-stage__curtain`) —
    // a `transitionend` listener keyed on one named property then never
    // fires and the user is stranded on this decoy at /auth forever. Wait on
    // whichever transitions the browser actually started instead (reading
    // getAnimations() flushes style, so they exist by now); none started
    // (transitions suppressed / everything already at target) means the
    // reveal is already visually done.
    let cancelled = false;
    const running = curtain
      .getAnimations()
      .filter((a) => typeof CSSTransition !== "undefined" && a instanceof CSSTransition);
    void Promise.allSettled(running.map((a) => a.finished)).then(() => {
      if (cancelled || revealedRef.current) return;
      revealedRef.current = true;
      onRoomRevealed();
    });
    return () => {
      cancelled = true;
    };
  }, [stage, onRoomRevealed]);

  return (
    <section
      ref={rootRef}
      className="auth-stage"
      data-mode={stage}
      data-room-entry={roomStage?.entry}
      aria-label={stage === "room" ? "Joining your room" : isRegister ? "Create an account" : "Log in"}
    >
      <div className="auth-stage__viewport glass-primary">
        <div data-auth-side="register" className="auth-stage__form auth-stage__form--register">
          <RegisterForm onSwitchToLogin={() => onSwitch("login")} />
        </div>
        <div data-auth-side="login" className="auth-stage__form auth-stage__form--login">
          <LoginForm />
        </div>
        {roomContent && (
          <div data-auth-side="room" className="auth-stage__room">
            {roomContent}
          </div>
        )}

        <div className="auth-stage__curtain" aria-hidden="true" />

        <div className="auth-stage__welcome">
          {SIDES.map((side) => (
            <div key={side} data-auth-side={side} className={`auth-stage__copy auth-stage__copy--${side}`}>
              <span className="auth-stage__wordmark">{COPY[side].wordmark}</span>
              <h2 className="auth-stage__heading">{COPY[side].heading}</h2>
              <p className="auth-stage__sub">{COPY[side].sub}</p>
              <AuthSwitchCta onClick={() => onSwitch(side === "login" ? "register" : "login")}>
                {COPY[side].ctaLabel}
              </AuthSwitchCta>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
