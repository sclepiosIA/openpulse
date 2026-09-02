import React, { useEffect } from 'react';
import { useOfflineStatus } from '@/hooks/shared/useOfflineStatus';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/shared/use-toast';

export function OfflineIndicator() {
  const { isOnline, isOffline, wasOffline } = useOfflineStatus();
  const { toast } = useToast();

  useEffect(() => {
    if (isOffline) {
      toast({
        title: 'Hors ligne',
        description: 'Vous êtes actuellement hors ligne. Certaines fonctionnalités peuvent être limitées.',
        variant: 'destructive',
        duration: 5000,
      });
    } else if (wasOffline) {
      toast({
        title: 'Reconnecté',
        description: 'Vous êtes de nouveau en ligne.',
        className: 'bg-success text-success-foreground',
        duration: 3000,
      });
    }
  }, [isOnline, isOffline, wasOffline, toast]);

  if (isOnline) return null;

  return (
    <div className={cn(
      'fixed top-0 left-0 right-0 z-[100]',
      'bg-destructive text-destructive-foreground',
      'px-4 py-2',
      'flex items-center justify-center gap-2',
      'text-sm font-medium',
      'shadow-lg',
      'animate-slide-in-top'
    )}>
      <WifiOff className="h-4 w-4" />
      <span>Hors ligne</span>
    </div>
  );
}
