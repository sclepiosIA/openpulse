import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users } from 'lucide-react';

interface ConnectedUser {
  user_id: string;
  user_name: string;
  user_avatar?: string;
  user_color: string;
}

interface CollaborativeCursorsProps {
  connectedUsers: ConnectedUser[];
  isConnected: boolean;
}

export function CollaborativeCursors({ connectedUsers, isConnected }: CollaborativeCursorsProps) {
  if (!isConnected && connectedUsers.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5">
        {/* Connection indicator */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-500' : 'bg-destructive'
            }`}
          />
          <span className="hidden sm:inline">
            {isConnected ? 'Connecté' : 'Déconnecté'}
          </span>
        </div>

        {/* Stacked avatars */}
        {connectedUsers.length > 0 && (
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {connectedUsers.slice(0, 4).map((u) => (
                <Tooltip key={u.user_id}>
                  <TooltipTrigger asChild>
                    <Avatar
                      className="h-6 w-6 border-2 border-background"
                      style={{ boxShadow: `0 0 0 2px ${u.user_color}` }}
                    >
                      {u.user_avatar && <AvatarImage src={u.user_avatar} alt={u.user_name} />}
                      <AvatarFallback
                        className="text-[10px] font-medium text-white"
                        style={{ backgroundColor: u.user_color }}
                      >
                        {getInitials(u.user_name)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {u.user_name}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>

            {connectedUsers.length > 4 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-0.5 ml-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    +{connectedUsers.length - 4}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {connectedUsers.slice(4).map(u => u.user_name).join(', ')}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
