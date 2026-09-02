import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Clock, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface LastSyncIndicatorProps {
  lastSyncAt: string | null;
  className?: string;
  showLabel?: boolean;
}

type SyncStatus = 'fresh' | 'recent' | 'stale' | 'old';

function getSyncStatus(lastSyncAt: string | null): SyncStatus {
  if (!lastSyncAt) return 'old';
  
  const lastSync = new Date(lastSyncAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - lastSync.getTime()) / (1000 * 60);
  
  if (diffMinutes < 15) return 'fresh';
  if (diffMinutes < 60) return 'recent';
  if (diffMinutes < 180) return 'stale';
  return 'old';
}

const statusConfig: Record<SyncStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  fresh: { 
    icon: CheckCircle2, 
    color: 'text-green-600 dark:text-green-400',
    label: 'À jour'
  },
  recent: { 
    icon: Clock, 
    color: 'text-amber-600 dark:text-amber-400',
    label: 'Récent'
  },
  stale: { 
    icon: AlertTriangle, 
    color: 'text-orange-600 dark:text-orange-400',
    label: 'Ancien'
  },
  old: { 
    icon: AlertCircle, 
    color: 'text-red-600 dark:text-red-400',
    label: 'Sync requise'
  },
};

export function LastSyncIndicator({ lastSyncAt, className, showLabel = true }: LastSyncIndicatorProps) {
  const [, setTick] = useState(0);
  
  // Actualiser l'affichage toutes les minutes
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);
  
  const status = getSyncStatus(lastSyncAt);
  const config = statusConfig[status];
  const Icon = config.icon;
  
  const formattedDate = lastSyncAt 
    ? new Date(lastSyncAt).toLocaleString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      })
    : 'Jamais synchronisé';
  
  const relativeTime = lastSyncAt 
    ? formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true, locale: fr })
    : null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn(
          "flex items-center gap-1.5 text-xs cursor-default",
          config.color,
          className
        )}>
          <Icon className="h-3.5 w-3.5" />
          {showLabel && (
            <span className="hidden sm:inline">
              {relativeTime || config.label}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <p className="font-medium">Dernière synchronisation</p>
        <p className="text-muted-foreground">{formattedDate}</p>
      </TooltipContent>
    </Tooltip>
  );
}
