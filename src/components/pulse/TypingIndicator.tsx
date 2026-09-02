import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { PulseConversationMember } from '@/types/pulse';

interface TypingIndicatorProps {
  typingUserIds: string[];
  members: PulseConversationMember[];
}

export const TypingIndicator = memo(function TypingIndicator({
  typingUserIds,
  members,
}: TypingIndicatorProps) {
  if (typingUserIds.length === 0) return null;

  const typingUsers = typingUserIds
    .map(id => members.find(m => m.user_id === id)?.user)
    .filter(Boolean);

  if (typingUsers.length === 0) return null;

  const getTypingText = () => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0]?.prenom || 'Quelqu\'un'} écrit`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0]?.prenom} et ${typingUsers[1]?.prenom} écrivent`;
    }
    return `${typingUsers.length} personnes écrivent`;
  };

  const getInitials = (nom?: string, prenom?: string) => {
    if (!nom && !prenom) return '?';
    return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase();
  };

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Avatars des personnes qui écrivent - tailles réduites sur mobile */}
      <div className="flex -space-x-1 sm:-space-x-1.5">
        {typingUsers.slice(0, 2).map((user, index) => (
          <Avatar 
            key={user?.id || index} 
            className="h-5 w-5 sm:h-6 sm:w-6 border-[1.5px] sm:border-2 border-background"
          >
            {user?.avatar_url && (
              <AvatarImage src={user.avatar_url} alt={user?.prenom || ''} />
            )}
            <AvatarFallback className="text-[8px] sm:text-[10px] bg-muted">
              {getInitials(user?.nom, user?.prenom)}
            </AvatarFallback>
          </Avatar>
        ))}
        {typingUsers.length > 2 && (
          <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-muted border-[1.5px] sm:border-2 border-background flex items-center justify-center text-[8px] sm:text-[10px] font-medium">
            +{typingUsers.length - 2}
          </div>
        )}
      </div>

      {/* Animation des points */}
      <div className="flex items-center gap-0.5 bg-muted rounded-full px-1.5 sm:px-2 py-0.5 sm:py-1">
        <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-muted-foreground rounded-full animate-bounce" />
      </div>

      {/* Texte - masqué sur xs */}
      <span className="text-xs hidden sm:inline truncate max-w-[120px] md:max-w-[180px]">
        {getTypingText()}...
      </span>
    </div>
  );
});
