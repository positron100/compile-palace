import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ClientProps {
  username: string;
}

const Client: React.FC<ClientProps> = ({ username }) => {
  // Generate a consistent color based on username
  const getColorFromUsername = (name: string) => {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
      'bg-pink-500', 'bg-purple-500', 'bg-indigo-500',
      'bg-red-500', 'bg-orange-500', 'bg-teal-500'
    ];
    
    // Simple hash function to get consistent color for same username
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
    return colors[hash % colors.length];
  };

  // Get initials from username (first letter or first two letters)
  const getInitials = (name: string) => {
    if (!name) return '?';
    
    // If username contains spaces, use first letter of each word
    if (name.includes(' ')) {
      return name
        .split(' ')
        .map(part => part.charAt(0).toUpperCase())
        .join('')
        .slice(0, 2);
    }
    
    // Otherwise return first 1-2 characters
    return name.length > 1 
      ? name.substring(0, 2).toUpperCase() 
      : name.charAt(0).toUpperCase();
  };

  const avatarColor = getColorFromUsername(username || 'User');

  return (
    <div className="flex flex-col items-center gap-1 my-1">
      <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
        <AvatarFallback className={`${avatarColor} text-white text-sm font-semibold`}>
          {getInitials(username)}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs text-purple-700 font-medium truncate max-w-[60px]">
        {username || 'User'}
      </span>
    </div>
  );
};

export default Client;
