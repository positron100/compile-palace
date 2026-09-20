
import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LaptopIntro } from '@/components/start/LaptopIntro';
import { RoomJoinCard } from '@/components/room/RoomJoinCard';
import { useMagnetic } from '@/hooks/use-magnetic';
import { useAuth } from '@/context/AuthContext';
import { useStageTransitionNavigate } from '@/hooks/use-stage-transition-navigate';

const Index = () => {
  const navigate = useStageTransitionNavigate();
  const { user, loading } = useAuth();
  const [roomId, setRoomId] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [profile, setProfile] = useState<any>(null);
  const ctaMagnetic = useMagnetic<HTMLButtonElement>({ strength: 10 });
  const signingOutRef = useRef(false);

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
    const id = uuidv4();
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

  const handleSignOut = async (e: React.MouseEvent<HTMLButtonElement>) => {
    // A fast double-click (or the magnetic wrapper re-firing) called this
    // twice in a row: the first signOut() succeeds and clears the local
    // session, the second then fails with "Auth session missing!" — a
    // confusing error toast for something that's already the desired state.
    if (signingOutRef.current) return;
    signingOutRef.current = true;

    const r = e.currentTarget.getBoundingClientRect();
    const origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    const { error } = await supabase.auth.signOut();
    // Reset unconditionally: this component stays mounted across the sign-out
    // (same "/" route, just re-renders unauthenticated), so a guard that only
    // clears on the error path stays stuck "true" forever after any
    // successful sign-out, silently blocking every sign-out after the first.
    signingOutRef.current = false;
    if (error) {
      // No local session to sign out of == already logged out. Treat as
      // success rather than surfacing an error for a state the user already
      // wants.
      if (!/auth session missing/i.test(error.message)) {
        toast.error(error.message);
        return;
      }
    }
    // AuthContext's SIGNED_OUT event is authoritative for auth state; this
    // navigate only decides where the now-unauthenticated app lands. Room
    // Join's sign-out returns to the starting page (this same route renders
    // the start screen once unauthenticated) via the circular reveal in
    // reverse — the current screen closes back into the start environment,
    // same choreography as CloudBook's theme toggle played backward.
    navigate('/', { shape: 'circle', direction: 'reverse', origin, replace: true });
  };

  // Auth state is still restoring — avoid a flash of the wrong screen.
  if (loading) return null;

  // Starting screen: laptop/code intro leading into the auth experience
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center cp-atmosphere relative overflow-hidden px-6 sm:px-8 py-10">
        <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-md">
          <LaptopIntro />

          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Compile Palace</h1>
            <p className="text-gray-600 mt-2">A collaborative coding environment — spin up a room and ship together.</p>
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
            className="cp-pill cp-lift h-16 w-16 p-0 bg-indigo-600 text-white hover:bg-indigo-700"
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
    <div className="min-h-screen flex flex-col items-center justify-center cp-atmosphere relative overflow-hidden px-6 sm:px-8 py-10">
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

      <footer className="relative z-10 text-center text-sm text-gray-600 mt-6">
        Built with ❤️ by Macrohard
      </footer>
    </div>
  );
};

export default Index;
