import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/notifications/usePushNotifications';
import { cn } from '@/lib/utils';
import { safeStorage } from '@/lib/safeStorage';

interface PushNotificationPromptProps {
  className?: string;
  variant?: 'banner' | 'card' | 'minimal';
}

export function PushNotificationPrompt({ 
  className, 
  variant = 'banner' 
}: PushNotificationPromptProps) {
  const { isSupported, permission, isSubscribed, isLoading, subscribe, isApercuTiersPreview } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // If user already granted permission and subscribed before, never show again
    const hasSubscribedBefore = safeStorage.getItem('push-subscribed-once') === 'true';
    if (permission === 'granted' && hasSubscribedBefore) {
      return;
    }

    // Check if already dismissed recently (30 days instead of 7)
    const dismissedAt = safeStorage.getItem('push-prompt-dismissed');
    if (dismissedAt) {
      const daysSinceDismissed = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 30) {
        setDismissed(true);
        return;
      }
    }

    // Show after a delay if conditions are met
    const timer = setTimeout(() => {
      if (isSupported && !isSubscribed && permission !== 'denied' && !isLoading) {
        setShow(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [isSupported, isSubscribed, permission, isLoading]);

  // A11y : fermeture clavier Escape (cf. audit v3-azure 214428Z #24/#25)
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
     
  }, [show]);

  const handleDismiss = () => {
    setDismissed(true);
    setShow(false);
    safeStorage.setItem('push-prompt-dismissed', Date.now().toString());
  };

  const handleSubscribe = async () => {
    const success = await subscribe();
    if (success) {
      setShow(false);
      safeStorage.setItem('push-subscribed-once', 'true');
    }
  };

  // Don't show in aperçu tiers, if Notification not supported, or if already subscribed/denied
  const notificationSupported = typeof window !== 'undefined' && 'Notification' in window;
  const hasSubscribedBefore = safeStorage.getItem('push-subscribed-once') === 'true';
  if (!show || dismissed || isSubscribed || permission === 'denied' || isApercuTiersPreview || !notificationSupported || (permission === 'granted' && hasSubscribedBefore)) {
    return null;
  }

  if (variant === 'minimal') {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSubscribe}
        className={cn('gap-2', className)}
      >
        <Bell className="h-4 w-4" />
        Activer les notifications
      </Button>
    );
  }

  if (variant === 'card') {
    return (
      <Card className={cn('relative', className)}>
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-6 w-6"
          onClick={handleDismiss} aria-label="Fermer">
          <X className="h-4 w-4" />
        </Button>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <h4 className="font-semibold">Restez informé</h4>
              <p className="text-sm text-muted-foreground">
                Recevez des notifications pour les nouveaux emails, tâches et alertes importantes.
              </p>
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSubscribe}>
                  Activer
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss}>
                  Plus tard
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Banner variant (default)
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="push-prompt-title"
      aria-describedby="push-prompt-desc"
      className={cn(
        'fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50',
        'animate-in slide-in-from-bottom-4 duration-300',
        className
      )}>
      <Card className="border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2 shrink-0">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p id="push-prompt-title" className="text-sm font-medium">Activer les notifications push ?</p>
              <p id="push-prompt-desc" className="text-xs text-muted-foreground truncate">
                Emails, tâches et alertes en temps réel
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" onClick={handleSubscribe}>
                Activer
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleDismiss} aria-label="Fermer">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
