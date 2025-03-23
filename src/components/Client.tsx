
import React from 'react';

interface ClientProps {
  username: string;
}

const Client: React.FC<ClientProps> = ({ username }) => {
  // Create a simple avatar with the first letter of the username
  const firstLetter = username.charAt(0).toUpperCase();
  
  return (
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 rounded-full bg-white text-amber-500 flex items-center justify-center font-bold text-lg">
        {firstLetter}
      </div>
      <span className="mt-1 text-sm font-medium text-white">{username}</span>
    </div>
  );
};

export default Client;
