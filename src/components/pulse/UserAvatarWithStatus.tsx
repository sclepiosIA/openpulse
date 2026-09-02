import { memo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { type PresenceStatus, PRESENCE_STATUS_CONFIG } from '@/types/pulse';
import { Calendar, BellOff } from 'lucide-react';

interface UserAvatarWithStatusProps {
  user: {
    id: string;
    avatar_url?: string | null;
    nom?: string;
    prenom?: string;
  };
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showStatus?: boolean;
  status?: PresenceStatus;
  customStatusText?: string | null;
  calendarEventTitle?: string | null;
  className?: string;
}

const SIZE_CLASSES = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

const BADGE_SIZE_CLASSES = {
  xs: 'h-2 w-2 -bottom-0 -right-0',
  sm: 'h-2.5 w-2.5 -bottom-0.5 -right-0.5',
  md: 'h-3 w-3 -bottom-0.5 -right-0.5',
  lg: 'h-3.5 w-3.5 -bottom-0.5 -right-0.5',
  xl: 'h-4 w-4 -bottom-1 -right-1',
};

const TEXT_SIZE_CLASSES = {
  xs: 'text-[10px]',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-lg',
};

function getInitials(nom?: string, prenom?: string): string {
  if (!nom && !prenom) return '?';
  return `${prenom?.[0] || ''}${nom?.[0] || ''}`.toUpperCase();
}

function getAvatarColor(str: string): string {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-orange-500",
    "bg-pink-500",
  ];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

export const UserAvatarWithStatus = memo(function UserAvatarWithStatus({
  user,
  size = 'md',
  showStatus = true,
  status = 'offline',
  customStatusText,
  calendarEventTitle,
  className,
}: UserAvatarWithStatusProps) {
  const displayName = `${user.prenom || ''} ${user.nom || ''}`.trim() || 'Membre';
  const colorClass = getAvatarColor(displayName);
  const statusConfig = PRESENCE_STATUS_CONFIG[status];

  const renderStatusBadge = () => {
    if (!showStatus) return null;

    const isInMeeting = status === 'in_meeting';
    const isDnd = status === 'dnd';
    const isOffline = status === 'offline';

    // For offline status, show a gray badge without tooltip animation
    if (isOffline) {
      return (
        <span 
          className={cn(
            "absolute flex items-center justify-center rounded-full border-2 border-background bg-gray-400",
            BADGE_SIZE_CLASSES[size]
          )}
        />
      );
    }

    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span 
              className={cn(
                "absolute flex items-center justify-center rounded-full border-2 border-background",
                BADGE_SIZE_CLASSES[size],
                statusConfig.bgColor
              )}
            >
              {isInMeeting && size !== 'xs' && size !== 'sm' && (
                <Calendar className="h-1.5 w-1.5 text-white" />
              )}
              {isDnd && size !== 'xs' && size !== 'sm' && (
                <BellOff className="h-1.5 w-1.5 text-white" />
              )}
              {status === 'active' && (
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{statusConfig.label}</span>
              {customStatusText && (
                <span className="text-muted-foreground">{customStatusText}</span>
              )}
              {calendarEventTitle && status === 'in_meeting' && (
                <span className="text-blue-500">{calendarEventTitle}</span>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className={cn("relative inline-flex", className)}>
      <Avatar className={cn(SIZE_CLASSES[size])}>
        {user.avatar_url && (
          <AvatarImage 
            src={user.avatar_url} 
            alt={displayName}
            className="object-cover"
          />
        )}
        <AvatarFallback 
          className={cn(
            "text-white font-medium",
            colorClass,
            TEXT_SIZE_CLASSES[size]
          )}
        >
          {getInitials(user.nom, user.prenom)}
        </AvatarFallback>
      </Avatar>
      {renderStatusBadge()}
    </div>
  );
});
