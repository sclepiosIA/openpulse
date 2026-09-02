import { Bell, Mail, CheckSquare, Sparkles, Calendar, Wallet, Clock, Send, Smartphone, Info } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { usePushNotifications } from '@/hooks/notifications/usePushNotifications';
import { Skeleton } from '@/components/ui/skeleton';
import { useProductionUrl } from '@/hooks/shared/useAppConfig';

export function PushPreferencesPanel() {
  const productionUrl = useProductionUrl();
  const {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    preferences,
    subscribe,
    unsubscribe,
    updatePreferences,
    sendTestNotification,
    isSendingTest,
    isIOSSafari,
    isIOSPWA,
    iosWebPushSupported,
    needsPWAInstall,
    isApercuTiersPreview,
  } = usePushNotifications();

  // Show warning in aperçu tiers
  if (isApercuTiersPreview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications Push
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="mt-2">
              <p className="font-medium mb-2">un aperçu tiers</p>
              <p className="text-sm text-muted-foreground mb-3">
                Les notifications push ne fonctionnent pas dans un aperçu tiers car le Service Worker est désactivé.
              </p>
              <a 
                href={`${productionUrl}/parametres`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline font-medium"
              >
                Testez sur le site déployé →
              </a>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications Push
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  // iOS Safari but not installed as PWA
  if (needsPWAInstall) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications Push
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription className="mt-2">
              <p className="font-medium mb-2">Installation requise sur iOS</p>
              <p className="text-sm text-muted-foreground mb-3">
                Pour recevoir des notifications push sur votre iPhone/iPad, vous devez d'abord installer l'application sur votre écran d'accueil :
              </p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Appuyez sur le bouton de partage <span className="inline-block px-1 bg-muted rounded">⬆</span></li>
                <li>Faites défiler et sélectionnez <strong>"Sur l'écran d'accueil"</strong></li>
                <li>Appuyez sur <strong>"Ajouter"</strong></li>
                <li>Ouvrez l'application depuis l'écran d'accueil</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // iOS Safari but version too old
  if (isIOSSafari && !iosWebPushSupported && !isIOSPWA) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications Push
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium">iOS 16.4 ou supérieur requis</p>
              <p className="text-sm mt-1">
                Les notifications push nécessitent iOS 16.4 ou une version plus récente. 
                Veuillez mettre à jour votre appareil dans Réglages → Général → Mise à jour logicielle.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications Push
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Les notifications push ne sont pas supportées par votre navigateur.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (permission === 'denied') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications Push
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <p className="font-medium">Notifications bloquées</p>
              <p className="text-sm mt-1">
                Les notifications sont bloquées. Pour les activer, cliquez sur l'icône de cadenas 
                dans la barre d'adresse de votre navigateur, puis autorisez les notifications.
              </p>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notifications Push
        </CardTitle>
        <CardDescription>
          Recevez des alertes en temps réel directement sur votre appareil
          {isIOSPWA && (
            <span className="block text-xs mt-1 text-green-600 dark:text-green-400">
              ✓ Application installée sur iOS
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="font-medium">
              {isSubscribed ? 'Notifications activées' : 'Notifications désactivées'}
            </Label>
            <p className="text-sm text-muted-foreground">
              {isSubscribed 
                ? 'Vous recevez des notifications push'
                : 'Activez pour recevoir des notifications'}
            </p>
          </div>
          {isSubscribed ? (
            <Button variant="outline" size="sm" onClick={unsubscribe}>
              Désactiver
            </Button>
          ) : (
            <Button size="sm" onClick={subscribe}>
              Activer
            </Button>
          )}
        </div>

        {isSubscribed && preferences && (
          <>
            <Separator />
            
            {/* Test notification button */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="space-y-0.5">
                <Label className="font-medium">Tester les notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Envoyez une notification de test pour vérifier que tout fonctionne
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={sendTestNotification}
                disabled={isSendingTest}
              >
                <Send className="h-4 w-4 mr-2" />
                {isSendingTest ? 'Envoi...' : 'Tester'}
              </Button>
            </div>

            <Separator />
            
            {/* Notification types */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Types de notifications</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="email-notifs">Nouveaux emails</Label>
                  </div>
                  <Switch
                    id="email-notifs"
                    checked={preferences.email_notifications}
                    onCheckedChange={(checked) => 
                      updatePreferences({ email_notifications: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckSquare className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="task-notifs">Tâches assignées</Label>
                  </div>
                  <Switch
                    id="task-notifs"
                    checked={preferences.task_notifications}
                    onCheckedChange={(checked) => 
                      updatePreferences({ task_notifications: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="ai-notifs">Suggestions IA</Label>
                  </div>
                  <Switch
                    id="ai-notifs"
                    checked={preferences.ai_suggestions}
                    onCheckedChange={(checked) => 
                      updatePreferences({ ai_suggestions: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="calendar-notifs">Rappels calendrier</Label>
                  </div>
                  <Switch
                    id="calendar-notifs"
                    checked={preferences.calendar_reminders}
                    onCheckedChange={(checked) => 
                      updatePreferences({ calendar_reminders: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor="treasury-notifs">Alertes trésorerie</Label>
                  </div>
                  <Switch
                    id="treasury-notifs"
                    checked={preferences.treasury_alerts}
                    onCheckedChange={(checked) => 
                      updatePreferences({ treasury_alerts: checked })
                    }
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Quiet hours */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h4 className="text-sm font-medium">Heures calmes (optionnel)</h4>
              </div>
              <p className="text-xs text-muted-foreground">
                Aucune notification pendant cette période
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="quiet-start" className="text-xs">Début</Label>
                  <Input
                    id="quiet-start"
                    type="time"
                    value={preferences.quiet_hours_start || ''}
                    onChange={(e) => 
                      updatePreferences({ quiet_hours_start: e.target.value || null })
                    }
                    className="h-9"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="quiet-end" className="text-xs">Fin</Label>
                  <Input
                    id="quiet-end"
                    type="time"
                    value={preferences.quiet_hours_end || ''}
                    onChange={(e) => 
                      updatePreferences({ quiet_hours_end: e.target.value || null })
                    }
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
