
import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';

interface ClientProps {
  username: string;
}

const Client: React.FC<ClientProps> = ({ username }) => {
  const isMobile = useIsMobile();
  
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
  const initials = getInitials(username);

  // Use tooltip for longer usernames to show the full name on hover
  return (
    <TooltipProvider>
      <div className="flex flex-col items-center gap-1 my-1 px-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className={`${isMobile ? 'h-8 w-8' : 'h-10 w-10'} border-2 border-white shadow-sm hover:scale-110 transition-transform cursor-pointer`}>
              <AvatarFallback className={`${avatarColor} text-white text-sm font-semibold rounded-full`}>
                {initials}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side={isMobile ? "bottom" : "right"} className="rounded-lg bg-white border border-purple-100 shadow-lg">
            {username || 'User'}
          </TooltipContent>
        </Tooltip>
        <span className={`text-xs text-purple-700 font-medium truncate ${isMobile ? 'max-w-[50px]' : 'max-w-[60px] md:max-w-[80px]'}`}>
          {username || 'User'}
        </span>
      </div>
    </TooltipProvider>
  );
};

export default Client;
