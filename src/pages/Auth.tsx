import { useState, useEffect } from 'react';
import { AuthCard, type AuthMode } from '@/components/auth/AuthCard';
import { useAuth } from '@/context/AuthContext';
import { useStageTransitionNavigate } from '@/hooks/use-stage-transition-navigate';

const Auth = () => {
  const navigate = useStageTransitionNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');

  useEffect(() => {
    // Auth -> Room: the login/register curtain, continued — the auth panel
    // sweeps itself off to reveal Room Join, not a rect reveal.
    // Keyed on user?.id (a stable primitive), not the `user`/session object
    // itself — Supabase's onAuthStateChange can fire more than once right
    // after login (SIGNED_IN, then a token refresh) with a new session
    // object each time even though the user hasn't actually changed, which
    // was re-running this effect and starting a second, redundant transition.
    if (!loading && user) navigate('/', { shape: 'curtain' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center cp-atmosphere relative overflow-hidden px-6 sm:px-8 py-10">
      <div className="relative z-10 w-full">
        <AuthCard mode={mode} onSwitch={setMode} />
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
        Built with ❤️ by Macrohard
      </footer>
    </div>
  );
};

export default Auth;
