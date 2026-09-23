import React from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ModernTooltip } from '@/components/ModernTooltip';
import { useLiquidGlass } from '@/hooks/use-liquid-glass';

interface ClientProps {
  username: string;
  socketId?: string;
  isYou?: boolean;
}

const Client: React.FC<ClientProps> = ({ username, socketId, isYou = false }) => {
  // Section 6/7 — the per-user gradient hash is gone: idle now uses one
  // quiet accent tint (`.editor-avatar` in EditorPage.css) rather than a
  // rainbow of per-user gradients, since identity is already carried by the
  // initials/tooltip, not by hue. Section 8 reuses the same liquid-glass
  // interaction every other control uses instead of a bespoke hover.
  const liquid = useLiquidGlass<HTMLSpanElement>({ strength: 4 });

  // Get initials from username
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

  const initials = getInitials(username);

  // Ensure the component only renders when we have a valid username
  if (!username) {
    return null;
  }

  return (
    <ModernTooltip content={isYou ? `${username} (You)` : username}>
      <Avatar
        key={socketId || username}
        ref={liquid.ref}
        onMouseMove={liquid.onMouseMove}
        onMouseLeave={liquid.onMouseLeave}
        tabIndex={0}
        className="cp-liquid editor-avatar h-9 w-9 shrink-0"
        aria-label={isYou ? `${username} (you)` : username}
      >
        <AvatarFallback className="editor-avatar__fallback text-xs font-semibold" style={{ background: 'transparent' }}>
          {initials}
        </AvatarFallback>
      </Avatar>
    </ModernTooltip>
  );
};

export default Client;
