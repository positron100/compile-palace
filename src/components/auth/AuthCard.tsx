import { useEffect, useRef, type ReactNode } from "react";
import { useMagnetic } from "@/hooks/use-magnetic";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import "./AuthCard.css";

export type AuthMode = "login" | "register";

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

/**
 * The authentication stage — a fixed-size clipping viewport. The outer box
 * never resizes between login and register; only the layers inside move, and
 * only on transforms.
 *
 * The transition is a CURTAIN SWEEP: a full-width accent surface rests half
 * off one edge and, on a mode change, slides across to the opposite edge,
 * fully covering the card at the midpoint, while the welcome copy rides the
 * same sweep and the two forms cross-fade underneath. All CSS, driven by
 * `data-mode`; both forms stay mounted (no remount-to-switch) and the
 * inactive side is set `inert` so it takes no focus or pointer.
 */
export function AuthCard({ mode, onSwitch }: { mode: AuthMode; onSwitch: (mode: AuthMode) => void }) {
  const rootRef = useRef<HTMLElement>(null);
  const isRegister = mode === "register";

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.querySelectorAll<HTMLElement>("[data-auth-side]").forEach((el) => {
      el.inert = el.dataset.authSide !== mode;
    });
  }, [mode]);

  return (
    <section
      ref={rootRef}
      className="auth-stage"
      data-mode={mode}
      aria-label={isRegister ? "Create an account" : "Log in"}
    >
      <div className="auth-stage__viewport glass-primary">
        <div data-auth-side="register" className="auth-stage__form auth-stage__form--register">
          <RegisterForm onSwitchToLogin={() => onSwitch("login")} />
        </div>
        <div data-auth-side="login" className="auth-stage__form auth-stage__form--login">
          <LoginForm />
        </div>

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
