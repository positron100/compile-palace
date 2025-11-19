
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner";
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';

const Index = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = React.useState('');
  const [username, setUsername] = React.useState('');
  const isMobile = useIsMobile();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      // Fetch profile
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
    }
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
    navigate(`/editor/${roomId}`, {
      state: {
        username,
      },
    });
  };

  const handleInputEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      joinRoom();
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
  };

  // Redirect to auth if not logged in
  if (!user) {
    return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative overflow-hidden px-6 sm:px-8">
      <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 w-full max-w-md z-10">
        <div className="flex justify-between items-center mb-6">
          <div className="text-center flex-1">
            <h1 className="text-3xl font-bold text-gray-800">Compile Palace</h1>
            <p className="text-gray-600 mt-2">Welcome, {profile?.name || user?.email}</p>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={handleSignOut}
          >
            Sign Out
          </Button>
        </div>
          
          <p className="text-center text-gray-600 mb-4">
            Please sign in to continue
          </p>
          
          <Button 
            onClick={() => navigate('/auth')}
            className="w-full"
          >
            Sign In / Sign Up
          </Button>
        </div>
        
        {/* Animated background elements */}
        <div className="absolute inset-0 z-0">
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
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative overflow-hidden px-6 sm:px-8">
      <div className="bg-white rounded-lg shadow-lg p-6 sm:p-8 w-full max-w-md z-10">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Compile Palace</h1>
          <p className="text-gray-600 mt-2">Code together in real-time</p>
        </div>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="roomId" className="block text-sm font-medium text-gray-700">Room ID</label>
            <input
              type="text"
              id="roomId"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyUp={handleInputEnter}
            />
          </div>
          
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">Username</label>
            <input
              type="text"
              id="username"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyUp={handleInputEnter}
            />
          </div>
          
          <button 
            onClick={joinRoom}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Join Room
          </button>
          
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Don't have an invite? 
              <button 
                onClick={createNewRoom} 
                className="ml-1 text-indigo-600 hover:text-indigo-800 focus:outline-none"
              >
                Create a new room
              </button>
            </p>
          </div>
        </div>
      </div>
      
      {/* Animated background elements */}
      <div className="absolute inset-0 z-0">
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

export default Index;
