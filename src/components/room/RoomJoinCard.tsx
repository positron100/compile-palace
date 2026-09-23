import { useEffect, useRef, type FormEvent } from "react";
import { KeyRound, User as UserIcon, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthField } from "@/components/auth/AuthField";
import { useRoomLaptopSlot } from "@/context/RoomLaptopContext";
import { useMagnetic } from "@/hooks/use-magnetic";
import "./RoomJoinCard.css";

interface RoomJoinCardProps {
  roomId: string;
  username: string;
  onRoomIdChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onJoin: () => void;
  onCreateRoom: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onSignOut: (e: React.MouseEvent<HTMLButtonElement>) => void;
  joining?: boolean;
}

function SignOutGlassButton({ onClick }: { onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  const magnetic = useMagnetic<HTMLButtonElement>({ strength: 6 });
  return (
    <button
      ref={magnetic.ref}
      type="button"
      className="room-form__signout glass-secondary cp-lift"
      onMouseMove={magnetic.onMouseMove}
      onMouseLeave={magnetic.onMouseLeave}
      onClick={onClick}
      aria-label="Sign out"
      title="Sign out"
    >
      <LogOut size={16} />
    </button>
  );
}

/**
 * The room-join surface: same spatial scale and interaction language as the
 * Login/Sign-Up card. Left is the looping laptop environment (physical/solid
 * — it's the environment, not floating UI); right is the glass form panel,
 * built from the exact same AuthField/Button primitives the auth forms use,
 * so it reads as another Compile Palace form rather than a page bolted on
 * later. Join semantics (state passed to /editor/:roomId) are unchanged.
 */
export function RoomJoinCard({
  roomId,
  username,
  onRoomIdChange,
  onUsernameChange,
  onJoin,
  onCreateRoom,
  onSignOut,
  joining = false,
}: RoomJoinCardProps) {
  const magnetic = useMagnetic<HTMLDivElement>({ strength: 10 });
  const laptopSlotRef = useRef<HTMLDivElement>(null);
  const { registerSlot, releaseSlot } = useRoomLaptopSlot();

  // RoomJoinCard mounts twice during Auth -> Room (Auth.tsx's transient
  // curtain-sweep preview, then the real page here on "/") — two separate
  // React trees. Rather than each rendering its own <LaptopIntro>, which
  // would restart the open/type/compile sequence from scratch on the real
  // mount (the "double open" glitch), this div is only a layout-reserving
  // placeholder: registering it hands RoomLaptopProvider's ONE persistent,
  // shared LaptopIntro (rendered once at the App root, never here) the
  // position to track, so it's already mid-animation right here for the
  // whole curtain sweep — not popping in fresh after the handoff. Releasing
  // on unmount (only if we're still the registered slot — a newer mount's
  // registration must win a race against our own cleanup) matters just as
  // much as registering, so the tracked position doesn't linger on a node
  // about to be detached.
  useEffect(() => {
    const el = laptopSlotRef.current;
    if (!el) return;
    registerSlot(el);
    return () => releaseSlot(el);
  }, [registerSlot, releaseSlot]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onJoin();
  };

  return (
    <div className="room-stage">
      <div className="room-stage__viewport">
        <div className="room-stage__laptop" ref={laptopSlotRef}>
          {/* Static, invisible spacer — NOT a second LaptopIntro. Reserves
              the exact box the real (overlaid) laptop occupies, open-state
              sized, so this now-otherwise-empty placeholder's measured rect
              (RoomLaptopContext's getBoundingClientRect polling) is correct.
              Plain CSS classes only, no JS state machine, so it can't itself
              become a second running instance. */}
          <div className="laptop-scene" style={{ visibility: "hidden" }} aria-hidden="true">
            <div className="laptop laptop--open">
              <div className="laptop__screen" />
              <div className="laptop__hinge" />
              <div className="laptop__base" />
            </div>
          </div>
        </div>

        <div className="room-stage__form glass-primary">
          <SignOutGlassButton onClick={onSignOut} />
          <div className="room-form">
            <h1 className="room-form__title">Join a room</h1>
            <p className="room-form__sub">Enter a room code and a name to start collaborating.</p>

            <form className="room-form__body" aria-label="Join room" onSubmit={handleSubmit}>
              <AuthField
                label="Room ID"
                name="roomId"
                icon={KeyRound}
                value={roomId}
                onChange={(e) => onRoomIdChange(e.target.value)}
                autoComplete="off"
                required
              />
              <AuthField
                label="Username"
                name="username"
                icon={UserIcon}
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                autoComplete="name"
                required
              />

              <div
                ref={magnetic.ref}
                className="room-form__submit-wrap"
                onMouseMove={magnetic.onMouseMove}
                onMouseLeave={magnetic.onMouseLeave}
              >
                <Button
                  type="submit"
                  className="room-form__submit cp-pill cp-lift cp-accent-bg text-white"
                  disabled={joining}
                >
                  {joining && <Loader2 size={16} className="animate-spin" />}
                  Join Room
                </Button>
              </div>

              <p className="room-form__hint">
                Don't have an invite?{" "}
                <button type="button" className="room-form__link" onClick={onCreateRoom}>
                  Create a new room
                </button>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
