# Guide Technique - Notifications Push

Documentation technique complète du système de notifications push Web Push OpenPulse.

## Table des Matières

- [Vue d'Ensemble](#vue-densemble)
- [Configuration VAPID](#configuration-vapid)
- [Architecture](#architecture)
- [Support iOS](#support-ios)
- [Schéma de Données](#schéma-de-données)
- [Déclencheurs](#déclencheurs)
- [Composants React](#composants-react)
- [Edge Functions](#edge-functions)
- [Service Worker](#service-worker)

---

## Vue d'Ensemble

Le système de notifications push utilise l'API Web Push standard avec chiffrement VAPID :

- **Web Push Protocol** : RFC 8030
- **Chiffrement** : VAPID (RFC 8292) + aes128gcm
- **Support** : Chrome, Firefox, Safari 16.4+, Edge
- **iOS** : Supporté via PWA (iOS 16.4+)

---

## Configuration VAPID

### Clés VAPID

Les clés VAPID authentifient le serveur auprès des push services. Elles doivent être configurées via Supabase Secrets.

```typescript
// Configuration via Supabase Secrets (Dashboard > Project Settings > Secrets)
// Generate with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE'
VAPID_PRIVATE_KEY = 'YOUR_VAPID_PRIVATE_KEY_HERE'
VAPID_SUBJECT = 'mailto:contact@exploitant.example.org'
```

### Génération de Nouvelles Clés

```bash
npx web-push generate-vapid-keys
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ÉVÉNEMENT DÉCLENCHEUR                         │
│  (Nouvel email, Tâche assignée, Ticket support, etc.)           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              send-push-notification Edge Function                │
│                                                                  │
│  1. Récupère les subscriptions de l'utilisateur                 │
│  2. Pour chaque subscription:                                    │
│     a. Génère le header VAPID (JWT signé)                       │
│     b. Chiffre le payload (aes128gcm + ECDH)                    │
│     c. POST vers push endpoint (FCM, APNs, Mozilla)             │
│  3. Supprime les subscriptions expirées (410 Gone)              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PUSH SERVICE                                  │
│              (FCM, APNs, Mozilla Push)                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICE WORKER                                │
│                                                                  │
│  1. Reçoit l'événement 'push'                                   │
│  2. Déchiffre et parse le payload                               │
│  3. Affiche la notification système                             │
│  4. Gère le clic (notificationclick)                            │
│  5. Focus ou ouvre l'application                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Support iOS

### Détection PWA iOS

```typescript
function isIOSPWA(): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = (window.navigator as any).standalone === true;
  const isDisplayModeStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  return isIOS && (isStandalone || isDisplayModeStandalone);
}

function getIOSVersion(): number | null {
  const match = navigator.userAgent.match(/OS (\d+)_/);
  return match ? parseInt(match[1], 10) : null;
}

function canUseWebPushOnIOS(): boolean {
  const iosVersion = getIOSVersion();
  return isIOSPWA() && iosVersion !== null && iosVersion >= 16.4;
}
```

### Instructions Utilisateur iOS

```tsx
function IOSPWAInstructions() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isPWA = isIOSPWA();
  const iosVersion = getIOSVersion();
  
  if (!isIOS) return null;
  
  if (!isPWA) {
    return (
      <Alert>
        <AlertTitle>Installation requise</AlertTitle>
        <AlertDescription>
          Pour recevoir les notifications sur iOS :
          <ol className="list-decimal ml-4 mt-2">
            <li>Appuyez sur le bouton Partager (📤)</li>
            <li>Sélectionnez "Sur l'écran d'accueil"</li>
            <li>Confirmez en appuyant sur "Ajouter"</li>
            <li>Ouvrez l'application depuis l'écran d'accueil</li>
          </ol>
        </AlertDescription>
      </Alert>
    );
  }
  
  if (iosVersion && iosVersion < 16.4) {
    return (
      <Alert variant="destructive">
        <AlertTitle>iOS {iosVersion} non supporté</AlertTitle>
        <AlertDescription>
          Les notifications push nécessitent iOS 16.4 ou supérieur.
          Veuillez mettre à jour votre appareil.
        </AlertDescription>
      </Alert>
    );
  }
  
  return null;
}
```

---

## Schéma de Données

### `push_subscriptions`

Abonnements push des utilisateurs.

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  
  -- Web Push Subscription
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,    -- Client public key
  auth TEXT NOT NULL,       -- Auth secret
  
  -- Métadonnées
  device_type TEXT,         -- 'desktop', 'android', 'ios_pwa'
  device_name TEXT,
  user_agent TEXT,
  
  -- Préférences
  enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  
  CONSTRAINT unique_user_endpoint UNIQUE(user_id, endpoint)
);

-- Index pour lookup rapide
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_subscriptions_enabled ON push_subscriptions(enabled);
```

### `notification_preferences`

Préférences par type de notification.

```sql
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  
  -- Types de notifications
  email_notifications BOOLEAN DEFAULT true,
  task_notifications BOOLEAN DEFAULT true,
  ai_suggestions BOOLEAN DEFAULT true,
  calendar_reminders BOOLEAN DEFAULT true,
  support_tickets BOOLEAN DEFAULT true,
  treasury_alerts BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Déclencheurs

### 1. Nouveaux Emails

```typescript
// Dans sync-emails
if (newEmailsCount > 0 && account.user_id) {
  await supabase.functions.invoke('send-push-notification', {
    body: {
      userId: account.user_id,
      type: 'email',
      title: `${newEmailsCount} nouveau(x) email(s)`,
      body: `De: ${lastEmail.from_name || lastEmail.from_address}`,
      url: `/emails?thread=${lastThreadId}`
    }
  });
}
```

### 2. Tâches Assignées

```sql
-- Trigger SQL
CREATE OR REPLACE FUNCTION notify_task_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.responsable_id IS NOT NULL 
     AND (OLD.responsable_id IS NULL OR OLD.responsable_id != NEW.responsable_id) 
  THEN
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-push-notification',
      body := jsonb_build_object(
        'userId', NEW.responsable_id,
        'type', 'task',
        'title', 'Nouvelle tâche assignée',
        'body', NEW.titre,
        'url', '/etablissements/' || NEW.etablissement_id || '?task=' || NEW.id
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_task_assignment
AFTER INSERT OR UPDATE ON taches
FOR EACH ROW
EXECUTE FUNCTION notify_task_assignment();
```

### 3. Tickets Support

```typescript
// Dans create-support-ticket
await supabase.functions.invoke('send-push-notification', {
  body: {
    type: 'support_ticket',
    title: 'Nouveau ticket support',
    body: ticket.titre,
    url: `/support?ticket=${ticket.id}`,
    // Envoyer à tous les admins/support
    roleFilter: ['admin', 'support']
  }
});
```

### 4. Suggestions IA

```typescript
// Dans generate-ai-suggestions
if (suggestions.length > 0) {
  await supabase.functions.invoke('send-push-notification', {
    body: {
      userId: etablissement.csm_id,
      type: 'ai_suggestion',
      title: 'Nouvelles suggestions IA',
      body: `${suggestions.length} actions suggérées pour ${etablissement.nom}`,
      url: `/etablissements/${etablissement.id}?tab=suggestions`
    }
  });
}
```

### 5. Invitations Calendrier

```typescript
// Dans detect-calendar-invitations
if (invitation) {
  await supabase.functions.invoke('send-push-notification', {
    body: {
      userId: thread.user_email_account.user_id,
      type: 'calendar',
      title: 'Invitation calendrier',
      body: invitation.summary,
      url: `/emails?thread=${thread.id}`
    }
  });
}
```

---

## Composants React

### `usePushNotifications`

Hook principal pour la gestion des notifications.

```typescript
interface UsePushNotificationsReturn {
  isSupported: boolean;
  isSubscribed: boolean;
  isLoading: boolean;
  permission: NotificationPermission;
  
  // iOS specific
  isIOS: boolean;
  isIOSPWA: boolean;
  canUseWebPush: boolean;
  
  // Actions
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  sendTestNotification: () => Promise<void>;
}

function usePushNotifications(): UsePushNotificationsReturn {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const subscribe = async () => {
    const registration = await navigator.serviceWorker.ready;
    
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
    
    // Enregistrer en base
    await supabase.from('push_subscriptions').insert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
      auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
      device_type: detectDeviceType()
    });
    
    setIsSubscribed(true);
  };
  
  // ...
}
```

### `PushPreferencesPanel`

Interface de gestion des préférences.

```tsx
function PushPreferencesPanel() {
  const push = usePushNotifications();
  const { preferences, updatePreference } = useNotificationPreferences();
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications Push</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Instructions iOS si nécessaire */}
        <IOSPWAInstructions />
        
        {/* Activation globale */}
        <div className="flex items-center justify-between">
          <Label>Activer les notifications</Label>
          <Switch
            checked={push.isSubscribed}
            onCheckedChange={push.isSubscribed ? push.unsubscribe : push.subscribe}
            disabled={!push.isSupported || !push.canUseWebPush}
          />
        </div>
        
        {/* Préférences par type */}
        {push.isSubscribed && (
          <div className="space-y-4">
            <PreferenceToggle
              label="Nouveaux emails"
              checked={preferences.email_notifications}
              onChange={(v) => updatePreference('email_notifications', v)}
            />
            <PreferenceToggle
              label="Tâches assignées"
              checked={preferences.task_notifications}
              onChange={(v) => updatePreference('task_notifications', v)}
            />
            {/* ... autres préférences */}
          </div>
        )}
        
        {/* Bouton test */}
        {push.isSubscribed && (
          <Button onClick={push.sendTestNotification}>
            Tester les notifications
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## Edge Functions

### `send-push-notification`

Envoi de notifications push.

```typescript
// supabase/functions/send-push-notification/index.ts

serve(async (req) => {
  const { userId, roleFilter, type, title, body, url } = await req.json();
  
  // 1. Récupérer les subscriptions
  let query = supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, keys, device_type, enabled')
    .eq('enabled', true);
  
  if (userId) {
    query = query.eq('user_id', userId);
  } else if (roleFilter) {
    // Récupérer users avec ces rôles
    const { data: users } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', roleFilter);
    
    query = query.in('user_id', users.map(u => u.user_id));
  }
  
  const { data: subscriptions } = await query;
  
  // 2. Vérifier préférences
  const filteredSubs = await filterByPreferences(subscriptions, type);
  
  // 3. Envoyer à chaque subscription
  const results = await Promise.allSettled(
    filteredSubs.map(sub => sendWebPush(sub, { title, body, url, type }))
  );
  
  // 4. Nettoyer subscriptions expirées
  const expiredIds = results
    .filter((r, i) => r.status === 'rejected' && r.reason?.status === 410)
    .map((_, i) => filteredSubs[i].id);
  
  if (expiredIds.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', expiredIds);
  }
  
  return new Response(JSON.stringify({
    success: true,
    sent: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
    expired: expiredIds.length
  }));
});

// Envoi Web Push avec chiffrement VAPID
async function sendWebPush(subscription: Subscription, payload: Payload) {
  const vapidHeaders = await generateVAPIDHeaders(subscription.endpoint);
  const encryptedPayload = await encryptPayload(
    JSON.stringify(payload),
    subscription.p256dh,
    subscription.auth
  );
  
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      ...vapidHeaders,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400'
    },
    body: encryptedPayload
  });
  
  if (!response.ok) {
    throw { status: response.status, message: await response.text() };
  }
  
  return true;
}
```

### `test-push-notification`

Test de notification.

```typescript
// supabase/functions/test-push-notification/index.ts

serve(async (req) => {
  // Authentification requise
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(
    authHeader?.replace('Bearer ', '')
  );
  
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  
  // Envoyer notification de test
  const { data, error } = await supabase.functions.invoke('send-push-notification', {
    body: {
      userId: user.id,
      type: 'test',
      title: '🔔 Test de notification',
      body: 'Si vous voyez ceci, les notifications fonctionnent !',
      url: '/parametres'
    }
  });
  
  return new Response(JSON.stringify({ success: true }));
});
```

---

## Service Worker

### Configuration PWA

```typescript
// public/sw.js

self.addEventListener('push', function(event) {
  if (!event.data) return;
  
  const payload = event.data.json();
  
  const options = {
    body: payload.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: payload.url,
      type: payload.type
    },
    actions: [
      { action: 'open', title: 'Ouvrir' },
      { action: 'dismiss', title: 'Ignorer' }
    ],
    tag: payload.type,  // Groupe les notifications du même type
    renotify: true
  };
  
  event.waitUntil(
    self.registration.showNotification(payload.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  if (event.action === 'dismiss') return;
  
  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Focus fenêtre existante si possible
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            client.navigate(url);
            return;
          }
        }
        // Sinon ouvrir nouvelle fenêtre
        return clients.openWindow(url);
      })
  );
});
```

---

## Troubleshooting

### Problèmes Courants

#### Notifications non reçues

1. Vérifier la permission du navigateur
2. Vérifier que le Service Worker est actif
3. Vérifier les préférences utilisateur
4. Vérifier les logs Edge Function

#### Erreur 410 Gone

La subscription a expiré. Le système la supprime automatiquement.

#### iOS ne reçoit pas

- Vérifier que l'app est installée en PWA
- Vérifier iOS ≥ 16.4
- Réinstaller l'app depuis Safari

---

*Guide mis à jour le 07/12/2025*
