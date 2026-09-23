import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthCard, type AuthMode } from '@/components/auth/AuthCard';
import { RoomJoinCard } from '@/components/room/RoomJoinCard';
import { useAuth } from '@/context/AuthContext';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

const Auth = () => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  // 'mounting': Room Join content is in the DOM at its off-screen resting
  // position, still on the login/register curtain state — gives the CSS
  // transition a "before" frame. 'active': data-mode flips to "room" on the
  // next paint, so the curtain actually sweeps. Two ticks, same trick
  // login/register already rely on by staying mounted from the start.
  const [roomPhase, setRoomPhase] = useState<'none' | 'mounting' | 'active'>('none');
  // Which side the sweep is FROM — read once when the transform starts, not
  // live off `mode` (the user could keep flipping login/register after the
  // sweep begins; the curtain's direction shouldn't follow that).
  const roomEntryRef = useRef<AuthMode>('login');
  // True once this component has observed itself unauthenticated — the only
  // circumstance under which a later `user` becoming truthy means "a
  // login/signup just happened here", as opposed to landing on /auth by
  // direct URL while already signed in (item 9: don't force the transform
  // for that case).
  const wasUnauthedRef = useRef(!user);
  const handedOffRef = useRef(false);

  useEffect(() => {
    if (loading || handedOffRef.current) return;
    if (!user) {
      wasUnauthedRef.current = true;
      return;
    }
    handedOffRef.current = true;
    if (!wasUnauthedRef.current || reduceMotion) {
      // Already authenticated on arrival (direct /auth visit), or reduced
      // motion — land on Room Join directly, no transform.
      navigate('/', { replace: true });
      return;
    }
    // A login/signup just completed in this session: reuse the exact same
    // curtain choreography AuthCard already uses for Login <-> Register,
    // sweeping to reveal Room Join instead of the other auth form. See
    // AuthCard.css's `[data-mode="room"]` rules.
    roomEntryRef.current = mode;
    setRoomPhase('mounting');
    const raf = requestAnimationFrame(() => setRoomPhase('active'));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading, reduceMotion, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center cp-atmosphere relative overflow-hidden px-6 sm:px-8 py-10">
      <div className="relative z-10 w-full">
        <AuthCard
          mode={mode}
          onSwitch={setMode}
          roomStage={roomPhase === 'none' ? null : { entry: roomEntryRef.current, active: roomPhase === 'active' }}
          roomContent={
            roomPhase === 'none' ? null : (
              // A visual double for the sweep's destination frame — its
              // fields/handlers are inert (this instance is gone within
              // --dur-room, handed off to the real, stateful RoomJoinCard
              // Index.tsx renders on "/"). Its laptop area registers as the
              // current slot for the one persistent, shared LaptopIntro
              // (RoomLaptopContext — a fixed overlay that tracks this slot's
              // position, not a portal reparented into it), so the laptop is
              // already part of this composition, mid-animation, for the
              // whole curtain sweep — not popping in after the handoff. When
              // Index.tsx's RoomJoinCard mounts moments later it registers
              // its own slot instead; same LaptopIntro instance throughout.
              <RoomJoinCard
                roomId=""
                username=""
                onRoomIdChange={() => {}}
                onUsernameChange={() => {}}
                onJoin={() => {}}
                onCreateRoom={() => {}}
                onSignOut={() => {}}
              />
            )
          }
          onRoomRevealed={() => navigate('/', { replace: true })}
        />
      </div>

      {/* Subtle environmental layer — ambience, not the main visual story */}
      <div className="absolute inset-0 z-0 opacity-40">
        <ul className="squares">
          {Array.from({ length: 10 }).map((_, idx) => (
            <li
              key={idx}
              style={{
                "--i": Math.random() * 10 + 1,
                "--j": Math.random() * 7 + 1,
              } as React.CSSProperties}
              className="bg-indigo-500/20 absolute list-none rounded-lg animate-float"
            />
          ))}
        </ul>
      </div>

      <footer className="absolute bottom-4 text-center w-full text-sm text-gray-600 z-10">
        Built with ❤️ by Mukul
      </footer>
    </div>
  );
};

export default Auth;
