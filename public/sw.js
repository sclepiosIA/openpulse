// OpenPulse — Service Worker push handler (v3)
// Rôle: recevoir les notifications Web Push et gérer les clics.
// NE FAIT PAS d'app-shell caching (celui de Workbox a été supprimé) —
// mais nettoie les vieux caches Workbox résiduels à l'activation.

const SW_VERSION = 'marque-push-v3';

function isLegacyWorkboxCache(name) {
  return (
    /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name) ||
    /^(html-cache|static-resources|supabase-rest|supabase-api-cache|images-cache|styles-cache|scripts-cache|fonts-cache)/.test(name)
  );
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const cacheNames = await caches.keys();
      const legacy = cacheNames.filter(isLegacyWorkboxCache);
      await Promise.allSettled(legacy.map((n) => caches.delete(n)));
    } catch {
      /* non bloquant */
    }
    await self.clients.claim();
  })());
});

// ============= Push =============
self.addEventListener('push', (event) => {
  let notif = {
    title: 'OpenPulse',
    body: 'Vous avez une nouvelle notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: 'default',
    url: '/',
    type: 'unknown',
    related_id: null,
    requireInteraction: false,
    actions: [],
    timestamp: Date.now(),
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notif = { ...notif, ...data, tag: data.tag || data.type || notif.tag };
    } catch {
      try {
        const parsed = JSON.parse(event.data.text());
        notif = { ...notif, ...parsed, tag: parsed.tag || parsed.type || notif.tag };
      } catch {
        /* keep fallback */
      }
    }
  }

  // Actions par défaut pour les emails
  const actions = Array.isArray(notif.actions) && notif.actions.length > 0
    ? notif.actions
    : (notif.type === 'email'
        ? [
            { action: 'open', title: '📂 Ouvrir' },
            { action: 'mark-read', title: '✓ Marquer lu' },
          ]
        : []);

  const options = {
    body: notif.body,
    icon: notif.icon,
    badge: notif.badge,
    tag: notif.tag,
    renotify: true,
    requireInteraction: !!notif.requireInteraction || notif.type === 'email',
    actions,
    data: {
      url: notif.url,
      type: notif.type,
      related_id: notif.related_id,
      timestamp: notif.timestamp,
    },
  };

  event.waitUntil((async () => {
    try {
      await self.registration.showNotification(notif.title, options);
      if ('setAppBadge' in self.navigator) {
        try {
          const list = await self.registration.getNotifications();
          await self.navigator.setAppBadge(list.length);
        } catch { /* badge non critique */ }
      }
    } catch {
      /* showNotification error */
    }
  })());
});

// ============= Notification click =============
const DESKTOP_TO_MOBILE = {
  '/emails': '/m/mail',
  '/pulse': '/m/pulse',
  '/todos': '/m/todos',
  '/calendrier': '/m/calendrier',
};

function rewriteForMobile(url) {
  for (const [desk, mob] of Object.entries(DESKTOP_TO_MOBILE)) {
    if (url.startsWith(desk)) return mob + url.slice(desk.length);
  }
  return url;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if ('clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  const data = event.notification.data || {};
  const action = event.action;
  const url = data.url || '/';

  if (action === 'mark-read' && data.type === 'email' && data.related_id) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        for (const client of clients) {
          client.postMessage({ type: 'MARK_EMAIL_READ', threadId: data.related_id });
        }
      })
    );
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url && 'focus' in client) {
          const finalUrl = client.url.includes('/m/') ? rewriteForMobile(url) : url;
          client.postMessage({ type: 'NAVIGATE_TO', url: finalUrl });
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// ============= Maintenance messages =============
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'GET_VERSION') {
    event.source && event.source.postMessage && event.source.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
  }
  if (data.type === 'CLEAR_ALL_CACHES') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of clientsArr) c.postMessage({ type: 'CACHES_CLEARED' });
    })());
  }
});
