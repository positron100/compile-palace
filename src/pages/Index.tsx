
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate as useRouterNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LaptopIntro } from '@/components/start/LaptopIntro';
import { RoomJoinCard } from '@/components/room/RoomJoinCard';
import { useMagnetic } from '@/hooks/use-magnetic';
import { useAuth } from '@/context/AuthContext';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useStageTransitionNavigate } from '@/hooks/use-stage-transition-navigate';
import { startStageTransition, supportsViewTransitions } from '@/lib/stageTransition';
import { BrandLogo } from '@/components/BrandLogo';

const Index = () => {
  const navigate = useStageTransitionNavigate();
  const routerNavigate = useRouterNavigate();
  const reduceMotion = useReducedMotion();
  const { user, loading } = useAuth();
  const [roomId, setRoomId] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [profile, setProfile] = useState<any>(null);
  const ctaMagnetic = useMagnetic<HTMLButtonElement>({ strength: 10 });
  const signingOutRef = useRef(false);
  // Sign-out doesn't change route (Room Join and Start both render at "/"),
  // so the swap is driven by AuthContext's `user` flipping to null — which
  // happens on Supabase's own async auth-state-change event, outside our
  // control and NOT synchronized with the view transition's flushSync. Left
  // alone, that repaint lands before startStageTransition even captures its
  // "old" snapshot: Start Screen flashes in first, then the circle plays over
  // an already-revealed page. Holding the Room Join render here — regardless
  // of what `user` says — until our own flushSync releases it keeps the
  // "old" snapshot correct, so the circle is what actually reveals Start.
  const [holdRoomView, setHoldRoomView] = useState(false);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setProfile(data);
        if (data?.name) {
          setUsername(data.name);
        }
      });
  }, [user]);

  const createNewRoom = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    // 15 hex chars off a v4 UUID (plenty of entropy for a room code),
    // grouped 5-5-5 for readability — e.g. "a1b2c-3d4e5-f6a7b".
    const id = uuidv4().replace(/-/g, "").slice(0, 15).match(/.{1,5}/g)!.join("-");
    setRoomId(id);
    // Set toast duration to 3 seconds (3000ms)
    toast.success("New Room Created", { duration: 3000 });
  };

  const joinRoom = () => {
    if (!roomId || !username) {
      toast.error("Room ID and username required", { duration: 3000 });
      return;
    }
    // Room -> Editor: TextUtils' square -> horizontal band -> full reveal.
    navigate(`/editor/${roomId}`, {
      shape: 'rect',
      state: {
        username,
      },
    });
  };

  const handleSignOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    // A fast double-click (or the magnetic wrapper re-firing) called this
    // twice in a row: the first signOut() succeeds and clears the local
    // session, the second then fails with "Auth session missing!" — a
    // confusing error toast for something that's already the desired state.
    if (signingOutRef.current) return;
    signingOutRef.current = true;

    const r = e.currentTarget.getBoundingClientRect();
    const origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    // Hold Room Join on screen before signing out — the moment
    // supabase.auth.signOut() resolves, AuthContext's own listener flips
    // `user` to null on its own schedule, independent of the reveal below.
    setHoldRoomView(true);

    // AuthContext's SIGNED_OUT event is authoritative for auth state; this
    // only decides where the now-unauthenticated app lands. Room Join's
    // sign-out returns to the starting page (this same route renders the
    // start screen once unauthenticated) via the same forward-growing circle
    // as Start -> Auth. Releasing the hold has to happen inside the same
    // flushSync as the router navigate — otherwise the two repaints
    // (Room Join -> Start) land on either side of the transition's captured
    // snapshots instead of inside it, and the circle plays over a page
    // that's already switched.
    const release = () => {
      setHoldRoomView(false);
      routerNavigate('/', { replace: true });
    };
    // The circle starts on click, not after the network round trip —
    // supabase.auth.signOut() runs alongside it instead of gating it, so
    // there's no longer a dead beat between the click and the animation
    // starting. If it genuinely fails (not just "already signed out"), the
    // AuthContext session never flips and this route re-renders Room Join
    // again once the circle settles, with the toast explaining why.
    if (reduceMotion || !supportsViewTransitions()) {
      release();
    } else {
      // Slower than Start -> Auth's own 900ms default (stageTransition.ts) —
      // same circle, same easing, just more deliberate here so sign-out
      // doesn't feel like a snap.
      void startStageTransition('circle', 'forward', origin, release, 1300);
    }

    void supabase.auth.signOut().then(({ error }) => {
      // Reset unconditionally: this component stays mounted across the
      // sign-out (same "/" route, just re-renders unauthenticated), so a
      // guard that only clears on the error path stays stuck "true" forever
      // after any successful sign-out, silently blocking every sign-out
      // after the first.
      signingOutRef.current = false;
      // No local session to sign out of == already logged out. Treat as
      // success rather than surfacing an error for a state the user already
      // wants.
      if (error && !/auth session missing/i.test(error.message)) {
        toast.error(error.message);
      }
    });
  };

  // Auth state is still restoring — avoid a flash of the wrong screen.
  if (loading) return null;

  // Starting screen: laptop/code intro leading into the auth experience.
  // `holdRoomView` keeps Room Join rendered a beat past `user` going null so
  // the sign-out circle (handleSignOut above) is what visibly reveals this.
  if (!user && !holdRoomView) {
    return (
      <div className="min-h-screen flex items-center justify-center cp-atmosphere relative overflow-hidden px-6 sm:px-8 py-10">
        <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-md">
          <LaptopIntro />

          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center justify-center gap-2">
              <BrandLogo size={32} className="rounded-md" />
              Compile Palace
            </h1>
            <p className="text-muted-foreground mt-2">A collaborative coding environment — spin up a room and ship together.</p>
          </div>

          <Button
            ref={ctaMagnetic.ref}
            onMouseMove={ctaMagnetic.onMouseMove}
            onMouseLeave={ctaMagnetic.onMouseLeave}
            onClick={(e) => {
              // Origin = the CTA's own resting centre, backing out the
              // magnetic hook's `translate` drift — same model as
              // CloudBook's ThemeToggle (reveal starts from the control,
              // not the raw click point or its currently-drifted position).
              const el = e.currentTarget;
              const r = el.getBoundingClientRect();
              let x = r.left + r.width / 2;
              let y = r.top + r.height / 2;
              const [dx, dy] = el.style.translate.split(" ").map((v) => parseFloat(v) || 0);
              x -= dx || 0;
              y -= dy || 0;
              navigate('/auth', { shape: 'circle', origin: { x, y } });
            }}
            aria-label="Sign in or sign up"
            title="Sign in or sign up"
            className="cp-pill cp-lift cp-accent-bg h-16 w-16 p-0 text-white"
            size="lg"
          >
            <ArrowRight size={22} />
          </Button>
        </div>

        {/* Subtle environmental layer — no longer the main visual story */}
        <div className="absolute inset-0 z-0 opacity-40">
          <ul className="squares">
            {Array.from({ length: 6 }).map((_, idx) => (
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
          Built with ❤️ by Macrohard
        </footer>
      </div>
    );
  }

  return (
    // Same wrapper shape as Auth.tsx's (items-center, no flex-col, footer
    // taken OUT of flow) — not a coincidence: the Auth -> Room transform
    // holds RoomJoinCard inside Auth's own centered box mid-sweep, then hands
    // off here. An in-flow footer here (mt-6, part of the flex column) would
    // consume vertical space Auth's centering never accounted for, shifting
    // the whole centered group up the instant this page took over — a real,
    // measured 22px jump (auth-stage__viewport y=178 -> room-stage__viewport
    // y=156), not a rounding artifact. Matching the wrapper exactly removes
    // the discrepancy instead of papering over it with an offset.
    <div className="min-h-screen flex items-center justify-center cp-atmosphere relative overflow-hidden px-6 sm:px-8 py-10">
      <div className="relative z-10 w-full">
        <RoomJoinCard
          roomId={roomId}
          username={username}
          onRoomIdChange={setRoomId}
          onUsernameChange={setUsername}
          onJoin={joinRoom}
          onCreateRoom={createNewRoom}
          onSignOut={handleSignOut}
        />
      </div>

      {/* Subtle environmental layer */}
      <div className="absolute inset-0 z-0 opacity-40">
        <ul className="squares">
          {Array.from({ length: 6 }).map((_, idx) => (
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
        Built with ❤️ by Macrohard
      </footer>
    </div>
  );
};

export default Index;
