# Stack Monitoring - OpenPulse

> **Version**: 1.9.0 | **Dernière mise à jour**: Mars 2026

## Vue d'ensemble

OpenPulse utilise une stack de monitoring basée sur **OpenTelemetry** et **Sentry** pour le suivi des performances, erreurs et métriques applicatives.

---

## Architecture Monitoring

```
┌─────────────────────────────────────────────────────────────┐
│                     MONITORING STACK                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │  Frontend     │───▶│  Sentry      │    │  Supabase     │  │
│  │  (React)      │    │  (Erreurs)   │    │  Analytics    │  │
│  └──────────────┘    └──────────────┘    └───────────────┘  │
│         │                                                     │
│         ▼                                                     │
│  ┌──────────────┐    ┌──────────────┐                       │
│  │ OpenTelemetry │───▶│  Collector   │                       │
│  │  Adapter      │    │  (Events)    │                       │
│  └──────────────┘    └──────────────┘                       │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Composants

### 1. Sentry (Erreurs Frontend)

Configuration dans `src/lib/monitoring.ts` :

```typescript
import { monitoring } from '@/lib/monitoring';

// Initialisation au démarrage de l'app
monitoring.init();

// Capture d'erreur manuelle
monitoring.captureException(error);

// Breadcrumbs pour le contexte
monitoring.addBreadcrumb({
  message: 'Action utilisateur',
  category: 'user',
  level: 'info'
});
```

**Variables d'environnement** :
```env
VITE_SENTRY_DSN=https://your-dsn@sentry.io/project-id
VITE_APP_ENV=production
```

### 2. OpenTelemetry (Télémétrie)

Configuration dans `src/lib/opentelemetry.ts` :

```typescript
import { OpenTelemetryAdapter } from '@/lib/opentelemetry';

const telemetry = new OpenTelemetryAdapter({
  endpoint: 'https://your-collector/v1/traces',
  serviceName: 'marque-ia',
  environment: 'production'
});

// Enregistrer une exception
telemetry.recordException(error, { context: 'email-sync' });

// Enregistrer un événement métier
telemetry.recordEvent('email_classified', { category: 'Commercial' });
```

### 3. Web Vitals (Performance)

Suivi automatique des Core Web Vitals :

| Métrique | Seuil | Description |
|----------|-------|-------------|
| **LCP** | < 2.5s | Largest Contentful Paint |
| **FID** | < 100ms | First Input Delay |
| **CLS** | < 0.1 | Cumulative Layout Shift |
| **TTFB** | < 800ms | Time to First Byte |

### 4. Supabase Analytics

Logs accessibles via le Dashboard Supabase :
- **Database Logs** : Requêtes PostgreSQL
- **Auth Logs** : Événements d'authentification
- **Edge Function Logs** : Exécutions et erreurs des fonctions

---

## Stack Docker (Self-Hosted)

Pour les déploiements on-premise, une stack monitoring complète est disponible :

```bash
# Démarrer la stack monitoring locale
docker-compose -f docker-compose.monitoring.yml up -d

# Services disponibles :
# - Grafana Tempo (Tracing) : http://localhost:3200
# - Prometheus (Métriques) : http://localhost:9090
# - Grafana Loki (Logs) : http://localhost:3100
# - OpenTelemetry Collector : http://localhost:4317
```

### Configuration du Collector

Fichier `config/otel-collector-config.yaml` :

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

exporters:
  otlp/tempo:
    endpoint: tempo:4317
    tls:
      insecure: true
  prometheus:
    endpoint: "0.0.0.0:8889"
  loki:
    endpoint: http://loki:3100/loki/api/v1/push

service:
  pipelines:
    traces:
      receivers: [otlp]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      exporters: [prometheus]
    logs:
      receivers: [otlp]
      exporters: [loki]
```

---

## Bonnes Pratiques

### Logging

```typescript
import { debug } from '@/lib/debug';

// ✅ Utiliser debug.log (filtré en production)
debug.log('📧 Email synchronisé', { count: 15 });

// ✅ Masquer les identifiants sensibles
debug.log('User:', debug.maskId(userId));

// ❌ Ne PAS utiliser console.log directement
console.log('debug info'); // Fuite en production
```

### Requêtes Supabase

```typescript
// ✅ Colonnes explicites (performance)
const { data } = await supabase
  .from('etablissements')
  .select('id, nom, statut, ville')
  .limit(50);

// ❌ Ne PAS utiliser select('*')
const { data } = await supabase
  .from('etablissements')
  .select('*'); // Surcharge inutile
```

---

## Alertes

### Alertes Configurées

| Alerte | Seuil | Action |
|--------|-------|--------|
| Taux d'erreur frontend | > 5% | Notification Slack |
| Temps de réponse API | > 3s | Log warning |
| Edge Function timeout | > 60s | Log error + retry |
| Espace disque DB | > 80% | Notification email |

---

## Ressources

- [Sentry Documentation](https://docs.sentry.io/)
- [OpenTelemetry JS](https://opentelemetry.io/docs/instrumentation/js/)
- [Supabase Logs](https://supabase.com/docs/guides/platform/logs)
- [Web Vitals](https://web.dev/vitals/)

---

*Documentation maintenue par l'équipe OpenPulse — Mars 2026 | Version 1.9.0*
