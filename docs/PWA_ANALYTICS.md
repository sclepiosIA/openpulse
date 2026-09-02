# PWA Analytics & Performance Mobile - Configuration

## 🚀 Tracking mobile PWA avec Plausible Analytics Self-hosted

### Configuration Analytics PWA

#### 1. Variables d'environnement

```env
# Plausible Analytics Self-hosted
VITE_PLAUSIBLE_DOMAIN=marque-manager.com
VITE_PLAUSIBLE_API_HOST=https://analytics.votre-domaine.com

# Matomo Self-hosted (alternative)
VITE_MATOMO_SITE_ID=1
VITE_MATOMO_TRACKER_URL=https://matomo.votre-domaine.com
```

#### 2. Déploiement Plausible Self-hosted

```yaml
# docker-compose.plausible.yml
version: '3.8'
services:
  plausible_db:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: plausible
      POSTGRES_USER: plausible
      POSTGRES_PASSWORD: your-secure-password
    volumes:
      - plausible-db:/var/lib/postgresql/data

  plausible_events_db:
    image: clickhouse/clickhouse-server:22.6-alpine
    volumes:
      - plausible-events:/var/lib/clickhouse

  plausible:
    image: plausible/analytics:latest
    depends_on:
      - plausible_db
      - plausible_events_db
    environment:
      BASE_URL: https://analytics.votre-domaine.com
      SECRET_KEY_BASE: your-secret-key-here
      DATABASE_URL: postgres://plausible:your-secure-password@plausible_db:5432/plausible
      CLICKHOUSE_DATABASE_URL: http://plausible_events_db:8123/plausible_events_db
    ports:
      - "8000:8000"
```

#### 3. Fonctionnalités de tracking mobile

✅ **Événements PWA trackés automatiquement :**
- Installation PWA
- Passage en mode hors-ligne/en-ligne
- Changements de type de connexion (3G, 4G, WiFi)
- Performances Core Web Vitals mobiles
- Erreurs JavaScript spécifiques mobile
- Visibilité de l'application (app switching)
- Mises à jour du Service Worker

✅ **Métriques de performance mobile :**
- Temps de chargement sur mobile
- Métriques réseau (downlink, effectiveType)
- Détection de plateforme (iOS, Android)
- Résolution d'écran et pixel ratio
- Mode standalone vs navigateur

### 4. Usage dans l'application

```typescript
import { pwaAnalytics } from '@/lib/pwa-analytics'

// Tracking d'événements personnalisés
pwaAnalytics.trackEvent('user_action', { 
  action: 'form_submit',
  form_type: 'etablissement' 
})

// Tracking des erreurs
pwaAnalytics.trackPWAError(error, { context: 'user_workflow' })

// Tracking d'installation PWA
pwaAnalytics.trackPWAInstall()
```

## 📊 Analytics hors réseau hospitalier

### Fonctionnement offline-first

✅ **Queue d'événements** : Les événements sont mis en queue si hors-ligne  
✅ **Synchronisation automatique** : Envoi automatique lors du retour en ligne  
✅ **Persistance locale** : Stockage localStorage avec fallback  
✅ **Détection réseau** : Monitoring continu de l'état de connexion  

### Métriques spécifiques hors réseau

- **Temps passé hors-ligne** par session
- **Actions effectuées en mode offline**
- **Taux de synchronisation** après reconnexion
- **Erreurs de synchronisation**
- **Usage des fonctionnalités offline**

## 🎯 Dashboards Analytics

### Dashboard PWA Performance
- Core Web Vitals par plateforme mobile
- Temps de chargement par type de connexion
- Taux d'installation PWA
- Erreurs JavaScript mobiles

### Dashboard Usage Mobile
- Répartition iOS vs Android
- Sessions en mode standalone
- Fonctionnalités utilisées hors-ligne
- Géolocalisation des utilisateurs nomades

## 🔒 Conformité RGPD

✅ **Données anonymisées** - Pas d'IP tracking  
✅ **Hébergement interne** - Serveurs européens  
✅ **Pas de cookies tiers** - Analytics first-party  
✅ **Contrôle total** - Données jamais partagées  

## 🚀 Installation en 5 minutes

```bash
# 1. Déployer Plausible
docker-compose -f docker-compose.plausible.yml up -d

# 2. Configurer les variables d'environnement
echo "VITE_PLAUSIBLE_DOMAIN=marque-manager.com" >> .env
echo "VITE_PLAUSIBLE_API_HOST=https://analytics.votre-domaine.com" >> .env

# 3. Build et déployer l'app
npm run build
```

L'analytics PWA est maintenant entièrement auto-hébergé et conforme RGPD ! 🎉