
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner";
import { useIsMobile } from '@/hooks/use-mobile';

const Index = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = React.useState('');
  const [username, setUsername] = React.useState('');
  const isMobile = useIsMobile();

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
        Built with ❤️ by Compile Palace
      </footer>
    </div>
  );
};

export default Index;
